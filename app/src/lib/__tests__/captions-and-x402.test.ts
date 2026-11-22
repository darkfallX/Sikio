import { describe, expect, it } from "vitest";
import {
  applyCorrectionToWords,
  buildFlaggedClusters,
  computeCostMetrics,
  serializeToSrt,
  serializeToVtt,
} from "../captions";
import { buildX402Challenge, decodeX402Header, encodeX402Header } from "../x402";
import { CaptionWord } from "../types";

const sampleWords: CaptionWord[] = [
  { index: 0, start: 0.2, end: 0.5, aiText: "Today", currentText: "Today", confidence: 0.96, flagged: false },
  { index: 1, start: 0.55, end: 0.9, aiText: "founders", currentText: "founders", confidence: 0.94, flagged: false },
  { index: 2, start: 0.95, end: 1.3, aiText: "use", currentText: "use", confidence: 0.95, flagged: false },
  { index: 3, start: 1.35, end: 1.8, aiText: "Pay stark", currentText: "Pay stark", confidence: 0.48, flagged: true },
  { index: 4, start: 1.85, end: 2.2, aiText: "without", currentText: "without", confidence: 0.92, flagged: false },
  { index: 5, start: 2.25, end: 2.8, aiText: "wall holler.", currentText: "wall holler.", confidence: 0.41, flagged: true },
];

describe("Sikio caption clustering, merging, and SRT/VTT export", () => {
  it("clusters adjacent uncertain words with padded audio excerpt windows", () => {
    const clusters = buildFlaggedClusters(sampleWords, 0.78, 10);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].aiGuess).toBe("Pay stark");
    expect(clusters[0].excerptStart).toBeCloseTo(0.05, 2);
    expect(clusters[0].excerptEnd).toBeCloseTo(3.1, 2);
    expect(clusters[1].aiGuess).toBe("wall holler.");
  });

  it("merges human correction at exact timestamps and exports valid SRT and VTT", () => {
    const merged = applyCorrectionToWords(sampleWords, [3], "Paystack");
    expect(merged[3].currentText).toBe("Paystack");
    expect(merged[3].fixedByHuman).toBe(true);
    expect(merged[3].flagged).toBe(false);

    const srt = serializeToSrt(merged);
    expect(srt).toContain("1\n00:00:00,200 --> 00:00:02,800");
    expect(srt).toContain("Paystack");
    expect(srt).not.toContain("Pay stark");

    const vtt = serializeToVtt(merged);
    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
    expect(vtt).toContain("00:00:00.200 --> 00:00:02.800");
  });

  it("calculates cost per publishable minute and review time savings", () => {
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
    expect(m.reviewTimeSavedPct).toBe(80);
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
