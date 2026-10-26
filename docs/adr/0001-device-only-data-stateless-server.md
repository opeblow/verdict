# 0001. Personal data lives only on the device; the server is a stateless proxy

Status: Accepted

## Context

Verdict handles face photos and skin scores over weeks. A server-side database would make accounts, sync and analytics easy, but it would also make Verdict a store of sensitive personal data, with the breach risk, retention duties and consent burden that brings. The YouCam API key must still stay secret, so the browser cannot call YouCam directly.

## Decision

- Trials, photos, scores and detection masks are stored in the browser's IndexedDB.
- The Next.js server is a stateless proxy. It validates input, holds the YouCam key, applies rate limits, and forwards requests. It has no database and does not log request bodies.
- Users can export, import and erase their data from **Your data**.

## Consequences

- A compromised server reveals no user data, because it holds none.
- There are no accounts, sign-up or password resets to build or secure.
- Data does not follow the user between devices. Export and import cover this.
- Clearing site data deletes trials. The privacy page says so.
- Rate limits are per server instance, since there is no shared store. This is documented in [SECURITY.md](../../SECURITY.md).

## Enforced by

- [`src/lib/client/db.ts`](../../src/lib/client/db.ts): the only persistence layer.
- [`src/lib/server/`](../../src/lib/server): the only code that reads the key. [`AGENTS.md`](../../AGENTS.md) forbids importing it from client files.
- [`tests/unit/youcam.test.ts`](../../tests/unit/youcam.test.ts): the presigned upload is sent without the key.
- [`next.config.ts`](../../next.config.ts): the Content Security Policy lets the browser talk only to Verdict's own origin.
