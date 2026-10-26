import { NextResponse } from "next/server";
import { ERR, handleMcp } from "@/lib/mcp/protocol";
import { jsonError, limitPoll } from "@/lib/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 256 * 1024;

/**
 * Model Context Protocol endpoint (Streamable HTTP, stateless, JSON responses).
 * Exposes Verdict's engine as read-only tools. It never calls YouCam, so it
 * needs no access code and spends no units. Requests are rate limited.
 */
export async function POST(req: Request) {
  // Browsers send Origin; a page on another site must not drive this endpoint.
  const origin = req.headers.get("origin");
  if (origin && !sameHost(origin, req.url)) {
    return jsonError(403, "forbidden_origin", "Cross-origin requests are not allowed.");
  }
  const limited = limitPoll(req);
  if (limited) return limited;

  const text = await req.text();
  if (text.length > MAX_BYTES) return jsonError(413, "too_large", "Request body is too large.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: ERR.parse, message: "Parse error." } }, { status: 400 });
  }

  const reply = handleMcp(body);
  if (reply === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(reply, { headers: { "Cache-Control": "no-store" } });
}

function sameHost(origin: string, url: string): boolean {
  try {
    return new URL(origin).host === new URL(url).host;
  } catch {
    // "null" and other opaque origins are never the same site.
    return false;
  }
}

/** Stateless server: no server-to-client stream and no sessions to end. */
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
