import Link from "next/link";
import { Wordmark } from "./Logo";
import styles from "./SiteChrome.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`wrap ${styles.bar}`}>
        <Link href="/" className={styles.brand} aria-label="Verdict home">
          <Wordmark />
        </Link>
        <nav className={styles.nav} aria-label="Main">
          <Link href="/method">How it decides</Link>
          <Link href="/trials">Your trials</Link>
          <Link href="/trials/new" className="btn btn-sm">
            Start a trial
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.footGrid}`}>
        <div className="stack" style={{ ["--stack" as string]: "10px" }}>
          <Wordmark />
          <p className="small muted" style={{ maxWidth: 380 }}>
            A trial of one for your skincare. Skin measurements by YouCam AI Skin Analysis from Perfect Corp. Product data from Open Beauty Facts.
          </p>
        </div>
        <nav className={styles.footNav} aria-label="Footer">
          <Link href="/method">Method</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/settings">Your data</Link>
        </nav>
        <p className={`tiny faint ${styles.disclaimer}`}>
          Verdict describes how skin looks in photos. It is not a medical device and does not diagnose or treat any condition. For a skin problem that
          worries you, see a dermatologist.
        </p>
      </div>
    </footer>
  );
}
