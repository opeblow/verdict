import { CONCERN_INFO } from "@/lib/domain/concerns";
import { formatDate, type TrialVerdict } from "@/lib/domain/verdict";
import { DECISION_LABEL, STATUS_LABEL, Tag } from "./labels";
import { TrendChart } from "./TrendChart";
import styles from "./VerdictCard.module.css";

interface Props {
  verdict: TrialVerdict;
  productName: string;
  brand?: string;
  /** Marks illustrative content so it is never mistaken for a real result. */
  example?: boolean;
  showCharts?: boolean;
}

export function VerdictCard({ verdict, productName, brand, example = false, showCharts = true }: Props) {
  const d = DECISION_LABEL[verdict.decision];
  const targets = verdict.concerns.filter((c) => c.isTarget);
  return (
    <article className={`panel ${styles.card}`} aria-label={`Verdict for ${productName}`}>
      <header className={styles.head}>
        <div>
          <p className="eyebrow">{example ? "Example verdict" : "Verdict"}, week {verdict.week}</p>
          <p className={styles.product}>
            {productName}
            {brand ? <span className="faint">, {brand}</span> : null}
          </p>
        </div>
        <Tag tone={d.tone}>{d.label}</Tag>
      </header>
      <hr className="rule-strong" />
      <div className={styles.body}>
        <h2 className={`display ${styles.headline}`}>{verdict.headline}</h2>
        <p className="muted">{verdict.detail}</p>
      </div>
      {targets.length > 0 && (
        <ul className={styles.list}>
          {targets.map((c) => {
            const s = STATUS_LABEL[c.status];
            return (
              <li key={c.key} className={styles.item}>
                <div className={styles.itemHead}>
                  <span>{CONCERN_INFO[c.concern].label}</span>
                  <span className={`mono ${styles.delta}`}>
                    {c.estimate ? `${c.estimate.change >= 0 ? "+" : ""}${c.estimate.change.toFixed(1)}` : "--"}
                  </span>
                  <Tag tone={s.tone}>{s.label}</Tag>
                </div>
                {showCharts && (
                  <TrendChart
                    compact
                    height={70}
                    points={c.points}
                    estimate={c.estimate}
                    baseline={c.baseline}
                    callWeek={c.callWeek}
                    label={CONCERN_INFO[c.concern].label}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <footer className={`${styles.foot} tiny faint mono`}>
        <span>{verdict.checkInSessions} sittings</span>
        <span>Next check-in {formatDate(verdict.nextCheckIn)}</span>
      </footer>
    </article>
  );
}
