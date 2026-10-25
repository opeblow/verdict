"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FACE_GUIDE, assessConditions, matchScore, measureFrame, type CaptureIssue } from "@/lib/capture/quality";
import { SHORT_SIDE_MIN, bestModeFor, loadImage, preparePhoto, sampleFrame, type Drawable, type PreparedPhoto } from "@/lib/capture/image";
import { ApiError, analyse, setAccessCode, type AnalysisPhase, type AnalysisResult } from "@/lib/client/api";
import { unitCost, type AnalysisMode, type Concern } from "@/lib/domain/concerns";
import type { CaptureConditions } from "@/lib/domain/model";
import { useObjectUrl } from "@/lib/client/useTrial";
import styles from "./CaptureFlow.module.css";

export interface CaptureOutcome extends AnalysisResult {
  photo: PreparedPhoto;
  conditions: CaptureConditions;
  mode: AnalysisMode;
}

interface Props {
  /** Locked mode for check-ins. Null at baseline: chosen from the first photo. */
  mode: AnalysisMode | null;
  concerns: readonly Concern[];
  baseline?: CaptureConditions | null;
  ghost?: Blob | null;
  title: string;
  onDone: (result: CaptureOutcome) => void | Promise<void>;
  onCancel?: () => void;
}

type Phase = "start" | "live" | "review" | "working" | "error";

const PHASE_TEXT: Record<AnalysisPhase, string> = {
  uploading: "Uploading your photo",
  analysing: "Measuring your skin",
  saving: "Saving results to this device",
};

export function CaptureFlow({ mode, concerns, baseline, ghost, title, onDone, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>("start");
  const [issues, setIssues] = useState<CaptureIssue[]>([]);
  const [live, setLive] = useState<CaptureConditions | null>(null);
  const [shot, setShot] = useState<{ photo: PreparedPhoto; conditions: CaptureConditions } | null>(null);
  const [work, setWork] = useState<AnalysisPhase>("uploading");
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [showGhost, setShowGhost] = useState(true);
  const ghostUrl = useObjectUrl(ghost);
  const shotUrl = useObjectUrl(shot?.photo.blob);
  const [code, setCode] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sampleRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopCamera();
      abortRef.current?.abort();
    },
    [stopCamera],
  );

  // Live light check while the camera is open.
  useEffect(() => {
    if (phase !== "live") return;
    sampleRef.current ??= document.createElement("canvas");
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      const s = sampleFrame(v, sampleRef.current!);
      if (!s) return;
      const c = measureFrame(s.frame, s.full);
      setLive(c);
      setIssues(assessConditions(c, baseline));
    }, 160);
    return () => window.clearInterval(id);
  }, [phase, baseline]);

  async function openCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("live");
      requestAnimationFrame(() => {
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          void v.play().catch(() => {});
        }
      });
    } catch {
      setError({
        code: "camera",
        message: "Verdict couldn't open your camera. Allow camera access in your browser settings, or upload a photo instead.",
      });
      setPhase("error");
    }
  }

  const prepare = useCallback(
    async (src: Drawable) => {
      const photo = await preparePhoto(src);
      sampleRef.current ??= document.createElement("canvas");
      const s = sampleFrame(src, sampleRef.current);
      const conditions = s ? measureFrame(s.frame, { width: photo.width, height: photo.height }) : (live as CaptureConditions);
      setShot({ photo, conditions });
      setIssues(assessConditions(conditions, baseline));
      setPhase("review");
    },
    [baseline, live],
  );

  function takePhoto() {
    let n = 3;
    setCountdown(n);
    const id = window.setInterval(async () => {
      n -= 1;
      setCountdown(n);
      if (n > 0) return;
      window.clearInterval(id);
      const v = videoRef.current;
      if (!v) return;
      await prepare(v);
      stopCamera();
    }, 700);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const bmp = await loadImage(file);
      await prepare(bmp);
      bmp.close();
    } catch {
      setError({ code: "decode", message: "That file couldn't be opened. Use a JPG or PNG photo." });
      setPhase("error");
    }
  }

  async function submit() {
    if (!shot) return;
    const chosen = mode ?? bestModeFor(shot.photo.width, shot.photo.height);
    if (!chosen) {
      setError({ code: "low_res", message: `This photo is too small. It needs to be at least ${SHORT_SIDE_MIN.sd} pixels wide after cropping.` });
      setPhase("error");
      return;
    }
    if (Math.min(shot.photo.width, shot.photo.height) < SHORT_SIDE_MIN[chosen]) {
      setError({
        code: "low_res",
        message: "This photo has a lower resolution than your baseline, so its scores wouldn't be comparable. Use the same device and camera as your first photo.",
      });
      setPhase("error");
      return;
    }
    setPhase("working");
    setWork("uploading");
    abortRef.current = new AbortController();
    try {
      const result = await analyse(shot.photo, chosen, concerns, setWork, abortRef.current.signal);
      await onDone({ ...result, photo: shot.photo, conditions: shot.conditions, mode: chosen });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const e = err instanceof ApiError ? err : new ApiError("Something went wrong. Try again.", "unknown", 0);
      setError({ code: e.code, message: e.message });
      setPhase("error");
    }
  }

  function retake() {
    setShot(null);
    setError(null);
    setIssues([]);
    setPhase("start");
  }

  const blocked = issues.some((i) => i.level === "block");
  const top = issues[0];
  const units = unitCost(concerns.length, mode ?? "hd");

  return (
    <section className={styles.root} aria-labelledby="capture-title">
      <div className="spread">
        <h2 id="capture-title" className={styles.title}>
          {title}
        </h2>
        {mode && <span className="tiny faint mono">{mode.toUpperCase()} analysis, locked for this trial</span>}
      </div>

      <div className={styles.frame} data-phase={phase}>
        {phase === "live" && <video ref={videoRef} className={styles.video} playsInline muted autoPlay aria-label="Camera preview" />}
        {phase === "live" && ghostUrl && showGhost && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ghostUrl} alt="" className={styles.ghost} />
        )}
        {(phase === "review" || phase === "working" || (phase === "error" && shot)) && shotUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shotUrl} alt="Your photo" className={styles.still} />
        )}
        {(phase === "start" || (phase === "error" && !shot)) && (
          <div className={styles.placeholder}>
            <ul className={styles.tips}>
              <li>Bare skin. Remove makeup, glasses, and pull hair off your forehead.</li>
              <li>Face a window or bright light. Avoid light from behind or from one side.</li>
              <li>Hold the camera at eye level, about an arm&apos;s length away.</li>
              {baseline ? <li>Stand in the same spot as your first photo.</li> : null}
            </ul>
          </div>
        )}
        {(phase === "live" || phase === "review") && (
          <svg className={styles.guide} viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <mask id="guide-hole">
                <rect width="300" height="400" fill="white" />
                <ellipse cx={300 * FACE_GUIDE.cx} cy={400 * FACE_GUIDE.cy} rx={300 * FACE_GUIDE.rx} ry={400 * FACE_GUIDE.ry} fill="black" />
              </mask>
            </defs>
            <rect width="300" height="400" fill="rgba(20,19,17,0.42)" mask="url(#guide-hole)" />
            <ellipse
              cx={300 * FACE_GUIDE.cx}
              cy={400 * FACE_GUIDE.cy}
              rx={300 * FACE_GUIDE.rx}
              ry={400 * FACE_GUIDE.ry}
              fill="none"
              stroke={blocked ? "#f07a68" : "#fffdf9"}
              strokeWidth="2"
              strokeDasharray={blocked ? "6 6" : undefined}
            />
          </svg>
        )}
        {countdown > 0 && (
          <div className={styles.countdown} aria-live="assertive">
            {countdown}
          </div>
        )}
        {phase === "working" && (
          <div className={styles.working} role="status" aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            <p>{PHASE_TEXT[work]}</p>
            <p className="tiny">Usually 10 to 40 seconds.</p>
          </div>
        )}
      </div>

      {phase === "live" && (
        <div className={styles.readout} aria-live="polite">
          <p className={styles.status} data-level={top?.level ?? "ok"}>
            {top ? top.message : "Good light. Line up with the oval and hold still."}
          </p>
          {live && (
            <dl className={styles.meters}>
              <div>
                <dt>Light</dt>
                <dd className="mono">{Math.round(live.luma)}</dd>
              </div>
              <div>
                <dt>Evenness</dt>
                <dd className="mono">{Math.max(0, Math.round(100 - Math.abs(live.balance) * 200))}%</dd>
              </div>
              {baseline ? (
                <div>
                  <dt>Matches first photo</dt>
                  <dd className="mono">{matchScore(live, baseline)}%</dd>
                </div>
              ) : null}
            </dl>
          )}
        </div>
      )}

      {phase === "review" && issues.length > 0 && (
        <ul className={styles.issues}>
          {issues.map((i) => (
            <li key={i.id} data-level={i.level}>
              {i.message}
            </li>
          ))}
        </ul>
      )}

      {phase === "error" && error && (
        <div className="notice notice-stop stack" role="alert" style={{ ["--stack" as string]: "12px" }}>
          <p>{error.message}</p>
          {error.code === "access_code_required" && (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                setAccessCode(code.trim());
                setError(null);
                setPhase(shot ? "review" : "start");
              }}
            >
              <label className="field" style={{ flex: 1, minWidth: 200 }}>
                <span>Access code</span>
                <input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
              </label>
              <button className="btn" type="submit" style={{ alignSelf: "end" }}>
                Save code
              </button>
            </form>
          )}
        </div>
      )}

      <div className={styles.actions}>
        {phase === "start" && (
          <>
            <button className="btn btn-accent" onClick={openCamera}>
              Open camera
            </button>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              Upload a photo
            </button>
          </>
        )}
        {phase === "live" && (
          <>
            <button className="btn btn-accent" onClick={takePhoto} disabled={blocked || countdown > 0}>
              {countdown > 0 ? "Hold still" : "Take photo"}
            </button>
            {ghostUrl && (
              <button className="btn btn-ghost" onClick={() => setShowGhost((s) => !s)} aria-pressed={showGhost}>
                {showGhost ? "Hide first photo" : "Show first photo"}
              </button>
            )}
            <button
              className="btn btn-quiet"
              onClick={() => {
                stopCamera();
                setPhase("start");
              }}
            >
              Cancel
            </button>
          </>
        )}
        {phase === "review" && (
          <>
            <button className="btn btn-accent" onClick={submit} disabled={blocked}>
              Analyse this photo
            </button>
            <button className="btn btn-ghost" onClick={retake}>
              Retake
            </button>
          </>
        )}
        {phase === "working" && (
          <button
            className="btn btn-quiet"
            onClick={() => {
              abortRef.current?.abort();
              setPhase("review");
            }}
          >
            Cancel
          </button>
        )}
        {phase === "error" && (
          <>
            {shot && error?.code !== "low_res" && (
              <button className="btn btn-accent" onClick={submit}>
                Try again
              </button>
            )}
            <button className="btn btn-ghost" onClick={retake}>
              Retake photo
            </button>
          </>
        )}
        {onCancel && phase !== "working" && (
          <button className="btn btn-quiet" onClick={onCancel}>
            Back
          </button>
        )}
      </div>

      <p className="tiny faint">
        Each analysis uses about {units} YouCam API units. The photo is deleted from YouCam once results are saved on this device.
      </p>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png" hidden onChange={onFile} />
    </section>
  );
}

