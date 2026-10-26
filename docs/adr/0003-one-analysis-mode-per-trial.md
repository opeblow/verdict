# 0003. A trial is locked to HD or SD by its first photo

Status: Accepted

## Context

YouCam offers SD and HD skin analysis. They are different models with different minimum resolutions (480 px and 1080 px on the short side), and their scores are not on a common scale. A person might start a trial on a phone and check in later from a laptop webcam that cannot meet the HD minimum.

## Decision

The first baseline photo chooses the mode: HD when the cropped photo's short side is at least 1080 px, otherwise SD. The trial stores that mode, and every later photo is analysed in it. A later photo below the trial's minimum is refused with a plain explanation, rather than analysed in the other mode.

## Consequences

- Scores within a trial are always comparable.
- Someone who switches to a lower-resolution camera mid-trial is asked to use the original device. This friction is deliberate.

## Enforced by

- [`src/lib/capture/image.ts`](../../src/lib/capture/image.ts): `bestModeFor` and `SHORT_SIDE_MIN`.
- [`src/components/capture/CaptureFlow.tsx`](../../src/components/capture/CaptureFlow.tsx): refuses a check-in below the locked mode's minimum.
- [`src/app/api/analyze/route.ts`](../../src/app/api/analyze/route.ts): checks the size on the server as well.
- [`tests/e2e/api-guards.spec.ts`](../../tests/e2e/api-guards.spec.ts): an HD request below 1080 px is rejected.
- Invariant 2 in [`AGENTS.md`](../../AGENTS.md).
