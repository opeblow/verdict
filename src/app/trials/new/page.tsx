import type { Metadata } from "next";
import { NewTrialWizard } from "./NewTrialWizard";

export const metadata: Metadata = { title: "Start a trial" };

export default function NewTrialPage() {
  return (
    <div className="wrap page">
      <NewTrialWizard />
    </div>
  );
}
