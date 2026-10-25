"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CheckIn, Trial } from "../domain/model";

/**
 * Everything Verdict knows about a person lives in this browser's IndexedDB.
 * There is no account and no server-side database.
 */

interface VerdictDB extends DBSchema {
  trials: { key: string; value: Trial; indexes: { byCreated: string } };
  checkins: { key: string; value: CheckIn; indexes: { byTrial: string } };
}

const DB_NAME = "verdict";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<VerdictDB>> | null = null;

export function db(): Promise<IDBPDatabase<VerdictDB>> {
  dbPromise ??= openDB<VerdictDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const trials = database.createObjectStore("trials", { keyPath: "id" });
      trials.createIndex("byCreated", "createdAt");
      const checkins = database.createObjectStore("checkins", { keyPath: "id" });
      checkins.createIndex("byTrial", "trialId");
    },
  });
  return dbPromise;
}

export function newId(): string {
  return crypto.randomUUID();
}

export async function listTrials(): Promise<Trial[]> {
  const all = await (await db()).getAll("trials");
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTrial(id: string): Promise<Trial | undefined> {
  return (await db()).get("trials", id);
}

export async function saveTrial(trial: Trial): Promise<void> {
  await (await db()).put("trials", trial);
}

export async function listCheckIns(trialId: string): Promise<CheckIn[]> {
  const list = await (await db()).getAllFromIndex("checkins", "byTrial", trialId);
  return list.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

export async function saveCheckIn(c: CheckIn): Promise<void> {
  await (await db()).put("checkins", c);
}

export async function deleteCheckIn(id: string): Promise<void> {
  await (await db()).delete("checkins", id);
}

export async function deleteTrial(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(["trials", "checkins"], "readwrite");
  const keys = await tx.objectStore("checkins").index("byTrial").getAllKeys(id);
  await Promise.all([...keys.map((k) => tx.objectStore("checkins").delete(k)), tx.objectStore("trials").delete(id)]);
  await tx.done;
}

export async function deleteEverything(): Promise<void> {
  const d = await db();
  const tx = d.transaction(["trials", "checkins"], "readwrite");
  await Promise.all([tx.objectStore("trials").clear(), tx.objectStore("checkins").clear()]);
  await tx.done;
}

/* Export and import: a single JSON file with photos inlined as data URLs. */

interface ExportFile {
  format: "verdict-export";
  version: 1;
  exportedAt: string;
  trials: Trial[];
  checkins: (Omit<CheckIn, "photo" | "masks"> & { photo: string; masks: Record<string, string> })[];
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

async function dataUrlToBlob(u: string): Promise<Blob> {
  if (!u.startsWith("data:image/")) throw new Error("Unexpected data in import file");
  return (await fetch(u)).blob();
}

export async function exportAll(): Promise<Blob> {
  const d = await db();
  const trials = await d.getAll("trials");
  const checkins = await d.getAll("checkins");
  const out: ExportFile = {
    format: "verdict-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    trials,
    checkins: await Promise.all(
      checkins.map(async (c) => ({
        ...c,
        photo: await blobToDataUrl(c.photo),
        masks: Object.fromEntries(await Promise.all(Object.entries(c.masks).map(async ([k, v]) => [k, await blobToDataUrl(v)] as const))),
      })),
    ),
  };
  return new Blob([JSON.stringify(out)], { type: "application/json" });
}

export async function importAll(file: Blob): Promise<{ trials: number; checkins: number }> {
  const parsed = JSON.parse(await file.text()) as ExportFile;
  if (parsed?.format !== "verdict-export" || parsed.version !== 1 || !Array.isArray(parsed.trials) || !Array.isArray(parsed.checkins)) {
    throw new Error("This isn't a Verdict export file.");
  }
  const d = await db();
  for (const t of parsed.trials) await d.put("trials", t);
  for (const c of parsed.checkins) {
    const masks: Record<string, Blob> = {};
    for (const [k, v] of Object.entries(c.masks ?? {})) masks[k] = await dataUrlToBlob(v);
    await d.put("checkins", { ...c, photo: await dataUrlToBlob(c.photo), masks });
  }
  return { trials: parsed.trials.length, checkins: parsed.checkins.length };
}
