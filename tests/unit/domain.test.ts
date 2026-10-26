import { describe, expect, it } from "vitest";
import { assessConditions, matchScore, measureFrame } from "@/lib/capture/quality";
import { checkInCalendar } from "@/lib/client/ics";
import { CONCERNS, fromActionType, metricLabel, planConcerns, toAction, unitCost } from "@/lib/domain/concerns";
import { ACTIVES, detectActives, suggestedTargets, timelineFor } from "@/lib/domain/ingredients";
import type { CaptureConditions } from "@/lib/domain/model";

describe("concerns", () => {
  it("round-trips every concern through both API naming schemes", () => {
    for (const c of CONCERNS) {
      expect(fromActionType(toAction(c, "hd"))).toBe(c);
      expect(fromActionType(toAction(c, "sd"))).toBe(c);
    }
    expect(toAction("dark_circle", "sd")).toBe("dark_circle_v2");
    expect(toAction("dark_circle", "hd")).toBe("hd_dark_circle");
  });

  it("matches the published unit tiers", () => {
    expect(unitCost(4, "hd")).toBe(12);
    expect(unitCost(5, "hd")).toBe(16);
    expect(unitCost(8, "sd")).toBe(12);
    expect(unitCost(16, "hd")).toBe(22);
  });

  it("always includes the redness safety monitor and fills to the tier edge", () => {
    const plan = planConcerns(["pore", "oiliness"]);
    expect(plan.slice(0, 3)).toEqual(["pore", "oiliness", "redness"]);
    expect(plan).toHaveLength(4);
    const five = planConcerns(["pore", "oiliness", "wrinkle", "texture", "age_spot"]);
    expect(five).toHaveLength(8);
    expect(new Set(five).size).toBe(8);
  });

  it("labels regional metrics", () => {
    expect(metricLabel("pore:nose")).toBe("Pores, nose");
    expect(metricLabel("wrinkle")).toBe("Fine lines");
  });
});

describe("ingredients", () => {
  it("finds actives in a real-world INCI list", () => {
    const inci = "Aqua, Niacinamide, Pentylene Glycol, Zinc PCA, Dimethyl Isosorbide, Tamarindus Indica Seed Gum, Xanthan Gum";
    expect(detectActives(inci).map((a) => a.id)).toEqual(["niacinamide", "zinc"]);
  });

  it("detects retinoids and vitamin C derivatives", () => {
    const ids = detectActives("Water, Squalane, Retinol, Ascorbyl Glucoside, Tocopherol").map((a) => a.id);
    expect(ids).toContain("retinol");
    expect(ids).toContain("vitamin-c");
  });

  it("suggests the most commonly targeted concerns first", () => {
    const actives = detectActives("niacinamide, zinc pca");
    expect(suggestedTargets(actives)[0]).toBe("oiliness");
  });

  it("uses the slowest active and at least one skin cycle for structural concerns", () => {
    const ha = ACTIVES.filter((a) => a.id === "hyaluronic");
    expect(timelineFor("moisture", ha).callWeek).toBe(2);
    const mix = ACTIVES.filter((a) => a.id === "glycolic" || a.id === "retinol");
    expect(timelineFor("texture", mix).callWeek).toBe(8);
    expect(timelineFor("wrinkle", []).callWeek).toBe(8);
  });

  it("has a sane timeline for every active", () => {
    for (const a of ACTIVES) {
      for (const t of a.targets) {
        expect(t.fromWeek).toBeGreaterThan(0);
        expect(t.callWeek).toBeGreaterThanOrEqual(t.fromWeek);
        expect(t.callWeek).toBeLessThanOrEqual(16);
      }
    }
  });
});

function frame(w: number, h: number, pixel: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  return { data, width: w, height: h };
}

describe("capture quality", () => {
  it("measures brightness, side light and warmth", () => {
    const even = measureFrame(frame(60, 80, () => [180, 140, 120]));
    expect(even.luma).toBeGreaterThan(130);
    expect(Math.abs(even.balance)).toBeLessThan(0.01);
    expect(even.warmth).toBeCloseTo(1.5, 1);

    const sideLit = measureFrame(frame(60, 80, (x) => (x < 30 ? [200, 200, 200] : [90, 90, 90])));
    expect(sideLit.balance).toBeGreaterThan(0.3);
    expect(assessConditions(sideLit).some((i) => i.id === "side" && i.level === "block")).toBe(true);
  });

  it("blocks a dark frame and flags a blurry flat one", () => {
    const dark = measureFrame(frame(60, 80, () => [30, 30, 30]));
    const issues = assessConditions(dark);
    expect(issues[0]).toMatchObject({ id: "dark", level: "block" });
    expect(issues.some((i) => i.id === "blur")).toBe(true);
  });

  it("detects texture as sharpness", () => {
    const checker = measureFrame(frame(60, 80, (x, y) => ((x + y) % 2 ? [200, 170, 150] : [110, 90, 80])));
    expect(checker.sharpness).toBeGreaterThan(100);
  });

  const base: CaptureConditions = { luma: 140, balance: 0.02, warmth: 1.2, sharpness: 40, clipped: 0, width: 1080, height: 1440 };

  it("compares against the baseline photo", () => {
    expect(assessConditions(base, base)).toEqual([]);
    expect(matchScore(base, base)).toBe(100);
    const brighter = { ...base, luma: 200 };
    expect(assessConditions(brighter, base).find((i) => i.id === "match-luma")?.level).toBe("block");
    const lamp = { ...base, warmth: 1.5 };
    expect(assessConditions(lamp, base).some((i) => i.id === "match-warmth")).toBe(true);
    expect(matchScore(lamp, base)).toBeLessThan(100);
  });
});

describe("calendar reminders", () => {
  it("produces a valid recurring iCalendar event", () => {
    const ics = checkInCalendar(
      { uid: "abc", productName: "Serum; with, commas", firstCheckIn: new Date("2026-11-02T08:00:00Z"), cadenceDays: 7, count: 8, url: "https://example.test/trials/abc" },
      new Date("2026-10-26T08:00:00Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261102T080000Z");
    expect(ics).toContain("RRULE:FREQ=DAILY;INTERVAL=7;COUNT=8");
    expect(ics).toContain("Serum\\; with\\, commas");
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });
});
