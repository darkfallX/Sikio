import { NextRequest, NextResponse } from "next/server";
import { getClipSpec } from "@/lib/clips";
import {
  createJobAndReserveTasks,
  getAvailableBudget,
  readState,
} from "@/lib/store";
import { findUploadedClip } from "@/lib/storage";
import { liveLimitNote, takeLiveSpend, visitorKey } from "@/lib/live-limit";
import { encodeX402Header, X402PaymentChallenge } from "@/lib/x402";
import { CaptionWord, ExecutionMode } from "@/lib/types";
import { POST as transcribePost } from "../transcribe/route";
import { isLiveSettlementConfigured } from "@/lib/settlement";
import { ExactEvmPayload, signX402Payment } from "@/lib/eip3009";

export const runtime = "nodejs";

/**
 * Runs the Sikio Agent end-to-end for a clip:
 * 1. Calls /api/transcribe with no payment header -> receives HTTP 402 Payment Required challenge (x402)
 * 2. Signs a standard x402 "exact" payment (EIP-3009 tUSD8 transfer) that the service's
 *    facilitator settles on chain (or uses a live wallet txHash, or sandbox)
 * 3. Re-calls /api/transcribe with X-PAYMENT proof -> receives 200 OK timed word probabilities
 * 4. Flags uncertain words below confidenceThreshold & reserves fees per task
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      clipId?: string;
      customTitle?: string;
      customLanguageTag?: string;
      customAudioUrl?: string;
      customDurationSeconds?: number;
      customTranscript?: string;
      confidenceThreshold?: number;
      feePerTaskTusd8?: number;
      x402TxHash?: `0x${string}`;
      /** The requestId the browser wallet paid for, so the server verifies that exact payment. */
      x402RequestId?: string;
      mode?: ExecutionMode;
    };

    const threshold =
      typeof body.confidenceThreshold === "number" &&
      Number.isFinite(body.confidenceThreshold)
        ? Math.min(0.95, Math.max(0.45, body.confidenceThreshold))
        : 0.78;
    const feePerTask =
      typeof body.feePerTaskTusd8 === "number" &&
      Number.isFinite(body.feePerTaskTusd8)
        ? Math.max(0.05, Number(body.feePerTaskTusd8.toFixed(2)))
        : 0.1;

    const inferenceCostTusd8 = 0.04;
    const requestId =
      body.x402RequestId && /^x402-[a-z0-9]{4,20}$/.test(body.x402RequestId)
        ? body.x402RequestId
        : `x402-${Date.now().toString(36)}`;
    const state = readState();
    let effectiveMode: ExecutionMode =
      body.x402TxHash && body.mode === "aevum-live" ? "aevum-live" : "sandbox";
    let livePaymentNote: string | undefined;

    const transcribePayload = {
      clipId: body.clipId,
      requestId,
      confidenceThreshold: threshold,
      customDurationSeconds: body.customDurationSeconds,
      customTranscript: body.customTranscript,
    };

    // Step 1: Real unpaid request to /api/transcribe -> HTTP 402 challenge
    const step1Req = new NextRequest("http://sikio.local/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transcribePayload),
    });
    const step1Res = await transcribePost(step1Req);
    if (step1Res.status !== 402) {
      return NextResponse.json(
        { error: `Expected x402 HTTP 402 challenge, got ${step1Res.status}` },
        { status: 500 }
      );
    }
    const step1Json = (await step1Res.json()) as {
      challenge: X402PaymentChallenge;
    };
    const challenge = step1Json.challenge;

    // Step 2: Pay for the transcript. With no browser wallet, the agent signs a
    // standard x402 "exact" payment: an EIP-3009 tUSD8 transfer for exactly the price,
    // valid for 5 minutes, single use. It sends no transaction and holds no gas; the
    // service's facilitator settles it on chain. If anything fails, the transcript is
    // paid in sandbox and labelled sandbox.
    let signed: ExactEvmPayload | undefined;
    const runLimit =
      !body.x402TxHash && isLiveSettlementConfigured()
        ? takeLiveSpend(visitorKey(req), inferenceCostTusd8, `run:${challenge.requestId}`)
        : null;
    if (runLimit && !runLimit.ok) {
      livePaymentNote = liveLimitNote(runLimit.reason, "this transcript");
    } else if (!body.x402TxHash && isLiveSettlementConfigured()) {
      try {
        signed = await signX402Payment({
          requestId: challenge.requestId,
          payTo: challenge.payTo,
          amountBaseUnits: BigInt(challenge.maxAmountRequired),
        });
      } catch (err) {
        livePaymentNote = "The QDay testnet was slow, so this transcript was paid in sandbox.";
        console.error("[jobs] x402 signing failed:", err instanceof Error ? err.message.split("\n")[0] : err);
      }
    }

    const sandboxTx = `0x${Buffer.from(`${requestId}:${Date.now()}`)
      .toString("hex")
      .padEnd(64, "a")
      .slice(0, 64)}` as `0x${string}`;
    const headerFor = (useSigned: boolean) =>
      useSigned && signed
        ? encodeX402Header({
            x402Version: 1,
            network: "eip155:44005",
            requestId: challenge.requestId,
            scheme: "exact",
            payload: signed,
            payer: signed.authorization.from,
            amountBaseUnits: challenge.maxAmountRequired,
            mode: "aevum-live",
          })
        : encodeX402Header({
            x402Version: 1,
            network: "eip155:44005",
            requestId: challenge.requestId,
            txHash: body.x402TxHash || sandboxTx,
            payer: state.batch.agentAddress,
            amountBaseUnits: challenge.maxAmountRequired,
            mode: body.x402TxHash ? effectiveMode : "sandbox",
          });

    // Step 3: Paid retry to /api/transcribe -> HTTP 200 OK timed transcript
    type TranscribeReply = {
      ok?: boolean;
      error?: string;
      engine?: string;
      durationSeconds?: number;
      words?: CaptionWord[];
      x402?: { txHash?: `0x${string}`; verifiedOnChain?: boolean; scheme?: string; payer?: `0x${string}` };
    };
    const paidCall = async (header: string) => {
      const res = await transcribePost(
        new NextRequest("http://sikio.local/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-PAYMENT": header },
          body: JSON.stringify(transcribePayload),
        })
      );
      return { res, json: (await res.json()) as TranscribeReply };
    };
    let paymentHeader = headerFor(true);
    let { res: step2Res, json: step2Json } = await paidCall(paymentHeader);
    if (signed && step2Res.status === 402) {
      // The facilitator could not settle the signed payment: nothing moved on chain
      // for it, so finish this run in sandbox and say so.
      livePaymentNote = "The signed payment could not be settled on the QDay testnet, so this transcript was paid in sandbox.";
      console.error("[jobs] x402 settle refused:", step2Json.error);
      signed = undefined;
      paymentHeader = headerFor(false);
      ({ res: step2Res, json: step2Json } = await paidCall(paymentHeader));
    }
    const serverPaidTx =
      signed && step2Json.x402?.verifiedOnChain ? step2Json.x402.txHash : undefined;
    if (serverPaidTx) effectiveMode = "aevum-live";
    if (!step2Res.ok || !step2Json.words) {
      return NextResponse.json(
        { error: step2Json.error || "Paid x402 retry failed." },
        { status: step2Res.status === 402 ? 402 : 400 }
      );
    }

    const spec = body.clipId ? getClipSpec(body.clipId) : undefined;
    const uploaded = !spec && body.clipId ? findUploadedClip(body.clipId) : null;

    const clipId = spec
      ? spec.id
      : uploaded
      ? uploaded.meta.clipId
      : body.clipId || `custom-${Date.now().toString(36)}`;
    const title = spec
      ? spec.title
      : body.customTitle?.trim() || uploaded?.meta.fileName || "Uploaded Studio Clip";
    const sourceLabel = spec
      ? spec.sourceLabel
      : "Agency Uploaded Media · Persistent Session Clip";
    const languageTag = spec
      ? spec.languageTag
      : body.customLanguageTag?.trim() || "en-AF";
    const audioUrl = spec
      ? spec.audioUrl
      : uploaded
      ? `/api/media/${uploaded.meta.clipId}`
      : body.customAudioUrl || "/clips/lagos-fintech-ep14.wav";
    const preferredCity = spec?.recommendedEditorCity;
    const isCustomUpload = !spec;

    const result = createJobAndReserveTasks({
      clipId,
      title,
      sourceLabel,
      languageTag,
      audioUrl,
      durationSeconds: step2Json.durationSeconds || 15,
      confidenceThreshold: threshold,
      feePerTaskTusd8: feePerTask,
      inferenceCostTusd8,
      transcriptionEngine:
        step2Json.engine || "Sikio Local ASR Engine (self-hosted x402)",
      x402RequestId: challenge.requestId,
      x402TxHash: body.x402TxHash || serverPaidTx,
      x402Signed: serverPaidTx
        ? { payer: step2Json.x402?.payer, provider: challenge.payTo }
        : undefined,
      words: step2Json.words,
      preferredCity,
      isCustomUpload,
      mode: effectiveMode,
    });

    return NextResponse.json({
      ok: true,
      x402Handshake: {
        step1HttpStatus: 402,
        challenge,
        step2PaymentHeaderPreview: `${paymentHeader.slice(0, 36)}…`,
        step3HttpStatus: 200,
      },
      livePaymentNote,
      job: result.job,
      createdTasks: result.createdTasks,
      state: result.state,
      availableBudgetTusd8: getAvailableBudget(result.state.batch),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to run Sikio agent";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
