import { describe, expect, it } from "vitest";
import {
  MIN_NOISE_SD,
  PRIOR_NOISE_SD,
  classifyChange,
  estimateChange,
  estimateNoise,
  smallestDetectableChange,
  tCritical95,
} from "@/lib/domain/stats";

describe("estimateNoise", () => {
  it("returns the prior when there are no replicates", () => {
    const n = estimateNoise([]);
    expect(n.sd).toBeCloseTo(PRIOR_NOISE_SD, 5);
    expect(n.pairs).toBe(0);
  });

  it("shrinks a single tight pair towards the prior instead of trusting it", () => {
    const n = estimateNoise([[50, 50.1]]);
    expect(n.sd).toBeGreaterThan(1.8);
    expect(n.sd).toBeLessThan(PRIOR_NOISE_SD);
  });

  it("grows with noisy replicates", () => {
    const n = estimateNoise([
      [50, 60],
      [40, 52],
      [70, 61],
    ]);
    expect(n.sd).toBeGreaterThan(PRIOR_NOISE_SD);
  });

  it("never drops below the floor", () => {
    const n = estimateNoise(Array.from({ length: 200 }, () => [50, 50] as [number, number]));
    expect(n.sd).toBe(MIN_NOISE_SD);
  });
});

describe("tCritical95", () => {
  it("matches the textbook values", () => {
    expect(tCritical95(1)).toBeCloseTo(12.706, 3);
    expect(tCritical95(10)).toBeCloseTo(2.228, 3);
    expect(tCritical95(1000)).toBe(1.96);
  });
});

describe("estimateChange", () => {
  const noise = estimateNoise([[50, 51]]);

  it("needs at least two distinct days", () => {
    expect(estimateChange([], noise)).toBeNull();
    expect(estimateChange([{ day: 0, value: 50 }], noise)).toBeNull();
    expect(
      estimateChange(
        [
          { day: 0, value: 50 },
          { day: 0.001, value: 51 },
        ],
        noise,
      ),
    ).toBeNull();
  });

  it("recovers a clear linear improvement", () => {
    const pts = Array.from({ length: 9 }, (_, w) => ({ day: w * 7, value: 50 + w * 1.0 }));
    const est = estimateChange(pts, noise)!;
    expect(est.change).toBeCloseTo(8, 5);
    expect(est.slopePerWeek).toBeCloseTo(1, 5);
    expect(est.low).toBeGreaterThan(0);
    expect(classifyChange(est)).toBe("improved");
  });

  it("does not call a flat noisy series an improvement", () => {
    const vals = [50, 52, 49, 51, 50, 48, 51, 50, 49];
    const est = estimateChange(
      vals.map((v, w) => ({ day: w * 7, value: v })),
      noise,
    )!;
    expect(classifyChange(est)).not.toBe("improved");
    expect(classifyChange(est)).not.toBe("worsened");
  });

  it("uses measurement noise as a floor when the fit looks too perfect", () => {
    const perfect = [
      { day: 0, value: 50 },
      { day: 7, value: 51 },
      { day: 14, value: 52 },
    ];
    const est = estimateChange(perfect, estimateNoise([], 5))!;
    expect(est.high - est.low).toBeGreaterThan(5);
  });
});

describe("classifyChange", () => {
  it("calls no-change only when a meaningful benefit is confidently ruled out", () => {
    expect(classifyChange({ change: 0.5, low: -1.5, high: 2.5 })).toBe("no-change");
    expect(classifyChange({ change: 0.5, low: -4, high: 5 })).toBe("inconclusive");
  });

  it("requires both significance and a meaningful size", () => {
    expect(classifyChange({ change: 2, low: 0.5, high: 3.5 })).toBe("inconclusive");
    expect(classifyChange({ change: 4, low: 1, high: 7 })).toBe("improved");
    expect(classifyChange({ change: -4, low: -7, high: -1 })).toBe("worsened");
  });
});

describe("smallestDetectableChange", () => {
  it("is 1.96 * sqrt(2) * sd", () => {
    expect(smallestDetectableChange({ sd: 2, df: 5, pairs: 1 })).toBeCloseTo(5.544, 3);
  });
});
