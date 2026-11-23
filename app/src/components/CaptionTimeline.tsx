"use client";

import React from "react";
import { CaptionWord, ReviewTask } from "@/lib/types";

interface CaptionTimelineProps {
  words: CaptionWord[];
  tasks: ReviewTask[];
  currentTime: number;
  onWordClick: (word: CaptionWord) => void;
}

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

  const flaggedCount = words.filter((w) => w.flagged).length;
  const fixedCount = words.filter((w) => w.fixedByHuman).length;

  return (
    <div className="rounded-[14px] hairline bg-[var(--paper)] overflow-hidden">
      <div className="px-5 py-3.5 hairline-b flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-label">Timed transcript</h2>
        <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
          <span className="text-[var(--mute)]">{words.length} words</span>
          <span className="px-2 py-0.5 rounded-full bg-[var(--signal-bg)] text-[var(--signal-ink)] font-medium">
            {flaggedCount} flagged
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[var(--green-bg)] text-[var(--green)] font-medium">
            {fixedCount} fixed
          </span>
        </div>
      </div>

      <div className="p-5 leading-[2.25] text-[16px] text-[var(--ink)] flex flex-wrap gap-x-1.5 gap-y-1.5">
        {words
          .filter((w) => w.currentText.trim().length > 0)
          .map((w) => {
            const linkedTask = w.taskId ? taskById.get(w.taskId) : undefined;
            const isNow =
              currentTime >= w.start - 0.04 && currentTime <= w.end + 0.06;

            let tone =
              "hover:bg-[var(--hover)] text-[var(--ink)] border-b-2 border-transparent";
            if (w.fixedByHuman) {
              tone =
                "bg-[var(--green-bg)] text-[var(--green)] border-b-2 border-[var(--green)] font-semibold";
            } else if (linkedTask?.status === "submitted") {
              tone =
                "bg-[var(--amber-bg)] text-[var(--amber)] border-b-2 border-[var(--amber)] font-semibold";
            } else if (w.flagged) {
              tone =
                "bg-[var(--signal-bg)] text-[var(--signal-ink)] border-b-2 border-[var(--signal)] font-semibold";
            }

            if (isNow) {
              tone += " ring-2 ring-[var(--ink)] ring-offset-1 ring-offset-[var(--paper)]";
            }

            return (
              <button
                key={w.index}
                type="button"
                onClick={() => onWordClick(w)}
                title={`${w.start.toFixed(2)}s · ${Math.round(w.confidence * 100)}%`}
                className={`px-1.5 py-0.5 rounded-[6px] transition-colors cursor-pointer ${tone}`}
              >
                <span>{w.currentText}</span>
                {w.flagged && !w.fixedByHuman && (
                  <span className="ml-1 font-mono text-[10px] tabular-nums opacity-80">
                    {Math.round(w.confidence * 100)}%
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}
