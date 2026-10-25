"use client";

import { useId, useState } from "react";
import { useObjectUrl } from "@/lib/client/useTrial";
import styles from "./CompareSlider.module.css";

interface Props {
  before: Blob;
  after: Blob;
  beforeLabel: string;
  afterLabel: string;
  beforeMask?: Blob;
  afterMask?: Blob;
  showMask: boolean;
}

/** Drag to compare the baseline photo with the latest one, optionally with a detection overlay. */
export function CompareSlider({ before, after, beforeLabel, afterLabel, beforeMask, afterMask, showMask }: Props) {
  const [pos, setPos] = useState(50);
  const id = useId();
  const b = useObjectUrl(before);
  const a = useObjectUrl(after);
  const bm = useObjectUrl(showMask ? beforeMask : null);
  const am = useObjectUrl(showMask ? afterMask : null);

  return (
    <figure className={styles.root}>
      <div className={styles.frame}>
        {/* eslint-disable @next/next/no-img-element */}
        {a && <img src={a} alt={afterLabel} className={styles.img} />}
        {am && <img src={am} alt="" className={styles.mask} />}
        <div className={styles.top} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {b && <img src={b} alt={beforeLabel} className={styles.img} />}
          {bm && <img src={bm} alt="" className={styles.mask} />}
        </div>
        {/* eslint-enable @next/next/no-img-element */}
        <div className={styles.handle} style={{ left: `${pos}%` }} aria-hidden="true" />
        <span className={`${styles.label} ${styles.left}`}>{beforeLabel}</span>
        <span className={`${styles.label} ${styles.right}`}>{afterLabel}</span>
      </div>
      <label htmlFor={id} className="visually-hidden">
        Compare position
      </label>
      <input id={id} type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className={styles.range} />
    </figure>
  );
}
