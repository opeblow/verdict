# Security

## Reporting a vulnerability

Please report security problems privately through **GitHub Security Advisories** ("Report a vulnerability" on the repository's Security tab). Do not open a public issue.

Include what you found, how to reproduce it, and the impact you expect. You will get an acknowledgement within three working days and a plan within ten. Credit is given in the fix's release notes unless you prefer otherwise.

## Supported versions

Only the latest commit on `main` and the current deployment are supported.

## Threat model

Verdict processes face photos, which are sensitive personal data. The design goal is that a compromise of the server reveals no user data, because the server holds none.

| Asset | Where it lives | Protection |
|---|---|---|
| Face photos, scores, masks | User's browser (IndexedDB) | Same-origin policy; never stored server-side; user can export or erase |
| Photo in transit | Browser to Verdict server to YouCam | HTTPS only; HSTS in production |
| Photo at YouCam | YouCam storage, up to 24 hours | Task deleted through `/s2s/v2.0/task/delete` once results are saved on the device |
| YouCam API key | Server environment | Read only in `src/lib/server`; never sent to the browser; not logged |
| API units | YouCam account | Optional access code, per-visitor hourly limit, per-instance daily cap |

### Controls

- **Content Security Policy.** The browser may only connect to Verdict's own origin. Scripts are same-origin. No third-party scripts, fonts or analytics. `frame-ancestors 'none'`. See [`next.config.ts`](next.config.ts).
- **Other headers.** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` allowing only the camera on the same origin, `Cross-Origin-Opener-Policy: same-origin`, HSTS.
- **SSRF protection.** The mask proxy only fetches HTTPS URLs on allow-listed YouCam result hosts, rejects credentials and non-standard ports, refuses redirects, checks the content type and caps the size. Covered by tests in [`tests/server.test.ts`](tests/server.test.ts).
- **Input validation.** Upload type (JPEG or PNG), size (10 MB), dimensions, mode and concern names are validated before any upstream call. Task IDs are pattern-checked.
- **Access code.** Compared in constant time.
- **Rate limits.** In-memory sliding windows per visitor and per instance.
- **Dependencies.** Dependabot for npm and GitHub Actions; CodeQL on every push and weekly.

### Known limitations

- **Rate limits are per server instance.** On serverless platforms each instance has its own window. For high-traffic public deployments, replace `SlidingWindowLimiter` with a shared store such as Redis or Upstash; the interface is one method.
- **The access code is a shared secret,** suited to a demo, not to per-user authentication.
- **Browser storage is not encrypted at rest** beyond what the operating system provides. Anyone with access to the unlocked device and browser profile can see the photos, as with the device's own photo gallery.
- **`'unsafe-inline'` scripts** are allowed because Next.js injects inline bootstrapping scripts. Moving to nonce-based CSP is planned.
