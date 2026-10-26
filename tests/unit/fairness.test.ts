import { describe, expect, it } from "vitest";
import { FACE_GUIDE, assessConditions, measureFrame, type PixelFrame } from "@/lib/capture/quality";

/**
 * The photo checks must treat every skin tone the same in the same light.
 * Swatches are the ten tones of the Monk Skin Tone scale (Google, 2022),
 * from lightest (1) to darkest (10).
 */
const MONK: Record<number, [number, number, number]> = {
  1: [0xf6, 0xed, 0xe4],
  2: [0xf3, 0xe7, 0xdb],
  3: [0xf7, 0xea, 0xd0],
  4: [0xea, 0xda, 0xba],
  5: [0xd7, 0xbd, 0x96],
  6: [0xa0, 0x7e, 0x56],
  7: [0x82, 0x5c, 0x43],
  8: [0x60, 0x41, 0x34],
  9: [0x3a, 0x31, 0x2a],
  10: [0x29, 0x24, 0x20],
};

const WALL: [number, number, number] = [205, 200, 190];

/**
 * A 150 x 200 frame: a lit wall, and a face that fills the guide oval.
 * `light` scales everything, as a brighter or darker room would.
 * `texture` is skin detail as a fraction of the skin's own brightness, so the
 * same skin detail is drawn on every tone.
 */
function portrait(tone: [number, number, number], light: number, texture: number): PixelFrame {
  const w = 150;
  const h = 200;
  const data = new Uint8ClampedArray(w * h * 4);
  let s = 7;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - FACE_GUIDE.cx * w) / (FACE_GUIDE.rx * w * 1.15);
      const dy = (y - FACE_GUIDE.cy * h) / (FACE_GUIDE.ry * h * 1.15);
      const onFace = dx * dx + dy * dy <= 1;
      const grain = onFace ? 1 + texture * (rnd() * 2 - 1) : 1;
      const [r, g, b] = onFace ? tone : WALL;
      const i = (y * w + x) * 4;
      data[i] = r * light * grain;
      data[i + 1] = g * light * grain;
      data[i + 2] = b * light * grain;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

const TONES = Object.entries(MONK).map(([n, rgb]) => ({ n: Number(n), rgb }));
const ids = (light: number, texture = 0.04) => (rgb: [number, number, number]) =>
  assessConditions(measureFrame(portrait(rgb, light, texture))).map((i) => `${i.id}:${i.level}`);

describe("photo checks are fair across the Monk Skin Tone scale", () => {
  it.each(TONES)("tone $n in good light passes with no issues", ({ rgb }) => {
    expect(ids(1)(rgb)).toEqual([]);
  });

  it.each(TONES)("tone $n in a dark room is blocked as too dark", ({ rgb }) => {
    expect(ids(0.25)(rgb)).toContain("dark:block");
  });

  it.each(TONES)("tone $n with no skin detail is flagged as blurry", ({ rgb }) => {
    expect(ids(1, 0)(rgb)).toContain("blur:warn");
  });

  it.each(TONES)("tone $n with fine skin detail is not flagged as blurry", ({ rgb }) => {
    expect(ids(1, 0.02)(rgb)).not.toContain("blur:warn");
  });

  it("gives every tone the same decision at every light level", () => {
    for (const light of [0.2, 0.25, 0.35, 0.6, 0.8, 1]) {
      const decisions = new Set(TONES.map(({ rgb }) => ids(light)(rgb).filter((i) => i.startsWith("dark") || i.startsWith("dim")).join(",")));
      expect([...decisions], `light ${light}`).toHaveLength(1);
    }
  });

  it("would have failed under the old rule, which judged light by face brightness", () => {
    // The old rule blocked a mean face brightness below 70 and warned on one above 220.
    const darkest = measureFrame(portrait(MONK[10]!, 1, 0.04));
    const lightest = measureFrame(portrait(MONK[1]!, 1, 0.04));
    expect(darkest.luma).toBeLessThan(70);
    expect(lightest.luma).toBeGreaterThan(220);
    expect(darkest.exposure).toBeGreaterThan(150);
  });

  it("still compares face brightness with the same person's baseline", () => {
    const base = measureFrame(portrait(MONK[9]!, 1, 0.04));
    const later = measureFrame(portrait(MONK[9]!, 0.55, 0.04));
    expect(assessConditions(later, base).find((i) => i.id === "match-luma")?.level).toBe("block");
  });
});
