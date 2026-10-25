import type { Metadata } from "next";
import Link from "next/link";
import { CONCERN_INFO } from "@/lib/domain/concerns";
import { ACTIVES, MIN_CALL_WEEK } from "@/lib/domain/ingredients";
import { DEFAULT_MEANINGFUL_CHANGE, MIN_NOISE_SD, PRIOR_NOISE_SD } from "@/lib/domain/stats";
import styles from "../prose.module.css";

export const metadata: Metadata = {
  title: "How it decides",
  description: "The measurement protocol, statistics and ingredient timelines behind every Verdict.",
};

export default function MethodPage() {
  return (
    <article className={`wrap page ${styles.prose}`}>
      <p className="eyebrow">Method</p>
      <h1 className="display">How Verdict decides.</h1>
      <p className={styles.lede}>
        A skin score from one photo says little. A change between two photos says something only if it is bigger than the change you would see
        between two photos of the same, unchanged skin. Everything below follows from that.
      </p>

      <h2>1. The measurement</h2>
      <p>
        Each photo is analysed by <strong>YouCam AI Skin Analysis</strong> (Perfect Corp), using the <code>/s2s/v2.0/task/skin-analysis</code> API in
        either HD or SD mode. A trial measures the product&apos;s targets, redness as an irritation monitor, and enough extra concerns to fill the
        API&apos;s billing tier, so no paid capacity is wasted.
      </p>
      <ul>
        <li>
          <strong>Verdict uses <code>raw_score</code>, never <code>ui_score</code>.</strong> YouCam&apos;s documentation says the UI score is adjusted
          upwards to be encouraging. That is fine for a one-off result and wrong for measuring change.
        </li>
        <li>
          <strong>The mode is locked per trial.</strong> HD and SD scores come from different models and cannot be compared, so a trial that starts
          in HD stays in HD. The app refuses a lower-resolution check-in rather than mixing them.
        </li>
        <li>
          <strong>Photos are cropped to a 3:4 portrait</strong> so the face fills more than 60% of the width, as the API requires, with the same
          framing on a laptop or a phone.
        </li>
      </ul>

      <h2>2. Matched conditions</h2>
      <p>
        Lighting moves skin scores. Before a photo counts, Verdict measures the light inside the face guide: brightness, left-right balance,
        colour temperature, glare and blur. Each is compared with the first photo of the trial. Large mismatches block the photo. Small ones warn.
        The first photo is also shown faintly over the camera view, so you line up at the same distance and angle every week.
      </p>

      <h2>3. Your noise floor</h2>
      <p>
        The trial starts with two photos taken a minute apart, with a step out of frame between them. Their difference estimates how much your
        scores move when your skin has not changed. This is combined with a cautious starting assumption of &plusmn;{PRIOR_NOISE_SD} points, so a
        lucky pair of near-identical photos can&apos;t make the app overconfident. Each check-in where you take a second photo improves the estimate.
        The floor never goes below &plusmn;{MIN_NOISE_SD} point.
      </p>

      <h2>4. The change estimate</h2>
      <p>
        For each concern, a straight line is fitted through every photo since day zero. The change is the fitted rise or fall across the trial, with a
        95% interval that accounts for both your noise floor and the scatter around the line. Using every photo, instead of comparing the last one
        with the first, means one odd morning cannot flip the result.
      </p>

      <h2>5. From numbers to a decision</h2>
      <p>A change smaller than {DEFAULT_MEANINGFUL_CHANGE} points on the 100-point scale is treated as not worth acting on.</p>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Reading</th>
            <th scope="col">Rule</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Improved</td>
            <td>Whole interval above zero, and the estimate is at least {DEFAULT_MEANINGFUL_CHANGE} points. Reported as soon as it is true.</td>
          </tr>
          <tr>
            <td>Worse</td>
            <td>Whole interval below zero, and the estimate is at least {DEFAULT_MEANINGFUL_CHANGE} points down.</td>
          </tr>
          <tr>
            <td>No change</td>
            <td>The top of the interval is below {DEFAULT_MEANINGFUL_CHANGE} points: a meaningful benefit is confidently ruled out.</td>
          </tr>
          <tr>
            <td>Unclear</td>
            <td>Anything else. More check-ins are needed.</td>
          </tr>
          <tr>
            <td>Too early</td>
            <td>Before the concern&apos;s fair-verdict week, unless an improvement is already clear.</td>
          </tr>
          <tr>
            <td>Purging</td>
            <td>Blemishes worse within the first 6 weeks of a product containing a retinoid or exfoliating acid.</td>
          </tr>
          <tr>
            <td>Irritation</td>
            <td>Redness worse by a meaningful amount, at any point. This always produces a stop.</td>
          </tr>
        </tbody>
      </table>

      <h2>6. Fair-verdict timelines</h2>
      <p>
        Each active ingredient has a week from which visible change is commonly reported, and a later week by which a fair judgement can be made.
        When a product has several actives, the slowest one sets the deadline. Texture, tone and lines are never judged before week {MIN_CALL_WEEK},
        about one renewal cycle of the skin&apos;s outer layer.
      </p>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Active</th>
              <th scope="col">Targets, fair verdict week</th>
              <th scope="col">Basis</th>
            </tr>
          </thead>
          <tbody>
            {ACTIVES.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.name}
                  {a.purges ? <span className="tiny faint"> (can purge)</span> : null}
                </td>
                <td className="small">{a.targets.map((t) => `${CONCERN_INFO[t.concern].label} W${t.callWeek}`).join(", ")}</td>
                <td className="tiny faint">{a.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Limits</h2>
      <ul>
        <li>Verdict measures how skin looks in photos. It is not a medical device and its readings are not a diagnosis.</li>
        <li>A trial of one cannot rule out other causes. Weather, sleep, stress, a cycle or a second new product can all move scores. Change one thing at a time.</li>
        <li>Skin analysis models can be less reliable for some skin tones and in low light. Matching your own conditions week to week reduces, but does not remove, this.</li>
        <li>Timelines are conservative ranges from published studies and common practice, not promises about any specific product.</li>
      </ul>

      <p>
        <Link href="/trials/new" className="btn btn-accent">
          Start a trial
        </Link>
      </p>
    </article>
  );
}
