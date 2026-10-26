# 0009. Light checks judge the room, not the skin

Status: Accepted. Supersedes the original brightness, glare and blur rules.

## Context

Before a photo is uploaded, Verdict checks the light so it does not spend API units on photos YouCam would reject or score unreliably. The first version judged "too dark" and "glare" by the mean brightness of the face, and blur by the raw variance of the Laplacian.

Face brightness depends on skin tone as much as on light. Measured on the ten tones of the Monk Skin Tone scale in identical, good light:

| Tone | Mean face luma | Old result |
|---|---|---|
| 1 to 3 | 233 to 238 | "Glare" warning (threshold 220) |
| 4 to 7 | 98 to 219 | Accepted |
| 8 | 71 | "A little dim" warning |
| 9 | 50 | Blocked as too dark (threshold 70) |
| 10 | 37 | Blocked as too dark |

People with the two darkest tones could not take a baseline photo in any light. Fifteen professionally lit stock portraits showed the same pattern: a studio portrait of a woman with dark skin was blocked, and six other well-lit portraits were warned as dim. The blur check had the same bias, because the same skin detail produces less contrast on darker skin.

## Decision

Each absolute check now uses a measure that depends on the light, not the skin:

- **Too dark or dim** is judged on **room light**: the 90th percentile brightness of a strip along the frame's edges (12% of each side). A framed face does not reach it. Face pixels, even highlights, are excluded, because they are brighter on lighter skin. Thresholds are 75 (block) and 100 (warn), which keep the strictness the old rule had for a mid-range skin tone.
- **Glare** is judged only on blown-out pixels (luma 250 or more), which mean glare on any skin.
- **Blur** scales the Laplacian variance up to a mid-grey reference for darker faces. It is never scaled down, so no one is held to a stricter bar than before.
- **Mean face brightness** is still measured, and only compared with the same person's first photo, where it is fair.

The live readout and the photo log show room light, so a person with dark skin no longer sees a low "Light" number in good light.

## Consequences

- Every Monk tone gets the same decision at every light level tested, from a dark room to full light.
- A well-lit face against a very dark backdrop can now get a "dim" warning, because the edges are dark. Warnings never block a photo.
- Photos saved before this change have no room-light value. The checks fall back to face brightness for them, and baseline comparisons are unaffected.

## Enforced by

- [`src/lib/capture/quality.ts`](../../src/lib/capture/quality.ts): `measureFrame`, `assessConditions`, `relativeSharpness`, `ROOM_EDGE` and `LIMITS`.
- [`tests/unit/fairness.test.ts`](../../tests/unit/fairness.test.ts): all ten Monk tones pass in good light, are blocked in a dark room, are judged identically at six light levels, and get the same blur decision for the same skin detail. It also pins the old rule's failure.
- [`tests/e2e/skin-tone-fairness.spec.ts`](../../tests/e2e/skin-tone-fairness.spec.ts): the same ten tones through the real capture pipeline in the browser. Against the old code, tones 1, 9 and 10 fail.
