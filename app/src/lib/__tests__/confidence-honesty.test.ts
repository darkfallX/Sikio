import { describe, it, expect } from "vitest";
import { buildCustomTranscript, buildShowcaseTranscript } from "../clips";

describe("confidence honesty", () => {
  it("never fabricates a transcript when none is provided", () => {
    expect(() =>
      buildCustomTranscript({
        durationSeconds: 14,
        rawTranscript: "",
        confidenceThreshold: 0.78,
      })
    ).toThrow(/never fabricates/);
    expect(() =>
      buildCustomTranscript({
        durationSeconds: 14,
        confidenceThreshold: 0.78,
      })
    ).toThrow();
  });

  it("flags local names and slang with a stated lexical reason, not a model score", () => {
    const words = buildCustomTranscript({
      durationSeconds: 10,
      rawTranscript: "We rode the matatu past Ngong road to Safaricom house in 2026",
      confidenceThreshold: 0.78,
    });

    // Every custom word is honestly attributed to the lexical heuristic.
    expect(words.every((w) => w.confidenceSource === "lexical-heuristic")).toBe(true);

    const byText = (t: string) => words.find((w) => w.aiText.replace(/[.,]/g, "") === t);

    // Out-of-vocabulary Swahili slang is flagged with a reason.
    expect(byText("matatu")?.flagged).toBe(true);
    expect(byText("matatu")?.flagReason).toMatch(/out-of-vocabulary/);

    // Proper nouns (places/brands) are flagged as proper nouns.
    expect(byText("Ngong")?.flagged).toBe(true);
    expect(byText("Ngong")?.flagReason).toMatch(/proper noun/);
    expect(byText("Safaricom")?.flagReason).toMatch(/proper noun/);

    // A number is flagged for its own reason.
    expect(byText("2026")?.flagReason).toMatch(/number/);

    // Everyday English words are NOT flagged (no false positives on common vocabulary).
    expect(byText("the")?.flagged).toBe(false);
    expect(byText("to")?.flagged).toBe(false);
    expect(byText("rode")?.flagged).toBe(false);
    expect(byText("past")?.flagged).toBe(false);
    expect(byText("house")?.flagged).toBe(false);
  });

  it("labels bundled showcase clips as prepared-demo, not model output", () => {
    const { words } = buildShowcaseTranscript("lagos-fintech-ep14", 0.78);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w.confidenceSource === "prepared-demo")).toBe(true);
    // The authored hard spot ("Pay stark" for Paystack) is genuinely below threshold.
    const payStark = words.find((w) => w.aiText.startsWith("Pay stark"));
    expect(payStark?.flagged).toBe(true);
  });
});
