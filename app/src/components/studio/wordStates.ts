import { CaptionWord, ReviewTask } from "@/lib/types";

/*
  One place that decides what colour a caption word gets, so the live caption,
  the full transcript and the lanes always agree:
  yellow = needs an ear, sky = heard, mint = fixed and paid, grey = returned.
*/
export type WordState = "plain" | "flag" | "heard" | "fixed" | "returned";

export const WORD_PILL: Record<Exclude<WordState, "plain">, string> = {
  flag: "bg-[var(--flag-bg)] text-[var(--on-pastel)]",
  heard: "bg-[var(--heard-bg)] text-[var(--on-pastel)]",
  fixed: "bg-[var(--paid-bg)] text-[var(--on-pastel)]",
  returned: "bg-[var(--returned-bg)] text-[var(--ink)]",
};

export function wordState(
  w: CaptionWord,
  taskById: Map<string, ReviewTask>,
  raw: boolean,
  threshold: number
): WordState {
  if (raw) return w.confidence < threshold ? "flag" : "plain";
  if (w.fixedByHuman) return "fixed";
  const t = w.taskId ? taskById.get(w.taskId) : undefined;
  if (t?.status === "submitted") return "heard";
  if (t?.status === "accepted") return "fixed";
  if (t && (t.status === "rejected" || t.status === "expired")) return "returned";
  if (w.flagged) return "flag";
  return "plain";
}

export interface WordSegment {
  key: string;
  words: CaptionWord[];
  text: string;
  state: WordState;
  start: number;
  end: number;
}

/* Joins neighbouring words that belong to the same unsure span into one pill. */
export function segmentWords(
  words: CaptionWord[],
  taskById: Map<string, ReviewTask>,
  raw: boolean,
  threshold: number
): WordSegment[] {
  const out: WordSegment[] = [];
  for (const w of words) {
    const text = (raw ? w.aiText : w.currentText).trim();
    if (!text) continue;
    const state = wordState(w, taskById, raw, threshold);
    const prev = out[out.length - 1];
    const sameSpan =
      prev &&
      state !== "plain" &&
      prev.state === state &&
      ((w.taskId && prev.words[0].taskId === w.taskId) || (raw && prev.state === "flag"));
    if (sameSpan) {
      prev.words.push(w);
      prev.text = `${prev.text} ${text}`;
      prev.end = w.end;
    } else {
      out.push({ key: `${w.index}`, words: [w], text, state, start: w.start, end: w.end });
    }
  }
  return out;
}

export function formatClock(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const whole = Math.floor(s % 60);
  const tenths = Math.floor((s - Math.floor(s)) * 10);
  return m > 0
    ? `${m}:${String(whole).padStart(2, "0")}.${tenths}`
    : `${String(whole).padStart(2, "0")}.${tenths}`;
}
