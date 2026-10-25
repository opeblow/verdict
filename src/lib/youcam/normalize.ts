import { fromActionType, metricKey } from "../domain/concerns";
import type { MetricReading } from "../domain/model";

/** One entry of `data.results.output` from a `format: "json"` skin analysis task. */
export interface YouCamOutputItem {
  type: string;
  region?: string | null;
  raw_score?: number | null;
  ui_score?: number | null;
  score?: number | null;
  skin_type?: string | null;
  mask_urls?: string[] | null;
  url?: string | null;
}

export interface NormalizedAnalysis {
  readings: MetricReading[];
  overall?: number;
  skinAge?: number;
  skinType?: Record<string, string>;
  /** The image YouCam actually analysed. Masks align to it, not to the original. */
  resizedImageUrl?: string;
}

/**
 * Convert YouCam's flat output list into Verdict readings.
 * Tolerates both HD and SD naming, and missing optional fields.
 */
export function normalizeOutput(output: readonly YouCamOutputItem[]): NormalizedAnalysis {
  const result: NormalizedAnalysis = { readings: [] };
  for (const item of output) {
    if (!item || typeof item.type !== "string") continue;
    const type = item.type;
    const region = item.region ?? "whole";
    const mask = item.mask_urls?.[0] ?? undefined;

    if (type === "all") {
      if (typeof item.score === "number") result.overall = item.score;
      continue;
    }
    if (type === "skin_age") {
      if (typeof item.score === "number") result.skinAge = item.score;
      continue;
    }
    if (type === "resize_image") {
      if (mask) result.resizedImageUrl = mask;
      continue;
    }
    if (type === "skin_type" || type === "hd_skin_type") {
      if (item.skin_type) result.skinType = { ...result.skinType, [region]: item.skin_type };
      continue;
    }

    const concern = fromActionType(type);
    if (!concern || typeof item.raw_score !== "number" || !Number.isFinite(item.raw_score)) continue;
    result.readings.push({
      key: metricKey(concern, region),
      concern,
      region,
      raw: item.raw_score,
      ui: typeof item.ui_score === "number" ? item.ui_score : undefined,
      maskUrl: mask,
    });
  }
  return result;
}
