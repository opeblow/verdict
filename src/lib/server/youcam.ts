import { parseEngineError, type EngineError } from "../youcam/errors";
import { normalizeOutput, type NormalizedAnalysis, type YouCamOutputItem } from "../youcam/normalize";

/**
 * Server-only client for YouCam AI Skin Analysis.
 *
 * Flow (YouCam API v2):
 *   1. POST /s2s/v2.0/file/skin-analysis     register the upload, get a presigned URL
 *   2. PUT  <presigned url>                   send the image bytes
 *   3. POST /s2s/v2.0/task/skin-analysis     start analysis, get a task id
 *   4. GET  /s2s/v2.0/task/skin-analysis/:id poll until success or error
 *   5. POST /s2s/v2.0/task/delete             remove the photo and results from YouCam
 *
 * The API key is read from the server environment and never sent to the browser.
 */

export const DEFAULT_BASE_URL = "https://yce-api-01.makeupar.com";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class YouCamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "YouCamError";
  }
}

export type TaskState =
  | { status: "running" }
  | { status: "success"; analysis: NormalizedAnalysis }
  | { status: "error"; error: EngineError };

export interface YouCamClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: FetchLike;
  /** Skin analysis API version. "v2.0" is the long-standing default. */
  skinVersion?: "v2.0" | "v2.1";
}

interface ApiErrorBody {
  status?: number;
  error?: string;
  error_code?: string;
}

export class YouCamClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly skinVersion: "v2.0" | "v2.1";

  constructor(opts: YouCamClientOptions) {
    if (!opts.apiKey) throw new Error("YouCam API key is missing");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
    this.skinVersion = opts.skinVersion ?? "v2.0";
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    let body: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { error: text.slice(0, 200) };
      }
    }
    if (!res.ok) {
      const b = (body ?? {}) as ApiErrorBody;
      const code = b.error_code ?? (res.status === 401 ? "InvalidApiKey" : res.status === 429 ? "TooManyRequests" : "HttpError");
      throw new YouCamError(b.error ?? `YouCam request failed with HTTP ${res.status}`, res.status, code);
    }
    return body as T;
  }

  /** Steps 1 and 2: register and upload. Returns the file id for the task. */
  async uploadImage(bytes: ArrayBuffer, contentType: string, fileName: string): Promise<string> {
    type FileResponse = {
      data?: { files?: { file_id?: string; requests?: { method?: string; url?: string; headers?: Record<string, string> }[] }[] };
    };
    const reg = await this.request<FileResponse>("/s2s/v2.0/file/skin-analysis", {
      method: "POST",
      body: JSON.stringify({ files: [{ content_type: contentType, file_name: fileName, file_size: bytes.byteLength }] }),
    });
    const file = reg?.data?.files?.[0];
    const put = file?.requests?.[0];
    if (!file?.file_id || !put?.url) throw new YouCamError("File registration returned an unexpected shape", 502, "BadUpstreamShape");

    const upload = await this.fetchImpl(put.url, {
      method: put.method ?? "PUT",
      headers: put.headers ?? { "Content-Type": contentType, "Content-Length": String(bytes.byteLength) },
      body: bytes,
    });
    if (!upload.ok) throw new YouCamError(`Image upload failed with HTTP ${upload.status}`, 502, "UploadFailed");
    return file.file_id;
  }

  /** Step 3: start the analysis. */
  async createSkinTask(fileId: string, dstActions: readonly string[]): Promise<string> {
    const body: Record<string, unknown> = {
      src_file_id: fileId,
      dst_actions: dstActions,
      format: "json",
      miniserver_args: { enable_mask_overlay: false },
    };
    const res = await this.request<{ data?: { task_id?: string } }>(`/s2s/${this.skinVersion}/task/skin-analysis`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const taskId = res?.data?.task_id;
    if (!taskId) throw new YouCamError("Task creation returned no task id", 502, "BadUpstreamShape");
    return taskId;
  }

  /** Step 4: check progress once. */
  async getSkinTask(taskId: string): Promise<TaskState> {
    type StatusResponse = {
      data?: { task_status?: string; error?: unknown; results?: { output?: YouCamOutputItem[] } | null };
    };
    const res = await this.request<StatusResponse>(`/s2s/${this.skinVersion}/task/skin-analysis/${encodeURIComponent(taskId)}`);
    return parseTaskState(res);
  }

  /** Step 5: delete the uploaded photo and results from YouCam's servers. */
  async deleteTask(taskId: string): Promise<void> {
    await this.request("/s2s/v2.0/task/delete", { method: "POST", body: JSON.stringify({ task_id: taskId }) });
  }

  /** Remaining API units, used by the health endpoint. */
  async credit(): Promise<unknown> {
    return this.request("/s2s/v1.0/client/credit");
  }
}

export function parseTaskState(res: {
  data?: { task_status?: string; error?: unknown; results?: { output?: YouCamOutputItem[] } | null };
}): TaskState {
  const data = res?.data;
  if (data?.task_status === "success") {
    return { status: "success", analysis: normalizeOutput(data.results?.output ?? []) };
  }
  if (data?.task_status === "error") return { status: "error", error: parseEngineError(data.error) };
  return { status: "running" };
}
