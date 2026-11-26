import { describe, expect, it } from "vitest";
import { applyCorrectionToWords, buildFlaggedClusters, serializeToSrt } from "../captions";
import { CaptionWord } from "../types";

// Real Deepgram nova-3 output for the Lagos clip (26 Nov 2026): "Paystack" was heard
// as two words and only the first was below the 0.78 threshold.
const w = (
  index: number,
  text: string,
  confidence: number,
  confidenceSource: CaptionWord["confidenceSource"] = "deepgram-confidence"
): CaptionWord => ({
  index,
  start: index * 0.4,
  end: index * 0.4 + 0.4,
  aiText: text,
  currentText: text,
  confidence,
  confidenceSource,
  flagged: confidence < 0.78,
});

describe("split words from real speech recognition", () => {
  it("covers both halves of a misheard word so the fix leaves nothing behind", () => {
    const words = [w(0, "founders", 0.99), w(1, "use", 0.996), w(2, "PACE", 0.545), w(3, "TAC", 0.92), w(4, "and", 0.993)];
    const [cluster] = buildFlaggedClusters(words, 0.78, 10);
    expect(cluster.aiGuess).toBe("PACE TAC");
    const fixed = applyCorrectionToWords(words, cluster.wordIndices, "Paystack");
    const srt = serializeToSrt(fixed);
    expect(srt).toContain("use Paystack and");
    expect(srt).not.toContain("TAC");
  });

  it("leaves near-certain neighbours alone", () => {
    const words = [w(0, "with", 0.999), w(1, "Tunde", 0.728), w(2, "from", 0.993)];
    expect(buildFlaggedClusters(words, 0.78, 10)[0].aiGuess).toBe("Tunde");
  });

  it("does not change prepared-demo transcripts, whose confidences are authored", () => {
    const words = [w(0, "use", 0.9, "prepared-demo"), w(1, "Pay stark", 0.48, "prepared-demo"), w(2, "and", 0.9, "prepared-demo")];
    expect(buildFlaggedClusters(words, 0.78, 10)[0].aiGuess).toBe("Pay stark");
  });
});
