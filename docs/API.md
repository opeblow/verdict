# HTTP API

Verdict's own routes, used by the browser. All of them are in [`src/app/api`](../src/app/api). Inputs are validated before any upstream call.

Every error has the same shape:

```json
{ "error": { "code": "unsupported_type", "message": "Use a JPG or PNG photo." } }
```

## Routes

| Method and path | Purpose | Input | Returns |
|---|---|---|---|
| `GET /api/health` | Is the server ready to analyse? | | `{ ok, youcamConfigured, accessCodeRequired, skinVersion }` |
| `POST /api/analyze` | Start a skin analysis | Multipart: `image` (JPEG or PNG, at most 10 MB), `mode` (`hd` or `sd`), `concerns` (JSON array), `width`, `height` | `{ taskId }` |
| `GET /api/analyze/{taskId}` | Poll a task | | `{ status: "running" }`, `{ status: "success", analysis }`, or `{ status: "error", code, message, retake }` |
| `DELETE /api/analyze/{taskId}` | Delete the photo and results from YouCam | | `204 No Content` |
| `GET /api/mask?u={url}` | Copy a YouCam result image to the device | A YouCam result URL (allow-listed hosts only) | The image |
| `GET /api/products?q={text}` | Search products | 2 to 80 characters | `{ products }` |
| `GET /api/products?barcode={digits}` | Look up a barcode | 6 to 14 digits | `{ products }` |

If `ACCESS_CODE` is set, analysis and mask requests must carry it in the `x-access-code` header.

## Error codes

| Status | Code | When |
|---|---|---|
| 400 | `bad_request` | Missing or malformed input, unknown concern, invalid task id, or a mask URL that is not a YouCam result host |
| 401 | `access_code_required` | `ACCESS_CODE` is set and the request does not carry it |
| 402 | `out_of_units` | The YouCam account has no units left |
| 410 | `task_expired` | The task was deleted or is older than YouCam's 24-hour retention |
| 413 | `too_large` | Photo over 10 MB |
| 415 | `unsupported_type` | Not a JPEG or PNG |
| 422 | `error_below_min_image_size` | Short side below 480 px (SD) or 1080 px (HD) |
| 429 | `rate_limited` | Per-visitor hourly limit reached |
| 429 | `daily_cap` | The server instance's daily analysis cap is reached |
| 429 | `upstream_busy` | YouCam asked Verdict to slow down; includes `retryAfter` |
| 500 | `internal` | An unexpected failure talking to YouCam |
| 502 | `upstream_auth` | YouCam rejected the server's API key |
| 502 | `upstream_error` | YouCam or Open Beauty Facts failed |
| 503 | `not_configured` | The server has no YouCam API key |

YouCam engine errors such as a face that is too small or a photo that is too dark arrive in a successful poll as `{ status: "error", code, message, retake: true }`, with `message` already turned into a plain instruction ([`errors.ts`](../src/lib/youcam/errors.ts)).

## Normalised analysis

```ts
interface NormalizedAnalysis {
  readings: {
    key: string;      // metric key, such as "pore" or "pore:nose"
    concern: string;  // Verdict concern id
    region: string;   // "whole" or an HD region
    raw: number;      // raw_score, 1 to 100, used for every calculation
    ui?: number;      // ui_score, display only
    maskUrl?: string; // YouCam result link, expires in about two hours
  }[];
  overall?: number;
  skinAge?: number;
  skinType?: Record<string, string>;
  resizedImageUrl?: string; // the image YouCam analysed; masks align to it
}
```

The exact types are `NormalizedAnalysis` in [`src/lib/youcam/normalize.ts`](../src/lib/youcam/normalize.ts) and `MetricReading` in [`src/lib/domain/model.ts`](../src/lib/domain/model.ts).
