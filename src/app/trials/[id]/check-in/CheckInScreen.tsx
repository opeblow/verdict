"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CaptureFlow, type CaptureOutcome } from "@/components/capture/CaptureFlow";
import { recordCheckIn } from "@/lib/client/checkins";
import { newId } from "@/lib/client/db";
import { useTrial } from "@/lib/client/useTrial";
import { unitCost } from "@/lib/domain/concerns";
import { daysBetween, formatDate } from "@/lib/domain/verdict";
import styles from "./checkin.module.css";

export function CheckInScreen({ id }: { id: string }) {
  const router = useRouter();
  const { state } = useTrial(id);
  const session = useRef(newId());
  const [taken, setTaken] = useState(0);

  if (state.status === "loading") return <p className="muted">Loading.</p>;
  if (state.status !== "ready")
    return (
      <p className="notice notice-stop">
        This trial isn&apos;t on this device. <Link href="/trials">Your trials</Link>
      </p>
    );

  const { trial, checkIns } = state;
  const first = checkIns[0];
  const last = checkIns[checkIns.length - 1];
  const sinceLast = last ? daysBetween(last.takenAt, new Date()) : Infinity;
  const units = unitCost(trial.concerns.length, trial.mode);

  async function onDone(outcome: CaptureOutcome) {
    await recordCheckIn(trial, outcome, "check-in", session.current);
    setTaken((n) => n + 1);
  }

  return (
    <div className={styles.layout}>
      <div className="stack" style={{ ["--stack" as string]: "14px" }}>
        <p className="small">
          <Link href={`/trials/${trial.id}`}>Back to {trial.product.name}</Link>
        </p>
        <h1 className={`display ${styles.h1}`}>{taken === 0 ? "Weekly check-in." : "Saved."}</h1>

        {taken === 0 ? (
          <>
            <ul className={styles.reminders}>
              <li>
                <span className="eyebrow">Spot</span>
                {trial.protocol.place ?? "Same spot as your first photo"}
              </li>
              <li>
                <span className="eyebrow">Time</span>
                {trial.protocol.timeOfDay === "evening" ? "Evening, after cleansing" : "Morning, before skincare"}
              </li>
              <li>
                <span className="eyebrow">Skin</span>
                Bare, no makeup or fresh moisturiser
              </li>
            </ul>
            {sinceLast < 5 && (
              <p className="notice notice-wait">
                Your last photo was {sinceLast < 1 ? "today" : `${Math.round(sinceLast)} day${Math.round(sinceLast) === 1 ? "" : "s"} ago`}. Weekly check-ins give a fairer picture; daily photos mostly measure noise.
              </p>
            )}
          </>
        ) : (
          <div className="stack" style={{ ["--stack" as string]: "12px" }}>
            <p className="muted">
              {taken === 1
                ? `A second photo now, after stepping away and lining up again, sharpens Verdict's estimate of your photo noise and makes the result more reliable. It uses about ${units} more units.`
                : "Two photos this sitting. That's the most useful amount."}
            </p>
            <div className="row">
              <Link href={`/trials/${trial.id}`} className="btn btn-accent">
                See the verdict
              </Link>
            </div>
          </div>
        )}
      </div>

      {taken < 2 && (
        <CaptureFlow
          key={taken}
          mode={trial.mode}
          concerns={trial.concerns}
          baseline={first?.conditions ?? null}
          ghost={first?.photo ?? null}
          title={taken === 0 ? `Check-in photo, ${formatDate(new Date())}` : "Optional second photo"}
          onDone={onDone}
          onCancel={taken === 1 ? () => router.push(`/trials/${trial.id}`) : undefined}
        />
      )}
    </div>
  );
}
