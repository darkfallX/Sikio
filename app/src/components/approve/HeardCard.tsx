"use client";

import React from "react";
import { motion } from "motion/react";
import { ArrowDown, ArrowRight, BadgeCheck, Loader2, Pause, Play, Undo2, X } from "lucide-react";
import { ReviewTask } from "@/lib/types";
import { OrganicWaveRibbon } from "@/components/OrganicWaveRibbon";
import { Button, StatusPill } from "@/components/ui";
import { SPRING } from "@/components/motion-kit";

export type TaskAction = "accept" | "reject" | "expire";

/*
  One answer from a native speaker, waiting for the approver.
  Listen to the slice, compare what the AI heard with what the editor heard, then decide.
  Once decided it flies out toward the Settled list and the next card slides up.
*/
export function HeardCard({
  task,
  index,
  isPlaying,
  playTime,
  busyAction,
  disabled,
  onPlay,
  onAction,
  ref,
}: {
  ref?: React.Ref<HTMLElement>;
  task: ReviewTask;
  index: number;
  isPlaying: boolean;
  playTime: number;
  busyAction: TaskAction | null;
  disabled: boolean;
  onPlay: () => void;
  onAction: (action: TaskAction) => void;
}) {
  const dur = Math.max(0.6, task.end - task.start);
  const excerptUrl = `/api/excerpt/${task.clipId}?start=${task.start}&end=${task.end}`;
  const firstName = task.editorName.split(" ")[0];
  const sure = Math.round(task.minConfidence * 100);
  const heardText = task.submittedText?.trim() || task.aiGuess;
  const sameAsAi = heardText.toLowerCase() === task.aiGuess.trim().toLowerCase();
  const fee = task.feeTusd8.toFixed(2);

  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        x: 120,
        y: -24,
        scale: 0.8,
        rotate: 3,
        transition: { duration: 0.42, ease: [0.55, 0, 0.75, 0.2] },
      }}
      transition={{ ...SPRING.soft, delay: Math.min(index, 4) * 0.06 }}
      className="brut-lg bg-[var(--paper)] text-[var(--ink)] p-4 sm:p-7 grid gap-5 sm:gap-6"
      aria-label={`Answer for "${task.aiGuess}" from ${task.editorName}`}
    >
      {/* Top line: state, where in the clip, fee */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <StatusPill status="submitted" />
          <span className="font-bold text-[15px] truncate max-w-[16rem]">{task.clipTitle}</span>
          <span className="font-mono text-[12px] text-[var(--mute)] tabular-nums">
            {task.start.toFixed(1)}s to {task.end.toFixed(1)}s
          </span>
        </div>
        <span className="font-mono text-[13px] font-bold tabular-nums text-[var(--mute)]">
          Fee {fee} tUSD8
        </span>
      </div>

      {/* The diff: what the AI heard vs what the native speaker heard */}
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2 sm:gap-3">
        <div className="pastel-yellow rounded-[18px] border-2 border-[var(--outline)] px-4 py-3.5 sm:px-5 sm:py-4 min-w-0">
          <div className="font-mono text-[12px] font-bold text-[#111]/70">AI heard, {sure}% sure</div>
          <div className="mt-1 font-mono font-bold text-[24px] sm:text-[30px] leading-[1.1] tracking-[-0.04em] line-through decoration-[3px] decoration-[#111]/60 break-words">
            {task.aiGuess}
          </div>
        </div>

        <div className="flex items-center justify-center" aria-hidden="true">
          <span className="w-10 h-10 rounded-full border-2 border-[var(--outline)] bg-[var(--paper)] grid place-items-center">
            <ArrowRight className="w-4 h-4 hidden sm:block" />
            <ArrowDown className="w-4 h-4 sm:hidden" />
          </span>
        </div>

        <div className="pastel-mint rounded-[18px] border-2 border-[var(--outline)] px-4 py-3.5 sm:px-5 sm:py-4 min-w-0">
          <div className="font-mono text-[12px] font-bold text-[#111]/70">
            {firstName} heard{sameAsAi ? ", AI was right" : ""}
          </div>
          <div className="mt-1 font-mono font-bold text-[24px] sm:text-[30px] leading-[1.1] tracking-[-0.04em] break-words">
            {heardText}
          </div>
        </div>
      </div>

      {(task.contextBefore || task.contextAfter) && (
        <p className="text-[15px] text-[var(--ink-2)] leading-relaxed line-clamp-2 -mt-1">
          <span className="text-[var(--mute)]">{task.contextBefore} </span>
          <span className="font-bold text-[var(--ink)] underline decoration-[var(--green)] decoration-[3px] underline-offset-4">
            {heardText}
          </span>
          <span className="text-[var(--mute)]"> {task.contextAfter}</span>
        </p>
      )}

      {/* Listen */}
      <div className="flex items-center gap-3 sm:gap-4">
        <motion.button
          type="button"
          onClick={onPlay}
          whileTap={{ scale: 0.92 }}
          aria-label={isPlaying ? "Pause the excerpt" : `Hear ${dur.toFixed(1)} seconds`}
          className="shrink-0 w-14 h-14 rounded-full bg-[var(--ink)] text-[var(--bg)] border-2 border-[var(--outline)] grid place-items-center cursor-pointer"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </motion.button>
        <div className="flex-1 min-w-0 rounded-full border-2 border-[var(--outline)] bg-[var(--paper)] px-3 sm:px-4 overflow-hidden">
          <OrganicWaveRibbon
            audioUrl={excerptUrl}
            seedKey={task.id}
            duration={dur}
            currentTime={isPlaying ? playTime : 0}
            playing={isPlaying}
            height={48}
            interactive={false}
          />
        </div>
        <span className="hidden sm:block font-mono text-[13px] font-bold tabular-nums text-[var(--mute)] w-12 text-right">
          {(isPlaying ? playTime : dur).toFixed(1)}s
        </span>
      </div>

      {/* Who and decide */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3 min-w-0">
          <span
            aria-hidden="true"
            className="w-11 h-11 shrink-0 rounded-full pastel-pink border-2 border-[var(--outline)] grid place-items-center font-mono font-bold text-[16px]"
          >
            {firstName.charAt(0)}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="font-bold text-[15px] truncate">{task.editorName}</div>
            <div className="text-[13px] text-[var(--mute)]">Native speaker in {task.editorCity}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2.5 sm:gap-3">
          <Button
            variant="pay"
            size="lg"
            disabled={disabled}
            onClick={() => onAction("accept")}
            className="col-span-2 sm:order-3"
          >
            {busyAction === "accept" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <BadgeCheck className="w-5 h-5" />
            )}
            {busyAction === "accept" ? "Paying once" : `Approve and pay ${fee}`}
          </Button>
          <Button
            variant="danger"
            disabled={disabled}
            onClick={() => onAction("reject")}
            className="sm:order-1"
          >
            {busyAction === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Reject
          </Button>
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => onAction("expire")}
            className="sm:order-2"
          >
            {busyAction === "expire" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
            Return fee
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
