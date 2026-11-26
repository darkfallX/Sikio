import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { deepgramConfigured, deepgramEngineLabel, transcribeWithDeepgram } from "@/lib/deepgram";
import { liveInferenceProvider, verifyInferencePayment } from "@/lib/settlement";
import {
  buildShowcaseTranscript,
  buildCustomTranscript,
  getClipSpec,
  loadClipTimings,
} from "@/lib/clips";
import { findUploadedClip } from "@/lib/storage";
import { CaptionWord } from "@/lib/types";
import { buildX402Challenge, decodeX402Header } from "@/lib/x402";

export const runtime = "nodejs";

/** Deepgram results by verified payment tx, so replaying a payment costs no credit. */
const deepgramByTx = new Map<string, { clipId: string; durationSeconds: number; words: CaptionWord[] }>();

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
        payTo: liveInferenceProvider() ?? undefined,
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
        // The tx must be a ReviewEscrow InferencePaid for THIS requestId and at
        // least the asked amount; any other successful tx is refused.
        const paid = await verifyInferencePayment(
          payment.txHash,
          payment.requestId,
          // The server's own price, never the amount the client claims.
          BigInt(Math.round(inferenceCostTusd8 * 1_000_000))
        );
        if (!paid) {
          return NextResponse.json(
            {
              error:
                "That transaction did not pay this request: no ReviewEscrow InferencePaid for this requestId and amount.",
            },
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

    const paidResponse = (engine: string, durationSeconds: number, words: CaptionWord[], note?: string) =>
      NextResponse.json(
        {
          ok: true,
          operator: "Sikio Transcription Service (self-hosted)",
          engine,
          engineNote: note,
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

    // Step 3a: real speech recognition (Deepgram) for bundled clips and uploads,
    // when DEEPGRAM_API_KEY is set. Flags come from Deepgram's own word confidences.
    // It spends real Deepgram credit, so it runs only for a payment verified on chain;
    // sandbox payments (unverified by design) get the labelled prepared transcript.
    // A replayed tx is answered from memory instead of calling Deepgram again.
    let deepgramFailure: string | undefined;
    const replay = verifiedOnChain ? deepgramByTx.get(payment.txHash.toLowerCase()) : undefined;
    if (replay && replay.clipId === body.clipId) {
      const words = replay.words.map((w) => ({ ...w, flagged: w.confidence < threshold }));
      return paidResponse(deepgramEngineLabel(), replay.durationSeconds, words);
    }
    if (
      verifiedOnChain &&
      deepgramConfigured() &&
      body.clipId &&
      !body.customTranscript?.trim()
    ) {
      const spec = getClipSpec(body.clipId);
      const uploaded = spec ? null : findUploadedClip(body.clipId);
      const filePath = spec
        ? path.join(process.cwd(), "public", spec.audioUrl.replace(/^\//, ""))
        : uploaded?.filePath;
      if (filePath && fs.existsSync(filePath)) {
        try {
          const timing = spec ? loadClipTimings()[spec.id] : undefined;
          const { durationSeconds, words } = await transcribeWithDeepgram({
            filePath,
            mimeType: spec ? "audio/wav" : uploaded?.meta.mimeType || "audio/wav",
            threshold,
            referenceWords: timing?.words.map((w) => w.text),
          });
          if (deepgramByTx.size > 500) deepgramByTx.clear();
          deepgramByTx.set(payment.txHash.toLowerCase(), { clipId: body.clipId, durationSeconds, words });
          return paidResponse(deepgramEngineLabel(), durationSeconds, words);
        } catch (err) {
          deepgramFailure = err instanceof Error ? err.message : "Speech recognition failed.";
          console.error("[transcribe] Deepgram failed:", deepgramFailure);
        }
      }
    }

    // Step 3b: Showcase WAV clip without real speech recognition. Words and
    // confidences come from a prepared fixture (clips/timings.json plus asrErrors in
    // lib/clips.ts), not live model inference, and the engine label says so.
    if (body.clipId && getClipSpec(body.clipId)) {
      const { durationSeconds, words } = buildShowcaseTranscript(
        body.clipId,
        threshold
      );
      return paidResponse(
        "Sikio Local ASR Engine (prepared demo transcript)",
        durationSeconds,
        words,
        deepgramFailure
          ? "Real speech recognition was unavailable for this run, so the prepared transcript was used."
          : undefined
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
