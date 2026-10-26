# 0011. Verdict's engine is available to assistants as stateless MCP tools

Status: Accepted

## Context

People increasingly ask an assistant before they buy: "Will this serum help my pores, and how long should I give it?" Perfect Corp is building Model Context Protocol support into its APIs. Verdict's value is its engine (ingredient timelines, trial planning, noise-aware verdicts), and that engine is already pure functions ([ADR 0005](0005-pure-domain-layer.md)).

Exposing YouCam analysis itself through MCP would let any connected assistant spend the deployment's API units, and would move photos through a new path.

## Decision

- `/api/mcp` is a stateless MCP server over Streamable HTTP with JSON responses. It supports `initialize`, `ping`, `tools/list` and `tools/call`.
- Four read-only tools wrap the domain layer: `find_actives`, `plan_trial`, `evaluate_trial` and `explain_method`.
- No tool calls YouCam, accepts a photo or stores anything. `evaluate_trial` takes raw scores that the person already has.
- The protocol layer is a small, dependency-free JSON-RPC handler. Inputs are validated with the Zod schemas that also generate the published JSON Schemas.
- Requests whose `Origin` is another site are refused, bodies are capped at 256 KB, and calls share the per-client rate limit used for polling.
- Tool descriptions and server instructions ask assistants to describe results as cosmetic changes and to keep "too early" as a real answer. The copy guard scans this text too.

## Consequences

- An assistant can plan a trial and explain a result with the same rules and numbers as the app.
- No new way to spend units or move photos.
- Without sessions there are no server-to-client notifications. No tool needs them.
- The protocol layer must be kept current with MCP revisions. Version negotiation falls back to the newest supported version.

## Enforced by

- [`src/lib/mcp/tools.ts`](../../src/lib/mcp/tools.ts) and [`src/lib/mcp/protocol.ts`](../../src/lib/mcp/protocol.ts).
- [`src/app/api/mcp/route.ts`](../../src/app/api/mcp/route.ts): origin check, size cap, rate limit.
- [`tests/unit/mcp.test.ts`](../../tests/unit/mcp.test.ts): protocol behaviour, schemas, and parity between `evaluate_trial` and the app's verdict.
- [`tests/e2e/mcp.spec.ts`](../../tests/e2e/mcp.spec.ts): the handshake and a tool call over HTTP; cross-origin and malformed requests refused.
- [`tests/unit/copy-guard.test.ts`](../../tests/unit/copy-guard.test.ts): scans `src/lib/mcp`.
