import fs from "fs";
import path from "path";
import { CaptionWord } from "./types";

export interface ShowcaseClipSpec {
  id: string;
  title: string;
  shortLabel: string;
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
  /** Overconfident AI mistake (scored above 0.78) so agencies see honest miss-rate behavior */
  overconfidentMistake?: {
    referenceWord: string;
    aiText: string;
    confidence: number;
  };
}

export const SHOWCASE_CLIPS: ShowcaseClipSpec[] = [
  {
    id: "lagos-fintech-ep14",
    title: "Tech Point Lagos · Ep. 14",
    shortLabel: "Lagos · Pidgin",
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
    title: "Nairobi Mobility Cut · Reel 03",
    shortLabel: "Nairobi · Swahili",
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
    title: "Osu Studio Drama · Scene 09",
    shortLabel: "Accra · English",
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
 * Produces word-level ASR output with exact WAV timestamps, preserved trailing sentence
 * punctuation, and realistic confidence scores.
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
    const start = Math.min(timings.duration - 0.15, Math.max(0.05, w.start));
    const nextStart =
      idx < timings.words.length - 1
        ? timings.words[idx + 1].start
        : timings.duration;
    const end = Number(
      Math.min(timings.duration, Math.max(start + 0.14, nextStart - 0.02)).toFixed(3)
    );
    const punctMatch = w.text.match(/[.,!?]+$/);
    const trailingPunct = punctMatch ? punctMatch[0] : "";
    const cleanKey = w.text.replace(/[.,!?]+$/g, "");

    let aiText = w.text;
    let confidence = Number(
      (0.89 + (((idx * 17 + cleanKey.length * 7) % 10) * 0.009)).toFixed(2)
    );

    const err = spec.asrErrors[cleanKey];
    if (err) {
      aiText = `${err.aiText}${trailingPunct}`;
      confidence = err.confidence;
    } else if (
      spec.overconfidentMistake &&
      cleanKey === spec.overconfidentMistake.referenceWord
    ) {
      aiText = `${spec.overconfidentMistake.aiText}${trailingPunct}`;
      confidence = spec.overconfidentMistake.confidence;
    }

    return {
      index: idx,
      start: Number(start.toFixed(3)),
      end,
      aiText,
      currentText: aiText,
      referenceText: w.text,
      confidence,
      confidenceSource: "prepared-demo",
      flagged: confidence < confidenceThreshold,
    };
  });

  return {
    durationSeconds: timings.duration,
    words,
  };
}

/**
 * ~160 of the most common English function and content words. A token outside this
 * list (and long enough to matter) is treated as out-of-vocabulary and worth a human
 * glance. This deliberately leaves African names, places and slang unlisted, so they
 * surface for review, which is exactly the point.
 */
const COMMON_ENGLISH_WORDS = new Set<string>(
  (
    "the a an and or but so if then than that this these those there here it its it's " +
    "i you he she we they me him her us them my your his our their mine yours ours " +
    "is am are was were be been being do does did done have has had having will would " +
    "can could shall should may might must not no yes of to in on at by for from with " +
    "about into over under again further once up down out off above below between " +
    "as until while because since though although when where who whom which what why how " +
    "all any both each few more most other some such only own same too very just " +
    "one two three four five six seven eight nine ten first next last now today day " +
    "time year years people way ways man woman thing things work life world hand hands part " +
    "child eye eyes place places week month hour minute second moment night morning evening " +
    "go goes going gone went come comes came get gets got getting make makes made making " +
    "say says said saying see sees seen saw look looks looked looking watch watches " +
    "know knows knew known think thinks thought take takes took taken give gives gave given " +
    "want wants wanted need needs needed use uses used find finds found feel feels felt " +
    "talk talks talking tell tells told ask asks asked call calls called turn turns turned " +
    "put puts keep keeps kept let lets leave leaves left mean means meant show shows showed " +
    "ride rides rode riding drive drives drove walk walks walked run runs ran eat eats ate " +
    "road roads street streets house houses home homes room rooms door doors wall floor " +
    "car cars bus buses train phone phones money market markets shop shops store food water " +
    "school schools friend friends family name names number numbers back still even also " +
    "after before through around without within every many much well bad great little lot " +
    "kind sort side end top area case fact head face light air land sea sky sun rain tree " +
    "big small old new long short high low early late good right wrong past next last same " +
    "record recording studio partner payment payments local mobile scene drama podcast clip " +
    "across our we're let's really you're they're i'm he's she's don't can't won't that's " +
    "people person again always never often sometimes together along past near far behind"
  ).split(/\s+/)
);

/**
 * Word-level transcript for custom uploaded clips when no neural ASR (Whisper) is
 * available. It NEVER fabricates audio content: a real transcript must be supplied
 * (the caller returns a clear error otherwise). Uncertain tokens are flagged by a
 * transparent lexical rule (out-of-vocabulary / proper noun / number), each tagged
 * with its reason and `confidenceSource: "lexical-heuristic"` so it is never mistaken
 * for a model probability.
 */
export function buildCustomTranscript(params: {
  durationSeconds: number;
  rawTranscript?: string;
  confidenceThreshold: number;
}): CaptionWord[] {
  const text = params.rawTranscript?.trim();
  if (!text) {
    throw new Error(
      "buildCustomTranscript requires a transcript: the local engine never fabricates audio content."
    );
  }

  const tokens = text.split(/\s+/).filter(Boolean);
  const step = Math.max(params.durationSeconds / Math.max(tokens.length, 1), 0.25);

  return tokens.map((token, idx) => {
    const start = Number((idx * step).toFixed(2));
    const end = Number(
      Math.min(params.durationSeconds, (idx + 1) * step - 0.03).toFixed(2)
    );
    const clean = token.replace(/[.,!?;:"'()]/g, "");
    const lower = clean.toLowerCase();

    let confidence = 0.9;
    let flagReason: string | undefined;
    if (clean.length === 0) {
      confidence = 0.9;
    } else if (/\d/.test(clean)) {
      confidence = 0.6;
      flagReason = "contains a number";
    } else if (idx > 0 && /^[A-Z]/.test(clean) && clean.length >= 3) {
      confidence = 0.6;
      flagReason = "proper noun (capitalised mid-sentence)";
    } else if (clean.length >= 4 && !COMMON_ENGLISH_WORDS.has(lower)) {
      confidence = 0.66;
      flagReason = "out-of-vocabulary word";
    }

    return {
      index: idx,
      start,
      end: Math.max(end, start + 0.15),
      aiText: token,
      currentText: token,
      confidence,
      confidenceSource: "lexical-heuristic",
      flagReason,
      flagged: confidence < params.confidenceThreshold,
    };
  });
}
