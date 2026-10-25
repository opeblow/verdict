"use client";

import type { AnalysisMode, Concern } from "../domain/concerns";
import type { NormalizedAnalysis } from "../youcam/normalize";

/** Browser side of the analysis flow. Talks only to Verdict's own API routes. */

const ACCESS_KEY = "verdict.accessCode";

export function getAccessCode(): string {
  try {
    return localStorage.getItem(ACCESS_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAccessCode(code: string) {
  try {
    if (code) localStorage.setItem(ACCESS_KEY, code);
    else localStorage.removeItem(ACCESS_KEY);
  } catch {
    /* storage blocked: the code is asked for again next time */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly retake = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function headers(): HeadersInit {
  const code = getAccessCode();
  return code ? { "x-access-code": code } : {};
}

async function fail(res: Response): Promise<never> {
  let code = "http_error";
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
  } catch {
    /* non-JSON error body */
  }
  throw new ApiError(message, code, res.status, code === "error_below_min_image_size");
}

export type AnalysisPhase = "uploading" | "analysing" | "saving";

export interface AnalysisResult {
  taskId: string;
  analysis: NormalizedAnalysis;
  masks: Record<string, Blob>;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

/**
 * Upload, poll and collect. Masks are copied to the device straight away
 * because YouCam's result links expire, then the task is deleted on YouCam.
 */
export async function analyse(
  photo: { blob: Blob; width: number; height: number },
  mode: AnalysisMode,
  concerns: readonly Concern[],
  onPhase: (p: AnalysisPhase) => void = () => {},
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  onPhase("uploading");
  const form = new FormData();
  form.set("image", photo.blob, "photo.jpg");
  form.set("mode", mode);
  form.set("concerns", JSON.stringify(concerns));
  form.set("width", String(photo.width));
  form.set("height", String(photo.height));
  const start = await fetch("/api/analyze", { method: "POST", body: form, headers: headers(), signal });
  if (!start.ok) await fail(start);
  const { taskId } = (await start.json()) as { taskId: string };

  onPhase("analysing");
  const deadline = Date.now() + 120_000;
  let delay = 1500;
  let analysis: NormalizedAnalysis | null = null;
  while (Date.now() < deadline) {
    await sleep(delay, signal);
    delay = Math.min(4000, delay + 500);
    const res = await fetch(`/api/analyze/${encodeURIComponent(taskId)}`, { headers: headers(), signal });
    if (res.status === 429) continue;
    if (!res.ok) await fail(res);
    const body = (await res.json()) as
      | { status: "running" }
      | { status: "success"; analysis: NormalizedAnalysis }
      | { status: "error"; code: string; message: string; retake: boolean };
    if (body.status === "success") {
      analysis = body.analysis;
      break;
    }
    if (body.status === "error") throw new ApiError(body.message, body.code, 422, body.retake);
  }
  if (!analysis) throw new ApiError("The analysis took too long. Try again.", "timeout", 504);
  if (analysis.readings.length === 0) throw new ApiError("The analysis returned no scores. Retake the photo.", "empty", 422, true);

  onPhase("saving");
  const masks: Record<string, Blob> = {};
  const jobs: Promise<void>[] = [];
  const fetchBlob = async (key: string, url: string) => {
    try {
      const r = await fetch(`/api/mask?u=${encodeURIComponent(url)}`, { headers: headers(), signal });
      if (r.ok) masks[key] = await r.blob();
    } catch {
      /* a missing mask only hides one overlay */
    }
  };
  for (const r of analysis.readings) if (r.maskUrl) jobs.push(fetchBlob(r.key, r.maskUrl));
  if (analysis.resizedImageUrl) jobs.push(fetchBlob("__resized", analysis.resizedImageUrl));
  await Promise.all(jobs);

  // Best effort: remove the photo from YouCam now that everything is on the device.
  void fetch(`/api/analyze/${encodeURIComponent(taskId)}`, { method: "DELETE", headers: headers() }).catch(() => {});

  return { taskId, analysis, masks };
}

export interface ServerHealth {
  ok: boolean;
  youcamConfigured: boolean;
  accessCodeRequired: boolean;
}

export async function health(): Promise<ServerHealth | null> {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    return r.ok ? ((await r.json()) as ServerHealth) : null;
  } catch {
    return null;
  }
}
