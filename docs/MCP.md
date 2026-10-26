# Verdict for AI assistants (MCP)

Verdict exposes its engine as a [Model Context Protocol](https://modelcontextprotocol.io) server at `/api/mcp`. An assistant can read an ingredient list, plan a fair trial with dates and unit cost, and judge a trial from its scores, using exactly the rules the app uses.

The tools are read-only and stateless. They never call YouCam, never see a photo and never store anything, so they need no access code and spend no API units.

## Connect

| Client | How |
|---|---|
| Claude (web, desktop, mobile) | Settings, Connectors, Add custom connector, URL `https://<your-deployment>/api/mcp` |
| Any MCP client with Streamable HTTP | Server URL `https://<your-deployment>/api/mcp`, no authentication |
| Local development | `npm run dev`, then `http://localhost:3000/api/mcp` |

Transport: Streamable HTTP, stateless, JSON responses. Protocol versions `2025-11-25`, `2025-06-18` and `2025-03-26`.

## Tools

| Tool | Input | Returns |
|---|---|---|
| `find_actives` | `ingredients`: the ingredient list | Recognised actives, what each changes, weeks to a fair verdict, suggested targets |
| `plan_trial` | `targets` (1 to 5 concerns), optional `ingredients` or `activeIds`, `mode` (`hd` or `sd`), optional `startDate` | What every photo measures (targets, irritation monitor, fill-ins), fair-verdict week and date per target, purging window, units per photo and for the trial |
| `evaluate_trial` | `startedAt`, `targets`, optional `ingredients` or `activeIds`, `mode`, `photos` (each with `takenAt`, `kind`, optional `session`, and `scores` of YouCam `raw_score` by metric key), optional `now` | The decision, headline and reason, plus every measure's start, latest, change with its 95% range, photo noise, status and fair-verdict date |
| `explain_method` | none | The principle, the constants the engine uses, the safety rules, the light policy and the limits, so an assistant can describe results without overclaiming |

The full input schemas are returned by `tools/list`.

## Example

```text
Person: My serum has niacinamide and zinc. Is it worth a trial for pores?

Assistant calls plan_trial { "targets": ["pore", "oiliness"], "ingredients": "Aqua, Niacinamide, Zinc PCA" }

Assistant: Measure pores and oil control, plus redness as an irritation monitor
and hydration, which fills the billing tier at no extra cost.
Take two baseline photos a minute apart, then check in weekly. Oil control can
be judged from week 4 and pores from week 8. In HD each photo costs 12 units,
about 120 for the whole trial.
```

## Why it is built this way

- **Same engine, no drift.** The tools call the same pure functions as the app. A test checks that `evaluate_trial` gives the same decision and the same status on every measure as the app does for the same scores.
- **Privacy.** Personal data lives on the person's device ([ADR 0001](adr/0001-device-only-data-stateless-server.md)). The tools take scores, never photos, and keep nothing.
- **No units at risk.** No tool reaches YouCam, so an assistant cannot spend the deployment's units.
- **Safe on the open web.** Requests from other sites' pages are refused by `Origin`, bodies are capped at 256 KB, and calls are rate limited per client.

Decision record: [ADR 0011](adr/0011-mcp-tools-for-assistants.md). Code: [`src/lib/mcp`](../src/lib/mcp), [`src/app/api/mcp/route.ts`](../src/app/api/mcp/route.ts). Tests: [`tests/unit/mcp.test.ts`](../tests/unit/mcp.test.ts), [`tests/e2e/mcp.spec.ts`](../tests/e2e/mcp.spec.ts).
