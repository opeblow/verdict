import { ToolInputError, callTool, toolList } from "./tools";

/**
 * A minimal, stateless Model Context Protocol server over JSON-RPC 2.0, for
 * the Streamable HTTP transport with plain JSON responses. It supports
 * initialize, ping and the tools capability. There are no sessions, because
 * no tool keeps state.
 */

export const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;

const SERVER_INFO = { name: "verdict", title: "Verdict", version: "1.0.0" };

const INSTRUCTIONS =
  "Verdict judges whether a skincare product is working from repeated YouCam AI Skin Analysis raw scores. " +
  "Use find_actives on an ingredient list, plan_trial to set targets, dates and unit cost, and evaluate_trial with the scores the person exported. " +
  "Describe results as cosmetic changes in how skin looks, never as medical findings, and keep the engine's caution: 'too early' and 'more data' are real answers.";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string; data?: unknown } };

export const ERR = { parse: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602, internal: -32603 } as const;

function isRequest(m: unknown): m is JsonRpcRequest {
  return typeof m === "object" && m !== null && (m as JsonRpcRequest).jsonrpc === "2.0" && typeof (m as JsonRpcRequest).method === "string";
}

function fail(id: JsonRpcRequest["id"], code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function handleOne(msg: unknown, now: Date): JsonRpcResponse | null {
  if (!isRequest(msg)) return fail(null, ERR.invalidRequest, "Expected a JSON-RPC 2.0 request.");
  const { id, method, params } = msg;
  // Notifications (no id) get no response.
  if (id === undefined) return null;

  switch (method) {
    case "initialize": {
      const asked = typeof params?.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = (SUPPORTED_VERSIONS as readonly string[]).includes(asked) ? asked : SUPPORTED_VERSIONS[0];
      return {
        jsonrpc: "2.0",
        id,
        result: { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: toolList() } };
    case "tools/call": {
      const name = params?.name;
      if (typeof name !== "string") return fail(id, ERR.invalidParams, "tools/call needs a tool name.");
      try {
        const structuredContent = callTool(name, params?.arguments, now);
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }], structuredContent } };
      } catch (err) {
        if (err instanceof ToolInputError) {
          if (err.message.startsWith("Unknown tool")) return fail(id, ERR.invalidParams, err.message);
          // Input mistakes are reported to the model as a tool error it can correct.
          return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Invalid input. ${err.message}` }], isError: true } };
        }
        return fail(id, ERR.internal, "The tool failed.");
      }
    }
    default:
      return fail(id, ERR.methodNotFound, `Method not found: ${method}`);
  }
}

/**
 * Handles one JSON-RPC message or a batch. Returns null when nothing needs a
 * reply (only notifications), which the transport answers with 202.
 */
export function handleMcp(body: unknown, now = new Date()): JsonRpcResponse | JsonRpcResponse[] | null {
  if (Array.isArray(body)) {
    if (body.length === 0) return fail(null, ERR.invalidRequest, "Empty batch.");
    const out = body.map((m) => handleOne(m, now)).filter((r): r is JsonRpcResponse => r !== null);
    return out.length ? out : null;
  }
  return handleOne(body, now);
}
