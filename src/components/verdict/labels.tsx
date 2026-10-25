import type { ConcernStatus, Decision } from "@/lib/domain/verdict";

export type Tone = "keep" | "stop" | "wait" | "neutral";

export const DECISION_LABEL: Record<Decision, { label: string; tone: Tone }> = {
  baseline: { label: "Baseline set", tone: "neutral" },
  keep: { label: "Keep", tone: "keep" },
  stop: { label: "Stop", tone: "stop" },
  wait: { label: "Wait", tone: "wait" },
  extend: { label: "More data", tone: "wait" },
  switch: { label: "Don't rebuy", tone: "neutral" },
};

export const STATUS_LABEL: Record<ConcernStatus, { label: string; tone: Tone; explain: string }> = {
  "need-data": { label: "Baseline", tone: "neutral", explain: "Needs a check-in before anything can be measured." },
  "too-early": { label: "Too early", tone: "wait", explain: "Not enough time has passed for this to show." },
  purging: { label: "Purging", tone: "wait", explain: "A rise in blemishes is common early on with this kind of product." },
  irritation: { label: "Irritation", tone: "stop", explain: "Redness rose by more than your photos vary on their own." },
  improved: { label: "Improved", tone: "keep", explain: "Better by more than your photos vary on their own." },
  worsened: { label: "Worse", tone: "stop", explain: "Worse by more than your photos vary on their own." },
  "no-change": { label: "No change", tone: "neutral", explain: "Any change is too small to matter, with confidence." },
  inconclusive: { label: "Unclear", tone: "wait", explain: "Could be a small change. More check-ins will settle it." },
  "no-reaction": { label: "No reaction", tone: "keep", explain: "Redness hasn't risen beyond your photo noise." },
  steady: { label: "Steady", tone: "neutral", explain: "No meaningful change so far." },
};

export function Tag({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}
