import { describe, expect, it } from "vitest";
import {
  applyCorrectionToWords,
  buildFlaggedClusters,
  buildSubtitleCues,
  computeCostMetrics,
  computeMergedDuration,
  serializeToSrt,
  serializeToVtt,
} from "../captions";
import { buildShowcaseTranscript } from "../clips";
import { buildX402Challenge, decodeX402Header, encodeX402Header } from "../x402";
import { CaptionWord } from "../types";

const sampleWords: CaptionWord[] = [
  { index: 0, start: 0.2, end: 0.5, aiText: "Today", currentText: "Today", confidence: 0.96, flagged: false },
  { index: 1, start: 0.55, end: 0.9, aiText: "founders", currentText: "founders", confidence: 0.94, flagged: false },
  { index: 2, start: 0.95, end: 1.3, aiText: "use", currentText: "use", confidence: 0.95, flagged: false },
  { index: 3, start: 1.35, end: 1.8, aiText: "Pay stark", currentText: "Pay stark", confidence: 0.48, flagged: true },
  { index: 4, start: 1.85, end: 2.2, aiText: "and", currentText: "and", confidence: 0.95, flagged: false },
  { index: 5, start: 2.25, end: 2.6, aiText: "banks", currentText: "banks", confidence: 0.94, flagged: false },
  { index: 6, start: 2.65, end: 2.9, aiText: "everyday", currentText: "everyday", confidence: 0.93, flagged: false },
  { index: 7, start: 2.95, end: 3.3, aiText: "without", currentText: "without", confidence: 0.92, flagged: false },
  { index: 8, start: 3.35, end: 3.9, aiText: "wall holler.", currentText: "wall holler.", confidence: 0.41, flagged: true },
];

describe("Sikio caption clustering, merging, and SRT/VTT export", () => {
  it("clusters uncertain words with tight 0.65s padded windows and merges nearby flags cleanly", () => {
    const clusters = buildFlaggedClusters(sampleWords, 0.78, 10);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].aiGuess).toBe("Pay stark");
    expect(clusters[0].excerptStart).toBeCloseTo(0.7, 2);
    expect(clusters[0].excerptEnd).toBeCloseTo(2.45, 2);
    expect(clusters[1].aiGuess).toBe("wall holler.");

    // Nearby flagged tokens within <= 2 word gap merge continuously with bridge words included
    const closeWords: CaptionWord[] = [
      { index: 0, start: 1.0, end: 1.3, aiText: "Tuesday", currentText: "Tuesday", confidence: 0.64, flagged: true },
      { index: 1, start: 1.35, end: 1.55, aiText: "from", currentText: "from", confidence: 0.95, flagged: false },
      { index: 2, start: 1.6, end: 1.9, aiText: "Yabba", currentText: "Yabba", confidence: 0.54, flagged: true },
    ];
    const mergedClose = buildFlaggedClusters(closeWords, 0.78, 8);
    expect(mergedClose).toHaveLength(1);
    expect(mergedClose[0].wordIndices).toEqual([0, 1, 2]);
    expect(mergedClose[0].aiGuess).toBe("Tuesday from Yabba");
  });

  it("preserves trailing sentence punctuation when merging human correction and exports SRT/VTT", () => {
    const merged = applyCorrectionToWords(sampleWords, [3], "Paystack");
    expect(merged[3].currentText).toBe("Paystack");
    expect(merged[3].fixedByHuman).toBe(true);
    expect(merged[3].flagged).toBe(false);

    const punctPreserved = applyCorrectionToWords(merged, [8], "wahala");
    expect(punctPreserved[8].currentText).toBe("wahala.");

    const srt = serializeToSrt(punctPreserved);
    expect(srt).toContain("00:00:00,200 --> 00:00:02,900");
    expect(srt).toContain("2\n00:00:02,950 --> 00:00:03,900\nwithout wahala.");
    expect(srt).toContain("Paystack");
    expect(srt).toContain("wahala.");
    expect(srt).not.toContain("Pay stark");

    const vtt = serializeToVtt(punctPreserved);
    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
    expect(vtt).toContain("Paystack");
  });

  it("computes non-overlapping merged duration and honest cost metrics without -0% time", () => {
    const mergedSec = computeMergedDuration([
      { start: 1.0, end: 4.0 },
      { start: 2.5, end: 6.0 },
      { start: 8.0, end: 10.0 },
    ]);
    expect(mergedSec).toBe(7);

    const m = computeCostMetrics({
      durationSeconds: 120,
      inferenceCostTusd8: 0.04,
      humanSpentTusd8: 0.75,
      humanReservedTusd8: 0.25,
      flaggedSeconds: 24,
    });
    expect(m.minutes).toBe(2);
    expect(m.totalSettled).toBeCloseTo(0.79, 2);
    expect(m.costPerMinuteProjected).toBeCloseTo(0.52, 2);
    expect(m.isCheaperThanFull).toBe(true);
    expect(m.reviewTimeSavedPct).toBe(80);

    // Overlapping spans never produce negative or "-0%" review savings
    const lagosMetrics = computeCostMetrics({
      durationSeconds: 17.417,
      inferenceCostTusd8: 0.04,
      humanSpentTusd8: 0.1,
      humanReservedTusd8: 0.4,
      excerptSpans: [
        { start: 2, end: 8 },
        { start: 4, end: 12 },
        { start: 10, end: 17.417 },
      ],
    });
    expect(lagosMetrics.coveredSec).toBeCloseTo(15.42, 2);
    expect(lagosMetrics.reviewTimeSavedPct).toBeGreaterThanOrEqual(0);
    expect(lagosMetrics.isCheaperThanFull).toBe(true);
  });

  it("syncs showcase timings strictly within WAV duration and splits clean cues", () => {
    const transcript = buildShowcaseTranscript("lagos-fintech-ep14", 0.78);
    expect(transcript.words).toHaveLength(43);
    const lastWord = transcript.words[transcript.words.length - 1];
    expect(lastWord.end).toBeLessThanOrEqual(transcript.durationSeconds);
    const cues = buildSubtitleCues(transcript.words);
    expect(cues[0].text).toBe("Welcome back to Tech Point Lagos.");
  });
});

describe("Sikio x402 HTTP 402 protocol helpers", () => {
  it("builds valid eip155:44005 tUSD8 challenge and round-trips X-PAYMENT header", () => {
    const challenge = buildX402Challenge({
      requestId: "req-test-1",
      amountTusd8: 0.04,
      resource: "/api/transcribe",
    });
    expect(challenge.network).toBe("eip155:44005");
    expect(challenge.maxAmountRequired).toBe("40000");
    expect(challenge.asset).toBe("0x456569838f1d43009A91ebA4263147Afd7233483");

    const encoded = encodeX402Header({
      x402Version: 1,
      network: "eip155:44005",
      requestId: "req-test-1",
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      payer: "0x51C10A9E00000000000000000000000000002002",
      amountBaseUnits: "40000",
      mode: "sandbox",
    });

    const decoded = decodeX402Header(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.requestId).toBe("req-test-1");
    expect(decodeX402Header("not-valid-base64")).toBeNull();
  });
});
