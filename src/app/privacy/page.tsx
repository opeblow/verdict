import type { Metadata } from "next";
import Link from "next/link";
import styles from "../prose.module.css";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className={`wrap page ${styles.prose}`}>
      <p className="eyebrow">Privacy</p>
      <h1 className="display">Your face stays yours.</h1>
      <p className={styles.lede}>Verdict has no accounts, no analytics, no advertising and no database of users. Here is exactly where a photo goes.</p>

      <h2>On your device</h2>
      <ul>
        <li>Photos, scores, detection overlays, products and trial settings are stored in your browser&apos;s IndexedDB storage.</li>
        <li>They stay until you delete them. Clearing site data in your browser also removes them.</li>
        <li>
          <Link href="/settings">Your data</Link> lets you export everything to a file, import it on another device, or erase it all.
        </li>
      </ul>

      <h2>When a photo is analysed</h2>
      <ul>
        <li>The photo is sent to the Verdict server, which forwards it to YouCam AI Skin Analysis (Perfect Corp) and returns the scores.</li>
        <li>The Verdict server does not write photos or scores to disk or to any database, and does not log them.</li>
        <li>
          As soon as the results are saved on your device, Verdict asks YouCam to delete the task, which removes the photo and results from
          YouCam&apos;s servers. If that request fails, YouCam&apos;s own retention applies: uploads and results are kept for up to 24 hours.
        </li>
        <li>
          YouCam processes the photo under its own{" "}
          <a href="https://www.makeupar.com/perfectbeauty/youcam/privacy-policy-api" target="_blank" rel="noreferrer">
            API privacy policy
          </a>
          .
        </li>
      </ul>

      <h2>Product search</h2>
      <p>Searches and barcodes are forwarded to Open Beauty Facts to find products. No photo or personal information is sent with them.</p>

      <h2>What Verdict never does</h2>
      <ul>
        <li>Infer or store age, ethnicity, gender or identity.</li>
        <li>Share or sell data. There is nothing on the server to share.</li>
        <li>Use your photos to train anything.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Because your data lives on your device, you already hold it: you can see, export and erase it at any time without asking anyone. For
        questions, open an issue on the project repository.
      </p>
    </article>
  );
}
