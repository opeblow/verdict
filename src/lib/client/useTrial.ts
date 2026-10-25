"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { CheckIn, Trial } from "../domain/model";
import { getTrial, listCheckIns } from "./db";

export type LoadState<T> = { status: "loading" } | { status: "missing" } | { status: "error"; message: string } | ({ status: "ready" } & T);

type TrialState = LoadState<{ trial: Trial; checkIns: CheckIn[] }>;

async function readTrial(id: string): Promise<TrialState> {
  try {
    const trial = await getTrial(id);
    if (!trial) return { status: "missing" };
    return { status: "ready", trial, checkIns: await listCheckIns(id) };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Couldn't read this device's storage." };
  }
}

export function useTrial(id: string | undefined) {
  const [state, setState] = useState<TrialState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void readTrial(id).then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  const reload = useCallback(async () => {
    setVersion((v) => v + 1);
  }, []);

  return { state, reload };
}

const noopSubscribe = () => () => {};

/** False during server rendering and hydration, true afterwards. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Object URL for a blob, revoked when the blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [entry, setEntry] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    // Synchronising with an external resource (the object URL registry) is
    // the intended use of an effect; the URL must be created and revoked here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntry({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return blob && entry?.blob === blob ? entry.url : null;
}
