"use client";

import React from "react";
import { CaptionWord, ReviewTask } from "@/lib/types";
import { segmentWords, WORD_PILL } from "./studio/wordStates";

interface CaptionTimelineProps {
  words: CaptionWord[];
  tasks: ReviewTask[];
  currentTime: number;
  onWordClick: (word: CaptionWord) => void;
  /** Show what the AI heard before any human fixes */
  raw?: boolean;
  threshold?: number;
}

/*
  Full transcript, rendered inside the listening card (no box of its own).
  Every word seeks the player. Unsure spans are pills in their lane colour.
*/
export function CaptionTimeline({
  words,
  tasks,
  currentTime,
  onWordClick,
  raw = false,
  threshold = 0.78,
}: CaptionTimelineProps) {
  const taskById = React.useMemo(() => {
    const map = new Map<string, ReviewTask>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

  const segments = React.useMemo(
    () => segmentWords(words, taskById, raw, threshold),
    [words, taskById, raw, threshold]
  );

  return (
    <p className="text-[17px] sm:text-[18px] leading-[2.05] text-[var(--ink)]">
      {segments.map((seg) => {
        const isNow = currentTime >= seg.start - 0.04 && currentTime <= seg.end + 0.06;
        const first = seg.words[0];
        const title =
          seg.state === "fixed" && !raw
            ? `${seg.start.toFixed(1)}s. AI heard "${seg.words.map((w) => w.aiText).join(" ")}"`
            : `${seg.start.toFixed(1)}s. AI ${Math.round(
                Math.min(...seg.words.map((w) => w.confidence)) * 100
              )}% sure`;
        const pill =
          seg.state === "plain"
            ? `px-[3px] rounded-[8px] hover:bg-[var(--hover)] ${isNow ? "bg-[var(--hover)]" : ""}`
            : `mx-[2px] px-[0.35em] rounded-[10px] border-2 border-[var(--outline)] font-bold ${WORD_PILL[seg.state]}`;
        return (
          <React.Fragment key={seg.key}>
            <button
              type="button"
              onClick={() => onWordClick(first)}
              title={title}
              className={`[box-decoration-break:clone] cursor-pointer transition-colors ${pill} ${
                isNow ? "underline decoration-2 underline-offset-[5px]" : ""
              }`}
            >
              {seg.text}
            </button>{" "}
          </React.Fragment>
        );
      })}
    </p>
  );
}
