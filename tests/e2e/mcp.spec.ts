import { expect, test } from "@playwright/test";

// The MCP endpoint, over real HTTP, as an assistant would call it.

const call = (method: string, params?: Record<string, unknown>, id = 1) => ({
  data: { jsonrpc: "2.0", id, method, ...(params ? { params } : {}) },
  headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
});

test("an assistant can initialize, list tools and plan a trial", async ({ request }) => {
  const init = await request.post("/api/mcp", call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1" } }));
  expect(init.ok()).toBe(true);
  expect((await init.json()).result.serverInfo.name).toBe("verdict");

  const note = await request.post("/api/mcp", { ...call("notifications/initialized"), data: { jsonrpc: "2.0", method: "notifications/initialized" } });
  expect(note.status()).toBe(202);

  const list = await request.post("/api/mcp", call("tools/list"));
  const names = (await list.json()).result.tools.map((t: { name: string }) => t.name);
  expect(names).toEqual(["find_actives", "plan_trial", "evaluate_trial", "explain_method"]);

  const plan = await request.post("/api/mcp", call("tools/call", { name: "plan_trial", arguments: { targets: ["pore"], ingredients: "Aqua, Niacinamide" } }));
  const result = (await plan.json()).result;
  expect(result.isError).toBeUndefined();
  expect(result.structuredContent.units.perPhoto).toBeGreaterThan(0);
});

test("the MCP endpoint refuses cross-origin pages and malformed JSON", async ({ request }) => {
  const foreign = await request.post("/api/mcp", { ...call("ping"), headers: { ...call("ping").headers, origin: "https://evil.example" } });
  expect(foreign.status()).toBe(403);

  const broken = await request.post("/api/mcp", { data: Buffer.from("{not json"), headers: { "content-type": "application/json" } });
  expect(broken.status()).toBe(400);
  expect((await broken.json()).error.code).toBe(-32700);

  expect((await request.get("/api/mcp")).status()).toBe(405);
});
