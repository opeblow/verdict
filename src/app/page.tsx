import Link from "next/link";
import { VerdictCard } from "@/components/verdict/VerdictCard";
import { Tag } from "@/components/verdict/labels";
import { EXAMPLE_NOW, EXAMPLE_TRIAL, exampleCheckIns } from "@/lib/domain/example";
import { evaluateTrial } from "@/lib/domain/verdict";
import styles from "./page.module.css";

export default function Home() {
  const example = evaluateTrial(EXAMPLE_TRIAL, exampleCheckIns(), EXAMPLE_NOW);

  return (
    <>
      <section className={`wrap ${styles.hero}`}>
        <div className={styles.heroText}>
          <p className="eyebrow">A trial of one for your skincare</p>
          <h1 className={`display ${styles.title}`}>Is it working, or are you just hoping?</h1>
          <p className={styles.lede}>
            Verdict photographs your skin in matched light every week, measures it with YouCam AI Skin Analysis, and tells you, with numbers you can
            check, whether a product is worth buying again.
          </p>
          <div className="row" style={{ marginTop: 28 }}>
            <Link href="/trials/new" className="btn btn-accent">
              Start a trial
            </Link>
            <Link href="/method" className="btn btn-ghost">
              How it decides
            </Link>
          </div>
          <p className="tiny faint" style={{ marginTop: 16 }}>
            Free. No account. Photos stay on your phone.
          </p>
        </div>
        <div className={styles.heroCard}>
          <VerdictCard verdict={example} productName={EXAMPLE_TRIAL.product.name} example />
        </div>
      </section>

      <hr className="rule-strong" />

      <section className={`wrap section ${styles.problem}`}>
        <div>
          <p className="eyebrow">The problem</p>
          <h2 className={`display ${styles.h2}`}>Skincare is judged in the mirror, on a bad morning, after nine days.</h2>
        </div>
        <div className={styles.facts}>
          <div className={styles.fact}>
            <p className={`mono ${styles.factNum}`}>8 to 12 weeks</p>
            <p className="muted">
              How long retinol, vitamin C and peptides took to show in their best-known trials. Most people decide long before that.
            </p>
          </div>
          <div className={styles.fact}>
            <p className={`mono ${styles.factNum}`}>About 4 weeks</p>
            <p className="muted">One renewal cycle of the skin&apos;s outer layer. Nothing about texture or tone can be judged sooner.</p>
          </div>
          <div className={styles.fact}>
            <p className={`mono ${styles.factNum}`}>Same skin, new lamp</p>
            <p className="muted">
              A brighter room can make skin score better without it changing at all. A mirror cannot tell the difference. Verdict checks the light.
            </p>
          </div>
        </div>
      </section>

      <hr className="rule" />

      <section className="wrap section">
        <p className="eyebrow">How a verdict is made</p>
        <ol className={styles.steps}>
          <li>
            <span className={`mono ${styles.stepNum}`}>01</span>
            <h3>Name the product</h3>
            <p className="muted">
              Search or scan it. Verdict reads the ingredient list, finds the actives, and sets a fair deadline for each thing the product claims to do.
            </p>
          </li>
          <li>
            <span className={`mono ${styles.stepNum}`}>02</span>
            <h3>Two baseline photos</h3>
            <p className="muted">
              Taken a minute apart. The difference between them is how much your photos vary when nothing has changed: your personal noise floor.
            </p>
          </li>
          <li>
            <span className={`mono ${styles.stepNum}`}>03</span>
            <h3>One check-in a week</h3>
            <p className="muted">
              Your first photo is overlaid so you line up the same way, and the light is compared with that first photo before the new one counts.
            </p>
          </li>
          <li>
            <span className={`mono ${styles.stepNum}`}>04</span>
            <h3>A decision, not a score</h3>
            <p className="muted">
              Keep it, stop it, or wait until a named date. Change is only reported when it is larger than your noise floor.
            </p>
          </li>
        </ol>
      </section>

      <hr className="rule" />

      <section className={`wrap section ${styles.outcomes}`}>
        <div>
          <p className="eyebrow">What you can be told</p>
          <h2 className={`display ${styles.h2}`}>Five answers, each with a reason.</h2>
        </div>
        <dl className={styles.outcomeList}>
          <div>
            <dt>
              <Tag tone="keep">Keep</Tag>
            </dt>
            <dd>A target improved by more than your photos vary on their own, and nothing got worse.</dd>
          </div>
          <div>
            <dt>
              <Tag tone="wait">Wait</Tag>
            </dt>
            <dd>Too early to judge fairly. You get the date when it will be, so you don&apos;t quit a slow product too soon.</dd>
          </div>
          <div>
            <dt>
              <Tag tone="wait">Purging</Tag>
            </dt>
            <dd>More blemishes in the first weeks of a retinoid or acid. Common, and different from a reaction. Verdict keeps watching redness.</dd>
          </div>
          <div>
            <dt>
              <Tag tone="stop">Stop</Tag>
            </dt>
            <dd>Redness rose beyond your noise floor, or a target got worse after its deadline.</dd>
          </div>
          <div>
            <dt>
              <Tag tone="neutral">Don&apos;t rebuy</Tag>
            </dt>
            <dd>After a fair trial, every change is confidently too small to matter. Spend the money on something else.</dd>
          </div>
        </dl>
      </section>

      <hr className="rule" />

      <section className={`wrap section ${styles.privacy}`}>
        <div className="narrow stack">
          <p className="eyebrow">Your face, your device</p>
          <h2 className={`display ${styles.h2}`}>No account. No cloud album.</h2>
          <p className="muted">
            Photos and results are stored in your browser. Each photo is sent once to YouCam for analysis, then Verdict asks YouCam to delete it as soon
            as the results are saved on your device. You can export or erase everything from one page.
          </p>
          <p>
            <Link href="/privacy">Read the privacy notice</Link>
          </p>
        </div>
      </section>

      <section className={`wrap ${styles.cta}`}>
        <h2 className={`display ${styles.h2}`}>Find out about the product on your shelf.</h2>
        <Link href="/trials/new" className="btn btn-accent">
          Start a trial
        </Link>
      </section>
    </>
  );
}
