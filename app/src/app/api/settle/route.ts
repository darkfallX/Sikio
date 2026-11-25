import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { readState, acceptReviewTask, getAvailableBudget } from "@/lib/store";
import {
  isLiveSettlementConfigured,
  liveSettlementAddresses,
  settleTaskOnChain,
} from "@/lib/settlement";
import { shortHash } from "@/lib/aevum";

export const runtime = "nodejs";
// Real on-chain settlement needs an unbounded, uncached request.
export const dynamic = "force-dynamic";

/**
 * Reports whether the server can settle on Aevum with no wallet, and from which
 * operator/editor addresses, so the UI can show a "live, no wallet needed" badge.
 */
export async function GET() {
  const addrs = liveSettlementAddresses();
  return NextResponse.json({
    available: isLiveSettlementConfigured(),
    operator: addrs.operator,
    editor: addrs.editor,
    escrow: addrs.escrow,
  });
}

/**
 * Server-side settlement: for one submitted task, run the real
 * offerTask -> submitCorrectionBySig -> acceptTask lifecycle on QDay Aevum
 * (chain 44005) using the operator key, then record the confirmed payout in the
 * ledger as "aevum-live". No wallet, key, or extension required from the approver.
 *
 * Falls back to sandbox settlement when live keys are not configured, so the
 * flow still works locally and never silently mislabels a sandbox digest.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { taskId?: string };
    if (!body.taskId) {
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    const state = readState();
    const task = state.tasks.find((t) => t.id === body.taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (task.status === "accepted") {
      return NextResponse.json(
        {
          error:
            "Task already settled: ReviewEscrow pays each taskId at most once.",
        },
        { status: 409 }
      );
    }
    if (task.status !== "submitted") {
      return NextResponse.json(
        {
          error: `A native speaker must submit a correction before it can be paid (status: "${task.status}").`,
        },
        { status: 400 }
      );
    }

    // No live keys configured -> honest sandbox settlement.
    if (!isLiveSettlementConfigured()) {
      const res = acceptReviewTask({
        taskId: task.id,
        approverAddress: state.batch.approverAddress,
      });
      return NextResponse.json({
        ok: true,
        mode: "sandbox",
        task: res.task,
        state: res.state,
        availableBudgetTusd8: getAvailableBudget(res.state.batch),
      });
    }

    // Live path: settle the exact correction on-chain, then record the confirmed tx.
    const settlement = await settleTaskOnChain({
      taskIdBytes32: task.taskIdBytes32 as Hex,
      correctionHash: task.correctionHash as Hex,
      excerptHash: task.excerptHash as Hex,
      feeTusd8: task.feeTusd8,
    });

    const onChainNote = [
      settlement.offerTxHash ? `offer ${shortHash(settlement.offerTxHash)}` : null,
      settlement.submitTxHash
        ? `correction ${shortHash(settlement.submitTxHash)}`
        : null,
      `paid ${shortHash(settlement.acceptTxHash)} on Aevum 44005`,
    ]
      .filter(Boolean)
      .join(" · ");

    const res = acceptReviewTask({
      taskId: task.id,
      approverAddress: state.batch.approverAddress,
      txHash: settlement.acceptTxHash,
      mode: "aevum-live",
      settledEditorAddress: settlement.editorAddress,
      onChainNote,
    });

    return NextResponse.json({
      ok: true,
      mode: "aevum-live",
      task: res.task,
      state: res.state,
      availableBudgetTusd8: getAvailableBudget(res.state.batch),
      settlement,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "On-chain settlement failed";
    // Nothing is marked paid when settlement throws: the task stays "submitted".
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
