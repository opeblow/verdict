import { describe, expect, it } from "vitest";
import { guidanceFor, isRetakeError, parseEngineError } from "@/lib/youcam/errors";
import { normalizeOutput } from "@/lib/youcam/normalize";
import { YouCamClient, YouCamError, parseTaskState, type FetchLike } from "@/lib/server/youcam";
import * as fx from "./fixtures/youcam";

interface Call {
  url: string;
  init?: RequestInit;
}

function fakeFetch(responses: Array<{ status?: number; body?: unknown }>): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  let i = 0;
  const f: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)]!;
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status ?? 200 });
  };
  return { fetch: f, calls };
}

describe("YouCamClient", () => {
  it("registers, uploads to the presigned URL, and starts a JSON-format task", async () => {
    const { fetch, calls } = fakeFetch([{ body: fx.fileRegistered }, { status: 200 }, { body: fx.taskCreated }]);
    const client = new YouCamClient({ apiKey: "k", fetch });
    const fileId = await client.uploadImage(new Uint8Array([1, 2, 3, 4]).buffer, "image/jpeg", "a.jpg");
    const taskId = await client.createSkinTask(fileId, ["hd_pore", "hd_redness"]);

    expect(taskId).toBe(fx.taskCreated.data.task_id);
    expect(calls[0]!.url).toBe("https://yce-api-01.makeupar.com/s2s/v2.0/file/skin-analysis");
    expect((calls[0]!.init!.headers as Record<string, string>).Authorization).toBe("Bearer k");
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({ files: [{ content_type: "image/jpeg", file_name: "a.jpg", file_size: 4 }] });

    expect(calls[1]!.url).toContain("s3-accelerate.amazonaws.com");
    expect(calls[1]!.init!.method).toBe("PUT");
    // The presigned upload must not carry the API key.
    expect(JSON.stringify(calls[1]!.init!.headers)).not.toContain("Bearer");

    const task = JSON.parse(String(calls[2]!.init!.body));
    expect(calls[2]!.url).toBe("https://yce-api-01.makeupar.com/s2s/v2.0/task/skin-analysis");
    expect(task).toMatchObject({ src_file_id: fileId, dst_actions: ["hd_pore", "hd_redness"], format: "json" });
  });

  it("uses the configured skin analysis version for task and poll", async () => {
    const { fetch, calls } = fakeFetch([{ body: fx.taskCreated }, { body: fx.taskRunning }]);
    const client = new YouCamClient({ apiKey: "k", fetch, skinVersion: "v2.1" });
    const id = await client.createSkinTask("f", ["pore"]);
    await client.getSkinTask(id);
    expect(calls[0]!.url).toContain("/s2s/v2.1/task/skin-analysis");
    expect(calls[1]!.url).toContain(`/s2s/v2.1/task/skin-analysis/${id}`);
  });

  it("surfaces API errors with their code", async () => {
    const { fetch } = fakeFetch([{ status: 400, body: fx.noUnits }]);
    const client = new YouCamClient({ apiKey: "k", fetch });
    await expect(client.createSkinTask("f", ["pore"])).rejects.toMatchObject({ code: "CreditInsufficiency", status: 400 });
  });

  it("maps 401 to InvalidApiKey", async () => {
    const { fetch } = fakeFetch([{ status: 401, body: { status: 401, error: "Invalid API key" } }]);
    const client = new YouCamClient({ apiKey: "bad", fetch });
    const err = await client.getSkinTask("abcdefgh").catch((e) => e);
    expect(err).toBeInstanceOf(YouCamError);
    expect(err.code).toBe("InvalidApiKey");
  });

  it("rejects a malformed upload registration", async () => {
    const { fetch } = fakeFetch([{ body: { status: 200, data: { files: [] } } }]);
    const client = new YouCamClient({ apiKey: "k", fetch });
    await expect(client.uploadImage(new ArrayBuffer(1), "image/jpeg", "a.jpg")).rejects.toMatchObject({ code: "BadUpstreamShape" });
  });

  it("deletes tasks through the generic delete endpoint", async () => {
    const { fetch, calls } = fakeFetch([{ body: { status: 200 } }]);
    await new YouCamClient({ apiKey: "k", fetch }).deleteTask("abc");
    expect(calls[0]!.url).toBe("https://yce-api-01.makeupar.com/s2s/v2.0/task/delete");
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({ task_id: "abc" });
  });

  it("refuses to start without a key", () => {
    expect(() => new YouCamClient({ apiKey: "" })).toThrow();
  });
});

describe("parseTaskState", () => {
  it("handles running, success and the live tuple error format", () => {
    expect(parseTaskState(fx.taskRunning)).toEqual({ status: "running" });
    const ok = parseTaskState(fx.hdSuccess);
    expect(ok.status).toBe("success");
    const err = parseTaskState(fx.faceTooSmall);
    expect(err).toEqual({ status: "error", error: { code: "error_src_face_too_small", message: "The face area in the uploaded image is too small" } });
  });
});

describe("normalizeOutput", () => {
  it("normalises HD output with regions, skin type, overall and the resized image", () => {
    const n = normalizeOutput(fx.hdSuccess.data.results.output);
    const keys = n.readings.map((r) => r.key);
    expect(keys).toEqual(["wrinkle", "wrinkle:crowfeet", "pore", "pore:nose", "redness", "dark_circle"]);
    expect(n.readings.find((r) => r.key === "pore")!.raw).toBe(49.23);
    expect(n.readings.find((r) => r.key === "pore")!.ui).toBe(67);
    expect(n.skinType).toEqual({ t_zone: "Oily", whole: "Combination" });
    expect(n.skinAge).toBe(29);
    expect(n.overall).toBe(75.75);
    expect(n.resizedImageUrl).toContain("resized_image.jpg");
  });

  it("normalises SD output, including the dark_circle_v2 name", () => {
    const n = normalizeOutput(fx.sdSuccess.data.results.output);
    expect(n.readings.map((r) => r.key)).toEqual(["oiliness", "redness", "dark_circle"]);
    expect(n.readings[2]!.maskUrl).toBeUndefined();
  });

  it("skips entries without a usable raw score and unknown types", () => {
    const n = normalizeOutput([
      { type: "pore" },
      { type: "pore", raw_score: Number.NaN },
      { type: "eyebrow_shape", raw_score: 50 },
      { type: "texture", raw_score: 61 },
    ]);
    expect(n.readings.map((r) => r.key)).toEqual(["texture"]);
  });
});

describe("engine errors", () => {
  it("parses tuple, bare and free-text forms", () => {
    expect(parseEngineError("('Too dark', 'error_lighting_dark')").code).toBe("error_lighting_dark");
    expect(parseEngineError('("Too dark", "error_lighting_dark")').code).toBe("error_lighting_dark");
    expect(parseEngineError("error_no_face").code).toBe("error_no_face");
    expect(parseEngineError("Something broke").code).toBe("unknown_internal_error");
    expect(parseEngineError(null).code).toBe("unknown_internal_error");
  });

  it("gives a retake instruction for photo problems and not for service faults", () => {
    expect(isRetakeError("error_src_face_too_small")).toBe(true);
    expect(isRetakeError("error_lighting_dark")).toBe(true);
    expect(isRetakeError("error_inference")).toBe(false);
    expect(guidanceFor("error_lighting_dark")).toMatch(/dark/i);
    expect(guidanceFor("something_new")).toMatch(/Retake/);
  });
});
