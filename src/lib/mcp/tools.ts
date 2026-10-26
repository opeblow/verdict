import { z } from "zod";
import { CONCERN_INFO, CONCERNS, metricLabel, planConcerns, unitCost, type Concern } from "../domain/concerns";
import { ACTIVES, activeById, detectActives, purgeWindowWeeks, suggestedTargets, timelineFor, type Active } from "../domain/ingredients";
import type { CaptureConditions, CheckInData, Trial } from "../domain/model";
import { DEFAULT_MEANINGFUL_CHANGE, MIN_NOISE_SD, PRIOR_NOISE_SD, PRIOR_WEIGHT } from "../domain/stats";
import { addDays, evaluateTrial } from "../domain/verdict";

/**
 * Verdict's engine as tools for AI assistants (Model Context Protocol).
 *
 * Every tool is a pure function of its input. None of them calls YouCam,
 * stores anything or sees a photo: an assistant can plan a trial, or judge
 * one from scores the person exports, without spending API units.
 */

const concern = z.enum(CONCERNS);
const mode = z.enum(["hd", "sd"]);
const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Use an ISO 8601 date, such as 2026-11-02 or 2026-11-02T08:00:00Z.");

const findActivesInput = z.object({
  ingredients: z.string().min(3).max(5000).describe("The product's ingredient list, as printed on the box (INCI names or common names)."),
});

const planTrialInput = z.object({
  targets: z.array(concern).min(1).max(5).describe("What the product claims to improve, up to five."),
  ingredients: z.string().max(5000).optional().describe("Ingredient list. Used to find actives and set a fair-verdict week for each target."),
  activeIds: z.array(z.string()).max(20).optional().describe("Known active ids, as returned by find_actives. Used instead of, or as well as, the ingredient list."),
  mode: mode.default("hd").describe("hd if the camera's photos are at least 1080 px on the short side after cropping, otherwise sd."),
  startDate: isoDate.optional().describe("Day of the first baseline photo. Defaults to today."),
});

const photo = z.object({
  takenAt: isoDate,
  kind: z.enum(["baseline", "check-in"]),
  session: z.string().max(80).optional().describe("Photos taken back to back in one sitting share a session. Defaults to one session for all baselines and one per day for check-ins."),
  scores: z
    .record(z.string(), z.number().min(0).max(100))
    .describe('YouCam raw_score per metric key, such as { "pore": 61.2, "redness": 70.4, "pore:nose": 55 }. Never ui_score.'),
});

const evaluateTrialInput = z.object({
  startedAt: isoDate.describe("Time of the first baseline photo."),
  targets: z.array(concern).min(1).max(5),
  ingredients: z.string().max(5000).optional(),
  activeIds: z.array(z.string()).max(20).optional(),
  mode: mode.default("hd"),
  photos: z.array(photo).min(1).max(200).describe("Every photo in the trial: two baselines a minute apart, then weekly check-ins."),
  now: isoDate.optional().describe("Evaluate as of this time. Defaults to now."),
});

export type ToolResult = Record<string, unknown>;

interface ToolDef<S extends z.ZodType> {
  name: string;
  title: string;
  description: string;
  input: S;
  run: (input: z.infer<S>, now: Date) => ToolResult;
}

function activesFrom(ingredients?: string, ids: readonly string[] = []): Active[] {
  const found = ingredients ? detectActives(ingredients) : [];
  const byId = ids.map(activeById).filter((a): a is Active => Boolean(a));
  return [...new Map([...found, ...byId].map((a) => [a.id, a])).values()];
}

function describeActive(a: Active) {
  return {
    id: a.id,
    name: a.name,
    irritation: a.irritation,
    canPurge: a.purges,
    targets: a.targets.map((t) => ({ concern: t.concern, label: CONCERN_INFO[t.concern].label, fromWeek: t.fromWeek, fairVerdictWeek: t.callWeek })),
    basis: a.basis,
  };
}

const findActives: ToolDef<typeof findActivesInput> = {
  name: "find_actives",
  title: "Find active ingredients",
  description:
    "Reads an ingredient list and returns the actives Verdict recognises, what each is known to change, how many weeks each takes before a fair judgement, and the targets to measure.",
  input: findActivesInput,
  run: ({ ingredients }) => {
    const actives = detectActives(ingredients);
    return {
      actives: actives.map(describeActive),
      suggestedTargets: suggestedTargets(actives).map((c) => ({ concern: c, label: CONCERN_INFO[c].label })),
      recognisedActives: ACTIVES.length,
      note: actives.length ? undefined : "No recognised actives. Targets can still be measured with a default eight-week timeline.",
    };
  },
};

const planTrial: ToolDef<typeof planTrialInput> = {
  name: "plan_trial",
  title: "Plan a trial",
  description:
    "Plans a fair trial of one product: what to measure on every photo (targets, the redness irritation monitor, and fill-ins to the edge of YouCam's billing tier), the fair-verdict week and date for each target, and the YouCam units it will cost.",
  input: planTrialInput,
  run: ({ targets, ingredients, activeIds, mode, startDate }, now) => {
    const actives = activesFrom(ingredients, activeIds);
    const start = startDate ? new Date(startDate) : now;
    const measured = planConcerns(targets);
    const perTarget = targets.map((c) => {
      const t = timelineFor(c, actives);
      return {
        concern: c,
        label: CONCERN_INFO[c].label,
        fromWeek: t.fromWeek,
        fairVerdictWeek: t.callWeek,
        fairVerdictOn: addDays(start, t.callWeek * 7).toISOString().slice(0, 10),
        basis: t.basis,
      };
    });
    const weeks = Math.max(4, ...perTarget.map((t) => t.fairVerdictWeek));
    const perPhoto = unitCost(measured.length, mode);
    return {
      actives: actives.map((a) => ({ id: a.id, name: a.name })),
      measuredEachPhoto: measured.map((c) => ({ concern: c, label: CONCERN_INFO[c].label, role: targets.includes(c) ? "target" : c === "redness" ? "irritation monitor" : "fill-in" })),
      targets: perTarget,
      schedule: {
        baselinePhotos: "Two, a minute apart, stepping out of frame between them. Their difference is the person's noise floor.",
        checkIns: `Weekly, same spot and time of day, for at least ${weeks} weeks.`,
        likelyPurgingWindowWeeks: purgeWindowWeeks(actives) || undefined,
      },
      units: { mode, perPhoto, forTrial: perPhoto * (2 + weeks) },
    };
  },
};

const PLACEHOLDER_CONDITIONS: CaptureConditions = { luma: 0, balance: 0, warmth: 1, sharpness: 0, clipped: 0, width: 0, height: 0 };

const evaluate: ToolDef<typeof evaluateTrialInput> = {
  name: "evaluate_trial",
  title: "Evaluate a trial",
  description:
    "Judges a trial from its raw scores with Verdict's engine: noise floor from the baseline pair, least-squares trend, 95% interval, fair-verdict weeks, purging and irritation rules. Returns keep, stop, wait, more data, don't rebuy, or baseline set, with the evidence for every target.",
  input: evaluateTrialInput,
  run: ({ startedAt, targets, ingredients, activeIds, mode, photos, now: asOf }, now) => {
    const actives = activesFrom(ingredients, activeIds);
    const scored = new Set<Concern>(
      photos.flatMap((p) => Object.keys(p.scores).map((k) => k.split(":")[0] as Concern)).filter((c) => (CONCERNS as readonly string[]).includes(c)),
    );
    const trial: Trial = {
      id: "mcp",
      createdAt: startedAt,
      startedAt,
      product: { name: "Product", source: "manual" },
      activeIds: actives.map((a) => a.id),
      targets,
      concerns: [...new Set([...targets, ...scored])],
      mode,
      protocol: {},
      cadenceDays: 7,
      status: "active",
    };
    const checkIns: CheckInData[] = photos.map((p, i) => ({
      id: `p${i}`,
      trialId: trial.id,
      takenAt: new Date(p.takenAt).toISOString(),
      kind: p.kind,
      session: p.session ?? (p.kind === "baseline" ? "baseline" : p.takenAt.slice(0, 10)),
      readings: Object.entries(p.scores).flatMap(([key, raw]) => {
        const [c, region = "whole"] = key.split(":");
        return (CONCERNS as readonly string[]).includes(c!) ? [{ key, concern: c as Concern, region, raw }] : [];
      }),
      conditions: PLACEHOLDER_CONDITIONS,
      taskId: "",
    }));
    const v = evaluateTrial(trial, checkIns, asOf ? new Date(asOf) : now);
    const round = (n: number) => Math.round(n * 10) / 10;
    return {
      decision: v.decision,
      headline: v.headline,
      detail: v.detail,
      week: v.week,
      sittings: v.checkInSessions,
      nextCheckIn: v.nextCheckIn.toISOString().slice(0, 10),
      fairVerdictBy: v.callOn.toISOString().slice(0, 10),
      measures: v.concerns.map((c) => ({
        key: c.key,
        label: metricLabel(c.key),
        role: c.isTarget ? "target" : c.concern === "redness" ? "irritation monitor" : "also measured",
        status: c.status,
        start: Number.isFinite(c.baseline) ? round(c.baseline) : null,
        latest: Number.isFinite(c.latest) ? round(c.latest) : null,
        change: c.estimate ? { points: round(c.estimate.change), low: round(c.estimate.low), high: round(c.estimate.high) } : null,
        photoNoise: round(c.noise.sd),
        fairVerdictOn: c.callOn.toISOString().slice(0, 10),
      })),
    };
  },
};

const explainMethodInput = z.object({});

const explainMethod: ToolDef<typeof explainMethodInput> = {
  name: "explain_method",
  title: "Explain the method",
  description: "Explains how Verdict decides, with the constants the engine uses, so an assistant can describe a result accurately and without overclaiming.",
  input: explainMethodInput,
  run: () => ({
    principle:
      "One photo's score says little. A change means something only if it is larger than the change between two photos of the same, unchanged skin, so Verdict measures that for each person and judges every change against it.",
    score: "YouCam raw_score only. YouCam documents ui_score as adjusted upwards to be encouraging, so it is never used for measurement.",
    noiseFloor: `Two baseline photos a minute apart. Noise is shrunk towards a cautious prior of ${PRIOR_NOISE_SD} points weighted as ${PRIOR_WEIGHT} pseudo pairs, and never goes below ${MIN_NOISE_SD} point.`,
    change: "A least-squares line through every photo since day zero, with a 95% interval that pools replicate noise and the scatter around the line.",
    decision: `Improved or worse only when the whole interval clears zero and the change is at least ${DEFAULT_MEANINGFUL_CHANGE} points. Don't rebuy only when a meaningful benefit is ruled out. Before a target's fair-verdict week the answer is wait, with the date.`,
    safety: "Redness is measured on every photo as an irritation monitor. A rise beyond the noise floor means stop, at any week, whatever else the trial shows. Blemishes rising early on a retinoid or exfoliating acid are labelled likely purging.",
    light: "Photos are checked for light before upload. Checks are judged on the room, not on skin brightness, so every skin tone gets the same answer in the same light.",
    limits: "Verdict describes how skin looks in photos. It is not a medical device and does not diagnose or treat any condition. A trial of one cannot rule out other causes such as weather, sleep or a second new product.",
    source: "https://github.com/opeblow/verdict/blob/main/docs/METHOD.md",
  }),
};

export const TOOLS = [findActives, planTrial, evaluate, explainMethod] as const;

export function toolList() {
  return TOOLS.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: z.toJSONSchema(t.input, { io: "input" }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }));
}

export class ToolInputError extends Error {}

export function callTool(name: string, args: unknown, now = new Date()): ToolResult {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new ToolInputError(`Unknown tool: ${name}`);
  const parsed = tool.input.safeParse(args ?? {});
  if (!parsed.success) {
    throw new ToolInputError(parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
  }
  // The union of tool types loses the link between `input` and `run`; parsing above guarantees it.
  return (tool.run as (input: unknown, now: Date) => ToolResult)(parsed.data, now);
}
