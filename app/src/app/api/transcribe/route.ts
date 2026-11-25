import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { aevumTestnet, AEVUM_CONFIG } from "@/lib/aevum";
import {
  buildShowcaseTranscript,
  buildCustomTranscript,
  getClipSpec,
} from "@/lib/clips";
import { findUploadedClip } from "@/lib/storage";
import { CaptionWord } from "@/lib/types";
import { buildX402Challenge, decodeX402Header } from "@/lib/x402";

export const runtime = "nodejs";

async function transcribeWithOpenAIWhisper(params: {
  clipId: string;
  threshold: number;
}): Promise<{ durationSeconds: number; words: CaptionWord[] } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const uploaded = findUploadedClip(params.clipId);
  if (!uploaded) return null;

  try {
    const bytes = fs.readFileSync(uploaded.filePath);
    const form = new FormData();
    form.append(
      "file",
      new Blob([bytes], { type: uploaded.meta.mimeType || "audio/wav" }),
      uploaded.meta.fileName
    );
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.append("timestamp_granularities[]", "segment");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      duration?: number;
      words?: { word: string; start: number; end: number }[];
      segments?: {
        start: number;
        end: number;
        avg_logprob?: number;
        no_speech_prob?: number;
      }[];
    };
    if (!json.words || json.words.length === 0) return null;

    const segments = json.segments || [];

    // Real model confidence: Whisper reports an average token log-probability per
    // segment. We convert it to a probability (exp) and dampen it when the segment
    // is likely silence/noise. No capitalization or length heuristic is involved.
    const confidenceAt = (t: number): number => {
      const seg =
        segments.find((s) => t >= s.start && t < s.end) ||
        segments.find((s) => t <= s.end);
      if (!seg || typeof seg.avg_logprob !== "number") return 0.8;
      let conf = Math.exp(seg.avg_logprob);
      if (typeof seg.no_speech_prob === "number" && seg.no_speech_prob > 0.5) {
        conf *= 1 - seg.no_speech_prob;
      }
      return Number(Math.min(0.99, Math.max(0.05, conf)).toFixed(3));
    };

    const durationSeconds = Number(
      (json.duration || json.words[json.words.length - 1].end || 15).toFixed(2)
    );
    const words: CaptionWord[] = json.words.map((w, idx) => {
      const confidence = confidenceAt(w.start);
      return {
        index: idx,
        start: Number(w.start.toFixed(3)),
        end: Number(Math.max(w.start + 0.12, w.end).toFixed(3)),
        aiText: w.word,
        currentText: w.word,
        confidence,
        confidenceSource: "whisper-logprob",
        flagged: confidence < params.threshold,
      };
    });

    return { durationSeconds, words };
  } catch {
    return null;
  }
}

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

    // Step 1: Without X-PAYMENT header, return genuine HTTP 402 Payment Required
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

    // Step 3: Showcase WAV clip. Words and confidences come from a prepared fixture
    // (clips/timings.json plus asrErrors in lib/clips.ts), not live model inference.
    if (body.clipId && getClipSpec(body.clipId)) {
      const { durationSeconds, words } = buildShowcaseTranscript(
        body.clipId,
        threshold
      );
      return NextResponse.json(
        {
          ok: true,
          operator: "Sikio Transcription Service (self-hosted)",
          engine: "Sikio Local ASR Engine (prepared demo transcript)",
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

    // Real Whisper transcription if OPENAI_API_KEY is configured and no manual transcript override was provided
    if (body.clipId && !body.customTranscript?.trim()) {
      const whisper = await transcribeWithOpenAIWhisper({
        clipId: body.clipId,
        threshold,
      });
      if (whisper) {
        return NextResponse.json(
          {
            ok: true,
            operator: "Sikio Transcription Service (self-hosted)",
            engine:
              "OpenAI Whisper API (word timings + segment log-probability confidence)",
            x402: {
              requestId: payment.requestId,
              txHash: payment.txHash,
              mode: payment.mode,
              verifiedOnChain,
              amountTusd8: inferenceCostTusd8,
            },
            durationSeconds: whisper.durationSeconds,
            words: whisper.words,
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
    }

    // Honest local ASR engine fallback: no neural model is available, so we never
    // fabricate a transcript. A real transcript must be supplied; we then flag
    // uncertain tokens with a transparent lexical heuristic (not a model score).
    if (!body.customTranscript?.trim()) {
      return NextResponse.json(
        {
          error:
            "No transcript available. This upload has no Whisper key configured (set OPENAI_API_KEY) and no transcript was provided. Paste the clip's transcript so the local engine can flag uncertain words, or configure Whisper to transcribe the audio.",
        },
        { status: 400 }
      );
    }
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
        engine:
          "Sikio Local ASR Engine (your transcript + lexical uncertainty heuristic)",
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
