"use client";

import { useEffect, useRef, useState } from "react";
import { useMounted } from "@/lib/client/useTrial";
import type { Product } from "@/lib/domain/model";
import styles from "./ProductPicker.module.css";

interface Hit {
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  ingredientsText?: string;
}

type Mode = "search" | "manual" | "scan";

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

export function ProductPicker({ onPick }: { onPick: (p: Product) => void }) {
  const [mode, setMode] = useState<Mode>("search");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mounted = useMounted();
  const canScan = mounted && Boolean(window.BarcodeDetector) && Boolean(navigator.mediaDevices?.getUserMedia);
  const [manual, setManual] = useState({ name: "", brand: "", ingredientsText: "" });

  async function lookup(params: string) {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/products?${params}`);
      const body = (await r.json()) as { products?: Hit[]; error?: { message: string } };
      if (!r.ok) throw new Error(body.error?.message ?? "Search failed");
      setHits(body.products ?? []);
      return body.products ?? [];
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
      setHits(null);
      return [];
    } finally {
      setBusy(false);
    }
  }

  const pick = (h: Hit) =>
    onPick({ name: h.name, brand: h.brand, barcode: h.barcode, imageUrl: h.imageUrl, ingredientsText: h.ingredientsText, source: "openbeautyfacts" });

  return (
    <div className={styles.root}>
      <div className={styles.tabs} role="tablist" aria-label="How to add the product">
        <button role="tab" aria-selected={mode === "search"} className={styles.tab} onClick={() => setMode("search")}>
          Search
        </button>
        {canScan && (
          <button role="tab" aria-selected={mode === "scan"} className={styles.tab} onClick={() => setMode("scan")}>
            Scan barcode
          </button>
        )}
        <button role="tab" aria-selected={mode === "manual"} className={styles.tab} onClick={() => setMode("manual")}>
          Enter by hand
        </button>
      </div>

      {mode === "search" && (
        <div className="stack">
          <form
            className={styles.searchRow}
            onSubmit={(e) => {
              e.preventDefault();
              const v = q.trim();
              if (/^\d{8,14}$/.test(v)) void lookup(`barcode=${v}`);
              else if (v.length >= 2) void lookup(`q=${encodeURIComponent(v)}`);
            }}
          >
            <label className="field" style={{ flex: 1 }}>
              <span>Product name, brand or barcode</span>
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. niacinamide serum" autoFocus />
            </label>
            <button className="btn" type="submit" disabled={busy} style={{ alignSelf: "end" }}>
              {busy ? "Searching" : "Search"}
            </button>
          </form>
          {err && <p className="notice notice-wait">{err}</p>}
          {hits && hits.length === 0 && (
            <p className="notice">
              Nothing found. Open Beauty Facts is a volunteer database, so many products are missing.{" "}
              <button className="btn-quiet btn" onClick={() => setMode("manual")}>
                Enter it by hand
              </button>
            </p>
          )}
          {hits && hits.length > 0 && (
            <ul className={styles.hits}>
              {hits.map((h) => (
                <li key={h.barcode}>
                  <button className={styles.hit} onClick={() => pick(h)}>
                    {h.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.imageUrl} alt="" className={styles.thumb} loading="lazy" />
                    ) : (
                      <span className={styles.thumb} aria-hidden="true" />
                    )}
                    <span className={styles.hitText}>
                      <span className={styles.hitName}>{h.name}</span>
                      <span className="tiny faint">
                        {h.brand ?? "Unknown brand"}
                        {h.ingredientsText ? ", ingredients listed" : ", no ingredient list"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="tiny faint">
            Product data from{" "}
            <a href="https://world.openbeautyfacts.org" target="_blank" rel="noreferrer">
              Open Beauty Facts
            </a>
            , available under the Open Database License.
          </p>
        </div>
      )}

      {mode === "scan" && (
        <BarcodeScan
          onCode={async (code) => {
            setMode("search");
            setQ(code);
            const found = await lookup(`barcode=${code}`);
            if (found.length === 1) pick(found[0]!);
          }}
        />
      )}

      {mode === "manual" && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!manual.name.trim()) return;
            onPick({
              name: manual.name.trim(),
              brand: manual.brand.trim() || undefined,
              ingredientsText: manual.ingredientsText.trim() || undefined,
              source: "manual",
            });
          }}
        >
          <div className={styles.twoCol}>
            <label className="field">
              <span>Product name</span>
              <input className="input" required value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Brand</span>
              <input className="input" value={manual.brand} onChange={(e) => setManual({ ...manual, brand: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span>Ingredients</span>
            <textarea
              className="textarea"
              value={manual.ingredientsText}
              onChange={(e) => setManual({ ...manual, ingredientsText: e.target.value })}
              placeholder="Paste the ingredient list from the box or the brand's website"
            />
            <span className="hint">Optional, but it lets Verdict set a fair timeline for each active ingredient.</span>
          </label>
          <button className="btn" type="submit">
            Use this product
          </button>
        </form>
      )}
    </div>
  );
}

function BarcodeScan({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    const Detector = window.BarcodeDetector;
    if (!Detector) return;
    const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        while (!stop) {
          const codes = await detector.detect(v).catch(() => []);
          const code = codes.find((c) => /^\d{8,14}$/.test(c.rawValue));
          if (code) {
            onCodeRef.current(code.rawValue);
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setErr("Couldn't open the camera for scanning. Type the barcode into search instead.");
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="stack">
      <video ref={videoRef} className={styles.scanVideo} playsInline muted aria-label="Barcode camera" />
      <p className="small muted">Point the rear camera at the barcode on the box or bottle.</p>
      {err && <p className="notice notice-wait">{err}</p>}
    </div>
  );
}
