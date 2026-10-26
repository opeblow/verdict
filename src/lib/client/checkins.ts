"use client";

import type { CaptureOutcome } from "@/components/capture/CaptureFlow";
import type { CheckIn, Trial } from "../domain/model";
import { newId, saveCheckIn } from "./db";

/** Turn a finished capture into a stored check-in. */
export async function recordCheckIn(trial: Trial, outcome: CaptureOutcome, kind: CheckIn["kind"], session: string): Promise<CheckIn> {
  const checkIn: CheckIn = {
    id: newId(),
    trialId: trial.id,
    takenAt: new Date().toISOString(),
    kind,
    session,
    readings: outcome.analysis.readings.map((r) => ({ key: r.key, concern: r.concern, region: r.region, raw: r.raw, ui: r.ui })),
    overall: outcome.analysis.overall,
    skinAge: outcome.analysis.skinAge,
    skinType: outcome.analysis.skinType,
    conditions: outcome.conditions,
    taskId: outcome.taskId,
    photo: outcome.photo.blob,
    masks: outcome.masks,
  };
  await saveCheckIn(checkIn);
  return checkIn;
}
