/**
 * Skin concerns Verdict can track, and how each maps onto YouCam AI Skin
 * Analysis `dst_actions`.
 *
 * Every YouCam score uses the same direction: a higher score means healthier
 * looking skin. Verdict relies on that, so "improved" always means "went up".
 */

export const CONCERNS = [
  "acne",
  "redness",
  "pore",
  "texture",
  "wrinkle",
  "age_spot",
  "radiance",
  "moisture",
  "oiliness",
  "firmness",
  "dark_circle",
  "eye_bag",
] as const;

export type Concern = (typeof CONCERNS)[number];

export type AnalysisMode = "hd" | "sd";

export interface ConcernInfo {
  id: Concern;
  /** Short label used in charts and tables. */
  label: string;
  /** What a person would call it in a sentence. */
  plain: string;
  /** One-line description of what the score reflects. */
  describes: string;
  /** HD analysis returns per-region scores for some concerns. */
  hdRegions: readonly string[];
}

export const CONCERN_INFO: Record<Concern, ConcernInfo> = {
  acne: {
    id: "acne",
    label: "Blemishes",
    plain: "blemishes",
    describes: "Visible spots and breakouts across the face.",
    hdRegions: ["whole"],
  },
  redness: {
    id: "redness",
    label: "Redness",
    plain: "redness",
    describes: "Areas of visible redness. Verdict also uses this as an irritation monitor.",
    hdRegions: [],
  },
  pore: {
    id: "pore",
    label: "Pores",
    plain: "pore visibility",
    describes: "How visible pores are.",
    hdRegions: ["whole", "forehead", "nose", "cheek"],
  },
  texture: {
    id: "texture",
    label: "Texture",
    plain: "skin texture",
    describes: "Smoothness and evenness of the skin surface.",
    hdRegions: ["whole"],
  },
  wrinkle: {
    id: "wrinkle",
    label: "Fine lines",
    plain: "fine lines",
    describes: "Visibility of lines and wrinkles.",
    hdRegions: ["whole", "forehead", "glabellar", "crowfeet", "periocular", "nasolabial", "marionette"],
  },
  age_spot: {
    id: "age_spot",
    label: "Dark spots",
    plain: "dark spots",
    describes: "Spots and uneven pigmentation.",
    hdRegions: [],
  },
  radiance: {
    id: "radiance",
    label: "Radiance",
    plain: "radiance",
    describes: "How bright and luminous the skin looks.",
    hdRegions: [],
  },
  moisture: {
    id: "moisture",
    label: "Hydration",
    plain: "hydration",
    describes: "How hydrated the skin looks.",
    hdRegions: [],
  },
  oiliness: {
    id: "oiliness",
    label: "Oil control",
    plain: "shine and oiliness",
    describes: "Visible shine and oil.",
    hdRegions: [],
  },
  firmness: {
    id: "firmness",
    label: "Firmness",
    plain: "firmness",
    describes: "How firm and lifted the skin looks.",
    hdRegions: [],
  },
  dark_circle: {
    id: "dark_circle",
    label: "Dark circles",
    plain: "dark circles",
    describes: "Darkness under the eyes.",
    hdRegions: [],
  },
  eye_bag: {
    id: "eye_bag",
    label: "Puffiness",
    plain: "under-eye puffiness",
    describes: "Puffiness under the eyes.",
    hdRegions: [],
  },
};

/** Concerns always measured, even if the product does not target them. */
export const SAFETY_CONCERNS: readonly Concern[] = ["redness"];

/** Translate an internal concern into the YouCam `dst_actions` value. */
export function toAction(concern: Concern, mode: AnalysisMode): string {
  if (mode === "hd") return `hd_${concern}`;
  if (concern === "dark_circle") return "dark_circle_v2";
  return concern;
}

/** Translate a YouCam output `type` back into an internal concern, if tracked. */
export function fromActionType(type: string): Concern | null {
  let base = type.startsWith("hd_") ? type.slice(3) : type;
  if (base === "dark_circle_v2") base = "dark_circle";
  return (CONCERNS as readonly string[]).includes(base) ? (base as Concern) : null;
}

/**
 * YouCam bills by concern count tier: 1-4, 5-8, 9-12, 13-16.
 * Values from the AI Skin Analysis "Unit Consumption" table.
 */
export function unitCost(concernCount: number, mode: AnalysisMode): number {
  const tiers = mode === "hd" ? [12, 16, 20, 22] : [9, 12, 14, 16];
  const n = Math.max(1, Math.min(16, concernCount));
  return tiers[Math.ceil(n / 4) - 1]!;
}

/** Fill-in concerns, in priority order, used to reach a full billing tier. */
const FILL_ORDER: readonly Concern[] = ["redness", "moisture", "texture", "acne", "pore", "radiance", "oiliness", "age_spot"];

/**
 * Build the concern set for a trial: the product's targets, the safety
 * monitor, then fill-ins up to the edge of the billing tier, so no unit is
 * paid for and wasted.
 */
export function planConcerns(targets: readonly Concern[]): Concern[] {
  const set: Concern[] = [];
  const add = (c: Concern) => {
    if (!set.includes(c)) set.push(c);
  };
  targets.forEach(add);
  SAFETY_CONCERNS.forEach(add);
  const tierEdge = Math.min(16, Math.ceil(set.length / 4) * 4);
  for (const c of FILL_ORDER) {
    if (set.length >= tierEdge) break;
    add(c);
  }
  return set;
}

/** Stable key for one tracked measurement, such as `pore` or `pore:nose`. */
export function metricKey(concern: Concern, region = "whole"): string {
  return region === "whole" ? concern : `${concern}:${region}`;
}

export function parseMetricKey(key: string): { concern: Concern; region: string } {
  const [concern, region = "whole"] = key.split(":");
  return { concern: concern as Concern, region };
}

const REGION_LABELS: Record<string, string> = {
  whole: "Whole face",
  forehead: "Forehead",
  nose: "Nose",
  cheek: "Cheeks",
  glabellar: "Between brows",
  crowfeet: "Eye corners",
  periocular: "Around eyes",
  nasolabial: "Smile lines",
  marionette: "Mouth corners",
};

export function regionLabel(region: string): string {
  return REGION_LABELS[region] ?? region;
}

export function metricLabel(key: string): string {
  const { concern, region } = parseMetricKey(key);
  const base = CONCERN_INFO[concern]?.label ?? concern;
  return region === "whole" ? base : `${base}, ${regionLabel(region).toLowerCase()}`;
}
