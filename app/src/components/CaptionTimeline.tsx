"use client";

import React from "react";
import { CaptionWord, ReviewTask } from "@/lib/types";

interface CaptionTimelineProps {
  words: CaptionWord[];
  tasks: ReviewTask[];
  currentTime: number;
  onWordClick: (word: CaptionWord) => void;
}

/*
  Full transcript. Every word can be clicked to seek. Word colour follows the
  lifecycle board: ochre needs an ear, blue heard, green paid once.
*/
export function CaptionTimeline({
  words,
  tasks,
  currentTime,
  onWordClick,
}: CaptionTimelineProps) {
  const taskById = React.useMemo(() => {
    const map = new Map<string, ReviewTask>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

  const flaggedCount = words.filter((w) => w.flagged && !w.fixedByHuman).length;
  const fixedCount = words.filter((w) => w.fixedByHuman).length;

  return (
    <div className="rounded-[var(--r)] hairline bg-[var(--paper)] overflow-hidden">
      <div className="px-4 sm:px-5 py-3 hairline-b flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[var(--ink)]">Transcript</h2>
        <div className="flex items-center gap-3 text-[13px] tabular-nums text-[var(--mute)]">
          <span>{words.length} words</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--signal)]" aria-hidden="true" />
            {flaggedCount} unsure
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--green)]" aria-hidden="true" />
            {fixedCount} fixed
          </span>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6 sm:py-6 text-[18px] sm:text-[20px] leading-[1.85] text-[var(--ink)] flex flex-wrap items-baseline gap-x-1 gap-y-1">
        {words
          .filter((w) => w.currentText.trim().length > 0)
          .map((w) => {
            const linkedTask = w.taskId ? taskById.get(w.taskId) : undefined;
            const isNow =
              currentTime >= w.start - 0.04 && currentTime <= w.end + 0.06;

            let tone = "hover:bg-[var(--hover)] text-[var(--ink)]";
            if (w.fixedByHuman) {
              tone =
                "sikio-verdict bg-[var(--green-bg)] text-[var(--green-ink)] font-semibold";
            } else if (linkedTask?.status === "submitted") {
              tone = "bg-[var(--heard-bg)] text-[var(--heard-ink)] font-semibold";
            } else if (w.flagged) {
              tone = "bg-[var(--signal-bg)] text-[var(--signal-ink)] font-semibold";
            }

            if (isNow) {
              tone += " underline decoration-2 underline-offset-[6px] decoration-[var(--ink)]";
            }

            const titleText = w.fixedByHuman
              ? `${w.start.toFixed(2)}s. AI heard "${w.aiText}", a native speaker wrote "${w.currentText}"`
              : `${w.start.toFixed(2)}s. AI ${Math.round(w.confidence * 100)}% sure`;

            return (
              <button
                key={w.index}
                type="button"
                onClick={() => onWordClick(w)}
                title={titleText}
                className={`px-1 rounded-[5px] transition-colors cursor-pointer ${tone}`}
              >
                <span>{w.currentText}</span>
                {w.flagged && !w.fixedByHuman && (
                  <sup className="ml-0.5 font-mono text-[10px] tabular-nums opacity-80">
                    {Math.round(w.confidence * 100)}%
                  </sup>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}
