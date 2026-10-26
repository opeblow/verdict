import { CONCERN_INFO } from "@/lib/domain/concerns";
import { formatDate, type ConcernVerdict, type TrialVerdict } from "@/lib/domain/verdict";
import { DECISION_LABEL, STATUS_LABEL } from "./labels";

/**
 * The verdict as plain sentences for speech, so it can be understood without
 * seeing the screen. Uses the same labels and explanations as the page, and
 * says numbers the way a person would.
 */
export function spokenVerdict(verdict: TrialVerdict, productName: string, { ended = false } = {}): string {
  const parts = [
    `${productName}. Week ${verdict.week}.`,
    `Verdict: ${DECISION_LABEL[verdict.decision].label}.`,
    sentence(verdict.headline),
    sentence(verdict.detail),
  ];

  const targets = verdict.concerns.filter((c) => c.isTarget);
  for (const c of targets) parts.push(spokenConcern(c));

  const monitor = verdict.concerns.find((c) => !c.isTarget && c.concern === "redness");
  if (monitor && (monitor.status === "irritation" || monitor.status === "no-reaction")) {
    parts.push(`Irritation monitor: ${STATUS_LABEL[monitor.status].explain}`);
  }

  if (!ended) {
    parts.push(`Next check-in ${formatDate(verdict.nextCheckIn)}. Fair verdict by ${formatDate(verdict.callOn)}.`);
  }
  return parts.join(" ");
}

function spokenConcern(c: ConcernVerdict): string {
  const label = CONCERN_INFO[c.concern].label;
  const status = STATUS_LABEL[c.status];
  if (!c.estimate) return `${label}: ${status.label}. ${status.explain}`;
  const change = c.estimate.change;
  const amount = Math.abs(change).toFixed(1);
  const direction = Math.abs(change) < 0.05 ? "unchanged" : `${change > 0 ? "up" : "down"} ${amount} points`;
  return `${label}: ${status.label}, ${direction}. ${status.explain}`;
}

function sentence(s: string): string {
  const t = forSpeech(s);
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** Written notation that a voice would read out literally, rewritten as words. */
export function forSpeech(s: string): string {
  return s
    .replace(/\+(\d)/g, "$1")
    .replace(/±\s?/g, "plus or minus ")
    .replace(/\s+\/\s+/g, ", ")
    .replace(/\s*--\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
