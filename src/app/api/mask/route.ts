import { NextResponse } from "next/server";
import { checkAccess, isAllowedResultUrl, jsonError } from "@/lib/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Fetch a YouCam result image (mask or resized photo) on behalf of the browser.
 * YouCam result links expire after about two hours and do not allow
 * cross-origin canvas use, so Verdict copies them to the device right away.
 * Only YouCam result hosts are allowed.
 */
export async function GET(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  const target = new URL(req.url).searchParams.get("u") ?? "";
  if (!isAllowedResultUrl(target)) return jsonError(400, "bad_request", "Not a YouCam result URL.");

  const upstream = await fetch(target, { cache: "no-store", redirect: "error" }).catch(() => null);
  if (!upstream || !upstream.ok) return jsonError(502, "upstream_error", "Couldn't fetch the result image.");
  const type = upstream.headers.get("content-type") ?? "application/octet-stream";
  if (!type.startsWith("image/") && type !== "application/octet-stream" && type !== "binary/octet-stream") {
    return jsonError(502, "upstream_error", "Unexpected result type.");
  }
  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return jsonError(502, "upstream_error", "Result image too large.");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": type.startsWith("image/") ? type : guessType(target),
      "Cache-Control": "private, no-store",
    },
  });
}

function guessType(url: string): string {
  return /\.png(\?|$)/i.test(url) ? "image/png" : "image/jpeg";
}
