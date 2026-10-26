# 0002. Every calculation uses `raw_score`, never `ui_score`

Status: Accepted

## Context

YouCam AI Skin Analysis returns two numbers per concern. YouCam documents `ui_score` as adjusted to produce more favourable results, as a motivator for consumer apps. `raw_score` is the model's unadjusted output.

An upward adjustment is harmless for a one-off result. For measuring change it is a problem: a non-linear lift compresses differences near the top of the scale, and any change to the adjustment would look like a change in the skin.

## Decision

Verdict reads `raw_score` for every calculation: baselines, noise, trends, intervals and verdicts. `ui_score` is stored for display parity only and never enters the maths.

## Consequences

- Numbers in Verdict can be lower than those in YouCam's own apps. The method page explains why.
- Change estimates are not distorted by a presentation layer.

## Enforced by

- [`src/lib/youcam/normalize.ts`](../../src/lib/youcam/normalize.ts): maps task output to readings, keeping `raw` and `ui` apart.
- [`src/lib/domain/verdict.ts`](../../src/lib/domain/verdict.ts): reads only `raw`.
- [`tests/unit/youcam.test.ts`](../../tests/unit/youcam.test.ts): normalisation tests built on fixtures in the official OpenAPI shapes.
- Invariant 1 in [`AGENTS.md`](../../AGENTS.md).
