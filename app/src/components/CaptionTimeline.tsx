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
    <div className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-[#E2DDD2]">
        <h2 className="text-sm font-semibold text-[#161513]">
          Word-Level Confidence Transcript
        </h2>
        <div className="flex items-center gap-3 text-xs tabular-nums">
          <span className="text-[#5C584F]">{words.length} words</span>
          <span className="px-2 py-0.5 rounded-[4px] bg-[#F9EAE4] text-[#B8381A] font-medium">
            {flaggedCount} flagged
          </span>
          <span className="px-2 py-0.5 rounded-[4px] bg-[#E9F4EE] text-[#1D6B48] font-medium">
            {fixedCount} fixed
          </span>
        </div>
      </div>

      <div className="leading-[2.15] text-[15.5px] text-[#161513] flex flex-wrap gap-x-1.5 gap-y-1">
        {words
          .filter((w) => w.currentText.trim().length > 0)
          .map((w) => {
            const linkedTask = w.taskId ? taskById.get(w.taskId) : undefined;
            const isNow =
              currentTime >= w.start - 0.04 && currentTime <= w.end + 0.06;

            let tone =
              "hover:bg-[#EFECE4] text-[#161513] border-b border-transparent";
            if (w.fixedByHuman) {
              tone =
                "bg-[#E9F4EE] text-[#1D6B48] border-b-2 border-[#1D6B48] font-medium";
            } else if (linkedTask?.status === "submitted") {
              tone =
                "bg-[#FBF2DE] text-[#945F00] border-b-2 border-[#D4941A] font-medium";
            } else if (w.flagged) {
              tone =
                "bg-[#F9EAE4] text-[#B8381A] border-b-2 border-[#C54B24] font-medium";
            }

            if (isNow) {
              tone += " ring-1 ring-[#161513]";
            }

            return (
              <button
                key={w.index}
                type="button"
                onClick={() => onWordClick(w)}
                title={`${w.start.toFixed(2)}s · AI confidence ${Math.round(
                  w.confidence * 100
                )}%${w.fixedByHuman ? ` · Original AI: "${w.aiText}"` : ""}`}
                className={`px-1.5 py-0.5 rounded-[4px] transition-colors cursor-pointer ${tone}`}
              >
                <span>{w.currentText}</span>
                {w.flagged && !w.fixedByHuman && (
                  <span className="ml-1 text-[10px] font-mono opacity-80">
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
