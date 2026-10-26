import { describe, expect, it } from "vitest";
import { forSpeech, spokenVerdict } from "@/components/verdict/spoken";
import { EXAMPLE_NOW, EXAMPLE_TRIAL, exampleCheckIns } from "@/lib/domain/example";
import { evaluateTrial, type TrialVerdict } from "@/lib/domain/verdict";

const EMOJI = /\p{Extended_Pictographic}/u;

describe("spoken verdict", () => {
  const verdict: TrialVerdict = evaluateTrial(EXAMPLE_TRIAL, exampleCheckIns(), EXAMPLE_NOW);
  const text = spokenVerdict(verdict, EXAMPLE_TRIAL.product.name);

  it("starts with the product, the week and the decision", () => {
    expect(text.startsWith(`${EXAMPLE_TRIAL.product.name}. Week ${verdict.week}. Verdict: `)).toBe(true);
    expect(text).toContain(verdict.headline.replace(/[.!?]$/, ""));
  });

  it("names every target with its status and change in words", () => {
    for (const c of verdict.concerns.filter((x) => x.isTarget)) {
      if (c.estimate) expect(text).toMatch(/(up|down) \d+\.\d points|unchanged/);
    }
  });

  it("is plain speech: no symbols that a voice would read awkwardly", () => {
    // "%" is fine: speech engines read "10%" as "ten percent".
    expect(text.match(/.{0,40}([+±]|--|\/|\s\s).{0,40}/)?.[0] ?? null).toBeNull();
    expect(EMOJI.test(text)).toBe(false);
  });

  it("rewrites written notation as words", () => {
    expect(forSpeech("improved by +6.2 points")).toBe("improved by 6.2 points");
    expect(forSpeech("noise ±2.2  points")).toBe("noise plus or minus 2.2 points");
    expect(forSpeech("Brand / Niacinamide")).toBe("Brand, Niacinamide");
  });

  it("leaves out next dates once the trial has ended", () => {
    const ended = spokenVerdict(verdict, "Serum", { ended: true });
    expect(ended).not.toContain("Next check-in");
    expect(text).toContain("Next check-in");
  });
});
