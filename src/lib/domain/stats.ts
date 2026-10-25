/**
 * Small, dependency-free statistics used to decide whether a change in a skin
 * score is larger than the measurement noise.
 *
 * Approach:
 * 1. Measurement noise is estimated from back-to-back replicate photos taken
 *    at baseline, shrunk towards a conservative prior so two photos cannot
 *    produce an overconfident estimate.
 * 2. The change since baseline is estimated with ordinary least squares over
 *    every check-in, so one lucky photo cannot flip the result.
 *    Residual scatter around the trend is pooled with the replicate
 *    estimate, because it is further evidence about the same noise.
 * 3. The result is classified against a minimum meaningful change. For the
 *    purchase decision the question is one-sided: "No change" is reported
 *    only when the upper end of the interval is below a meaningful benefit.
 */

export interface Point {
  /** Days since the trial started. */
  day: number;
  value: number;
}

export interface NoiseEstimate {
  sd: number;
  /** Effective degrees of freedom behind `sd`. */
  df: number;
  /** How many replicate pairs contributed. */
  pairs: number;
}

/** Prior noise in raw score points, before any replicate is observed. */
export const PRIOR_NOISE_SD = 2.5;
/** Weight of the prior, in pseudo replicate pairs. */
export const PRIOR_WEIGHT = 3;
/** Floor so the engine never claims near-perfect precision. */
export const MIN_NOISE_SD = 1;
/** Smallest change, in raw score points, worth telling someone about. */
export const DEFAULT_MEANINGFUL_CHANGE = 3;

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Two-sided 95% critical values of Student's t, by degrees of freedom. */
const T95: readonly number[] = [
  Number.NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
  2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086,
  2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];

export function tCritical95(df: number): number {
  if (!Number.isFinite(df) || df >= 120) return 1.96;
  const d = Math.max(1, Math.floor(df));
  if (d < T95.length) return T95[d]!;
  if (d < 40) return 2.03;
  if (d < 60) return 2.01;
  return 1.99;
}

/**
 * Estimate per-photo measurement noise from replicate pairs.
 * For a pair (a, b) of the same skin, Var(a - b) = 2 sigma^2.
 */
export function estimateNoise(
  pairs: ReadonlyArray<readonly [number, number]>,
  prior = PRIOR_NOISE_SD,
  priorWeight = PRIOR_WEIGHT,
): NoiseEstimate {
  const ss = pairs.reduce((s, [a, b]) => s + ((a - b) * (a - b)) / 2, 0);
  const variance = (priorWeight * prior * prior + ss) / (priorWeight + pairs.length);
  return {
    sd: Math.max(MIN_NOISE_SD, Math.sqrt(variance)),
    df: priorWeight + pairs.length,
    pairs: pairs.length,
  };
}

export interface ChangeEstimate {
  /** Estimated change from day 0 to the latest check-in, in raw points. */
  change: number;
  low: number;
  high: number;
  /** Points per week. */
  slopePerWeek: number;
  n: number;
  spanDays: number;
  /** Fitted values at the first and last day, for drawing the trend line. */
  fit: { day: number; value: number }[];
}

/**
 * Least-squares change since baseline with a 95% interval.
 * Returns null until there are at least two distinct days of data.
 */
export function estimateChange(points: readonly Point[], noise: NoiseEstimate): ChangeEstimate | null {
  const n = points.length;
  if (n < 2) return null;
  const days = points.map((p) => p.day);
  const minDay = Math.min(...days);
  const maxDay = Math.max(...days);
  if (maxDay - minDay < 0.5) return null;

  const mx = mean(days);
  const my = mean(points.map((p) => p.value));
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.day - mx) ** 2;
    sxy += (p.day - mx) * (p.value - my);
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;

  let ssr = 0;
  for (const p of points) ssr += (p.value - (intercept + slope * p.day)) ** 2;
  const residualDf = Math.max(0, n - 2);
  // Pool replicate noise (with its prior) and residual scatter, weighted by
  // degrees of freedom. With few points the prior dominates, so a lucky
  // near-perfect fit cannot produce false confidence.
  const errorVar = Math.max(MIN_NOISE_SD ** 2, (noise.df * noise.sd ** 2 + ssr) / (noise.df + residualDf));
  const df = Math.max(1, residualDf + noise.df);

  const span = maxDay - minDay;
  const change = slope * span;
  const se = span * Math.sqrt(errorVar / sxx);
  const t = tCritical95(df);

  return {
    change,
    low: change - t * se,
    high: change + t * se,
    slopePerWeek: slope * 7,
    n,
    spanDays: span,
    fit: [
      { day: minDay, value: intercept + slope * minDay },
      { day: maxDay, value: intercept + slope * maxDay },
    ],
  };
}

export type ChangeClass = "improved" | "worsened" | "no-change" | "inconclusive";

/**
 * Classification against a minimum meaningful change (mmc).
 * - improved: interval entirely above zero and the estimate is meaningful
 * - worsened: interval entirely below zero and the estimate is meaningful
 * - no-change: confident the benefit is smaller than meaningful (upper bound below mmc)
 * - inconclusive: anything else, meaning more data is needed
 */
export function classifyChange(est: Pick<ChangeEstimate, "change" | "low" | "high">, mmc = DEFAULT_MEANINGFUL_CHANGE): ChangeClass {
  if (est.low > 0 && est.change >= mmc) return "improved";
  if (est.high < 0 && est.change <= -mmc) return "worsened";
  if (est.high < mmc) return "no-change";
  return "inconclusive";
}

/** Smallest change one new photo could reliably detect against one baseline photo. */
export function smallestDetectableChange(noise: NoiseEstimate): number {
  return 1.96 * Math.SQRT2 * noise.sd;
}
