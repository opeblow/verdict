import type { Metadata } from "next";
import { TrialList } from "./TrialList";

export const metadata: Metadata = { title: "Your trials" };

export default function TrialsPage() {
  return (
    <div className="wrap page">
      <TrialList />
    </div>
  );
}
