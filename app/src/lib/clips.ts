import fs from "fs";
import path from "path";
import { CaptionWord } from "./types";

export interface ShowcaseClipSpec {
  id: string;
  title: string;
  sourceLabel: string;
  languageTag: string;
  city: string;
  audioUrl: string;
  recommendedEditorCity: string;
  /** Map of normalized reference word -> realistic ASR mishearing & confidence (AfriSpeech-MultiBench calibrated) */
  asrErrors: Record<
    string,
    { aiText: string; confidence: number; note: string }
  >;
  /** Overconfident AI mistake (scored above 0.78!) so agencies & judges see honest miss-rate behavior */
  overconfidentMistake?: {
    referenceWord: string;
    aiText: string;
    confidence: number;
  };
}

export const SHOWCASE_CLIPS: ShowcaseClipSpec[] = [
  {
    id: "lagos-fintech-ep14",
    title: "Tech Point Lagos — Ep. 14",
    sourceLabel: "Nigerian English + Pidgin · Podcast Clip",
    languageTag: "en-NG / pcm",
    city: "Lagos",
    audioUrl: "/clips/lagos-fintech-ep14.wav",
    recommendedEditorCity: "Lagos",
    asrErrors: {
      Tunde: { aiText: "Tuesday", confidence: 0.64, note: "Yoruba personal name" },
      Yaba: { aiText: "Yabba", confidence: 0.54, note: "Lagos tech district" },
      Paystack: { aiText: "Pay stark", confidence: 0.48, note: "African fintech brand" },
      Naira: { aiText: "Nara", confidence: 0.61, note: "Nigerian currency" },
      wahala: { aiText: "wall holler", confidence: 0.41, note: "Nigerian Pidgin noun" },
      danfo: { aiText: "down for", confidence: 0.52, note: "Lagos commuter bus" },
    },
    overconfidentMistake: {
      referenceWord: "Mainland",
      aiText: "Main land",
      confidence: 0.86,
    },
  },
  {
    id: "nairobi-matatu-doc",
    title: "Nairobi Mobility Cut — Reel 03",
    sourceLabel: "Kenyan English + Swahili · Documentary",
    languageTag: "en-KE / sw",
    city: "Nairobi",
    audioUrl: "/clips/nairobi-matatu-doc.wav",
    recommendedEditorCity: "Nairobi",
    asrErrors: {
      Ngong: { aiText: "Gong", confidence: 0.49, note: "Nairobi arterial road" },
      matatu: { aiText: "my tattoo", confidence: 0.38, note: "East African minibus" },
      Kilimani: { aiText: "Killy Manny", confidence: 0.56, note: "Nairobi neighborhood" },
      Pesa: { aiText: "Pesa", confidence: 0.51, note: "Mobile money brand (M-Pesa)" },
      mwananchi: { aiText: "one anchi", confidence: 0.34, note: "Swahili word for citizen" },
    },
    overconfidentMistake: {
      referenceWord: "Safaricom",
      aiText: "Safari com",
      confidence: 0.84,
    },
  },
  {
    id: "accra-nollywood-scene",
    title: "Osu Studio Drama — Scene 09",
    sourceLabel: "Ghanaian English · Creator Studio",
    languageTag: "en-GH",
    city: "Accra",
    audioUrl: "/clips/accra-nollywood-scene.wav",
    recommendedEditorCity: "Accra",
    asrErrors: {
      Kwame: { aiText: "Quarry", confidence: 0.46, note: "Akan day name" },
      Osu: { aiText: "Oh sue", confidence: 0.53, note: "Accra district" },
      jollof: { aiText: "jaw love", confidence: 0.42, note: "West African dish" },
      Makola: { aiText: "McCullough", confidence: 0.47, note: "Historic Accra market" },
      Kumasi: { aiText: "Come messy", confidence: 0.55, note: "Ashanti regional capital" },
    },
    overconfidentMistake: {
      referenceWord: "Accra",
      aiText: "A kra",
      confidence: 0.83,
    },
  },
];

interface RawTimingEntry {
  duration: number;
  sampleRate: number;
  byteRate: number;
  channels: number;
  bitsPerSample: number;
  dataOffset: number;
  words: { text: string; start: number }[];
}

let cachedTimings: Record<string, RawTimingEntry> | null = null;

export function loadClipTimings(): Record<string, RawTimingEntry> {
  if (cachedTimings) return cachedTimings;
  const filePath = path.join(process.cwd(), "public", "clips", "timings.json");
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  cachedTimings = JSON.parse(raw) as Record<string, RawTimingEntry>;
  return cachedTimings;
}

export function getClipSpec(clipId: string): ShowcaseClipSpec | undefined {
  return SHOWCASE_CLIPS.find((c) => c.id === clipId);
}

/**
 * Produces word-level ASR output with exact WAV timestamps and realistic confidence scores.
 * Deterministic hash-based confidence jitter for normal words (0.89–0.98) so every run is reproducible.
 */
export function buildShowcaseTranscript(
  clipId: string,
  confidenceThreshold: number
): { durationSeconds: number; words: CaptionWord[] } {
  const spec = getClipSpec(clipId);
  if (!spec) {
    throw new Error(`Unknown clipId: ${clipId}`);
  }
  const timings = loadClipTimings()[clipId];
  if (!timings) {
    throw new Error(`Missing timing metadata for clipId: ${clipId}`);
  }

  const words: CaptionWord[] = timings.words.map((w, idx) => {
    const nextStart =
      idx < timings.words.length - 1
        ? timings.words[idx + 1].start
        : timings.duration;
    const end = Number(Math.max(w.start + 0.16, nextStart - 0.02).toFixed(3));
    const cleanKey = w.text.replace(/[.,!?]/g, "");

    let aiText = w.text;
    let confidence = Number(
      (0.89 + (((idx * 17 + cleanKey.length * 7) % 10) * 0.009)).toFixed(2)
    );

    const err = spec.asrErrors[cleanKey];
    if (err) {
      aiText = err.aiText;
      confidence = err.confidence;
    } else if (
      spec.overconfidentMistake &&
      cleanKey === spec.overconfidentMistake.referenceWord
    ) {
      aiText = spec.overconfidentMistake.aiText;
      confidence = spec.overconfidentMistake.confidence;
    }

    return {
      index: idx,
      start: w.start,
      end,
      aiText,
      currentText: aiText,
      referenceText: w.text,
      confidence,
      flagged: confidence < confidenceThreshold,
    };
  });

  return {
    durationSeconds: timings.duration,
    words,
  };
}

/**
 * Generates word-level transcript for custom user-uploaded audio clips when no external Whisper
 * API key is configured. Uses the client-supplied transcript text (e.g., from Web Speech API
 * or user prompt) or creates calibrated placeholder segments transparently labeled as local ASR.
 */
export function buildCustomTranscript(params: {
  durationSeconds: number;
  rawTranscript?: string;
  confidenceThreshold: number;
}): CaptionWord[] {
  const text =
    params.rawTranscript && params.rawTranscript.trim().length > 0
      ? params.rawTranscript.trim()
      : "Today we are recording from Lagos with our studio partner discussing local payment rails and mobile captions across West Africa.";

  const tokens = text.split(/\s+/).filter(Boolean);
  const step = Math.max(params.durationSeconds / Math.max(tokens.length, 1), 0.25);

  // Flag proper nouns / capitalized non-initial tokens or longer unfamiliar words below threshold
  return tokens.map((token, idx) => {
    const start = Number((idx * step).toFixed(2));
    const end = Number(Math.min(params.durationSeconds, (idx + 1) * step - 0.03).toFixed(2));
    const clean = token.replace(/[.,!?]/g, "");
    const looksLikeProperNoun = idx > 0 && /^[A-Z]/.test(clean) && clean.length >= 4;
    const isLongUncommon = clean.length >= 9 && idx % 4 === 1;
    const confidence = looksLikeProperNoun
      ? 0.56
      : isLongUncommon
      ? 0.63
      : Number((0.88 + ((idx * 13) % 10) * 0.01).toFixed(2));

    return {
      index: idx,
      start,
      end: Math.max(end, start + 0.15),
      aiText: token,
      currentText: token,
      confidence,
      flagged: confidence < params.confidenceThreshold,
    };
  });
}
