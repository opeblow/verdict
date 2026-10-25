import type { Metadata } from "next";
import { CheckInScreen } from "./CheckInScreen";

export const metadata: Metadata = { title: "Check in" };

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="wrap page">
      <CheckInScreen id={id} />
    </div>
  );
}
