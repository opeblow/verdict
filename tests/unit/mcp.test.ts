import { describe, expect, it } from "vitest";
import { EXAMPLE_NOW, EXAMPLE_TRIAL, exampleCheckIns } from "@/lib/domain/example";
import { evaluateTrial } from "@/lib/domain/verdict";
import { ERR, SUPPORTED_VERSIONS, handleMcp, type JsonRpcResponse } from "@/lib/mcp/protocol";
import { callTool, toolList } from "@/lib/mcp/tools";

const rpc = (method: string, params?: Record<string, unknown>, id: number | undefined = 1) =>
  handleMcp({ jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, ...(params ? { params } : {}) }) as JsonRpcResponse;

const resultOf = (r: JsonRpcResponse) => {
  if (!("result" in r)) throw new Error(`Expected a result, got ${JSON.stringify(r)}`);
  return r.result as Record<string, unknown>;
};

describe("MCP protocol", () => {
  it("negotiates a supported protocol version", () => {
    const asked = resultOf(rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } }));
    expect(asked.protocolVersion).toBe("2025-06-18");
    expect(asked.capabilities).toEqual({ tools: { listChanged: false } });
    const unknown = resultOf(rpc("initialize", { protocolVersion: "1999-01-01" }));
    expect(unknown.protocolVersion).toBe(SUPPORTED_VERSIONS[0]);
  });

  it("answers ping, ignores notifications, and handles batches", () => {
    expect(resultOf(rpc("ping"))).toEqual({});
    expect(handleMcp({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    const batch = handleMcp([
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ]) as JsonRpcResponse[];
    expect(batch.map((r) => r.id)).toEqual([1, 2]);
  });

  it("returns JSON-RPC errors for unknown methods, unknown tools and malformed requests", () => {
    const unknown = rpc("resources/list");
    expect("error" in unknown && unknown.error.code).toBe(ERR.methodNotFound);
    const noTool = rpc("tools/call", { name: "delete_everything", arguments: {} });
    expect("error" in noTool && noTool.error.code).toBe(ERR.invalidParams);
    const bad = handleMcp({ hello: "world" }) as JsonRpcResponse;
    expect("error" in bad && bad.error.code).toBe(ERR.invalidRequest);
  });

  it("reports invalid tool input as a correctable tool error", () => {
    const r = resultOf(rpc("tools/call", { name: "plan_trial", arguments: { targets: ["not_a_concern"] } }));
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.content)).toContain("targets");
  });

  it("lists four read-only tools with object input schemas", () => {
    const { tools } = resultOf(rpc("tools/list")) as { tools: ReturnType<typeof toolList> };
    expect(tools.map((t) => t.name)).toEqual(["find_actives", "plan_trial", "evaluate_trial", "explain_method"]);
    for (const t of tools) {
      expect(t.inputSchema.type).toBe("object");
      expect(t.annotations.readOnlyHint).toBe(true);
      expect(t.description.length).toBeGreaterThan(40);
    }
  });
});

describe("MCP tools", () => {
  it("find_actives reads an ingredient list", () => {
    const r = callTool("find_actives", { ingredients: "Aqua, Niacinamide, Zinc PCA, Glycerin" }) as { actives: { id: string; targets: { concern: string }[] }[] };
    const niacinamide = r.actives.find((a) => a.id === "niacinamide");
    expect(niacinamide?.targets.some((t) => t.concern === "pore")).toBe(true);
  });

  it("plan_trial matches the app's plan: monitor, tier fill-ins and unit cost", () => {
    const r = callTool("plan_trial", { targets: ["pore", "oiliness"], ingredients: "Aqua, Niacinamide, Zinc PCA", mode: "hd", startDate: "2026-11-02" }) as {
      measuredEachPhoto: { concern: string; role: string }[];
      targets: { fairVerdictWeek: number; fairVerdictOn: string }[];
      units: { perPhoto: number; forTrial: number };
    };
    expect(r.measuredEachPhoto).toHaveLength(4);
    expect(r.measuredEachPhoto.find((m) => m.concern === "redness")?.role).toBe("irritation monitor");
    expect(r.units.perPhoto).toBe(12); // HD tier for 1 to 4 concerns
    const weeks = Math.max(4, ...r.targets.map((t) => t.fairVerdictWeek));
    expect(r.units.forTrial).toBe(12 * (2 + weeks));
    expect(r.targets[0]!.fairVerdictOn).toMatch(/^2026-\d\d-\d\d$/);
  });

  it("evaluate_trial reaches the same verdict as the app for the same scores", () => {
    const checkIns = exampleCheckIns();
    const expected = evaluateTrial(EXAMPLE_TRIAL, checkIns, EXAMPLE_NOW);
    const r = callTool("evaluate_trial", {
      startedAt: EXAMPLE_TRIAL.startedAt,
      targets: EXAMPLE_TRIAL.targets,
      activeIds: EXAMPLE_TRIAL.activeIds,
      mode: EXAMPLE_TRIAL.mode,
      now: EXAMPLE_NOW.toISOString(),
      photos: checkIns.map((c) => ({
        takenAt: c.takenAt,
        kind: c.kind,
        session: c.session,
        scores: Object.fromEntries(c.readings.map((x) => [x.key, x.raw])),
      })),
    }) as { decision: string; headline: string; measures: { key: string; status: string }[] };

    expect(r.decision).toBe(expected.decision);
    expect(r.headline).toBe(expected.headline);
    for (const c of expected.concerns) {
      expect(r.measures.find((m) => m.key === c.key)?.status, c.key).toBe(c.status);
    }
  });

  it("evaluate_trial with only the baseline pair says the baseline is set", () => {
    const r = callTool("evaluate_trial", {
      startedAt: "2026-11-02T08:00:00Z",
      targets: ["pore"],
      photos: [
        { takenAt: "2026-11-02T08:00:00Z", kind: "baseline", scores: { pore: 61, redness: 70 } },
        { takenAt: "2026-11-02T08:01:30Z", kind: "baseline", scores: { pore: 62.4, redness: 69.1 } },
      ],
      now: "2026-11-02T09:00:00Z",
    }) as { decision: string };
    expect(r.decision).toBe("baseline");
  });

  it("explain_method states the engine's constants and cosmetic limits", () => {
    const r = callTool("explain_method", {}) as Record<string, string>;
    expect(r.score).toContain("raw_score");
    expect(r.limits).toContain("does not diagnose or treat any condition");
  });
});
