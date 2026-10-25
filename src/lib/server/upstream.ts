import { jsonError } from "./guard";
import { YouCamError } from "./youcam";

/** Map a YouCam client failure to a response the browser can act on. */
export function upstreamError(err: unknown) {
  if (err instanceof YouCamError) {
    if (err.status === 401) return jsonError(502, "upstream_auth", "The server's YouCam API key was rejected.");
    if (err.status === 429) return jsonError(429, "upstream_busy", "The analysis service is busy. Try again in a few seconds.", { retryAfter: 5 });
    if (err.code === "CreditInsufficiency") return jsonError(402, "out_of_units", "This server has run out of YouCam API units.");
    if (err.code === "InvalidTaskId") return jsonError(410, "task_expired", "This analysis has expired. Take the photo again.");
    return jsonError(502, "upstream_error", err.message);
  }
  console.error("YouCam request failed", err);
  return jsonError(500, "internal", "Something went wrong talking to the analysis service.");
}
