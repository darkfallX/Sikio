import { CaptionWord } from "./types";

export interface FlaggedCluster {
  wordIndices: number[];
  focusStart: number;
  focusEnd: number;
  excerptStart: number;
  excerptEnd: number;
  contextBefore: string;
  aiGuess: string;
  contextAfter: string;
  minConfidence: number;
}

/**
 * Identifies low-confidence words below `threshold` and merges nearby uncertain words
 * (within 2 word indices) into continuous micro-review spans with 0.65s context padding.
 */
export function buildFlaggedClusters(
  words: CaptionWord[],
  threshold: number,
  durationSeconds: number
): FlaggedCluster[] {
  const flaggedIndices = words
    .filter((w) => w.confidence < threshold)
    .map((w) => w.index);

  if (flaggedIndices.length === 0) return [];

  const groups: number[][] = [];
  for (const idx of flaggedIndices) {
    const last = groups[groups.length - 1];
    if (last && idx - last[last.length - 1] <= 2) {
      last.push(idx);
    } else {
      groups.push([idx]);
    }
  }

  // Real speech recognition often splits one unfamiliar word in two ("Paystack" heard
  // as "PACE TAC") and is only unsure of one half. Pull in a directly adjacent word
  // the model is also not near-certain of, so the editor's fix replaces the whole
  // misheard word instead of leaving "Paystack TAC". Only for real model
  // confidences; prepared-demo confidences are authored and stay as they are.
  const NEAR_CERTAIN = 0.95;
  const unsureNeighbour = (w: CaptionWord | undefined) =>
    !!w && w.confidenceSource === "deepgram-confidence" && w.confidence < NEAR_CERTAIN;
  const taken = new Set(groups.flat());
  for (const group of groups) {
    const before = words[group[0] - 1];
    if (unsureNeighbour(before) && !taken.has(before.index)) {
      group.unshift(before.index);
      taken.add(before.index);
    }
    const after = words[group[group.length - 1] + 1];
    if (unsureNeighbour(after) && !taken.has(after.index)) {
      group.push(after.index);
      taken.add(after.index);
    }
  }

  return groups.map((group) => {
    const firstIdx = group[0];
    const lastIdx = group[group.length - 1];
    const firstWord = words[firstIdx];
    const lastWord = words[lastIdx];

    // Fill continuous word indices so bridge words inside a merged phrase are cleanly replaced too
    const continuousIndices: number[] = [];
    for (let k = firstIdx; k <= lastIdx; k++) {
      continuousIndices.push(k);
    }

    const ctxBeforeWords = words.slice(Math.max(0, firstIdx - 5), firstIdx);
    const ctxAfterWords = words.slice(
      lastIdx + 1,
      Math.min(words.length, lastIdx + 6)
    );
    const guessWords = words.slice(firstIdx, lastIdx + 1);

    const excerptStart = Math.max(0, Number((firstWord.start - 0.65).toFixed(2)));
    const excerptEnd = Math.min(
      durationSeconds,
      Number((lastWord.end + 0.65).toFixed(2))
    );

    const flaggedGuessWords = guessWords.filter((w) => w.confidence < threshold);
    const minConfidence = Math.min(
      ...(flaggedGuessWords.length > 0 ? flaggedGuessWords : guessWords).map(
        (w) => w.confidence
      )
    );

    return {
      wordIndices: continuousIndices,
      focusStart: firstWord.start,
      focusEnd: lastWord.end,
      excerptStart,
      excerptEnd,
      contextBefore: ctxBeforeWords.map((w) => w.currentText).join(" "),
      aiGuess: guessWords.map((w) => w.aiText).join(" "),
      contextAfter: ctxAfterWords.map((w) => w.currentText).join(" "),
      minConfidence,
    };
  });
}

/**
 * Merges an approved human correction back into the caption words at exact timestamps,
 * preserving trailing sentence punctuation from the original phrase boundary if omitted.
 */
export function applyCorrectionToWords(
  words: CaptionWord[],
  wordIndices: number[],
  correctedPhrase: string
): CaptionWord[] {
  let cleaned = correctedPhrase.trim();
  if (!cleaned || wordIndices.length === 0) return words;

  const firstIdx = wordIndices[0];
  const lastIdx = wordIndices[wordIndices.length - 1];
  const originalLast = words.find((w) => w.index === lastIdx);
  const trailingPunct = originalLast?.aiText.match(/[.,!?]+$/)?.[0] || "";
  if (trailingPunct && !/[.,!?]$/.test(cleaned)) {
    cleaned = `${cleaned}${trailingPunct}`;
  }

  const restSet = new Set(wordIndices.slice(1));
  const splitTokens = cleaned.split(/\s+/);

  return words.map((w) => {
    if (w.index === firstIdx) {
      if (splitTokens.length === wordIndices.length) {
        return {
          ...w,
          currentText: splitTokens[0],
          fixedByHuman: true,
          flagged: false,
        };
      }
      return {
        ...w,
        currentText: cleaned,
        fixedByHuman: true,
        flagged: false,
      };
    }
    if (restSet.has(w.index)) {
      const pos = wordIndices.indexOf(w.index);
      if (splitTokens.length === wordIndices.length) {
        return {
          ...w,
          currentText: splitTokens[pos],
          fixedByHuman: true,
          flagged: false,
        };
      }
      return {
        ...w,
        currentText: "",
        fixedByHuman: true,
        flagged: false,
      };
    }
    return w;
  });
}

interface SubtitleCue {
  index: number;
  start: number;
  end: number;
  text: string;
}

/**
 * Groups timed words into readable subtitle cues respecting sentence and clause punctuation.
 */
export function buildSubtitleCues(words: CaptionWord[]): SubtitleCue[] {
  const visible = words.filter((w) => w.currentText.trim().length > 0);
  const cues: SubtitleCue[] = [];
  let buffer: CaptionWord[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    cues.push({
      index: cues.length + 1,
      start: buffer[0].start,
      end: buffer[buffer.length - 1].end,
      text: buffer.map((w) => w.currentText).join(" "),
    });
    buffer = [];
  };

  for (const w of visible) {
    buffer.push(w);
    const charLen = buffer.map((x) => x.currentText).join(" ").length;
    const endsSentence = /[.!?]$/.test(w.currentText);
    const endsClause = /[,;:]$/.test(w.currentText) && charLen >= 24;
    if (buffer.length >= 8 || charLen >= 44 || endsSentence || endsClause) {
      flush();
    }
  }
  flush();
  return cues;
}

function formatSrtTime(sec: number): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function formatVttTime(sec: number): string {
  return formatSrtTime(sec).replace(",", ".");
}

export function serializeToSrt(words: CaptionWord[]): string {
  const cues = buildSubtitleCues(words);
  return (
    cues
      .map(
        (c) =>
          `${c.index}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${c.text}\n`
      )
      .join("\n")
      .trim() + "\n"
  );
}

export function serializeToVtt(words: CaptionWord[]): string {
  const cues = buildSubtitleCues(words);
  const body = cues
    .map(
      (c) =>
        `${formatVttTime(c.start)} --> ${formatVttTime(c.end)}\n${c.text}\n`
    )
    .join("\n");
  return `WEBVTT\n\n${body.trim()}\n`;
}

/**
 * Merges overlapping [start, end] time intervals and returns total unique covered seconds.
 */
export function computeMergedDuration(
  spans: { start: number; end: number }[]
): number {
  const valid = spans
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .map((s) => ({ start: Math.max(0, s.start), end: s.end }))
    .sort((a, b) => a.start - b.start);

  if (valid.length === 0) return 0;

  let total = 0;
  let curStart = valid[0].start;
  let curEnd = valid[0].end;

  for (let i = 1; i < valid.length; i++) {
    const next = valid[i];
    if (next.start <= curEnd) {
      curEnd = Math.max(curEnd, next.end);
    } else {
      total += curEnd - curStart;
      curStart = next.start;
      curEnd = next.end;
    }
  }
  total += curEnd - curStart;
  return Number(total.toFixed(2));
}

/**
 * Calculates itemized cost per publishable minute vs. traditional full-timeline agency review.
 * Standard African localization agency human pass: ~$3.50/min ($0.058/sec).
 */
export function computeCostMetrics(params: {
  durationSeconds: number;
  inferenceCostTusd8: number;
  humanSpentTusd8: number;
  humanReservedTusd8: number;
  flaggedSeconds?: number;
  excerptSpans?: { start: number; end: number }[];
}) {
  const duration = Math.max(params.durationSeconds, 1);
  const minutes = Math.max(duration / 60, 0.01);
  const totalSettled = params.inferenceCostTusd8 + params.humanSpentTusd8;
  const totalProjected = totalSettled + params.humanReservedTusd8;
  const costPerMinuteSettled = totalSettled / minutes;
  const costPerMinuteProjected = totalProjected / minutes;
  const fullHumanReviewCostPerMin = 3.5; // baseline agency full-transcript review rate
  const fullHumanCostForClip = fullHumanReviewCostPerMin * minutes;

  const coveredSec = params.excerptSpans
    ? computeMergedDuration(params.excerptSpans)
    : Math.max(0, Math.min(duration, params.flaggedSeconds ?? 0));

  const clampedCovered = Math.min(duration, coveredSec);
  const rawSavedPct = Math.round((1 - clampedCovered / duration) * 100);
  const reviewTimeSavedPct = Math.max(0, Math.min(95, rawSavedPct));
  const isCheaperThanFull = costPerMinuteProjected <= fullHumanReviewCostPerMin;
  const costSavingsPct = Math.round(
    (1 - costPerMinuteProjected / fullHumanReviewCostPerMin) * 100
  );

  return {
    minutes,
    coveredSec: clampedCovered,
    totalSettled,
    totalProjected,
    costPerMinuteSettled,
    costPerMinuteProjected,
    fullHumanReviewCostPerMin,
    fullHumanCostForClip,
    reviewTimeSavedPct,
    isCheaperThanFull,
    costSavingsPct,
  };
}
