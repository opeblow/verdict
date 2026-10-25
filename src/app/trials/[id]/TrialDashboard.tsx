"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CompareSlider } from "@/components/verdict/CompareSlider";
import { TrendChart } from "@/components/verdict/TrendChart";
import { DECISION_LABEL, STATUS_LABEL, Tag } from "@/components/verdict/labels";
import { matchScore } from "@/lib/capture/quality";
import { deleteCheckIn, deleteTrial, saveTrial } from "@/lib/client/db";
import { checkInCalendar } from "@/lib/client/ics";
import { useTrial } from "@/lib/client/useTrial";
import { CONCERN_INFO, metricLabel } from "@/lib/domain/concerns";
import { activeById } from "@/lib/domain/ingredients";
import type { CheckIn, Trial, TrialOutcome } from "@/lib/domain/model";
import { daysBetween, evaluateTrial, formatDate, type ConcernVerdict } from "@/lib/domain/verdict";
import styles from "./dashboard.module.css";

export function TrialDashboard({ id }: { id: string }) {
  const { state, reload } = useTrial(id);
  const isNew = useSearchParams().get("new") === "1";

  if (state.status === "loading") return <p className="muted">Loading your trial.</p>;
  if (state.status === "error") return <p className="notice notice-stop">{state.message}</p>;
  if (state.status === "missing")
    return (
      <div className="stack">
        <h1 className="display" style={{ fontSize: 40 }}>
          Trial not found on this device.
        </h1>
        <p className="muted">Trials are stored in the browser where they were started. If you switched devices, import an export file from Your data.</p>
        <Link href="/trials" className="btn">
          Your trials
        </Link>
      </div>
    );

  return <Dashboard trial={state.trial} checkIns={state.checkIns} isNew={isNew} reload={reload} />;
}

function money(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: amount < 10 ? 2 : 0 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function signed(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
}

function Dashboard({ trial, checkIns, isNew, reload }: { trial: Trial; checkIns: CheckIn[]; isNew: boolean; reload: () => Promise<void> }) {
  const router = useRouter();
  const verdict = useMemo(() => evaluateTrial(trial, checkIns), [trial, checkIns]);
  const d = DECISION_LABEL[verdict.decision];
  const targets = verdict.concerns.filter((c) => c.isTarget);
  const safety = verdict.concerns.filter((c) => !c.isTarget && c.concern === "redness");
  const others = verdict.concerns.filter((c) => !c.isTarget && c.concern !== "redness");
  const actives = trial.activeIds.map(activeById).filter(Boolean);
  const first = checkIns[0];
  const latest = checkIns[checkIns.length - 1];
  const [maskKey, setMaskKey] = useState<string>(trial.targets[0] ?? "");
  const [showMask, setShowMask] = useState(false);
  const weeksIn = Math.max(0, daysBetween(trial.startedAt, new Date()) / 7);
  const ended = trial.status === "ended";

  function downloadCalendar() {
    const ics = checkInCalendar({
      uid: trial.id,
      productName: trial.product.name,
      firstCheckIn: verdict.nextCheckIn,
      cadenceDays: trial.cadenceDays,
      count: Math.max(2, Math.ceil(Math.max(...targets.map((t) => t.callWeek), 4) - weeksIn) + 1),
      url: `${window.location.origin}/trials/${trial.id}`,
      place: trial.protocol.place,
    });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `verdict-${trial.product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function end(outcome: TrialOutcome) {
    await saveTrial({ ...trial, status: "ended", endedAt: new Date().toISOString(), outcome });
    await reload();
  }

  async function removeCheckIn(c: CheckIn) {
    if (!window.confirm("Remove this photo and its scores from the trial?")) return;
    await deleteCheckIn(c.id);
    await reload();
  }

  async function removeTrial() {
    if (!window.confirm("Delete this trial and all its photos from this device? This can't be undone.")) return;
    await deleteTrial(trial.id);
    router.push("/trials");
  }

  const cost =
    trial.product.price && trial.product.weeksPerUnit
      ? {
          perWeek: trial.product.price / trial.product.weeksPerUnit,
          spent: (trial.product.price / trial.product.weeksPerUnit) * Math.max(1, weeksIn),
          perYear: (trial.product.price / trial.product.weeksPerUnit) * 52,
        }
      : null;

  return (
    <div className={styles.page}>
      <p className="small">
        <Link href="/trials">Your trials</Link>
      </p>

      <header className={styles.head}>
        <div className="stack" style={{ ["--stack" as string]: "8px" }}>
          <p className="eyebrow">
            Trial, week {verdict.week}
            {ended ? (trial.outcome === "kept" ? ", ended, kept" : ", ended, stopped") : ""}
          </p>
          <h1 className={`display ${styles.title}`}>{trial.product.name}</h1>
          <p className="muted small">
            {[trial.product.brand, actives.map((a) => a!.name).join(", ") || "No known actives", `started ${formatDate(new Date(trial.startedAt))}`, `${trial.mode.toUpperCase()} analysis`]
              .filter(Boolean)
              .join("  /  ")}
          </p>
        </div>
      </header>

      {isNew && verdict.decision === "baseline" && (
        <p className="notice notice-keep">Baseline saved. Add the weekly check-ins to your calendar so you don&apos;t lose the thread.</p>
      )}

      <section className={`panel ${styles.verdict}`} aria-labelledby="verdict-h">
        <div className={styles.verdictMain}>
          <Tag tone={d.tone}>{d.label}</Tag>
          <h2 id="verdict-h" className={`display ${styles.headline}`}>
            {verdict.headline}
          </h2>
          <p className={styles.detail}>{verdict.detail}</p>
        </div>
        <div className={styles.verdictSide}>
          <dl className={styles.facts}>
            <div>
              <dt>Next check-in</dt>
              <dd>{ended ? "Trial ended" : formatDate(verdict.nextCheckIn)}</dd>
            </div>
            <div>
              <dt>Fair verdict by</dt>
              <dd>{formatDate(verdict.callOn)}</dd>
            </div>
            <div>
              <dt>Sittings</dt>
              <dd className="mono">{verdict.checkInSessions}</dd>
            </div>
          </dl>
          {!ended && (
            <div className={styles.verdictActions}>
              <Link href={`/trials/${trial.id}/check-in`} className="btn btn-accent btn-block">
                Check in now
              </Link>
              <button className="btn btn-ghost btn-block" onClick={downloadCalendar}>
                Add reminders to calendar
              </button>
            </div>
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="targets-h">
        <h2 id="targets-h" className={styles.h2}>
          Targets
        </h2>
        <div className={styles.metricList}>
          {targets.map((c) => (
            <MetricRow key={c.key} c={c} />
          ))}
        </div>
      </section>

      {safety.length > 0 && (
        <section className={styles.section} aria-labelledby="safety-h">
          <h2 id="safety-h" className={styles.h2}>
            Irritation monitor
          </h2>
          <p className="small muted">Redness is measured on every photo, whatever the product claims, so a reaction is caught early.</p>
          <div className={styles.metricList}>
            {safety.map((c) => (
              <MetricRow key={c.key} c={c} />
            ))}
          </div>
        </section>
      )}

      {first && latest && first.id !== latest.id && (
        <section className={styles.section} aria-labelledby="photos-h">
          <h2 id="photos-h" className={styles.h2}>
            Photos
          </h2>
          <div className={styles.photos}>
            <CompareSlider
              before={first.photo}
              after={latest.photo}
              beforeLabel={formatDate(new Date(first.takenAt))}
              afterLabel={formatDate(new Date(latest.takenAt))}
              beforeMask={first.masks[maskKey]}
              afterMask={latest.masks[maskKey]}
              showMask={showMask}
            />
            <div className="stack" style={{ ["--stack" as string]: "12px" }}>
              <p className="small muted">Drag to compare your first photo with your latest. Turn on an overlay to see where YouCam detected each concern.</p>
              <label className={styles.toggle}>
                <input type="checkbox" checked={showMask} onChange={(e) => setShowMask(e.target.checked)} /> Show detection overlay
              </label>
              <label className="field">
                <span>Overlay</span>
                <select className="select" value={maskKey} onChange={(e) => setMaskKey(e.target.value)} disabled={!showMask}>
                  {Object.keys(latest.masks)
                    .filter((k) => !k.startsWith("__"))
                    .map((k) => (
                      <option key={k} value={k}>
                        {metricLabel(k)}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className={styles.section} aria-labelledby="others-h">
          <h2 id="others-h" className={styles.h2}>
            Also measured
          </h2>
          <p className="small muted">Not what this product is for. Shown so you can spot side effects, good or bad.</p>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col" className="num">
                    Start
                  </th>
                  <th scope="col" className="num">
                    Change
                  </th>
                  <th scope="col">Reading</th>
                </tr>
              </thead>
              <tbody>
                {others.map((c) => (
                  <tr key={c.key}>
                    <td>{CONCERN_INFO[c.concern].label}</td>
                    <td className="num">{Number.isFinite(c.baseline) ? c.baseline.toFixed(1) : "--"}</td>
                    <td className="num">{c.estimate ? signed(c.estimate.change) : "--"}</td>
                    <td>
                      <Tag tone={STATUS_LABEL[c.status].tone}>{STATUS_LABEL[c.status].label}</Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {cost && (
        <section className={styles.section} aria-labelledby="cost-h">
          <h2 id="cost-h" className={styles.h2}>
            Cost
          </h2>
          <dl className={styles.costGrid}>
            <div>
              <dt>Per week</dt>
              <dd className="mono">{money(cost.perWeek, trial.product.currency)}</dd>
            </div>
            <div>
              <dt>Spent in this trial</dt>
              <dd className="mono">{money(cost.spent, trial.product.currency)}</dd>
            </div>
            <div>
              <dt>Per year if you keep it</dt>
              <dd className="mono">{money(cost.perYear, trial.product.currency)}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className={styles.section} aria-labelledby="log-h">
        <h2 id="log-h" className={styles.h2}>
          Photo log
        </h2>
        <p className="small muted">Remove a photo if you know something was off, such as makeup left on or a different room.</p>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Taken</th>
                <th scope="col">Type</th>
                <th scope="col" className="num">
                  Light
                </th>
                <th scope="col" className="num">
                  Light match
                </th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {checkIns.map((c) => (
                <tr key={c.id}>
                  <td>
                    {new Date(c.takenAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </td>
                  <td>{c.kind === "baseline" ? "Baseline" : "Check-in"}</td>
                  <td className="num">{Math.round(c.conditions.luma)}</td>
                  <td className="num">{first ? `${matchScore(c.conditions, first.conditions)}%` : "--"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-quiet btn-sm" onClick={() => removeCheckIn(c)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${styles.section} ${styles.endRow}`} aria-labelledby="end-h">
        <h2 id="end-h" className={styles.h2}>
          {ended ? "Trial ended" : "Finish the trial"}
        </h2>
        {!ended ? (
          <div className="row">
            <button className="btn btn-ghost" onClick={() => end("kept")}>
              I&apos;m keeping it
            </button>
            <button className="btn btn-ghost" onClick={() => end("stopped")}>
              I stopped using it
            </button>
            <button className="btn btn-danger" onClick={removeTrial}>
              Delete trial
            </button>
          </div>
        ) : (
          <div className="row">
            <p className="muted small">Ended {trial.endedAt ? formatDate(new Date(trial.endedAt)) : ""}.</p>
            <button className="btn btn-ghost" onClick={() => saveTrial({ ...trial, status: "active", endedAt: undefined, outcome: undefined }).then(reload)}>
              Reopen
            </button>
            <button className="btn btn-danger" onClick={removeTrial}>
              Delete trial
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricRow({ c }: { c: ConcernVerdict }) {
  const s = STATUS_LABEL[c.status];
  const info = CONCERN_INFO[c.concern];
  return (
    <article className={styles.metric}>
      <div className={styles.metricHead}>
        <div>
          <h3 className={styles.metricTitle}>{info.label}</h3>
          <p className="tiny faint">{s.explain}</p>
        </div>
        <Tag tone={s.tone}>{s.label}</Tag>
      </div>
      <div className={styles.metricBody}>
        <dl className={styles.numbers}>
          <div>
            <dt>Start</dt>
            <dd className="mono">{Number.isFinite(c.baseline) ? c.baseline.toFixed(1) : "--"}</dd>
          </div>
          <div>
            <dt>Change</dt>
            <dd className="mono">{c.estimate ? signed(c.estimate.change) : "--"}</dd>
          </div>
          <div>
            <dt>95% range</dt>
            <dd className="mono">{c.estimate ? `${signed(c.estimate.low)} to ${signed(c.estimate.high)}` : "--"}</dd>
          </div>
          <div>
            <dt>Photo noise</dt>
            <dd className="mono">&plusmn;{c.noise.sd.toFixed(1)}</dd>
          </div>
        </dl>
        <TrendChart points={c.points} estimate={c.estimate} baseline={c.baseline} callWeek={c.callWeek} label={info.label} />
      </div>
      {c.basis.length > 0 && <p className="tiny faint">Timeline basis: {c.basis.join(" ")}</p>}
    </article>
  );
}
