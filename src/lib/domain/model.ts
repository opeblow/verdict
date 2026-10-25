import type { AnalysisMode, Concern } from "./concerns";

export interface Product {
  name: string;
  brand?: string;
  barcode?: string;
  ingredientsText?: string;
  imageUrl?: string;
  source: "openbeautyfacts" | "manual";
  /** Price paid for one unit, in `currency`. */
  price?: number;
  currency?: string;
  /** How long one unit lasts with daily use. */
  weeksPerUnit?: number;
}

export interface CaptureProtocol {
  /** Where the person stands, such as "bathroom mirror, window on the left". */
  place?: string;
  timeOfDay?: "morning" | "evening";
}

export type TrialOutcome = "kept" | "stopped" | "switched";

export interface Trial {
  id: string;
  createdAt: string;
  /** Time of the first baseline photo. Day 0 for every chart. */
  startedAt: string;
  product: Product;
  activeIds: string[];
  /** What the product is supposed to improve. */
  targets: Concern[];
  /** Everything measured each check-in: targets, the safety monitor and fill-ins. */
  concerns: Concern[];
  /** Locked for the whole trial. HD and SD scores are not comparable. */
  mode: AnalysisMode;
  protocol: CaptureProtocol;
  cadenceDays: number;
  status: "active" | "ended";
  endedAt?: string;
  outcome?: TrialOutcome;
}

export interface MetricReading {
  /** `concern` or `concern:region`. */
  key: string;
  concern: Concern;
  region: string;
  /** Model score, 1 to 100. Higher is healthier looking. Used for all maths. */
  raw: number;
  /** Display score. YouCam adjusts it upwards for motivation; never used for maths. */
  ui?: number;
  maskUrl?: string;
}

export interface CaptureConditions {
  /** Mean luminance inside the face guide, 0 to 255. */
  luma: number;
  /** Left minus right luminance, as a fraction of the mean. Positive means lit from the left. */
  balance: number;
  /** Red over blue ratio. Above 1 is warm light. */
  warmth: number;
  /** Variance of the Laplacian on a downscaled frame. Higher is sharper. */
  sharpness: number;
  /** Fraction of blown-out pixels inside the face guide. */
  clipped: number;
  width: number;
  height: number;
}

export interface CheckInData {
  id: string;
  trialId: string;
  takenAt: string;
  kind: "baseline" | "check-in";
  /** Photos taken back to back in one sitting share a session id. */
  session: string;
  readings: MetricReading[];
  overall?: number;
  skinAge?: number;
  skinType?: Record<string, string>;
  conditions: CaptureConditions;
  taskId: string;
}

export interface CheckIn extends CheckInData {
  photo: Blob;
  /** Detection masks keyed by metric key, saved locally because YouCam URLs expire. */
  masks: Record<string, Blob>;
}
