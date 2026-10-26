"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DECISION_LABEL, Tag } from "@/components/verdict/labels";
import { listCheckIns, listTrials } from "@/lib/client/db";
import type { Trial } from "@/lib/domain/model";
import { evaluateTrial, formatDate, type TrialVerdict } from "@/lib/domain/verdict";
import styles from "./list.module.css";

type Row = { trial: Trial; verdict: TrialVerdict; due: boolean };

export function TrialList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const trials = await listTrials();
        const now = new Date();
        const built = await Promise.all(
          trials.map(async (t) => {
            const verdict = evaluateTrial(t, await listCheckIns(t.id), now);
            return { trial: t, verdict, due: verdict.nextCheckIn.getTime() <= now.getTime() };
          }),
        );
        setRows(built);
      } catch {
        setError("This browser is blocking local storage, so Verdict can't save trials here. Private windows often do this.");
      }
    })();
  }, []);

  const active = rows?.filter((r) => r.trial.status === "active") ?? [];
  const ended = rows?.filter((r) => r.trial.status === "ended") ?? [];

  return (
    <div className="stack" style={{ ["--stack" as string]: "28px" }}>
      <div className="spread">
        <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>
          Your trials
        </h1>
        <Link href="/trials/new" className="btn btn-accent">
          Start a trial
        </Link>
      </div>

      {error && <p className="notice notice-stop">{error}</p>}
      {rows === null && !error && <p className="muted">Loading.</p>}

      {rows && rows.length === 0 && (
        <div className={`panel ${styles.empty}`}>
          <h2 className="display" style={{ fontSize: 30 }}>
            No trials yet.
          </h2>
          <p className="muted">Pick the product you&apos;re least sure about. Verdict will tell you when you can fairly judge it.</p>
          <Link href="/trials/new" className="btn">
            Start your first trial
          </Link>
        </div>
      )}

      {active.length > 0 && (
        <section className="stack" style={{ ["--stack" as string]: "0" }} aria-label="Active trials">
          <ul className={styles.list}>
            {active.map(({ trial, verdict, due }) => {
              const d = DECISION_LABEL[verdict.decision];
              return (
                <li key={trial.id}>
                  <Link href={`/trials/${trial.id}`} className={styles.item}>
                    <span className={styles.name}>
                      <span className={styles.product}>{trial.product.name}</span>
                      <span className="tiny faint">{trial.product.brand ?? "No brand"}, week {verdict.week}</span>
                    </span>
                    <span className={styles.headline}>{verdict.headline}</span>
                    <span className={`tiny mono ${due ? styles.due : "faint"}`}>{due ? "Check-in due" : `Next ${formatDate(verdict.nextCheckIn)}`}</span>
                    <Tag tone={d.tone}>{d.label}</Tag>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ended.length > 0 && (
        <section className="stack" aria-labelledby="ended-h">
          <h2 id="ended-h" className="eyebrow">
            Finished
          </h2>
          <ul className={styles.list}>
            {ended.map(({ trial, verdict }) => (
              <li key={trial.id}>
                <Link href={`/trials/${trial.id}`} className={styles.item}>
                  <span className={styles.name}>
                    <span className={styles.product}>{trial.product.name}</span>
                    <span className="tiny faint">{trial.outcome === "kept" ? "Kept" : "Stopped"}</span>
                  </span>
                  <span className={styles.headline}>{verdict.headline}</span>
                  <span />
                  <Tag tone="neutral">Ended</Tag>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
