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
    <div className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4]">
      <div className="px-5 py-3 border-b border-[#DDD7CA] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#847D72]">
            Script
          </span>
          <h2 className="text-sm font-semibold text-[#141311]">
            Timed Word Confidence
          </h2>
        </div>

        <div className="flex items-center gap-2.5 text-xs tabular-nums font-mono">
          <span className="text-[#5C574E]">{words.length}w</span>
          <span className="px-2 py-0.5 rounded-[4px] bg-[#FAEAE4] text-[#C94A22] font-medium">
            {flaggedCount} flagged
          </span>
          <span className="px-2 py-0.5 rounded-[4px] bg-[#E7F4ED] text-[#1B6B46] font-medium">
            {fixedCount} fixed
          </span>
        </div>
      </div>

      <div className="p-5 leading-[2.2] text-[16px] text-[#141311] flex flex-wrap gap-x-1.5 gap-y-1.5">
        {words
          .filter((w) => w.currentText.trim().length > 0)
          .map((w) => {
            const linkedTask = w.taskId ? taskById.get(w.taskId) : undefined;
            const isNow =
              currentTime >= w.start - 0.04 && currentTime <= w.end + 0.06;

            let tone =
              "hover:bg-[#EBE6DB] text-[#141311] border-b border-transparent";
            if (w.fixedByHuman) {
              tone =
                "bg-[#E7F4ED] text-[#1B6B46] border-b-2 border-[#1B6B46] font-medium";
            } else if (linkedTask?.status === "submitted") {
              tone =
                "bg-[#FBF2DD] text-[#945D00] border-b-2 border-[#D4941A] font-medium";
            } else if (w.flagged) {
              tone =
                "bg-[#FAEAE4] text-[#B33C17] border-b-2 border-[#C94A22] font-medium";
            }

            if (isNow) {
              tone += " ring-2 ring-[#141311] ring-offset-1 ring-offset-[#FBF9F4]";
            }

            return (
              <button
                key={w.index}
                type="button"
                onClick={() => onWordClick(w)}
                title={`${w.start.toFixed(2)}s · AI ${Math.round(
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
