# 0004. Change is reported only when it clears each person's measured noise

Status: Accepted

## Context

Skin scores move between photos even when the skin has not changed: light, angle, distance and expression all shift them. Comparing two single photos therefore produces confident-looking nonsense. How much scores move varies by person, camera and room, so a fixed threshold would be wrong for most people.

## Decision

- Every trial starts with two baseline photos taken a minute apart. Their difference is a direct measurement of that person's photo noise.
- Noise estimates are shrunk towards a cautious prior (2.5 points, weighted as three pseudo pairs, with a floor of 1 point), so two near-identical photos cannot create false confidence.
- Change is a least-squares trend over every photo since day zero, with a 95% interval that pools replicate noise and the scatter around the trend.
- "Improved" or "worse" requires the whole interval to clear zero and the change to be at least 3 points. "Don't rebuy" requires a meaningful benefit to be ruled out, which is a one-sided test.
- Before each active ingredient's fair-verdict week, the answer is "wait", with the date.

## Consequences

- Verdict often says "too early" or "more data". That is the honest answer, and the product is designed around it.
- Each trial costs two analyses at the start instead of one.
- No shortcut may compare two single photos (invariant 8 in [`AGENTS.md`](../../AGENTS.md)).

## Enforced by

- [`src/lib/domain/stats.ts`](../../src/lib/domain/stats.ts): `PRIOR_NOISE_SD`, `PRIOR_WEIGHT`, `MIN_NOISE_SD` and `DEFAULT_MEANINGFUL_CHANGE`.
- [`src/lib/domain/verdict.ts`](../../src/lib/domain/verdict.ts): the decision rules.
- [`tests/unit/stats.test.ts`](../../tests/unit/stats.test.ts) and [`tests/unit/verdict.test.ts`](../../tests/unit/verdict.test.ts): every rule and its edge cases.
- Full write-up: [METHOD.md](../METHOD.md).
