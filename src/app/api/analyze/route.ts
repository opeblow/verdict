import { NextResponse } from "next/server";
import { z } from "zod";
import { CONCERNS, toAction } from "@/lib/domain/concerns";
import { checkAccess, jsonError, limitAnalysis, youcamOrError } from "@/lib/server/guard";
import { upstreamError } from "@/lib/server/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_SHORT_SIDE = { hd: 1080, sd: 480 } as const;

const fieldsSchema = z.object({
  mode: z.enum(["hd", "sd"]),
  concerns: z.array(z.enum(CONCERNS)).min(1).max(16),
  width: z.coerce.number().int().positive(),
  height: z.coerce.number().int().positive(),
});

/**
 * Start a skin analysis. Accepts multipart form data:
 *   image     JPEG or PNG, at most 10 MB
 *   mode      "hd" or "sd"
 *   concerns  JSON array of Verdict concern ids
 *   width, height  pixel size of the image, checked against YouCam's minimums
 * Returns { taskId }.
 */
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "bad_request", "Expected multipart form data.");
  }

  const image = form.get("image");
  if (!(image instanceof Blob)) return jsonError(400, "bad_request", "Missing image.");
  if (!["image/jpeg", "image/png"].includes(image.type)) return jsonError(415, "unsupported_type", "Use a JPG or PNG photo.");
  if (image.size > MAX_BYTES) return jsonError(413, "too_large", "Photos must be under 10 MB.");

  let concernsRaw: unknown;
  try {
    concernsRaw = JSON.parse(String(form.get("concerns") ?? "[]"));
  } catch {
    return jsonError(400, "bad_request", "concerns must be a JSON array.");
  }
  const parsed = fieldsSchema.safeParse({
    mode: form.get("mode"),
    concerns: concernsRaw,
    width: form.get("width"),
    height: form.get("height"),
  });
  if (!parsed.success) return jsonError(400, "bad_request", "Invalid analysis request.", { issues: parsed.error.issues.map((i) => i.message) });

  const { mode, concerns, width, height } = parsed.data;
  if (Math.min(width, height) < MIN_SHORT_SIDE[mode]) {
    return jsonError(422, "error_below_min_image_size", `This mode needs a photo at least ${MIN_SHORT_SIDE[mode]} pixels on its short side.`);
  }

  const limited = limitAnalysis(req);
  if (limited) return limited;

  const client = youcamOrError();
  if (client instanceof NextResponse) return client;

  try {
    const bytes = await image.arrayBuffer();
    const ext = image.type === "image/png" ? "png" : "jpg";
    const fileId = await client.uploadImage(bytes, image.type, `verdict-${Date.now()}.${ext}`);
    const actions = [...new Set(concerns)].map((c) => toAction(c, mode));
    const taskId = await client.createSkinTask(fileId, actions);
    return NextResponse.json({ taskId }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return upstreamError(err);
  }
}
