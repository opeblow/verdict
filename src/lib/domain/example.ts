import { metricKey, type Concern } from "./concerns";
import type { CheckInData, Trial } from "./model";

/**
 * A fixed, clearly labelled example trial used on the landing page and in
 * tests. It is computed by the real verdict engine; only the scores are
 * illustrative.
 */

export const EXAMPLE_START = "2026-08-03T08:00:00.000Z";
export const EXAMPLE_NOW = new Date("2026-09-29T09:00:00.000Z");

export const EXAMPLE_TRIAL: Trial = {
  id: "example",
  createdAt: EXAMPLE_START,
  startedAt: EXAMPLE_START,
  product: { name: "Niacinamide 10% serum", brand: "Example brand", source: "manual", price: 12, currency: "USD", weeksPerUnit: 8 },
  activeIds: ["niacinamide", "zinc"],
  targets: ["pore", "oiliness"],
  concerns: ["pore", "oiliness", "redness", "moisture", "texture", "acne", "radiance", "age_spot"],
  mode: "hd",
  protocol: { place: "Bathroom, facing the window", timeOfDay: "morning" },
  cadenceDays: 7,
  status: "active",
};

const SERIES: Partial<Record<Concern, number[]>> = {
  // Two baseline photos, then weekly check-ins W1..W8.
  pore: [51.2, 49.9, 50.8, 52.3, 51.6, 53.9, 54.4, 55.8, 56.1, 57.0],
  oiliness: [60.4, 61.9, 62.5, 63.8, 64.9, 64.1, 66.7, 67.2, 68.4, 68.0],
  redness: [70.1, 69.2, 70.4, 69.6, 70.9, 70.2, 69.8, 70.6, 71.1, 70.3],
  moisture: [55.0, 56.1, 55.4, 54.8, 56.3, 55.7, 56.0, 55.2, 56.4, 55.9],
  texture: [64.2, 63.1, 64.0, 64.9, 64.4, 65.2, 65.0, 65.8, 66.1, 65.7],
  acne: [72.3, 73.0, 72.1, 72.8, 73.4, 72.6, 73.1, 73.9, 73.2, 74.0],
  radiance: [58.8, 59.6, 59.1, 60.2, 59.4, 60.0, 60.6, 59.9, 60.8, 60.4],
  age_spot: [77.9, 78.4, 78.0, 77.6, 78.3, 78.8, 78.1, 78.5, 78.9, 78.6],
};

const DAY = 86_400_000;

export function exampleCheckIns(trial: Trial = EXAMPLE_TRIAL, weeks = 8): CheckInData[] {
  const start = new Date(trial.startedAt).getTime();
  const out: CheckInData[] = [];
  for (let i = 0; i < 2 + weeks; i++) {
    const isBaseline = i < 2;
    const week = isBaseline ? 0 : i - 1;
    const takenAt = new Date(start + week * 7 * DAY + (isBaseline ? i * 90_000 : 0)).toISOString();
    out.push({
      id: `example-${i}`,
      trialId: trial.id,
      takenAt,
      kind: isBaseline ? "baseline" : "check-in",
      session: isBaseline ? "example-s0" : `example-s${week}`,
      readings: trial.concerns
        .filter((c) => SERIES[c])
        .map((c) => ({ key: metricKey(c), concern: c, region: "whole", raw: SERIES[c]![i]!, ui: Math.round(60 + SERIES[c]![i]! * 0.35) })),
      conditions: { luma: 142, balance: 0.04, warmth: 1.18, sharpness: 48, clipped: 0.004, width: 1440, height: 1920 },
      taskId: `example-task-${i}`,
    });
  }
  return out;
}
