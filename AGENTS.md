# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this is

Verdict is a Next.js 16 app that runs a measured trial of a skincare product using YouCam AI Skin Analysis. Personal data lives only in the browser (IndexedDB). The server is a stateless proxy.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # lint + typecheck + unit tests. Must pass before any commit.
npm run build        # must pass before any commit that touches src/app
npm run test:e2e     # browser tests against the build. Must pass before any UI change is merged.
npm test -- tests/unit/verdict.test.ts   # one unit suite
```

## Map

| Path | Contents | Rules |
|---|---|---|
| `src/lib/domain/` | Concerns, ingredients, statistics, verdict rules | Pure functions only. No I/O, no React, no `Date.now()` without an injectable `now`. Every rule change needs a test. |
| `src/lib/youcam/` | Response normalisation and error mapping | Shared by server and tests. Tolerate missing fields. |
| `src/lib/server/` | YouCam client, env, guards, rate limits | Server only. Never import from a `"use client"` file. |
| `src/lib/client/` | IndexedDB, API calls, hooks, calendar export | Browser only. |
| `src/lib/capture/` | Light measurement (pure) and photo preparation (browser) | `quality.ts` stays pure and tested. |
| `src/app/api/` | Route handlers | Validate input with Zod or explicit checks. Return `{ error: { code, message } }` on failure. Route files may only export HTTP handlers and route config. |
| `src/components/` | UI | CSS Modules plus the tokens in `src/app/globals.css`. |
| `tests/unit/` | Vitest suites | Fixtures in `tests/fixtures/youcam.ts` follow the official OpenAPI shapes and the live error format. |
| `tests/e2e/` | Playwright suites, helpers in `support/` | Never call the live YouCam API. Use `mockYouCam` and `syntheticFace`. Never commit a real person's photo. |
| `docs/` | Method, architecture, YouCam integration, API, setup, testing | A decision that changes an invariant needs a new record in `docs/adr/`. |

## Invariants: do not break these

1. **Use `raw_score` for every calculation.** `ui_score` is adjusted upwards by YouCam and is display only.
2. **Never mix HD and SD** in one task or one trial. The trial's `mode` is fixed by its first photo.
3. **The YouCam key never reaches the browser.** Only `src/lib/server` reads it.
4. **The mask proxy only fetches allow-listed YouCam hosts** (`isAllowedResultUrl`). Do not loosen it without a test.
5. **No server-side persistence of photos or scores.** No database, no logging of request bodies.
6. **Cosmetic language only.** No medical claims. `tests/unit/copy-guard.test.ts` enforces this, and it also bans emoji in user-facing text.
7. **Redness is always measured** as the irritation monitor (`SAFETY_CONCERNS`).
8. **Change is only reported when it exceeds measured noise.** Do not add shortcuts that compare two single photos.

## Style

- TypeScript strict with `noUncheckedIndexedAccess`. No `any`.
- Comments explain why, not what.
- User-facing copy: short, plain, second person, no exclamation marks, no emoji.
- Design: warm paper, ink, hairline rules, one iodine accent (`--accent`), four state colours used only for status. No gradients, glass, glows or purple.
- Accessibility: every interactive element reachable by keyboard; charts have an `aria-label` summary; status changes use `aria-live`.

## YouCam API facts this code depends on

- Base URL `https://yce-api-01.makeupar.com`, `Authorization: Bearer <key>`.
- `POST /s2s/v2.0/file/skin-analysis` returns `data.files[0].file_id` and `requests[0].url` for a PUT.
- `POST /s2s/v2.0/task/skin-analysis` with `src_file_id`, `dst_actions`, `format: "json"` returns `data.task_id`.
- `GET /s2s/v2.0/task/skin-analysis/{id}` returns `data.task_status` of `running`, `success` or `error`; success has `data.results.output[]`.
- Live engine errors arrive as `"('message', 'error_code')"`.
- Units: 1-4 concerns 9 SD / 12 HD; 5-8 concerns 12 / 16; 9-12 14 / 20; 13-16 16 / 22.
- HD needs a short side of at least 1080 px; SD at least 480 px; face wider than 60% of the image.
- Results are kept 24 hours; result URLs expire in about two hours.

## Before you open a pull request

- `npm run check`, `npm run build` and `npm run test:e2e` pass.
- New behaviour has a test.
- If you changed the UI, run `npm run screenshots` and include before and after images.
