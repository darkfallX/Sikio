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
 * (within 1 word gap) into clean micro-review tasks with 1.2s audio padding on each side.
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
    if (last && idx - last[last.length - 1] <= 1) {
      last.push(idx);
    } else {
      groups.push([idx]);
    }
  }

  return groups.map((group) => {
    const firstIdx = group[0];
    const lastIdx = group[group.length - 1];
    const firstWord = words[firstIdx];
    const lastWord = words[lastIdx];

    const ctxBeforeWords = words.slice(Math.max(0, firstIdx - 5), firstIdx);
    const ctxAfterWords = words.slice(lastIdx + 1, Math.min(words.length, lastIdx + 6));
    const guessWords = words.slice(firstIdx, lastIdx + 1);

    const excerptStart = Math.max(0, Number((firstWord.start - 1.3).toFixed(2)));
    const excerptEnd = Math.min(
      durationSeconds,
      Number((lastWord.end + 1.3).toFixed(2))
    );

    const minConfidence = Math.min(...guessWords.map((w) => w.confidence));

    return {
      wordIndices: group,
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
 * Merges an approved human correction back into the caption words at exact timestamps.
 */
export function applyCorrectionToWords(
  words: CaptionWord[],
  wordIndices: number[],
  correctedPhrase: string
): CaptionWord[] {
  const cleaned = correctedPhrase.trim();
  if (!cleaned || wordIndices.length === 0) return words;

  const firstIdx = wordIndices[0];
  const restSet = new Set(wordIndices.slice(1));
  const splitTokens = cleaned.split(/\s+/);

  return words.map((w) => {
    if (w.index === firstIdx) {
      // If replacement has exact same token count, map 1:1; otherwise place full phrase on anchor word
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
 * Groups timed words into readable subtitle cues (max ~9 words or ~42 chars per cue).
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
    if (buffer.length >= 8 || charLen >= 44 || endsSentence) {
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
 * Calculates itemized cost per publishable minute vs. traditional full-timeline agency review.
 * Standard African localization agency human pass: ~$3.50/min ($0.058/sec).
 */
export function computeCostMetrics(params: {
  durationSeconds: number;
  inferenceCostTusd8: number;
  humanSpentTusd8: number;
  humanReservedTusd8: number;
  flaggedSeconds: number;
}) {
  const minutes = Math.max(params.durationSeconds / 60, 0.01);
  const totalSettled = params.inferenceCostTusd8 + params.humanSpentTusd8;
  const totalProjected = totalSettled + params.humanReservedTusd8;
  const costPerMinuteSettled = totalSettled / minutes;
  const costPerMinuteProjected = totalProjected / minutes;
  const fullHumanReviewCostPerMin = 3.5; // baseline agency full-transcript review rate
  const fullHumanCostForClip = fullHumanReviewCostPerMin * minutes;
  const reviewTimeSavedPct = Math.max(
    0,
    Math.min(95, Math.round((1 - params.flaggedSeconds / Math.max(params.durationSeconds, 1)) * 100))
  );
  return {
    minutes,
    totalSettled,
    totalProjected,
    costPerMinuteSettled,
    costPerMinuteProjected,
    fullHumanReviewCostPerMin,
    fullHumanCostForClip,
    reviewTimeSavedPct,
  };
}
