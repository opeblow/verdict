import { NextResponse } from "next/server";
import { checkAccess, jsonError, limitPoll, youcamOrError } from "@/lib/server/guard";
import { guidanceFor, isRetakeError } from "@/lib/youcam/errors";
import { upstreamError } from "@/lib/server/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TASK_ID = /^[A-Za-z0-9_\-+/=]{8,256}$/;

/** Poll a task. Returns { status: "running" } or the normalised result, or a retake hint. */
export async function GET(req: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const denied = checkAccess(req);
  if (denied) return denied;
  const limited = limitPoll(req);
  if (limited) return limited;

  const { taskId } = await ctx.params;
  if (!TASK_ID.test(taskId)) return jsonError(400, "bad_request", "Invalid task id.");

  const client = youcamOrError();
  if (client instanceof NextResponse) return client;

  try {
    const state = await client.getSkinTask(taskId);
    if (state.status === "error") {
      return NextResponse.json(
        {
          status: "error",
          code: state.error.code,
          message: guidanceFor(state.error.code),
          retake: isRetakeError(state.error.code),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return upstreamError(err);
  }
}

/** Delete the photo and results from YouCam once Verdict has saved them on the device. */
export async function DELETE(req: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const denied = checkAccess(req);
  if (denied) return denied;
  const { taskId } = await ctx.params;
  if (!TASK_ID.test(taskId)) return jsonError(400, "bad_request", "Invalid task id.");
  const client = youcamOrError();
  if (client instanceof NextResponse) return client;
  try {
    await client.deleteTask(taskId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return upstreamError(err);
  }
}
