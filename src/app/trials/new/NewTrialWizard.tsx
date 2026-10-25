"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CaptureFlow, type CaptureOutcome } from "@/components/capture/CaptureFlow";
import { ProductPicker } from "@/components/product/ProductPicker";
import { health, type ServerHealth } from "@/lib/client/api";
import { recordCheckIn } from "@/lib/client/checkins";
import { newId, saveTrial } from "@/lib/client/db";
import { CONCERNS, CONCERN_INFO, planConcerns, unitCost, type AnalysisMode, type Concern } from "@/lib/domain/concerns";
import { ACTIVES, detectActives, suggestedTargets, timelineFor } from "@/lib/domain/ingredients";
import type { Product, Trial } from "@/lib/domain/model";
import styles from "./wizard.module.css";

type Step = 1 | 2 | 3 | 4;
const STEPS: Record<Step, string> = { 1: "Product", 2: "Goals", 3: "Setup", 4: "Baseline" };
const MAX_TARGETS = 5;

export function NewTrialWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [targets, setTargets] = useState<Concern[]>([]);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [weeksPerUnit, setWeeksPerUnit] = useState("");
  const [place, setPlace] = useState("");
  const [timeOfDay, setTimeOfDay] = useState<"morning" | "evening">("morning");
  const [server, setServer] = useState<ServerHealth | null | undefined>(undefined);
  const trialRef = useRef<Trial | null>(null);
  const [lockedMode, setLockedMode] = useState<AnalysisMode | null>(null);
  const [baselineCount, setBaselineCount] = useState(0);
  const sessionRef = useRef(newId());
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    void health().then(setServer);
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const actives = useMemo(() => ACTIVES.filter((a) => activeIds.includes(a.id)), [activeIds]);
  const concerns = useMemo(() => planConcerns(targets), [targets]);
  const longestCall = Math.max(4, ...targets.map((t) => timelineFor(t, actives).callWeek));
  const unitsPerPhoto = unitCost(concerns.length, "hd");

  function choose(p: Product) {
    setProduct(p);
    const found = p.ingredientsText ? detectActives(p.ingredientsText) : [];
    setActiveIds(found.map((a) => a.id));
    setTargets(suggestedTargets(found).slice(0, 3));
    setStep(2);
  }

  function toggle<T>(list: T[], v: T, max = Infinity): T[] {
    if (list.includes(v)) return list.filter((x) => x !== v);
    return list.length >= max ? list : [...list, v];
  }

  async function onBaseline(outcome: CaptureOutcome) {
    let trial = trialRef.current;
    if (!trial) {
      const now = new Date().toISOString();
      trial = {
        id: newId(),
        createdAt: now,
        startedAt: now,
        product: {
          ...product!,
          price: price ? Number(price) : undefined,
          currency: price ? currency : undefined,
          weeksPerUnit: weeksPerUnit ? Number(weeksPerUnit) : undefined,
        },
        activeIds,
        targets,
        concerns,
        mode: outcome.mode,
        protocol: { place: place.trim() || undefined, timeOfDay },
        cadenceDays: 7,
        status: "active",
      };
      await saveTrial(trial);
      trialRef.current = trial;
      setLockedMode(trial.mode);
    }
    await recordCheckIn(trial, outcome, "baseline", sessionRef.current);
    const n = baselineCount + 1;
    setBaselineCount(n);
    if (n >= 2) router.push(`/trials/${trial.id}?new=1`);
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.rail} aria-label="Progress">
        <p className="eyebrow">New trial</p>
        <ol className={styles.steps}>
          {(Object.keys(STEPS) as unknown as Step[]).map((k) => {
            const n = Number(k) as Step;
            return (
              <li key={k} data-state={n === step ? "current" : n < step ? "done" : "todo"} aria-current={n === step ? "step" : undefined}>
                <span className="mono">{String(n).padStart(2, "0")}</span> {STEPS[n]}
              </li>
            );
          })}
        </ol>
        {product && (
          <div className={styles.summary}>
            <p className="tiny faint mono">PRODUCT</p>
            <p className="small">{product.name}</p>
            {product.brand && <p className="tiny faint">{product.brand}</p>}
          </div>
        )}
      </aside>

      <div className={styles.main}>
        {step === 1 && (
          <section className="stack" style={{ ["--stack" as string]: "20px" }}>
            <h1 ref={headingRef} tabIndex={-1} className={`display ${styles.h1}`}>
              Which product are you testing?
            </h1>
            <p className="muted">Test one new product at a time. If you change two things at once, no one can tell which one worked.</p>
            <ProductPicker onPick={choose} />
          </section>
        )}

        {step === 2 && product && (
          <section className="stack" style={{ ["--stack" as string]: "24px" }}>
            <h1 ref={headingRef} tabIndex={-1} className={`display ${styles.h1}`}>
              What should it improve?
            </h1>

            <div className="stack" style={{ ["--stack" as string]: "10px" }}>
              <h2 className={styles.h2}>Active ingredients</h2>
              <p className="small muted">
                {activeIds.length
                  ? "Found in the ingredient list. Add any that were missed."
                  : product.ingredientsText
                    ? "No actives Verdict knows were found in the ingredient list. Pick any it contains."
                    : "No ingredient list. Pick the main actives from the label, if you know them."}
              </p>
              <div className={styles.chips}>
                {ACTIVES.map((a) => (
                  <button key={a.id} className="chip" aria-pressed={activeIds.includes(a.id)} onClick={() => setActiveIds((l) => toggle(l, a.id))}>
                    {a.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="stack" style={{ ["--stack" as string]: "10px" }}>
              <h2 className={styles.h2}>Targets</h2>
              <p className="small muted">Pick what the product claims to do, up to {MAX_TARGETS}. Redness is always measured too, to catch irritation.</p>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Target</th>
                      <th scope="col">Fair verdict from</th>
                      <th scope="col" className="visually-hidden">
                        Select
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {CONCERNS.map((c) => {
                      const on = targets.includes(c);
                      const tl = timelineFor(c, actives);
                      return (
                        <tr key={c} className={on ? styles.rowOn : undefined}>
                          <td>
                            <label className={styles.check}>
                              <input type="checkbox" checked={on} onChange={() => setTargets((l) => toggle(l, c, MAX_TARGETS))} />
                              <span>
                                <span className={styles.checkLabel}>{CONCERN_INFO[c].label}</span>
                                <span className="tiny faint">{CONCERN_INFO[c].describes}</span>
                              </span>
                            </label>
                          </td>
                          <td className="mono small">Week {tl.callWeek}</td>
                          <td />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="stack" style={{ ["--stack" as string]: "10px" }}>
              <h2 className={styles.h2}>What it costs you</h2>
              <p className="small muted">Optional. Used to show what the product costs per week and whether it&apos;s worth it.</p>
              <div className={styles.priceRow}>
                <label className="field">
                  <span>Price</span>
                  <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="24.00" />
                </label>
                <label className="field">
                  <span>Currency</span>
                  <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {["USD", "EUR", "GBP", "CAD", "AUD", "INR", "NGN", "JPY", "KRW", "SGD", "ZAR", "BRL", "MXN"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Weeks per bottle</span>
                  <input className="input" inputMode="numeric" value={weeksPerUnit} onChange={(e) => setWeeksPerUnit(e.target.value.replace(/\D/g, ""))} placeholder="8" />
                </label>
              </div>
            </div>

            <div className="row">
              <button className="btn btn-accent" disabled={targets.length === 0} onClick={() => setStep(3)}>
                Continue
              </button>
              <button className="btn btn-quiet" onClick={() => setStep(1)}>
                Change product
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="stack" style={{ ["--stack" as string]: "22px" }}>
            <h1 ref={headingRef} tabIndex={-1} className={`display ${styles.h1}`}>
              Pick your photo spot.
            </h1>
            <p className="muted">
              Light changes skin scores more than a week of skincare does. Choose one spot and time of day and use them for every check-in.
            </p>
            <label className="field">
              <span>Where will you take the photos?</span>
              <input className="input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Bathroom, facing the window" />
              <span className="hint">Daylight from a window in front of you works best. Verdict will remind you of this spot.</span>
            </label>
            <fieldset className={styles.fieldset}>
              <legend>When?</legend>
              <div className="row">
                {(["morning", "evening"] as const).map((t) => (
                  <label key={t} className="chip" aria-pressed={timeOfDay === t}>
                    <input type="radio" name="tod" value={t} checked={timeOfDay === t} onChange={() => setTimeOfDay(t)} className="visually-hidden" />
                    {t === "morning" ? "Morning, before skincare" : "Evening, after cleansing"}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="panel" style={{ padding: 18 }}>
              <p className="eyebrow">The plan</p>
              <dl className={styles.plan}>
                <div>
                  <dt>Measured each time</dt>
                  <dd>{concerns.map((c) => CONCERN_INFO[c].label).join(", ")}</dd>
                </div>
                <div>
                  <dt>Check-ins</dt>
                  <dd>Weekly, for at least {longestCall} weeks</dd>
                </div>
                <div>
                  <dt>API units</dt>
                  <dd className="mono">
                    about {unitsPerPhoto} per photo, {unitsPerPhoto * (2 + longestCall)} for the trial
                  </dd>
                </div>
              </dl>
            </div>

            <div className="row">
              <button className="btn btn-accent" onClick={() => setStep(4)}>
                Continue to baseline photos
              </button>
              <button className="btn btn-quiet" onClick={() => setStep(2)}>
                Back
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="stack" style={{ ["--stack" as string]: "18px" }}>
            <h1 ref={headingRef} tabIndex={-1} className={`display ${styles.h1}`}>
              {baselineCount === 0 ? "Two baseline photos." : "One more, so Verdict knows your noise."}
            </h1>
            <p className="muted">
              {baselineCount === 0
                ? "Take the first photo. Then you'll step away and take a second one. The difference between the two tells Verdict how much your photos vary when your skin hasn't changed."
                : "Put the phone down, step out of frame, then line up and take it again, exactly as before."}
            </p>
            {server === null || (server && !server.youcamConfigured) ? (
              <p className="notice notice-stop">This server has no YouCam API key, so analysis can&apos;t run. See SETUP.md to add one.</p>
            ) : null}
            <CaptureFlow
              key={baselineCount}
              mode={lockedMode}
              concerns={concerns}
              baseline={null}
              title={`Baseline photo ${baselineCount + 1} of 2`}
              onDone={onBaseline}
              onCancel={baselineCount === 0 ? () => setStep(3) : undefined}
            />
          </section>
        )}
      </div>
    </div>
  );
}
