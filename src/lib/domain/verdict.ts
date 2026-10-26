import { CONCERN_INFO, SAFETY_CONCERNS, metricKey, type Concern } from "./concerns";
import { activeById, purgeWindowWeeks, timelineFor, type Active } from "./ingredients";
import type { CheckInData, Trial } from "./model";
import {
  DEFAULT_MEANINGFUL_CHANGE,
  classifyChange,
  estimateChange,
  estimateNoise,
  mean,
  type ChangeEstimate,
  type NoiseEstimate,
  type Point,
} from "./stats";

const DAY_MS = 86_400_000;

export type ConcernStatus =
  | "need-data"
  | "too-early"
  | "purging"
  | "irritation"
  | "improved"
  | "worsened"
  | "no-change"
  | "inconclusive"
  /** Safety monitor only: redness has not risen. */
  | "no-reaction"
  /** Untargeted concern with no meaningful movement. */
  | "steady";

export interface ConcernVerdict {
  concern: Concern;
  key: string;
  isTarget: boolean;
  status: ConcernStatus;
  points: Point[];
  baseline: number;
  latest: number;
  noise: NoiseEstimate;
  estimate: ChangeEstimate | null;
  fromWeek: number;
  callWeek: number;
  callOn: Date;
  basis: string[];
}

export type Decision = "baseline" | "keep" | "stop" | "wait" | "extend" | "switch";

export interface TrialVerdict {
  decision: Decision;
  headline: string;
  detail: string;
  concerns: ConcernVerdict[];
  week: number;
  checkInSessions: number;
  nextCheckIn: Date;
  callOn: Date;
}

export function daysBetween(fromIso: string, to: Date | string): number {
  const t = typeof to === "string" ? new Date(to).getTime() : to.getTime();
  return (t - new Date(fromIso).getTime()) / DAY_MS;
}

export function addDays(iso: string | Date, days: number): Date {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  return new Date(t + days * DAY_MS);
}

function sessionsOf(checkIns: readonly CheckInData[]): Map<string, CheckInData[]> {
  const map = new Map<string, CheckInData[]>();
  for (const c of [...checkIns].sort((a, b) => a.takenAt.localeCompare(b.takenAt))) {
    const list = map.get(c.session) ?? [];
    list.push(c);
    map.set(c.session, list);
  }
  return map;
}

function readingOf(c: CheckInData, key: string): number | undefined {
  return c.readings.find((r) => r.key === key)?.raw;
}

/** Replicate pairs for one metric: the first two photos of every session. */
export function replicatePairs(checkIns: readonly CheckInData[], key: string): [number, number][] {
  const pairs: [number, number][] = [];
  for (const list of sessionsOf(checkIns).values()) {
    const vals = list.map((c) => readingOf(c, key)).filter((v): v is number => v !== undefined);
    if (vals.length >= 2) pairs.push([vals[0]!, vals[1]!]);
  }
  return pairs;
}

export function seriesFor(trial: Trial, checkIns: readonly CheckInData[], key: string): Point[] {
  return checkIns
    .map((c) => ({ day: daysBetween(trial.startedAt, c.takenAt), value: readingOf(c, key) }))
    .filter((p): p is Point => p.value !== undefined)
    .sort((a, b) => a.day - b.day);
}

export function evaluateConcern(
  trial: Trial,
  checkIns: readonly CheckInData[],
  concern: Concern,
  actives: readonly Active[],
  now: Date,
  mmc = DEFAULT_MEANINGFUL_CHANGE,
): ConcernVerdict {
  const key = metricKey(concern);
  const points = seriesFor(trial, checkIns, key);
  const noise = estimateNoise(replicatePairs(checkIns, key));
  const estimate = estimateChange(points, noise);
  const timeline = timelineFor(concern, actives);
  const isTarget = trial.targets.includes(concern);
  const week = daysBetween(trial.startedAt, now) / 7;
  const lastWeek = points.length ? points[points.length - 1]!.day / 7 : 0;

  const baselinePoints = points.filter((p) => p.day < 1);
  const baseline = mean((baselinePoints.length ? baselinePoints : points.slice(0, 1)).map((p) => p.value));
  const latest = points.length ? points[points.length - 1]!.value : Number.NaN;

  const base = {
    concern,
    key,
    isTarget,
    points,
    baseline,
    latest,
    noise,
    estimate,
    fromWeek: timeline.fromWeek,
    callWeek: timeline.callWeek,
    callOn: addDays(trial.startedAt, timeline.callWeek * 7),
    basis: timeline.basis,
  };

  if (!estimate) return { ...base, status: "need-data" };

  const cls = classifyChange(estimate, mmc);
  const isSafety = SAFETY_CONCERNS.includes(concern);

  // A meaningful rise in redness is an irritation signal at any point in the trial.
  if (isSafety && cls === "worsened") return { ...base, status: "irritation" };

  // Real early improvement is reported as soon as it is clear.
  if (cls === "improved") return { ...base, status: "improved" };

  // Concerns the product doesn't target are watched for side effects only,
  // so there is no deadline to wait for.
  if (!isTarget) {
    if (cls === "worsened") return { ...base, status: "worsened" };
    return { ...base, status: isSafety ? "no-reaction" : "steady" };
  }

  const purgeWeeks = purgeWindowWeeks(actives);
  if (concern === "acne" && cls === "worsened" && lastWeek < purgeWeeks) {
    return { ...base, status: "purging" };
  }

  if (Math.max(week, lastWeek) < timeline.callWeek) return { ...base, status: "too-early" };

  return { ...base, status: cls };
}

function fmt(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : ""}${r.toFixed(1)}`;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function evaluateTrial(trial: Trial, checkIns: readonly CheckInData[], now = new Date()): TrialVerdict {
  const actives = trial.activeIds.map(activeById).filter((a): a is Active => Boolean(a));
  const concerns = trial.concerns.map((c) => evaluateConcern(trial, checkIns, c, actives, now));
  const targets = concerns.filter((c) => c.isTarget);
  const sessions = sessionsOf(checkIns);
  const last = checkIns.length ? [...checkIns].sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0]! : null;
  const nextCheckIn = addDays(last ? last.takenAt : now, trial.cadenceDays);
  const week = Math.max(0, Math.floor(daysBetween(trial.startedAt, now) / 7));
  const pending = targets.filter((c) => ["too-early", "purging", "need-data", "inconclusive"].includes(c.status));
  const callOn = new Date(Math.max(...(pending.length ? pending : targets).map((c) => c.callOn.getTime())));

  const result = (decision: Decision, headline: string, detail: string): TrialVerdict => ({
    decision,
    headline,
    detail,
    concerns,
    week,
    checkInSessions: sessions.size,
    nextCheckIn,
    callOn,
  });

  const hasFollowUp = checkIns.some((c) => c.kind === "check-in");
  if (!hasFollowUp) {
    return result(
      "baseline",
      "Baseline recorded.",
      `Your starting point is saved. Take your first check-in photo on ${formatDate(nextCheckIn)}, in the same place and light.`,
    );
  }

  const irritation = concerns.find((c) => c.status === "irritation");
  if (irritation?.estimate) {
    return result(
      "stop",
      "Pause this product.",
      `Redness has gone up by ${fmt(-irritation.estimate.change)} points since you started, more than your photos vary on their own. Stop using it for a week and see if it settles. If it does not, talk to a dermatologist or pharmacist.`,
    );
  }

  const improved = targets.filter((c) => c.status === "improved");
  const worsened = targets.filter((c) => c.status === "worsened");
  const purging = targets.filter((c) => c.status === "purging");

  if (improved.length > 0 && worsened.length === 0) {
    const best = improved.reduce((a, b) => ((a.estimate?.change ?? 0) >= (b.estimate?.change ?? 0) ? a : b));
    const others = improved.length > 1 ? ` ${improved.length - 1} other target${improved.length > 2 ? "s" : ""} also improved.` : "";
    const stillWaiting = pending.length ? ` Still waiting on ${pending.map((c) => CONCERN_INFO[c.concern].plain).join(", ")}.` : "";
    return result(
      "keep",
      "It's working. Keep buying it.",
      `${CONCERN_INFO[best.concern].label} improved by ${fmt(best.estimate!.change)} points, more than the ${best.noise.sd.toFixed(1)}-point variation between your photos.${others}${stillWaiting}`,
    );
  }

  if (worsened.length > 0) {
    const w = worsened[0]!;
    return result(
      "stop",
      "It's making things worse.",
      `${CONCERN_INFO[w.concern].label} has dropped by ${Math.abs(w.estimate?.change ?? 0).toFixed(1)} points after ${Math.round(w.points[w.points.length - 1]!.day / 7)} weeks, past the point where this product should have helped. Stop and do not rebuy.`,
    );
  }

  if (purging.length > 0) {
    return result(
      "wait",
      "Likely purging. Keep going.",
      `Blemishes went up, which is common in the first weeks of products that speed up skin renewal. Verdict will re-check on ${formatDate(callOn)}. If redness also rises, it will tell you to stop.`,
    );
  }

  if (pending.some((c) => c.status === "too-early" || c.status === "need-data")) {
    return result(
      "wait",
      `Too early to call. Check back ${formatDate(callOn)}.`,
      `Products like this need about ${Math.max(...targets.map((c) => c.callWeek))} weeks before a fair judgement. Quitting earlier is the most common reason people never find out what works.`,
    );
  }

  if (pending.length > 0) {
    return result(
      "extend",
      "Not clear yet. Two more check-ins.",
      "The changes so far are within the normal variation between your photos. Two more weekly check-ins, ideally with two photos each, will settle it.",
    );
  }

  return result(
    "switch",
    "No measurable change. Don't rebuy.",
    `After ${week} weeks, every target is within ${DEFAULT_MEANINGFUL_CHANGE} points of where you started. Your money is better spent on something else.`,
  );
}
