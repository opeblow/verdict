import type { Metadata } from "next";
import { DataSettings } from "./DataSettings";

export const metadata: Metadata = { title: "Your data" };

export default function SettingsPage() {
  return (
    <div className="wrap page narrow">
      <DataSettings />
    </div>
  );
}
