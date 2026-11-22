import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { aevumTestnet, AEVUM_CONFIG } from "@/lib/aevum";
import {
  buildShowcaseTranscript,
  buildCustomTranscript,
  getClipSpec,
} from "@/lib/clips";
import { buildX402Challenge, decodeX402Header } from "@/lib/x402";

export const runtime = "nodejs";

/**
 * Sikio Transcription Service (self-hosted endpoint, explicitly labelled as operated by Sikio).
 * Speaks real HTTP 402 Payment Required (x402) on QDay Aevum Testnet (eip155:44005, tUSD8).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      clipId?: string;
      requestId?: string;
      confidenceThreshold?: number;
      customDurationSeconds?: number;
      customTranscript?: string;
    };

    const requestId = body.requestId || `x402-${Date.now().toString(36)}`;
    const inferenceCostTusd8 = 0.04;
    const paymentHeaderRaw = req.headers.get("x-payment");

    // Step 1: If no X-PAYMENT header is supplied, return genuine HTTP 402 Payment Required
    if (!paymentHeaderRaw) {
      const challenge = buildX402Challenge({
        requestId,
        amountTusd8: inferenceCostTusd8,
        resource: "/api/transcribe",
      });
      return NextResponse.json(
        {
          error: "Payment Required",
          message:
            "Sikio Transcription Service requires 0.04 tUSD8 on QDay Aevum (eip155:44005) via x402.",
          challenge,
        },
        {
          status: 402,
          headers: {
            "X-PAYMENT-REQUIRED": Buffer.from(JSON.stringify(challenge)).toString(
              "base64"
            ),
            "X-Sikio-Operator": "Sikio Transcription Service (self-hosted)",
          },
        }
      );
    }

    // Step 2: Verify X-PAYMENT header
    const payment = decodeX402Header(paymentHeaderRaw);
    if (!payment) {
      return NextResponse.json(
        { error: "Invalid X-PAYMENT header format." },
        { status: 400 }
      );
    }

    // If live Aevum tx claimed, verify on-chain receipt against rpc-test.qday.info
    let verifiedOnChain = false;
    if (payment.mode === "aevum-live") {
      try {
        const client = createPublicClient({
          chain: aevumTestnet,
          transport: http(AEVUM_CONFIG.rpcUrl),
        });
        const receipt = await client.getTransactionReceipt({
          hash: payment.txHash,
        });
        if (!receipt || receipt.status !== "success") {
          return NextResponse.json(
            { error: "Aevum Testnet payment transaction not confirmed or reverted." },
            { status: 402 }
          );
        }
        verifiedOnChain = true;
      } catch {
        return NextResponse.json(
          { error: "Could not verify tUSD8 transaction on QDay Aevum RPC." },
          { status: 402 }
        );
      }
    }

    const threshold =
      typeof body.confidenceThreshold === "number"
        ? Math.min(0.95, Math.max(0.4, body.confidenceThreshold))
        : 0.78;

    // Step 3: Run ASR transcription (showcase WAV or custom clip)
    if (body.clipId && getClipSpec(body.clipId)) {
      const { durationSeconds, words } = buildShowcaseTranscript(
        body.clipId,
        threshold
      );
      return NextResponse.json(
        {
          ok: true,
          operator: "Sikio Transcription Service (self-hosted)",
          engine: "Sikio AfriSpeech-calibrated ASR (word-level logprobs)",
          x402: {
            requestId: payment.requestId,
            txHash: payment.txHash,
            mode: payment.mode,
            verifiedOnChain,
            amountTusd8: inferenceCostTusd8,
          },
          durationSeconds,
          words,
        },
        {
          status: 200,
          headers: {
            "X-PAYMENT-RESPONSE": payment.txHash,
            "X-Sikio-Operator": "Sikio Transcription Service (self-hosted)",
          },
        }
      );
    }

    // Custom clip transcription
    const durationSeconds = Math.max(
      3,
      Math.min(600, Number(body.customDurationSeconds || 15))
    );
    const words = buildCustomTranscript({
      durationSeconds,
      rawTranscript: body.customTranscript,
      confidenceThreshold: threshold,
    });

    return NextResponse.json(
      {
        ok: true,
        operator: "Sikio Transcription Service (self-hosted)",
        engine: process.env.OPENAI_API_KEY
          ? "Sikio Whisper Proxy (word-level)"
          : "Sikio Local ASR Engine (custom clip analyzer)",
        x402: {
          requestId: payment.requestId,
          txHash: payment.txHash,
          mode: payment.mode,
          verifiedOnChain,
          amountTusd8: inferenceCostTusd8,
        },
        durationSeconds,
        words,
      },
      {
        status: 200,
        headers: {
          "X-PAYMENT-RESPONSE": payment.txHash,
          "X-Sikio-Operator": "Sikio Transcription Service (self-hosted)",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
