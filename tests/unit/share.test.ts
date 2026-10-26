import { describe, expect, it } from "vitest";
import { photoCount, reviewText } from "@/components/verdict/share";
import { CONCERN_INFO } from "@/lib/domain/concerns";
import { EXAMPLE_NOW, EXAMPLE_TRIAL, exampleCheckIns } from "@/lib/domain/example";
import { evaluateTrial } from "@/lib/domain/verdict";

describe("shareable review text", () => {
  const checkIns = exampleCheckIns();
  const verdict = evaluateTrial(EXAMPLE_TRIAL, checkIns, EXAMPLE_NOW);
  const text = reviewText(verdict, EXAMPLE_TRIAL.product);

  it("names the product, the time used and the decision", () => {
    expect(text).toContain(`Measured result: ${EXAMPLE_TRIAL.product.name}`);
    expect(text).toContain(`after ${verdict.week} weeks of use`);
    expect(text).toContain(`Verdict: Keep. ${verdict.headline}`);
  });

  it("gives every target its change with the 95% range, so a reader can judge it", () => {
    for (const c of verdict.concerns.filter((x) => x.isTarget)) {
      const line = text.split("\n").find((l) => l.startsWith(`${CONCERN_INFO[c.concern].label}:`));
      expect(line, c.concern).toBeDefined();
      if (c.estimate) expect(line).toMatch(/[+-]?\d+\.\d points \(95% range [+-]?\d+\.\d to [+-]?\d+\.\d\)/);
    }
    expect(text).toMatch(/My photos vary by about \d+\.\d points on their own/);
  });

  it("states how it was measured and that it is cosmetic only", () => {
    expect(text).toContain(`Measured from ${photoCount(verdict)} photos in matched light`);
    expect(photoCount(verdict)).toBe(checkIns.length);
    expect(text).toContain("not a medical assessment");
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("includes the brand when there is one", () => {
    expect(reviewText(verdict, { name: "Serum", brand: "Acme" })).toContain("Serum (Acme)");
  });
});
