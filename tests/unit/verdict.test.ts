import { describe, expect, it } from "vitest";
import { metricKey, type Concern } from "@/lib/domain/concerns";
import { EXAMPLE_NOW, EXAMPLE_TRIAL, exampleCheckIns } from "@/lib/domain/example";
import type { CheckInData, Trial } from "@/lib/domain/model";
import { evaluateTrial, replicatePairs } from "@/lib/domain/verdict";

const DAY = 86_400_000;
const START = "2026-01-05T08:00:00.000Z";

function trial(overrides: Partial<Trial> = {}): Trial {
  return {
    id: "t",
    createdAt: START,
    startedAt: START,
    product: { name: "Test", source: "manual" },
    activeIds: ["niacinamide"],
    targets: ["pore"],
    concerns: ["pore", "redness", "acne"],
    mode: "hd",
    protocol: {},
    cadenceDays: 7,
    status: "active",
    ...overrides,
  };
}

/** Build check-ins from per-concern series. Index 0 and 1 are the baseline pair. */
function checkIns(series: Partial<Record<Concern, number[]>>, t: Trial = trial()): CheckInData[] {
  const len = Math.max(...Object.values(series).map((s) => s!.length));
  return Array.from({ length: len }, (_, i) => {
    const week = i < 2 ? 0 : i - 1;
    return {
      id: `c${i}`,
      trialId: t.id,
      takenAt: new Date(new Date(START).getTime() + week * 7 * DAY + (i < 2 ? i * 60_000 : 0)).toISOString(),
      kind: i < 2 ? "baseline" : "check-in",
      session: i < 2 ? "s0" : `s${week}`,
      readings: Object.entries(series)
        .filter(([, s]) => s![i] !== undefined)
        .map(([c, s]) => ({ key: metricKey(c as Concern), concern: c as Concern, region: "whole", raw: s![i]! })),
      conditions: { luma: 140, balance: 0, warmth: 1.1, sharpness: 40, clipped: 0, width: 1080, height: 1440 },
      taskId: `task${i}`,
    } satisfies CheckInData;
  });
}

const at = (weeks: number) => new Date(new Date(START).getTime() + weeks * 7 * DAY + 3600_000);
const flat = (n: number, v = 70) => Array.from({ length: n }, (_, i) => v + (i % 2 ? 0.4 : -0.4));

describe("evaluateTrial", () => {
  it("reports baseline until a follow-up exists", () => {
    const v = evaluateTrial(trial(), checkIns({ pore: [50, 51], redness: [70, 70] }), at(0));
    expect(v.decision).toBe("baseline");
  });

  it("says wait before the call week even if numbers moved a little", () => {
    const v = evaluateTrial(trial(), checkIns({ pore: [50, 51, 51.5, 52], redness: flat(4) }), at(2));
    expect(v.decision).toBe("wait");
    expect(v.headline).toMatch(/Too early/);
  });

  it("keeps a product once a target clearly improves", () => {
    const pore = [50, 51, 51, 52.5, 53, 54.5, 55, 56.5, 57, 58.5];
    const v = evaluateTrial(trial(), checkIns({ pore, redness: flat(10) }), at(8));
    expect(v.decision).toBe("keep");
    expect(v.concerns.find((c) => c.concern === "pore")!.status).toBe("improved");
  });

  it("tells you to stop when redness rises, at any week", () => {
    const v = evaluateTrial(trial(), checkIns({ pore: [50, 51, 50, 51], redness: [72, 71, 66, 63] }), at(2));
    expect(v.decision).toBe("stop");
    expect(v.headline).toMatch(/Pause/);
  });

  it("recognises likely purging with a retinoid in the first weeks", () => {
    const t = trial({ activeIds: ["retinol"], targets: ["acne", "texture"], concerns: ["acne", "texture", "redness"] });
    const v = evaluateTrial(t, checkIns({ acne: [75, 76, 70, 66, 64], texture: flat(5, 60), redness: flat(5) }, t), at(3));
    expect(v.decision).toBe("wait");
    expect(v.concerns.find((c) => c.concern === "acne")!.status).toBe("purging");
  });

  it("does not excuse worsening blemishes as purging for a non-purging product", () => {
    const t = trial({ activeIds: ["hyaluronic"], targets: ["acne"], concerns: ["acne", "redness"] });
    const v = evaluateTrial(t, checkIns({ acne: [75, 76, 70, 66, 64, 62, 61, 60, 59, 58], redness: flat(10) }, t), at(8));
    expect(v.concerns.find((c) => c.concern === "acne")!.status).toBe("worsened");
    expect(v.decision).toBe("stop");
  });

  it("says don't rebuy after a fair trial with confidently no change", () => {
    const pore = [50, 50.4, 50.2, 49.8, 50.3, 50.1, 49.9, 50.2, 50.0, 50.3];
    const v = evaluateTrial(trial(), checkIns({ pore, redness: flat(10) }), at(8));
    expect(v.decision).toBe("switch");
  });

  it("asks for more data when the result is unclear past the deadline", () => {
    const pore = [50, 56, 47, 58, 49, 57, 50, 59];
    const v = evaluateTrial(trial(), checkIns({ pore, redness: flat(8) }), at(8));
    expect(v.decision).toBe("extend");
  });

  it("reports the redness monitor as no reaction when it is flat", () => {
    const pore = [50, 51, 51, 52.5, 53, 54.5, 55, 56.5, 57, 58.5];
    const v = evaluateTrial(trial(), checkIns({ pore, redness: flat(10), acne: flat(10, 72) }), at(8));
    expect(v.concerns.find((c) => c.concern === "redness")!.status).toBe("no-reaction");
    expect(v.concerns.find((c) => c.concern === "acne")!.status).toBe("steady");
  });

  it("computes the landing page example as a keep", () => {
    const v = evaluateTrial(EXAMPLE_TRIAL, exampleCheckIns(), EXAMPLE_NOW);
    expect(v.decision).toBe("keep");
    expect(v.week).toBe(8);
  });
});

describe("replicatePairs", () => {
  it("pairs the first two photos of each sitting", () => {
    const list = checkIns({ pore: [50, 52, 55] });
    expect(replicatePairs(list, "pore")).toEqual([[50, 52]]);
  });
});
