"use client";

import React from "react";
import { motion } from "motion/react";
import { ExternalLink, Loader2, Pause, Play, Undo2 } from "lucide-react";
import { ReviewTask } from "@/lib/types";
import { explorerTxUrl, shortHash } from "@/lib/aevum";
import { Coin, Sparkle } from "@/components/art";
import { SPRING } from "@/components/motion-kit";

/* A word still waiting for a native speaker. Compact yellow row: hear it, or return the held fee. */
export function WaitingRow({
  task,
  isPlaying,
  busy,
  disabled,
  onPlay,
  onReturn,
}: {
  task: ReviewTask;
  isPlaying: boolean;
  busy: boolean;
  disabled: boolean;
  onPlay: () => void;
  onReturn: () => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, scale: 0.9, transition: { duration: 0.3 } }}
      transition={SPRING.soft}
      className="pastel-yellow min-w-0 rounded-[18px] border-2 border-[var(--outline)] pl-2 pr-2 py-2 flex items-center gap-3"
    >
      <motion.button
        type="button"
        onClick={onPlay}
        whileTap={{ scale: 0.9 }}
        aria-label={isPlaying ? `Pause "${task.aiGuess}"` : `Hear "${task.aiGuess}"`}
        className="shrink-0 w-11 h-11 rounded-full bg-[#111] text-white grid place-items-center cursor-pointer"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </motion.button>
      <div className="flex-1 min-w-0 leading-tight">
        <div className="font-mono font-bold text-[15px] truncate">{task.aiGuess}</div>
        <div className="text-[12.5px] text-[#111]/70 truncate">
          With {task.editorName.split(" ")[0]}, {task.editorCity} · {task.feeTusd8.toFixed(2)} held
        </div>
      </div>
      <button
        type="button"
        onClick={onReturn}
        disabled={disabled}
        className="shrink-0 min-h-[44px] px-3.5 rounded-full border-2 border-[#111] bg-white text-[#111] text-[13px] font-bold inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#111] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
        Return fee
      </button>
    </motion.li>
  );
}

/* A decided task: paid once (mint) or returned (grey). Sandbox hashes are never linked. */
export function SettledRow({ task, celebrate }: { task: ReviewTask; celebrate: boolean }) {
  const paid = task.status === "accepted";
  const heard = task.submittedText?.trim() || task.aiGuess;
  const live = paid && task.settleMode === "aevum-live" && !!task.settleTxHash;
  const reason =
    task.status === "expired"
      ? "Fee returned to the batch"
      : task.rejectionReason
      ? `Rejected: ${task.rejectionReason}`
      : "Rejected, fee returned";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -18, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING.bouncy}
      className={`relative min-w-0 rounded-[18px] border-2 border-[var(--outline)] px-4 py-3 ${
        paid ? "pastel-mint" : "bg-[var(--returned-bg)] text-[var(--ink)]"
      }`}
      style={celebrate ? { boxShadow: "var(--shadow-sm)" } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 leading-tight">
          <div className="font-mono font-bold text-[15px] break-words">
            {paid && heard !== task.aiGuess ? (
              <>
                <span className="line-through opacity-50 font-normal">{task.aiGuess}</span>{" "}
                {heard}
              </>
            ) : paid ? (
              heard
            ) : (
              <span className="opacity-70">{task.aiGuess}</span>
            )}
          </div>
          <div className={`text-[12.5px] mt-1 ${paid ? "text-[#111]/70" : "text-[var(--mute)]"}`}>
            {paid ? `${task.editorName}, ${task.editorCity}` : reason}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono font-bold text-[13px] tabular-nums whitespace-nowrap">
            {paid ? "Paid once" : "Returned"} {task.feeTusd8.toFixed(2)}
          </div>
          {task.settleTxHash &&
            (live ? (
              <a
                href={explorerTxUrl(task.settleTxHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-[28px] font-mono text-[11.5px] font-bold underline underline-offset-2"
              >
                live {shortHash(task.settleTxHash)}
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <div
                className={`font-mono text-[11.5px] mt-0.5 ${paid ? "text-[#111]/60" : "text-[var(--mute)]"}`}
                title="Local sandbox record, not on chain"
              >
                sandbox {task.settleTxHash.slice(0, 8)}
              </div>
            ))}
        </div>
      </div>
      {celebrate && <PaidBurst label={task.feeTusd8.toFixed(2)} />}
    </motion.li>
  );
}

/* The paid moment: a coin drops onto the row with a few sparkles, then settles away. */
function PaidBurst({ label }: { label: string }) {
  const sparks = [
    { x: -46, y: -30, s: 18, d: 0.12, c: "#ffc8ea" },
    { x: 28, y: -40, s: 14, d: 0.2, c: "#b8efff" },
    { x: 40, y: 8, s: 16, d: 0.28, c: "#fff27a" },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -top-5 right-3 w-12 h-12">
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.3, rotate: -40 }}
        animate={{
          opacity: [0, 1, 1, 0],
          y: [-40, 0, 0, -6],
          scale: [0.3, 1.08, 1, 0.9],
          rotate: [-40, 8, 0, 0],
        }}
        transition={{ duration: 2.2, times: [0, 0.22, 0.8, 1], ease: [0.22, 1, 0.36, 1] }}
      >
        <Coin size={44} label={label} />
      </motion.div>
      {sparks.map((p, i) => (
        <motion.div
          key={i}
          className="absolute left-3 top-3"
          initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], x: p.x, y: p.y, scale: [0, 1, 0.6], rotate: 90 }}
          transition={{ duration: 1.1, delay: p.d, ease: [0.22, 1, 0.36, 1] }}
        >
          <Sparkle size={p.s} color={p.c} />
        </motion.div>
      ))}
    </div>
  );
}
