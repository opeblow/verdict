"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Spoken guidance through the browser's own speech synthesis. Nothing is sent
 * anywhere: the voice runs on the device, so it needs no network, key or
 * permission, and it works with the screen dimmed or out of sight.
 */

const PREF_KEY = "verdict.speakGuidance";
const listeners = new Set<() => void>();

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Speak `text`. By default it interrupts anything already being said. */
export function speak(text: string, { interrupt = true } = {}): void {
  if (!speechAvailable() || !text.trim()) return;
  const synth = window.speechSynthesis;
  if (interrupt) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 1;
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (speechAvailable()) window.speechSynthesis.cancel();
}

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Whether the person has turned spoken guidance on. Remembered on this device. */
export function useSpokenGuidance(): [boolean, (on: boolean) => void, boolean] {
  const on = useSyncExternalStore(subscribe, readPref, () => false);
  const available = useSyncExternalStore(subscribe, speechAvailable, () => false);
  const set = useCallback((next: boolean) => {
    try {
      if (next) localStorage.setItem(PREF_KEY, "1");
      else localStorage.removeItem(PREF_KEY);
    } catch {
      /* storage blocked: the setting lasts for this page only */
    }
    if (!next) stopSpeaking();
    listeners.forEach((l) => l());
  }, []);
  return [on && available, set, available];
}

/**
 * Speaks `message` when guidance is on and the message has stayed the same for
 * `settleMs`, so a live readout that flickers between states is not read out
 * on every frame.
 */
export function useSpeakWhenSettled(message: string | null, enabled: boolean, settleMs = 900): void {
  useEffect(() => {
    if (!enabled || !message) return;
    const t = window.setTimeout(() => speak(message), settleMs);
    return () => window.clearTimeout(t);
  }, [message, enabled, settleMs]);
}
