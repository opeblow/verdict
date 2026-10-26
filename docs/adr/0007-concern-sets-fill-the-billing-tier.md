# 0007. Concern sets are filled to the edge of YouCam's billing tier

Status: Accepted

## Context

YouCam bills skin analysis by the number of concerns per call, in tiers: 1 to 4, 5 to 8, 9 to 12 and 13 to 16 (9, 12, 14 and 16 units in SD; 12, 16, 20 and 22 in HD). A product with two targets plus the redness monitor uses three concerns but pays for four.

## Decision

`planConcerns` builds each trial's concern set in this order: the product's targets, then the safety monitor (redness), then fill-ins from a fixed priority list until the current tier is full. The set is fixed for the trial, so every photo measures the same things.

## Consequences

- Paid capacity is never wasted. The extra concerns appear under "Also measured", where they can show side effects the product does not claim.
- Adding a target can move a trial into the next tier. The setup screen shows the unit cost per photo and per trial before the first photo.

## Enforced by

- [`src/lib/domain/concerns.ts`](../../src/lib/domain/concerns.ts): `planConcerns`, `SAFETY_CONCERNS` and `unitCost`.
- [`tests/unit/domain.test.ts`](../../tests/unit/domain.test.ts): tier filling and unit costs.
- Invariant 7 in [`AGENTS.md`](../../AGENTS.md): redness is always measured.
