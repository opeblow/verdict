import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

/** Reports whether the server can run analyses, without revealing any secret. */
export function GET() {
  const env = serverEnv();
  return NextResponse.json(
    {
      ok: true,
      youcamConfigured: Boolean(env.youcamApiKey),
      accessCodeRequired: Boolean(env.accessCode),
      skinVersion: env.skinVersion,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
