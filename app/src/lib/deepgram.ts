import fs from "fs";
import net from "net";
import { CaptionWord } from "./types";

// Node tries each address family for only 250 ms before moving on. On slower links
// the IPv4 handshake to api.deepgram.com takes 500 to 1,000 ms, Node abandons it for
// an IPv6 route that never answers, and every request fails after 10 s. Give each
// attempt 2.5 s instead; the IPv6 fallback still works. Server side, process wide.
net.setDefaultAutoSelectFamilyAttemptTimeout(2500);

/**
 * Real speech recognition through Deepgram's pre-recorded API. Deepgram returns a
 * confidence for every word, which is exactly the signal Sikio uses to decide which
 * seconds a native speaker should hear. Server side only: the key never reaches
 * the browser.
 */

export const DEEPGRAM_MODEL = "nova-3";

export function deepgramConfigured(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY?.trim());
}

export function deepgramEngineLabel(): string {
  return `Deepgram ${DEEPGRAM_MODEL} speech recognition (real word confidences)`;
}

interface DeepgramWord {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  confidence: number;
}

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, "");

/** For each ASR word, the reference word it was aligned to (edit distance), if any. */
function referenceForEach(ref: string[], hyp: string[]): (string | undefined)[] {
  const r = ref.map(norm);
  const h = hyp.map(norm);
  const n = r.length, m = h.length;
  const d = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1), d[i - 1][j] + 1, d[i][j - 1] + 1);
  const out: (string | undefined)[] = new Array(m).fill(undefined);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (d[i][j] === d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1)) {
      out[j - 1] = ref[i - 1];
      i--; j--;
    } else if (d[i][j] === d[i][j - 1] + 1) {
      j--;
    } else {
      i--;
    }
  }
  return out;
}

export async function transcribeWithDeepgram(params: {
  filePath: string;
  mimeType: string;
  threshold: number;
  language?: string;
  /** True transcript words for bundled clips, used only to fill referenceText. */
  referenceWords?: string[];
}): Promise<{ durationSeconds: number; words: CaptionWord[] }> {
  const key = process.env.DEEPGRAM_API_KEY?.trim();
  if (!key) throw new Error("DEEPGRAM_API_KEY is not set");
  const url =
    `https://api.deepgram.com/v1/listen?model=${DEEPGRAM_MODEL}` +
    `&language=${encodeURIComponent(params.language || "en")}&punctuate=true`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  let json: {
    metadata?: { duration?: number };
    results?: { channels?: { alternatives?: { words?: DeepgramWord[] }[] }[] };
    err_msg?: string;
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": params.mimeType || "audio/wav" },
      body: fs.readFileSync(params.filePath),
      signal: controller.signal,
    });
    json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Never echo the key or the full response back to a visitor.
      throw new Error(`Speech recognition failed (${res.status}).`);
    }
  } finally {
    clearTimeout(timer);
  }

  const raw = json.results?.channels?.[0]?.alternatives?.[0]?.words || [];
  if (raw.length === 0) throw new Error("Speech recognition returned no words.");

  const refs = params.referenceWords
    ? referenceForEach(params.referenceWords, raw.map((w) => w.word))
    : [];

  const words: CaptionWord[] = raw.map((w, idx) => {
    const text = w.punctuated_word || w.word;
    const confidence = Number(Math.min(0.999, Math.max(0, w.confidence)).toFixed(3));
    return {
      index: idx,
      start: Number(w.start.toFixed(3)),
      end: Number(Math.max(w.start + 0.12, w.end).toFixed(3)),
      aiText: text,
      currentText: text,
      referenceText: refs[idx],
      confidence,
      confidenceSource: "deepgram-confidence",
      flagged: confidence < params.threshold,
    };
  });

  const durationSeconds = Number(
    (json.metadata?.duration || raw[raw.length - 1].end || 15).toFixed(2)
  );
  return { durationSeconds, words };
}
