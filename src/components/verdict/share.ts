import { CONCERN_INFO } from "@/lib/domain/concerns";
import type { Product } from "@/lib/domain/model";
import type { ConcernVerdict, TrialVerdict } from "@/lib/domain/verdict";
import { DECISION_LABEL, STATUS_LABEL } from "./labels";

/**
 * A result a person can share, for example as a product review. It carries
 * the evidence (change, 95% range, photo noise) so a reader can judge it, and
 * never includes the photo.
 */

type ShareProduct = Pick<Product, "name" | "brand">;

const fmt = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}`;

function weeksPhrase(week: number): string {
  return week === 1 ? "1 week" : `${week} weeks`;
}

function concernLine(c: ConcernVerdict): string {
  const label = CONCERN_INFO[c.concern].label;
  const status = STATUS_LABEL[c.status].label;
  if (!c.estimate) return `${label}: ${status}.`;
  const e = c.estimate;
  return `${label}: ${status}, ${fmt(e.change)} points (95% range ${fmt(e.low)} to ${fmt(e.high)}).`;
}

export function photoCount(verdict: TrialVerdict): number {
  return Math.max(0, ...verdict.concerns.map((c) => c.points.length));
}

/** Plain text for a store's review form or a message. */
export function reviewText(verdict: TrialVerdict, product: ShareProduct): string {
  const name = product.brand ? `${product.name} (${product.brand})` : product.name;
  const targets = verdict.concerns.filter((c) => c.isTarget);
  const monitor = verdict.concerns.find((c) => !c.isTarget && c.concern === "redness");
  const noise = targets.length ? Math.max(...targets.map((c) => c.noise.sd)) : 0;

  const lines = [
    `Measured result: ${name}, after ${weeksPhrase(verdict.week)} of use.`,
    `Verdict: ${DECISION_LABEL[verdict.decision].label}. ${verdict.headline}`,
    "",
    ...targets.map(concernLine),
    ...(monitor ? [`Irritation monitor (redness): ${STATUS_LABEL[monitor.status].label}.`] : []),
    "",
    `My photos vary by about ${noise.toFixed(1)} points on their own, so only changes beyond that count.`,
    `Measured from ${photoCount(verdict)} photos in matched light with YouCam AI Skin Analysis, using raw scores and the Verdict method. Describes how skin looks in photos, not a medical assessment.`,
  ];
  return lines.join("\n");
}

interface Palette {
  paper: string;
  ink: string;
  muted: string;
  rule: string;
  accent: string;
  keep: string;
  stop: string;
  wait: string;
  display: string;
  sans: string;
  mono: string;
}

function palette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  // The card is a light image wherever it is shared, so it uses the light theme's colours.
  return {
    paper: "#f5f2ec",
    ink: "#1c1b18",
    muted: "#5d584e",
    rule: "#dcd5c7",
    accent: "#a83c17",
    keep: "#24613d",
    stop: "#b42318",
    wait: "#805a00",
    display: v("--font-display", "Georgia, serif"),
    sans: v("--font-sans", "system-ui, sans-serif"),
    mono: v("--font-mono", "ui-monospace, monospace"),
  };
}

function toneColour(p: Palette, tone: string): string {
  return tone === "keep" ? p.keep : tone === "stop" ? p.stop : tone === "wait" ? p.wait : p.ink;
}

function wrap(g: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws the result as a 1080 x 1350 PNG card, in Verdict's light theme. */
export async function resultCard(verdict: TrialVerdict, product: ShareProduct): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const M = 84;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) throw new Error("Canvas is not available");
  const p = palette();
  if (document.fonts?.ready) await document.fonts.ready;

  g.fillStyle = p.paper;
  g.fillRect(0, 0, W, H);

  // Header: mark, wordmark, week.
  g.fillStyle = p.ink;
  g.beginPath();
  g.arc(M + 18, M + 18, 18, Math.PI / 2, (3 * Math.PI) / 2);
  g.fill();
  g.strokeStyle = p.ink;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(M + 18, M + 18, 18, 0, 2 * Math.PI);
  g.stroke();
  g.font = `500 34px ${p.display}`;
  g.textBaseline = "middle";
  g.fillText("Verdict", M + 52, M + 19);
  g.font = `500 22px ${p.mono}`;
  g.textAlign = "right";
  g.fillStyle = p.muted;
  g.fillText(`WEEK ${verdict.week}`, W - M, M + 19);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";

  let y = M + 120;
  g.fillStyle = p.ink;
  g.font = `500 56px ${p.display}`;
  for (const line of wrap(g, product.name, W - 2 * M).slice(0, 2)) {
    g.fillText(line, M, y);
    y += 64;
  }
  if (product.brand) {
    g.font = `400 28px ${p.sans}`;
    g.fillStyle = p.muted;
    g.fillText(product.brand, M, y);
    y += 30;
  }

  y += 28;
  g.fillStyle = p.ink;
  g.fillRect(M, y, W - 2 * M, 3);
  y += 72;

  const d = DECISION_LABEL[verdict.decision];
  g.font = `600 26px ${p.mono}`;
  g.fillStyle = toneColour(p, d.tone);
  g.fillText(d.label.toUpperCase(), M, y);
  y += 68;
  g.font = `500 54px ${p.display}`;
  g.fillStyle = p.ink;
  for (const line of wrap(g, verdict.headline, W - 2 * M).slice(0, 3)) {
    g.fillText(line, M, y);
    y += 62;
  }

  // Targets: change and 95% range against the person's own noise band.
  y += 30;
  const targets = verdict.concerns.filter((x) => x.isTarget).slice(0, 4);
  const barX = M + 360;
  const barW = W - M - barX;
  const span = Math.max(6, ...targets.flatMap((t) => (t.estimate ? [Math.abs(t.estimate.low), Math.abs(t.estimate.high)] : [])), ...targets.map((t) => t.noise.sd * 2));
  const xOf = (v: number) => barX + barW / 2 + (v / span) * (barW / 2);
  for (const t of targets) {
    g.fillStyle = p.rule;
    g.fillRect(M, y - 44, W - 2 * M, 1);
    g.font = `500 30px ${p.sans}`;
    g.fillStyle = p.ink;
    g.fillText(CONCERN_INFO[t.concern].label, M, y);
    const s = STATUS_LABEL[t.status];
    g.font = `500 22px ${p.mono}`;
    g.fillStyle = toneColour(p, s.tone);
    g.fillText(s.label.toUpperCase(), M, y + 34);

    // Noise band, zero line, then the estimate with its range.
    g.fillStyle = "rgba(28,27,24,0.08)";
    g.fillRect(xOf(-t.noise.sd), y - 26, xOf(t.noise.sd) - xOf(-t.noise.sd), 40);
    g.fillStyle = p.ink;
    g.fillRect(xOf(0) - 1, y - 30, 2, 48);
    if (t.estimate) {
      const e = t.estimate;
      g.fillStyle = toneColour(p, s.tone);
      g.fillRect(xOf(e.low), y - 8, Math.max(2, xOf(e.high) - xOf(e.low)), 4);
      g.beginPath();
      g.arc(xOf(e.change), y - 6, 9, 0, 2 * Math.PI);
      g.fill();
      g.font = `500 24px ${p.mono}`;
      g.textAlign = "right";
      g.fillText(`${fmt(e.change)} pts`, W - M, y + 34);
      g.textAlign = "left";
    }
    y += 112;
  }

  // Footer: what was measured and how.
  const footer = [
    `${photoCount(verdict)} photos in matched light. YouCam AI Skin Analysis raw scores.`,
    "Bars show the change with its 95% range; grey is this person's photo noise.",
    "How skin looks in photos, not a medical assessment.",
  ];
  g.font = `400 22px ${p.sans}`;
  g.fillStyle = p.muted;
  let fy = H - M - (footer.length - 1) * 32;
  g.fillStyle = p.rule;
  g.fillRect(M, fy - 48, W - 2 * M, 1);
  g.fillStyle = p.muted;
  for (const line of footer) {
    g.fillText(line, M, fy);
    fy += 32;
  }

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the card"))), "image/png"));
}
