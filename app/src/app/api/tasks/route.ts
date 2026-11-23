import { NextRequest, NextResponse } from "next/server";
import {
  acceptReviewTask,
  getAvailableBudget,
  rejectOrExpireTask,
  submitEditorCorrection,
} from "@/lib/store";
import { ExecutionMode } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action: "submit" | "accept" | "reject" | "expire";
      taskId: string;
      submittedText?: string;
      confirmedAiRight?: boolean;
      editorNote?: string;
      approverAddress?: `0x${string}`;
      txHash?: `0x${string}`;
      reason?: string;
      mode?: ExecutionMode;
    };

    if (!body.taskId || !body.action) {
      return NextResponse.json(
        { error: "Missing taskId or action" },
        { status: 400 }
      );
    }

    if (body.action === "submit") {
      const res = submitEditorCorrection({
        taskId: body.taskId,
        submittedText: body.submittedText || "",
        confirmedAiRight: body.confirmedAiRight,
        editorNote: body.editorNote,
      });
      return NextResponse.json({
        ok: true,
        task: res.task,
        state: res.state,
        availableBudgetTusd8: getAvailableBudget(res.state.batch),
      });
    }

    if (body.action === "accept") {
      const res = acceptReviewTask({
        taskId: body.taskId,
        approverAddress: body.approverAddress,
        txHash: body.txHash,
        mode: body.mode,
      });
      return NextResponse.json({
        ok: true,
        task: res.task,
        state: res.state,
        availableBudgetTusd8: getAvailableBudget(res.state.batch),
      });
    }

    if (body.action === "reject" || body.action === "expire") {
      const res = rejectOrExpireTask({
        taskId: body.taskId,
        action: body.action,
        reason: body.reason,
        approverAddress: body.approverAddress,
        txHash: body.txHash,
        mode: body.mode,
      });
      return NextResponse.json({
        ok: true,
        task: res.task,
        state: res.state,
        availableBudgetTusd8: getAvailableBudget(res.state.batch),
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Task action failed";
    const status = message.startsWith("UNAUTHORIZED:") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
