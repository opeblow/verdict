import type { CaptureConditions } from "../domain/model";

/**
 * Photo condition checks, run on a small downscaled frame many times a second.
 *
 * Skin scores move with lighting. A brighter bathroom can look like better
 * radiance, and a lamp on one side can look like uneven texture. Verdict
 * therefore measures the light on every photo and compares it against the
 * baseline before it lets a photo count.
 *
 * Every absolute check must give the same answer for every skin tone in the
 * same light. Mean face brightness fails that test: the darkest tones on the
 * Monk Skin Tone scale read as "too dark" in perfect light, and the lightest
 * as "glare". So absolute checks use measures that depend on the light, not
 * the skin: scene exposure, blown-out pixels, and contrast-relative sharpness.
 * Mean face brightness is only compared with the same person's baseline.
 */

export interface PixelFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** The face guide oval, as fractions of the frame. Shared with the camera overlay. */
export const FACE_GUIDE = { cx: 0.5, cy: 0.46, rx: 0.34, ry: 0.3 } as const;

/** Width of the border strip used to judge room light, as a fraction of each side. */
export const ROOM_EDGE = 0.12;

function insideGuide(x: number, y: number, w: number, h: number): boolean {
  const dx = (x - FACE_GUIDE.cx * w) / (FACE_GUIDE.rx * w);
  const dy = (y - FACE_GUIDE.cy * h) / (FACE_GUIDE.ry * h);
  return dx * dx + dy * dy <= 1;
}

export function measureFrame(frame: PixelFrame, fullSize?: { width: number; height: number }): CaptureConditions {
  const { data, width: w, height: h } = frame;
  const luma = new Float32Array(w * h);
  let sum = 0;
  let n = 0;
  let left = 0;
  let leftN = 0;
  let right = 0;
  let rightN = 0;
  let r = 0;
  let b = 0;
  let clipped = 0;
  const cx = FACE_GUIDE.cx * w;
  const roomHist = new Uint32Array(256);
  let roomN = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const R = data[i]!;
      const G = data[i + 1]!;
      const B = data[i + 2]!;
      const l = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      luma[y * w + x] = l;
      if (x < ROOM_EDGE * w || x >= (1 - ROOM_EDGE) * w || y < ROOM_EDGE * h || y >= (1 - ROOM_EDGE) * h) {
        roomHist[Math.min(255, Math.round(l))]!++;
        roomN++;
      }
      if (!insideGuide(x, y, w, h)) continue;
      sum += l;
      n++;
      r += R;
      b += B;
      if (l >= 250) clipped++;
      if (x < cx) {
        left += l;
        leftN++;
      } else {
        right += l;
        rightN++;
      }
    }
  }

  const mean = n ? sum / n : 0;
  const lMean = leftN ? left / leftN : 0;
  const rMean = rightN ? right / rightN : 0;

  // Variance of the 4-neighbour Laplacian inside the guide: a standard blur metric.
  let lapSum = 0;
  let lapSq = 0;
  let lapN = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!insideGuide(x, y, w, h)) continue;
      const c = luma[y * w + x]!;
      const v = luma[(y - 1) * w + x]! + luma[(y + 1) * w + x]! + luma[y * w + x - 1]! + luma[y * w + x + 1]! - 4 * c;
      lapSum += v;
      lapSq += v * v;
      lapN++;
    }
  }
  const lapMean = lapN ? lapSum / lapN : 0;
  const sharpness = lapN ? lapSq / lapN - lapMean * lapMean : 0;

  // The brighter parts of the room track the light and not the skin. Only a
  // strip along the frame's edges is used, which a framed face does not reach:
  // even face highlights, or skin just outside the guide, are brighter on
  // lighter skin and would let a lighter face pass where a darker one is blocked.
  const exposure = percentile(roomHist, roomN, 0.9);

  return {
    luma: round(mean),
    exposure: round(exposure),
    balance: round(mean ? (lMean - rMean) / mean : 0, 3),
    warmth: round(b ? r / b : 1, 3),
    sharpness: round(sharpness),
    clipped: round(n ? clipped / n : 0, 4),
    width: fullSize?.width ?? w,
    height: fullSize?.height ?? h,
  };
}

function percentile(hist: Uint32Array, total: number, p: number): number {
  if (!total) return 0;
  const target = p * total;
  let seen = 0;
  for (let v = 0; v < hist.length; v++) {
    seen += hist[v]!;
    if (seen >= target) return v;
  }
  return 255;
}

function round(v: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export type IssueLevel = "block" | "warn";

export interface CaptureIssue {
  id: string;
  level: IssueLevel;
  message: string;
}

export const LIMITS = {
  /**
   * Room exposure below this blocks the photo. 75 and 100 keep the strictness
   * the old face-brightness rule had for a mid-range skin tone, while applying
   * it equally to every tone.
   */
  tooDark: 75,
  /** Room exposure below this warns. */
  dim: 100,
  /** Fraction of blown-out face pixels above this warns. */
  glare: 0.06,
  sideLightWarn: 0.15,
  sideLightBlock: 0.28,
  blurry: 12,
  matchLumaWarn: 0.18,
  matchLumaBlock: 0.35,
  matchWarmth: 0.15,
  matchBalance: 0.15,
} as const;

/** Problems with a frame, worst first. A "block" issue stops the photo being taken. */
export function assessConditions(c: CaptureConditions, baseline?: CaptureConditions | null): CaptureIssue[] {
  const issues: CaptureIssue[] = [];
  const exposure = c.exposure ?? c.luma;
  if (exposure < LIMITS.tooDark) {
    issues.push({ id: "dark", level: "block", message: "Too dark. Face a window or a bright light." });
  } else if (exposure < LIMITS.dim) {
    issues.push({ id: "dim", level: "warn", message: "A little dim. More light gives steadier scores." });
  }
  // Blown-out pixels mean glare on any skin tone. A bright average does not.
  if (c.clipped > LIMITS.glare) {
    issues.push({ id: "glare", level: "warn", message: "Glare on your skin. Step back from the light or turn off the flash." });
  }
  if (Math.abs(c.balance) > LIMITS.sideLightBlock) {
    issues.push({ id: "side", level: "block", message: `Light is coming from your ${c.balance > 0 ? "left" : "right"}. Turn to face it.` });
  } else if (Math.abs(c.balance) > LIMITS.sideLightWarn) {
    issues.push({ id: "side", level: "warn", message: `Light is a bit stronger on your ${c.balance > 0 ? "left" : "right"}. Turn slightly towards it.` });
  }
  if (relativeSharpness(c) < LIMITS.blurry) {
    issues.push({ id: "blur", level: "warn", message: "Looks blurry. Hold still, or rest the phone on something." });
  }

  if (baseline && baseline.luma > 0) {
    const dl = (c.luma - baseline.luma) / baseline.luma;
    if (Math.abs(dl) > LIMITS.matchLumaBlock) {
      issues.push({
        id: "match-luma",
        level: "block",
        message: `Much ${dl > 0 ? "brighter" : "darker"} than your first photo. Use the same spot and time of day.`,
      });
    } else if (Math.abs(dl) > LIMITS.matchLumaWarn) {
      issues.push({ id: "match-luma", level: "warn", message: `${dl > 0 ? "Brighter" : "Darker"} than your first photo. Try to match it.` });
    }
    if (Math.abs(c.warmth - baseline.warmth) > LIMITS.matchWarmth) {
      issues.push({
        id: "match-warmth",
        level: "warn",
        message: `The light is ${c.warmth > baseline.warmth ? "warmer" : "cooler"} than your first photo. Daylight versus a lamp changes the scores.`,
      });
    }
    if (Math.abs(c.balance - baseline.balance) > LIMITS.matchBalance) {
      issues.push({ id: "match-side", level: "warn", message: "The light is falling from a different side than in your first photo." });
    }
  }

  return issues.sort((a, b) => (a.level === b.level ? 0 : a.level === "block" ? -1 : 1));
}

/**
 * Laplacian variance scales with the square of brightness, so the same detail
 * on darker skin reads as blurrier. Scale it up to a mid-grey reference for
 * darker faces. It is never scaled down, so no one is held to a stricter bar.
 */
export function relativeSharpness(c: Pick<CaptureConditions, "sharpness" | "luma">): number {
  const ref = 128;
  return c.sharpness * Math.max(1, (ref / Math.max(16, c.luma)) ** 2);
}

/** 0 to 100: how closely this frame's light matches the baseline. */
export function matchScore(c: CaptureConditions, baseline: CaptureConditions): number {
  const dl = Math.abs(c.luma - baseline.luma) / Math.max(1, baseline.luma) / LIMITS.matchLumaBlock;
  const dw = Math.abs(c.warmth - baseline.warmth) / (LIMITS.matchWarmth * 2);
  const db = Math.abs(c.balance - baseline.balance) / (LIMITS.matchBalance * 2);
  const penalty = Math.min(1, 0.5 * dl + 0.25 * dw + 0.25 * db);
  return Math.round(100 * (1 - penalty));
}
