import { DEFAULT_MEANINGFUL_CHANGE, type ChangeEstimate, type Point } from "@/lib/domain/stats";

interface Props {
  points: Point[];
  estimate: ChangeEstimate | null;
  baseline: number;
  callWeek: number;
  label: string;
  height?: number;
  compact?: boolean;
}

const W = 640;

/**
 * One concern over time. The shaded band is the no-meaningful-change zone
 * around the baseline; the dashed rule is the week a fair verdict is possible.
 */
export function TrendChart({ points, estimate, baseline, callWeek, label, height = 190, compact = false }: Props) {
  const H = height;
  const pad = { l: compact ? 8 : 40, r: 12, t: 14, b: compact ? 10 : 30 };
  const lastDay = points.length ? points[points.length - 1]!.day : 0;
  const spanDays = Math.max(callWeek * 7 + 7, Math.ceil((lastDay + 7) / 7) * 7, 14);

  const values = points.map((p) => p.value);
  if (Number.isFinite(baseline)) values.push(baseline - DEFAULT_MEANINGFUL_CHANGE * 2, baseline + DEFAULT_MEANINGFUL_CHANGE * 2);
  const lo = Math.max(0, Math.floor(Math.min(...values, 100) - 3));
  const hi = Math.min(100, Math.ceil(Math.max(...values, 0) + 3));
  const yMin = Math.min(lo, hi - 10);
  const yMax = Math.max(hi, yMin + 10);

  const x = (d: number) => pad.l + (d / spanDays) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);

  const weeks = Math.round(spanDays / 7);
  const tickEvery = weeks > 10 ? 2 : 1;
  const yTicks = niceTicks(yMin, yMax, 4);

  const summary = estimate
    ? `${label}: change since baseline ${estimate.change.toFixed(1)} points, 95% range ${estimate.low.toFixed(1)} to ${estimate.high.toFixed(1)}, from ${points.length} photos.`
    : `${label}: baseline ${Number.isFinite(baseline) ? baseline.toFixed(1) : "not set"}. No follow-up photos yet.`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary} style={{ overflow: "visible" }}>
      {Number.isFinite(baseline) && (
        <rect
          x={x(0)}
          width={x(spanDays) - x(0)}
          y={y(baseline + DEFAULT_MEANINGFUL_CHANGE)}
          height={y(baseline - DEFAULT_MEANINGFUL_CHANGE) - y(baseline + DEFAULT_MEANINGFUL_CHANGE)}
          fill="var(--band)"
        />
      )}

      {!compact &&
        yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)" fontFamily="var(--font-mono)">
              {t}
            </text>
          </g>
        ))}

      {!compact &&
        Array.from({ length: weeks + 1 }, (_, w) => w)
          .filter((w) => w % tickEvery === 0)
          .map((w) => (
            <text key={`x${w}`} x={x(w * 7)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--ink-3)" fontFamily="var(--font-mono)">
              {w === 0 ? "Start" : `W${w}`}
            </text>
          ))}

      <line x1={x(callWeek * 7)} x2={x(callWeek * 7)} y1={pad.t - 6} y2={H - pad.b} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="3 4" />
      {!compact && (
        <text x={x(callWeek * 7) + 6} y={pad.t + 4} fontSize={11} fill="var(--ink-2)" fontFamily="var(--font-mono)">
          fair verdict from W{callWeek}
        </text>
      )}

      {estimate && (
        <line
          x1={x(estimate.fit[0]!.day)}
          y1={y(estimate.fit[0]!.value)}
          x2={x(estimate.fit[1]!.day)}
          y2={y(estimate.fit[1]!.value)}
          stroke="var(--accent)"
          strokeWidth={2}
        />
      )}

      {points.map((p, i) => (
        <circle key={i} cx={x(p.day)} cy={y(p.value)} r={compact ? 3 : 4} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.75} />
      ))}
    </svg>
  );
}

function niceTicks(min: number, max: number, count: number): number[] {
  const step = Math.max(1, Math.ceil((max - min) / count / 5) * 5);
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max; v += step) out.push(v);
  return out;
}
