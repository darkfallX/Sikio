import { NextRequest, NextResponse } from "next/server";
import { addBenchmarkRun } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      clipTitle: string;
      dialect: string;
      clipDurationSec: number;
      fullReviewSec: number;
      targetedReviewSec: number;
      fullReviewErrorsLeft: number;
      targetedReviewErrorsLeft: number;
      overconfidentAiMisses: number;
      fullReviewCostUsd: number;
      targetedCostUsd: number;
    };

    if (!body.clipTitle?.trim() || !body.dialect?.trim()) {
      return NextResponse.json(
        { error: "Clip title and dialect are required." },
        { status: 400 }
      );
    }

    const state = addBenchmarkRun({
      clipTitle: body.clipTitle.trim(),
      dialect: body.dialect.trim(),
      clipDurationSec: Math.max(10, Number(body.clipDurationSec || 60)),
      fullReviewSec: Math.max(10, Number(body.fullReviewSec || 120)),
      targetedReviewSec: Math.max(5, Number(body.targetedReviewSec || 35)),
      fullReviewErrorsLeft: Math.max(0, Number(body.fullReviewErrorsLeft || 0)),
      targetedReviewErrorsLeft: Math.max(0, Number(body.targetedReviewErrorsLeft || 0)),
      overconfidentAiMisses: Math.max(0, Number(body.overconfidentAiMisses || 0)),
      fullReviewCostUsd: Math.max(0, Number(body.fullReviewCostUsd || 3.5)),
      targetedCostUsd: Math.max(0, Number(body.targetedCostUsd || 0.75)),
    });

    return NextResponse.json({ ok: true, benchmarks: state.benchmarks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not log benchmark";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
