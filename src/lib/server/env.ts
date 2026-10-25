import { z } from "zod";

const schema = z.object({
  YOUCAM_API_KEY: z.string().optional(),
  YOUCAM_API_BASE: z.string().url().optional(),
  YOUCAM_SKIN_VERSION: z.enum(["v2.0", "v2.1"]).optional(),
  /** When set, every analysis request must present this code. Protects API units on public demos. */
  ACCESS_CODE: z.string().optional(),
  /** Analyses one visitor may start per hour. */
  RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().optional(),
  /** Hard ceiling on analyses per server instance per day, so a demo cannot drain the account. */
  DAILY_ANALYSIS_CAP: z.coerce.number().int().positive().optional(),
});

export interface ServerEnv {
  youcamApiKey?: string;
  youcamBaseUrl?: string;
  skinVersion: "v2.0" | "v2.1";
  accessCode?: string;
  ratePerHour: number;
  dailyCap: number;
}

export function readEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = schema.parse({
    YOUCAM_API_KEY: source.YOUCAM_API_KEY || undefined,
    YOUCAM_API_BASE: source.YOUCAM_API_BASE || undefined,
    YOUCAM_SKIN_VERSION: source.YOUCAM_SKIN_VERSION || undefined,
    ACCESS_CODE: source.ACCESS_CODE || undefined,
    RATE_LIMIT_PER_HOUR: source.RATE_LIMIT_PER_HOUR || undefined,
    DAILY_ANALYSIS_CAP: source.DAILY_ANALYSIS_CAP || undefined,
  });
  return {
    youcamApiKey: parsed.YOUCAM_API_KEY,
    youcamBaseUrl: parsed.YOUCAM_API_BASE,
    skinVersion: parsed.YOUCAM_SKIN_VERSION ?? "v2.0",
    accessCode: parsed.ACCESS_CODE,
    ratePerHour: parsed.RATE_LIMIT_PER_HOUR ?? 20,
    dailyCap: parsed.DAILY_ANALYSIS_CAP ?? 150,
  };
}
