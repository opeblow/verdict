# 0005. Measurement and verdict rules are pure functions with no I/O

Status: Accepted

## Context

Verdict's value is in its rules: concern planning, ingredient timelines, noise estimation, trend fitting and verdicts. They must be easy to test exhaustively, and behave identically wherever they run: on the landing page's example trial, on the dashboard, and in tests.

## Decision

`src/lib/domain` contains only pure TypeScript: no network, no storage, no React, and no hidden clock. Functions that depend on the date take `now` as a parameter. The capture quality checks in `src/lib/capture/quality.ts` follow the same rule.

## Consequences

- The engine is tested without a browser, a server or a YouCam key, in under two seconds.
- The landing page renders a real verdict from the real engine, on a clearly labelled example trial.
- Callers must pass `now` explicitly, which is slightly more verbose.

## Enforced by

- The rules for `src/lib/domain/` in [`AGENTS.md`](../../AGENTS.md).
- [`tests/unit/`](../../tests/unit): the domain suites import these modules directly, with no mocks.
