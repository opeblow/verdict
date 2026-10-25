import type { Concern } from "./concerns";

/**
 * Curated timelines for common skincare actives.
 *
 * `fromWeek` is the earliest point a visible change is commonly reported.
 * `callWeek` is when Verdict is willing to call the result. Before it, a flat
 * line means "too early", not "not working". Timelines are conservative
 * consensus ranges from the cosmetic dermatology literature; where a single
 * well-known trial anchors the range it is named in `basis`.
 *
 * Wording stays cosmetic: these describe how skin looks, not medical outcomes.
 */

export type Irritation = "low" | "moderate" | "high";

export interface ActiveTarget {
  concern: Concern;
  fromWeek: number;
  callWeek: number;
}

export interface Active {
  id: string;
  name: string;
  /** Lowercase INCI or common-name fragments matched against ingredient lists. */
  match: readonly string[];
  targets: readonly ActiveTarget[];
  /**
   * Speeds up cell turnover, so existing clogged pores can surface as
   * blemishes in the first weeks ("purging").
   */
  purges: boolean;
  irritation: Irritation;
  basis: string;
}

export const ACTIVES: readonly Active[] = [
  {
    id: "niacinamide",
    name: "Niacinamide",
    match: ["niacinamide", "nicotinamide"],
    targets: [
      { concern: "oiliness", fromWeek: 2, callWeek: 4 },
      { concern: "pore", fromWeek: 4, callWeek: 8 },
      { concern: "redness", fromWeek: 4, callWeek: 8 },
      { concern: "age_spot", fromWeek: 4, callWeek: 8 },
      { concern: "texture", fromWeek: 4, callWeek: 8 },
    ],
    purges: false,
    irritation: "low",
    basis: "Bissett et al., Dermatologic Surgery 2005 (12-week split-face study); Draelos et al., J Cosmet Laser Ther 2006 (sebum).",
  },
  {
    id: "retinol",
    name: "Retinol",
    match: ["retinol", "retinyl palmitate", "retinal", "retinaldehyde", "hydroxypinacolone retinoate"],
    targets: [
      { concern: "wrinkle", fromWeek: 8, callWeek: 12 },
      { concern: "texture", fromWeek: 4, callWeek: 8 },
      { concern: "age_spot", fromWeek: 8, callWeek: 12 },
      { concern: "acne", fromWeek: 6, callWeek: 10 },
    ],
    purges: true,
    irritation: "high",
    basis: "Kafi et al., Archives of Dermatology 2007 (24-week retinol trial).",
  },
  {
    id: "adapalene",
    name: "Adapalene",
    match: ["adapalene"],
    targets: [
      { concern: "acne", fromWeek: 6, callWeek: 12 },
      { concern: "texture", fromWeek: 6, callWeek: 12 },
    ],
    purges: true,
    irritation: "high",
    basis: "Commonly reported 8 to 12 week course before full visible effect.",
  },
  {
    id: "salicylic",
    name: "Salicylic acid (BHA)",
    match: ["salicylic acid", "betaine salicylate", "willow bark"],
    targets: [
      { concern: "acne", fromWeek: 4, callWeek: 6 },
      { concern: "pore", fromWeek: 4, callWeek: 6 },
      { concern: "oiliness", fromWeek: 2, callWeek: 4 },
    ],
    purges: true,
    irritation: "moderate",
    basis: "Commonly reported 4 to 6 weeks for visible change in blemishes.",
  },
  {
    id: "glycolic",
    name: "Glycolic acid (AHA)",
    match: ["glycolic acid"],
    targets: [
      { concern: "texture", fromWeek: 2, callWeek: 6 },
      { concern: "radiance", fromWeek: 2, callWeek: 4 },
      { concern: "age_spot", fromWeek: 8, callWeek: 12 },
    ],
    purges: true,
    irritation: "moderate",
    basis: "Ditre et al., J Am Acad Dermatol 1996 (AHA, 6 months).",
  },
  {
    id: "lactic",
    name: "Lactic or mandelic acid (AHA)",
    match: ["lactic acid", "mandelic acid"],
    targets: [
      { concern: "texture", fromWeek: 2, callWeek: 6 },
      { concern: "radiance", fromWeek: 2, callWeek: 4 },
      { concern: "moisture", fromWeek: 1, callWeek: 3 },
    ],
    purges: true,
    irritation: "low",
    basis: "Gentler AHAs; visible texture change commonly reported within 4 to 6 weeks.",
  },
  {
    id: "benzoyl-peroxide",
    name: "Benzoyl peroxide",
    match: ["benzoyl peroxide"],
    targets: [{ concern: "acne", fromWeek: 3, callWeek: 6 }],
    purges: false,
    irritation: "moderate",
    basis: "Commonly reported 4 to 6 weeks for visible change in blemishes.",
  },
  {
    id: "azelaic",
    name: "Azelaic acid",
    match: ["azelaic acid", "potassium azeloyl diglycinate"],
    targets: [
      { concern: "redness", fromWeek: 4, callWeek: 8 },
      { concern: "acne", fromWeek: 4, callWeek: 8 },
      { concern: "age_spot", fromWeek: 8, callWeek: 12 },
    ],
    purges: false,
    irritation: "moderate",
    basis: "Thiboutot et al., J Am Acad Dermatol 2003 (12-week azelaic acid gel trials).",
  },
  {
    id: "vitamin-c",
    name: "Vitamin C",
    match: ["ascorbic acid", "ascorbyl glucoside", "sodium ascorbyl phosphate", "magnesium ascorbyl phosphate", "ethyl ascorbic acid", "tetrahexyldecyl ascorbate"],
    targets: [
      { concern: "radiance", fromWeek: 3, callWeek: 6 },
      { concern: "age_spot", fromWeek: 8, callWeek: 12 },
      { concern: "wrinkle", fromWeek: 8, callWeek: 12 },
    ],
    purges: false,
    irritation: "moderate",
    basis: "Humbert et al., Experimental Dermatology 2003 (topical vitamin C, 6 months).",
  },
  {
    id: "tranexamic",
    name: "Tranexamic acid",
    match: ["tranexamic acid"],
    targets: [{ concern: "age_spot", fromWeek: 8, callWeek: 12 }],
    purges: false,
    irritation: "low",
    basis: "Commonly reported 8 to 12 weeks for visible change in uneven tone.",
  },
  {
    id: "arbutin",
    name: "Alpha arbutin",
    match: ["arbutin"],
    targets: [{ concern: "age_spot", fromWeek: 8, callWeek: 12 }],
    purges: false,
    irritation: "low",
    basis: "Commonly reported 8 to 12 weeks for visible change in uneven tone.",
  },
  {
    id: "bakuchiol",
    name: "Bakuchiol",
    match: ["bakuchiol"],
    targets: [
      { concern: "wrinkle", fromWeek: 8, callWeek: 12 },
      { concern: "age_spot", fromWeek: 8, callWeek: 12 },
    ],
    purges: false,
    irritation: "low",
    basis: "Dhaliwal et al., British Journal of Dermatology 2019 (12-week trial against retinol).",
  },
  {
    id: "peptides",
    name: "Peptides",
    match: ["palmitoyl pentapeptide", "palmitoyl tripeptide", "acetyl hexapeptide", "copper tripeptide", "palmitoyl tetrapeptide", "matrixyl"],
    targets: [
      { concern: "wrinkle", fromWeek: 8, callWeek: 12 },
      { concern: "firmness", fromWeek: 8, callWeek: 12 },
    ],
    purges: false,
    irritation: "low",
    basis: "Robinson et al., International Journal of Cosmetic Science 2005 (12-week peptide study).",
  },
  {
    id: "hyaluronic",
    name: "Hyaluronic acid",
    match: ["hyaluronic acid", "sodium hyaluronate", "hydrolyzed hyaluronic"],
    targets: [{ concern: "moisture", fromWeek: 1, callWeek: 2 }],
    purges: false,
    irritation: "low",
    basis: "Humectant; hydration change is commonly visible within days to two weeks.",
  },
  {
    id: "ceramides",
    name: "Ceramides",
    match: ["ceramide"],
    targets: [
      { concern: "moisture", fromWeek: 1, callWeek: 3 },
      { concern: "redness", fromWeek: 2, callWeek: 4 },
    ],
    purges: false,
    irritation: "low",
    basis: "Barrier lipids; hydration change commonly reported within 2 to 4 weeks.",
  },
  {
    id: "centella",
    name: "Centella asiatica",
    match: ["centella asiatica", "madecassoside", "asiaticoside", "cica"],
    targets: [{ concern: "redness", fromWeek: 2, callWeek: 4 }],
    purges: false,
    irritation: "low",
    basis: "Soothing botanical; visible change in redness commonly reported within 4 weeks.",
  },
  {
    id: "zinc",
    name: "Zinc PCA",
    match: ["zinc pca", "zinc gluconate"],
    targets: [{ concern: "oiliness", fromWeek: 2, callWeek: 4 }],
    purges: false,
    irritation: "low",
    basis: "Commonly reported 2 to 4 weeks for visible change in shine.",
  },
  {
    id: "caffeine",
    name: "Caffeine",
    match: ["caffeine"],
    targets: [
      { concern: "eye_bag", fromWeek: 2, callWeek: 6 },
      { concern: "dark_circle", fromWeek: 4, callWeek: 8 },
    ],
    purges: false,
    irritation: "low",
    basis: "Commonly reported 4 to 6 weeks for under-eye products.",
  },
];

/** Fallback when no recognised active targets a concern. */
export const DEFAULT_TIMELINE: Omit<ActiveTarget, "concern"> = { fromWeek: 4, callWeek: 8 };

/**
 * The skin's outer layer renews in roughly four weeks in young adults, longer
 * with age. No texture or tone claim is callable before one full cycle.
 */
export const MIN_CALL_WEEK = 4;

export function activeById(id: string): Active | undefined {
  return ACTIVES.find((a) => a.id === id);
}

/** Find the recognised actives in a free-text ingredient list. */
export function detectActives(ingredientsText: string): Active[] {
  const text = ` ${ingredientsText.toLowerCase().replace(/\s+/g, " ")} `;
  return ACTIVES.filter((a) => a.match.some((m) => text.includes(m)));
}

/** Concerns a set of actives is known to target, most common first. */
export function suggestedTargets(actives: readonly Active[]): Concern[] {
  const counts = new Map<Concern, number>();
  for (const a of actives) for (const t of a.targets) counts.set(t.concern, (counts.get(t.concern) ?? 0) + 1);
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => c);
}

/**
 * When a concern can be judged, given the product's actives. Uses the
 * slowest relevant active so a fast-acting humectant never hides a slow
 * retinoid, and never goes below one skin cycle for structural concerns.
 */
export function timelineFor(concern: Concern, actives: readonly Active[]): Omit<ActiveTarget, "concern"> & { basis: string[] } {
  const relevant = actives.flatMap((a) => a.targets.filter((t) => t.concern === concern).map((t) => ({ t, a })));
  if (relevant.length === 0) {
    return { ...DEFAULT_TIMELINE, basis: [] };
  }
  const fromWeek = Math.max(...relevant.map((r) => r.t.fromWeek));
  let callWeek = Math.max(...relevant.map((r) => r.t.callWeek));
  const fastConcerns: Concern[] = ["moisture", "oiliness", "radiance", "eye_bag"];
  if (!fastConcerns.includes(concern)) callWeek = Math.max(callWeek, MIN_CALL_WEEK);
  return { fromWeek, callWeek, basis: [...new Set(relevant.map((r) => r.a.basis))] };
}

export function purgeWindowWeeks(actives: readonly Active[]): number {
  return actives.some((a) => a.purges) ? 6 : 0;
}
