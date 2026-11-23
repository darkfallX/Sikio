import { NextRequest, NextResponse } from "next/server";
import { SHOWCASE_CLIPS } from "@/lib/clips";
import {
  getAvailableBudget,
  readState,
  resetState,
  updateBatchPolicy,
} from "@/lib/store";
import { AEVUM_CONFIG } from "@/lib/aevum";

export const runtime = "nodejs";

export async function GET() {
  const state = readState();
  return NextResponse.json({
    ...state,
    availableBudgetTusd8: getAvailableBudget(state.batch),
    showcaseClips: SHOWCASE_CLIPS.map((c) => ({
      id: c.id,
      title: c.title,
      shortLabel: c.shortLabel,
      sourceLabel: c.sourceLabel,
      languageTag: c.languageTag,
      city: c.city,
      audioUrl: c.audioUrl,
      recommendedEditorCity: c.recommendedEditorCity,
    })),
    network: {
      chainId: AEVUM_CONFIG.chainId,
      chainName: AEVUM_CONFIG.chainName,
      rpcUrl: AEVUM_CONFIG.rpcUrl,
      explorerUrl: AEVUM_CONFIG.explorerUrl,
      tusd8Address: AEVUM_CONFIG.tusd8Address,
      entryPointV07Address: AEVUM_CONFIG.entryPointV07Address,
      reviewEscrowAddress: AEVUM_CONFIG.reviewEscrowAddress || null,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: "update_policy" | "reset";
      maxBudgetTusd8?: number;
      maxTaskFeeTusd8?: number;
      autoAcceptTrusted?: boolean;
      agentRevoked?: boolean;
      agencyAddress?: `0x${string}`;
      mode?: "aevum-live" | "sandbox";
    };

    if (body.action === "reset") {
      const fresh = resetState();
      return NextResponse.json({
        ok: true,
        state: fresh,
        availableBudgetTusd8: getAvailableBudget(fresh.batch),
      });
    }

    if (
      body.maxBudgetTusd8 !== undefined &&
      (!Number.isFinite(body.maxBudgetTusd8) ||
        body.maxBudgetTusd8 < 0.5 ||
        body.maxBudgetTusd8 > 10000)
    ) {
      return NextResponse.json(
        { error: "maxBudgetTusd8 must be between 0.50 and 10000." },
        { status: 400 }
      );
    }

    if (
      body.maxTaskFeeTusd8 !== undefined &&
      (!Number.isFinite(body.maxTaskFeeTusd8) ||
        body.maxTaskFeeTusd8 < 0.05 ||
        body.maxTaskFeeTusd8 > 50)
    ) {
      return NextResponse.json(
        { error: "maxTaskFeeTusd8 must be between 0.05 and 50." },
        { status: 400 }
      );
    }

    const updated = updateBatchPolicy({
      maxBudgetTusd8: body.maxBudgetTusd8,
      maxTaskFeeTusd8: body.maxTaskFeeTusd8,
      autoAcceptTrusted: body.autoAcceptTrusted,
      agentRevoked: body.agentRevoked,
      agencyAddress: body.agencyAddress,
      mode: body.mode,
    });

    return NextResponse.json({
      ok: true,
      state: updated,
      availableBudgetTusd8: getAvailableBudget(updated.batch),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update policy";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
