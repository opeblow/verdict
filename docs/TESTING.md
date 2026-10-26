# Testing

Two suites, both run in CI on every push and pull request. Neither calls the live YouCam API or needs a key ([ADR 0008](adr/0008-browser-tests-mock-youcam.md)).

```bash
npm run check      # lint + strict typecheck + 108 unit tests
npm run build      # production build
npm run test:e2e   # 25 browser tests against the production build
```

The first browser run needs `npx playwright install chromium`.

## Unit tests (Vitest)

In [`tests/unit`](../tests/unit). They import the code directly and run in under two seconds.

| Suite | Covers |
|---|---|
| [`stats.test.ts`](../tests/unit/stats.test.ts) | Noise estimation, the cautious prior, trend lines and 95% intervals |
| [`verdict.test.ts`](../tests/unit/verdict.test.ts) | Every decision: wait, more data, keep, stop, don't rebuy, likely purging |
| [`youcam.test.ts`](../tests/unit/youcam.test.ts) | The client's call sequence, the key never sent with the upload, HD and SD normalisation, live error parsing |
| [`server.test.ts`](../tests/unit/server.test.ts) | SSRF allow-list, constant-time access code check, rate limits, environment parsing, product data mapping |
| [`domain.test.ts`](../tests/unit/domain.test.ts) | Concern planning by billing tier, ingredient detection, light measurement, calendar export |
| [`db.test.ts`](../tests/unit/db.test.ts) | Local storage recovers after a failed open instead of failing until reload |
| [`copy-guard.test.ts`](../tests/unit/copy-guard.test.ts) | Fails the build on medical claims or emoji in user-facing text |

YouCam responses in [`tests/fixtures/youcam.ts`](../tests/fixtures/youcam.ts) follow the official OpenAPI shapes and the live error format.

## Browser tests (Playwright)

In [`tests/e2e`](../tests/e2e). They start the production build with a placeholder YouCam key, answer the analysis routes inside the browser, and draw test faces on a canvas, so no real photo is used and no unit is spent.

| Spec | Covers |
|---|---|
| [`trial-journey.spec.ts`](../tests/e2e/trial-journey.spec.ts) | A full trial on desktop and phone: product, goals, two baselines, a check-in, the verdict page and photo log. Every photo is deleted from YouCam only after its results are saved. Trials survive a reload. |
| [`save-retry.spec.ts`](../tests/e2e/save-retry.spec.ts) | A failed local save shows a clear message and is retried without a second analysis |
| [`capture-quality.spec.ts`](../tests/e2e/capture-quality.spec.ts) | A photo that is too dark is blocked before any upload, on desktop and phone |
| [`api-guards.spec.ts`](../tests/e2e/api-guards.spec.ts) | The real route handlers reject bad types, undersized HD photos, unknown concerns, non-YouCam mask URLs and malformed task ids, and health reveals no secret |
| [`a11y.spec.ts`](../tests/e2e/a11y.spec.ts) | No WCAG 2.2 A or AA violations (axe) on six pages in light and dark themes, and the new-trial wizard can be completed by keyboard alone |

Shared helpers live in [`tests/e2e/support`](../tests/e2e/support): the YouCam mock, the synthetic face generator, and the wizard steps.

## Live check

The automated suites prove Verdict's own behaviour. To check the real API with your key before a demo:

```bash
npm run smoke:youcam -- path/to/selfie.jpg sd
```

This runs one real analysis (9 units in SD) and deletes the task afterwards.

## Adding tests

- A change to a rule in `src/lib/domain` needs a unit test that pins it.
- A new user-facing flow needs a browser test. Use `mockYouCam` and `syntheticFace` from `tests/e2e/support`.
- A UI change should keep `a11y.spec.ts` passing in both themes.
