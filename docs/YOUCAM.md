# YouCam API integration

Verdict uses **YouCam AI Skin Analysis** (Perfect Corp) as a measuring instrument across weeks, not as a one-off score. Every call is made from the server; the API key never reaches the browser.

## Call sequence

| Step | Endpoint | Code |
|---|---|---|
| Register upload | `POST /s2s/v2.0/file/skin-analysis` | [`src/lib/server/youcam.ts`](../src/lib/server/youcam.ts) |
| Upload bytes | `PUT` to the presigned URL, without the API key | same |
| Run analysis | `POST /s2s/v2.0/task/skin-analysis` with `src_file_id`, HD or SD `dst_actions`, `format: "json"` | same |
| Poll | `GET /s2s/v2.0/task/skin-analysis/{task_id}` until `success` or `error` | [`src/app/api/analyze/[taskId]/route.ts`](../src/app/api/analyze/[taskId]/route.ts) |
| Copy masks to the device | Result mask URLs through an allow-listed proxy | [`src/app/api/mask/route.ts`](../src/app/api/mask/route.ts) |
| Delete from YouCam | `POST /s2s/v2.0/task/delete`, after the results are saved on the device | [`src/components/capture/CaptureFlow.tsx`](../src/components/capture/CaptureFlow.tsx) |

The full sequence diagram is in [ARCHITECTURE.md](ARCHITECTURE.md#one-analysis-end-to-end).

## Concerns measured

Verdict tracks 12 YouCam concerns. Every score points the same way: higher means healthier looking.

| Group | Concerns |
|---|---|
| Blemishes and tone | acne, redness (always measured, as the irritation monitor), age spots, radiance |
| Texture | pores, texture, wrinkles, firmness |
| Hydration and oil | moisture, oiliness |
| Eye area | dark circles, eye bags |

In HD, pores and wrinkles also return regional scores (pores on the forehead, nose and cheeks; lines on the forehead, between the brows, at the crow's feet, around the eyes and along the nasolabial and marionette folds), which Verdict tracks as separate metrics.

## Decisions that keep the measurement honest

| Decision | Why | Record |
|---|---|---|
| `raw_score`, never `ui_score` | YouCam documents the UI score as adjusted upwards as a motivator | [ADR 0002](adr/0002-raw-score-not-ui-score.md) |
| One mode per trial | HD and SD are different models with incomparable scores | [ADR 0003](adr/0003-one-analysis-mode-per-trial.md) |
| Concern sets fill the billing tier | No paid capacity is wasted | [ADR 0007](adr/0007-concern-sets-fill-the-billing-tier.md) |
| Framed for the model | The API needs the face wider than 60% of the image. Photos are cropped to a centred 3:4 portrait with a face guide at 68% of the width, so laptops and phones frame the same way | [`image.ts`](../src/lib/capture/image.ts) |
| Live error format handled | The live API returns engine errors as `"('message', 'error_code')"`, not the bare code in the reference. Both forms are parsed and mapped to a plain instruction such as "Move closer" | [`errors.ts`](../src/lib/youcam/errors.ts) |
| Masks copied before expiry | Result links expire after about two hours, so masks are copied to the device straight away | [`api.ts`](../src/lib/client/api.ts) |
| Deleted after saving | Photos leave YouCam once results are safely on the device, not before | [ADR 0006](adr/0006-delete-from-youcam-after-local-save.md) |

## Unit budget

| Concerns per call | SD units | HD units |
|---|---|---|
| 1-4 | 9 | 12 |
| 5-8 | 12 | 16 |
| 9-12 | 14 | 20 |
| 13-16 | 16 | 22 |

A Verdict analysis measures 4 to 8 concerns. A full eight-week trial (two baseline photos plus eight weekly check-ins) costs about 160 HD units, so 1,000 units covers about six complete trials.

## Limits that protect units on a public demo

| Control | Default | Variable |
|---|---|---|
| Access code before any analysis | off | `ACCESS_CODE` |
| Analyses per visitor per hour | 20 | `RATE_LIMIT_PER_HOUR` |
| Analyses per server instance per day | 150 | `DAILY_ANALYSIS_CAP` |
| Photos blocked before upload when too dark, side-lit, blurred or mismatched with the baseline | always | [`quality.ts`](../src/lib/capture/quality.ts) |

## Checking the live integration

```bash
npm run smoke:youcam -- path/to/selfie.jpg sd
```

Runs one real analysis with the key in `.env.local`, prints the scores, then deletes the task. It costs one analysis (9 units for SD with four concerns). The automated test suites never call the live API ([ADR 0008](adr/0008-browser-tests-mock-youcam.md)).
