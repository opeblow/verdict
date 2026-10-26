import type { Metadata } from "next";
import { Suspense } from "react";
import { TrialDashboard } from "./TrialDashboard";

export const metadata: Metadata = { title: "Trial" };

export default async function TrialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="wrap page">
      <Suspense fallback={<p className="muted">Loading your trial.</p>}>
        <TrialDashboard id={id} />
      </Suspense>
    </div>
  );
}
