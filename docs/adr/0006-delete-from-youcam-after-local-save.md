# 0006. Photos are deleted from YouCam only after results are saved on the device

Status: Accepted

## Context

YouCam keeps uploaded photos and results for up to 24 hours. Verdict promises that a photo is deleted from YouCam once its results are saved on the device. An earlier version deleted the task as soon as analysis finished, before the local save. If the save then failed (storage full, or a blocked or private browser profile), the result was lost, the units were spent, and "Try again" paid for a second analysis.

End-to-end testing against the live API found this when a browser profile could not open IndexedDB.

## Decision

- Analysis and saving are separate steps. The analysed result is held in memory until it is saved.
- The YouCam task is deleted only after the save succeeds.
- If the save fails, the user sees a specific message and a **Try saving again** button that retries the save without a new analysis.
- If the user retakes the photo or leaves the page with an unsaved result, the task is deleted then, rather than left for the 24-hour expiry.
- A failed database open is not cached, so one failure does not break every later save.

## Consequences

- The privacy promise in the interface is literally true.
- Recovering from a failed save costs nothing extra.
- An unsaved result can stay at YouCam a little longer while the user decides, never beyond YouCam's own 24-hour limit.

## Enforced by

- [`src/components/capture/CaptureFlow.tsx`](../../src/components/capture/CaptureFlow.tsx): `save` and `releaseTask`.
- [`src/lib/client/db.ts`](../../src/lib/client/db.ts): resets the cached open on failure.
- [`tests/unit/db.test.ts`](../../tests/unit/db.test.ts): the database is reopened after a failed open.
- [`tests/e2e/save-retry.spec.ts`](../../tests/e2e/save-retry.spec.ts): one analysis, a failed save, a successful retry, and the delete only afterwards.
- [`tests/e2e/trial-journey.spec.ts`](../../tests/e2e/trial-journey.spec.ts): every photo in a full trial is deleted after its masks are saved.
