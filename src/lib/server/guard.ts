import { NextResponse } from "next/server";
import { readEnv, type ServerEnv } from "./env";
import { SlidingWindowLimiter, clientKey } from "./rateLimit";
import { YouCamClient } from "./youcam";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let env: ServerEnv | null = null;
let perVisitor: SlidingWindowLimiter | null = null;
let perPoll: SlidingWindowLimiter | null = null;
let daily: SlidingWindowLimiter | null = null;

export function serverEnv(): ServerEnv {
  if (!env) env = readEnv();
  return env;
}

function limiters() {
  const e = serverEnv();
  perVisitor ??= new SlidingWindowLimiter(e.ratePerHour, HOUR);
  // Polling is cheap but still counts against YouCam's 5 requests per second.
  perPoll ??= new SlidingWindowLimiter(120, 60_000);
  daily ??= new SlidingWindowLimiter(e.dailyCap, DAY);
  return { perVisitor, perPoll, daily };
}

export function jsonError(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Constant-time string comparison, so the access code cannot be guessed by timing. */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function checkAccess(req: Request): NextResponse | null {
  const code = serverEnv().accessCode;
  if (!code) return null;
  const given = req.headers.get("x-access-code") ?? "";
  if (!safeEqual(given, code)) {
    return jsonError(401, "access_code_required", "This demo needs an access code. It's in the project's testing instructions.");
  }
  return null;
}

export function youcamOrError(): YouCamClient | NextResponse {
  const e = serverEnv();
  if (!e.youcamApiKey) {
    return jsonError(503, "not_configured", "The server has no YouCam API key. See docs/SETUP.md.");
  }
  return new YouCamClient({ apiKey: e.youcamApiKey, baseUrl: e.youcamBaseUrl, skinVersion: e.skinVersion });
}

export function limitAnalysis(req: Request): NextResponse | null {
  const { perVisitor, daily } = limiters();
  const visitor = perVisitor.take(clientKey(req.headers));
  if (!visitor.ok) {
    return jsonError(429, "rate_limited", `You've hit the hourly limit for this demo. Try again in ${Math.ceil(visitor.retryAfter / 60)} minutes.`, {
      retryAfter: visitor.retryAfter,
    });
  }
  const global = daily.take("global");
  if (!global.ok) return jsonError(429, "daily_cap", "This demo has used its analyses for today. Try again tomorrow.");
  return null;
}

export function limitPoll(req: Request): NextResponse | null {
  const r = limiters().perPoll.take(clientKey(req.headers));
  return r.ok ? null : jsonError(429, "rate_limited", "Polling too fast.", { retryAfter: r.retryAfter });
}

/** Hosts YouCam serves results from. The mask proxy refuses anything else, which prevents SSRF. */
const RESULT_HOST_PATTERNS: readonly RegExp[] = [
  /^yce-[a-z0-9-]+\.s3[a-z0-9.-]*\.amazonaws\.com$/,
  /^s3[a-z0-9.-]*\.amazonaws\.com$/,
  /^[a-z0-9-]+\.makeupar\.com$/,
  /^[a-z0-9-]+\.perfectcorp\.com$/,
  /^[a-z0-9]+\.cloudfront\.net$/,
];

export function isAllowedResultUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  const host = u.hostname.toLowerCase();
  if (!RESULT_HOST_PATTERNS.some((p) => p.test(host))) return false;
  // Path-style S3 URLs must point at a YouCam bucket.
  if (/^s3[a-z0-9.-]*\.amazonaws\.com$/.test(host) && !/^\/yce-/.test(u.pathname)) return false;
  return true;
}
