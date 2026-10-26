# 0008. Browser tests mock YouCam and never spend API units

Status: Accepted

## Context

YouCam API units are limited and cost money. Browser tests run on every push and pull request. A suite that called the live API would drain units, fail when they ran out, and need the secret key in CI.

The live integration still needs checking, so it gets a separate, deliberate path.

## Decision

- The Playwright suite in `tests/e2e` answers `/api/analyze`, `/api/analyze/{id}` and `/api/mask` inside the browser, with responses in the shapes the real routes return after normalisation.
- The test server starts with a placeholder key (see `playwright.config.ts`), so even a stray request cannot spend units, including on a machine whose `.env.local` holds a real key.
- Request-level tests of the route handlers (`api-guards.spec.ts`) cover only inputs that are rejected before any YouCam call.
- Test photos are drawn in the browser. No real person's photo is committed or uploaded.
- The live API is checked on demand with `npm run smoke:youcam`, which costs one analysis.

## Consequences

- The suite is free, fast and safe to run anywhere, including on forks.
- A change in YouCam's live response format would not be caught by the browser suite. The unit fixtures follow the official OpenAPI shapes and the live error format, and the smoke test checks the real API before a demo.

## Enforced by

- [`playwright.config.ts`](../../playwright.config.ts)
- [`tests/e2e/support/youcam-mock.ts`](../../tests/e2e/support/youcam-mock.ts)
- [`tests/e2e/support/photos.ts`](../../tests/e2e/support/photos.ts)
- [`scripts/youcam-smoke.mjs`](../../scripts/youcam-smoke.mjs)
