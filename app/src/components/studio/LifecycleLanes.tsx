"use client";

import React from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowUpRight, Check, ExternalLink, Headphones, Loader2, Undo2, X } from "lucide-react";
import { ReviewTask } from "@/lib/types";
import { explorerTxUrl, shortHash } from "@/lib/aevum";
import { Sparkle } from "../art";
import { SPRING } from "../motion-kit";

export type LaneKey = "offered" | "submitted" | "accepted" | "returned";

export const LANES: {
  key: LaneKey;
  title: string;
  bg: string;
  ink: string;
  empty: string;
  explain: string;
}[] = [
  {
    key: "offered",
    title: "Needs an ear",
    bg: "bg-[var(--flag-bg)]",
    ink: "text-[var(--on-pastel)]",
    empty: "No unsure words.",
    explain: "The AI marks words it is unsure of.",
  },
  {
    key: "submitted",
    title: "Heard",
    bg: "bg-[var(--heard-bg)]",
    ink: "text-[var(--on-pastel)]",
    empty: "Answers from Ear land here.",
    explain: "A native speaker hears just those seconds.",
  },
  {
    key: "accepted",
    title: "Paid once",
    bg: "bg-[var(--paid-bg)]",
    ink: "text-[var(--on-pastel)]",
    empty: "Approved fixes land here.",
    explain: "You approve and they are paid exactly once.",
  },
  {
    key: "returned",
    title: "Returned",
    bg: "bg-[var(--returned-bg)]",
    ink: "text-[var(--ink)]",
    empty: "Unused fees come back here.",
    explain: "Rejected or unused fees go back to the budget.",
  },
];

export function laneOf(t: ReviewTask): LaneKey {
  if (t.status === "offered") return "offered";
  if (t.status === "submitted") return "submitted";
  if (t.status === "accepted") return "accepted";
  return "returned";
}

const usd = (n: number) => `$${n.toFixed(2)}`;

interface LanesProps {
  jobId: string;
  tasks: ReviewTask[];
  busyTaskId: string | null;
  celebrateId: string | null;
  playingTaskId: string | null;
  onSeek: (t: ReviewTask) => void;
  onAction: (t: ReviewTask, a: "accept" | "reject" | "expire") => void;
}

export const LifecycleLanes = React.memo(function LifecycleLanes({
  jobId,
  tasks,
  busyTaskId,
  celebrateId,
  playingTaskId,
  onSeek,
  onAction,
}: LanesProps) {
  const grouped: Record<LaneKey, ReviewTask[]> = {
    offered: [],
    submitted: [],
    accepted: [],
    returned: [],
  };
  for (const t of tasks) grouped[laneOf(t)].push(t);

  return (
    <LayoutGroup id={`lanes-${jobId}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 items-start gap-3 sm:gap-4">
        {LANES.map((lane) => {
          const items = grouped[lane.key];
          return (
            <section
              key={lane.key}
              aria-label={`${lane.title}, ${items.length}`}
              className={`brut-flat ${lane.bg} ${lane.ink} p-3 sm:p-4 flex flex-col gap-3 min-w-0 sm:min-h-[200px]`}
            >
              <header className="flex items-center justify-between gap-2 px-1 pt-0.5">
                <h3 className="font-mono text-[14px] font-bold tracking-[-0.02em]">{lane.title}</h3>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={items.length}
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.3, opacity: 0 }}
                    transition={SPRING.bouncy}
                    className="min-w-[28px] h-7 px-2 grid place-items-center rounded-full bg-[#111] text-white font-mono text-[13px] font-bold tabular-nums"
                  >
                    {items.length}
                  </motion.span>
                </AnimatePresence>
              </header>

              {items.length === 0 ? (
                <motion.p
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  className="px-1 text-[13px] leading-snug"
                >
                  {lane.empty}
                </motion.p>
              ) : (
                items.map((t) => (
                  <WordCard
                    key={t.id}
                    task={t}
                    busy={busyTaskId === t.id}
                    celebrate={celebrateId === t.id}
                    playing={playingTaskId === t.id}
                    onSeek={onSeek}
                    onAction={onAction}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>
    </LayoutGroup>
  );
});

function WordCard({
  task: t,
  busy,
  celebrate,
  playing,
  onSeek,
  onAction,
}: {
  task: ReviewTask;
  busy: boolean;
  celebrate: boolean;
  playing: boolean;
  onSeek: (t: ReviewTask) => void;
  onAction: (t: ReviewTask, a: "accept" | "reject" | "expire") => void;
}) {
  const changed = !!t.submittedText && t.submittedText !== t.aiGuess;
  const live = t.settleMode === "aevum-live";
  const word = t.aiGuess.replace(/[.,!?;:]+$/, "");
  const fixed = (t.submittedText || "").replace(/[.,!?;:]+$/, "");

  let meta: string;
  if (t.status === "offered") meta = `${t.focusStart.toFixed(1)}s · ${Math.round(t.minConfidence * 100)}% sure`;
  else if (t.status === "submitted") meta = `${t.editorName.split(" ")[0]} · ${t.editorCity}`;
  else if (t.status === "accepted") meta = `${usd(t.feeTusd8)} to ${t.editorName.split(" ")[0]}`;
  else meta = `${usd(t.feeTusd8)} back${t.status === "expired" ? " after expiry" : ""}`;

  return (
    <motion.article
      layoutId={`word-${t.id}`}
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{
        opacity: 1,
        scale: 1,
        boxShadow: playing ? "4px 4px 0 var(--outline)" : "0px 0px 0 var(--outline)",
      }}
      transition={SPRING.soft}
      className="relative rounded-[var(--r-sm)] border-2 border-[var(--outline)] bg-[var(--paper)] text-[var(--ink)]"
    >
      <button
        type="button"
        onClick={() => onSeek(t)}
        aria-label={`Hear "${word}" at ${t.focusStart.toFixed(1)} seconds`}
        className="w-full text-left px-3.5 pt-3 pb-2 rounded-[var(--r-sm)] cursor-pointer group"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[17px] font-bold leading-snug break-words min-w-0">
            {t.status === "offered" || !t.submittedText ? (
              word
            ) : changed ? (
              <>
                <s className="font-medium text-[var(--mute)] decoration-2">{word}</s> {fixed}
              </>
            ) : (
              fixed
            )}
          </span>
          <Headphones
            aria-hidden="true"
            className={`w-4 h-4 mt-1 shrink-0 transition-opacity ${
              playing ? "opacity-100" : "opacity-30 group-hover:opacity-80"
            }`}
          />
        </div>
        <div className="mt-0.5 font-mono text-[11.5px] text-[var(--mute)] tabular-nums">
          {meta}
          {t.status !== "offered" && t.confirmedAiRight && " · AI was right"}
        </div>
      </button>

      {t.status === "offered" && (
        <div className="px-3 pb-3 flex flex-wrap items-center gap-1.5">
          <Link
            href="/ear"
            className="min-h-[44px] sm:min-h-[34px] px-3 inline-flex items-center gap-1 rounded-full border-2 border-[var(--outline)] bg-[var(--paper)] text-[12.5px] font-bold hover:bg-[var(--hover)]"
          >
            Ear <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction(t, "expire")}
            className="min-h-[44px] sm:min-h-[34px] px-3 inline-flex items-center gap-1 rounded-full text-[12.5px] font-bold text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
            Return fee
          </button>
        </div>
      )}

      {t.status === "submitted" && (
        <div className="px-3 pb-2 space-y-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction(t, "accept")}
            className="w-full min-h-[44px] px-3 inline-flex items-center justify-center gap-1.5 brut-sm press !rounded-full bg-[var(--mint)] text-[var(--on-pastel)] text-[13px] font-bold cursor-pointer disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={3} />}
            {busy ? "Paying" : `Approve and pay ${usd(t.feeTusd8)}`}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction(t, "reject")}
            className="min-h-[44px] sm:min-h-[34px] px-3 inline-flex items-center gap-1 rounded-full text-[12.5px] font-bold text-[var(--error)] hover:bg-[var(--error-bg)] cursor-pointer disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" strokeWidth={3} /> Reject
          </button>
        </div>
      )}

      {t.status === "accepted" && (
        <div className="px-3.5 pb-3 flex items-center justify-between gap-2 text-[11.5px] font-mono">
          <span className="inline-flex items-center gap-1 font-bold text-[var(--paid-ink)]">
            <Check className="w-3.5 h-3.5" strokeWidth={3} /> Paid once
          </span>
          {t.settleTxHash && live ? (
            <a
              href={explorerTxUrl(t.settleTxHash)}
              target="_blank"
              rel="noreferrer"
              className="min-h-[44px] sm:min-h-[32px] inline-flex items-center gap-1 font-bold text-[var(--paid-ink)] hover:underline"
            >
              {shortHash(t.settleTxHash)} <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-[var(--mute)]">sandbox</span>
          )}
        </div>
      )}

      <AnimatePresence>{celebrate && <PaidBurst key="burst" amount={usd(t.feeTusd8)} />}</AnimatePresence>
    </motion.article>
  );
}

/* A small moment when a fix is paid: sparkles fly out and the amount floats up. */
const SPARKS = [
  { x: -58, y: -34, c: "#ffc8ea", r: -20, s: 18 },
  { x: 54, y: -40, c: "#fff27a", r: 15, s: 22 },
  { x: -70, y: 10, c: "#b8efff", r: 0, s: 14 },
  { x: 72, y: 6, c: "#c6f4c1", r: 30, s: 16 },
  { x: -24, y: -56, c: "#e2d4ff", r: 10, s: 14 },
  { x: 26, y: -60, c: "#ffd7b5", r: -10, s: 18 },
];

function PaidBurst({ amount }: { amount: string }) {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <motion.span
        className="absolute inset-0 rounded-[var(--r-sm)] bg-[var(--mint)]"
        initial={{ opacity: 0.85 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      <div className="absolute left-1/2 top-1/2">
        {SPARKS.map((p, i) => (
          <motion.span
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
            animate={{ x: p.x, y: p.y, scale: [0, 1.15, 0.9], rotate: p.r + 90, opacity: [1, 1, 0] }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: i * 0.025 }}
          >
            <Sparkle size={p.s} color={p.c} />
          </motion.span>
        ))}
        <motion.span
          className="absolute -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full border-2 border-[#111] bg-[#fff27a] text-[#111] font-mono text-[14px] font-bold shadow-[3px_3px_0_#111]"
          initial={{ y: -10, scale: 0.4, opacity: 0 }}
          animate={{ y: [-10, -52, -64], scale: [0.4, 1.1, 1], opacity: [0, 1, 0] }}
          transition={{ duration: 1.6, times: [0, 0.35, 1], ease: [0.22, 1, 0.36, 1] }}
        >
          +{amount}
        </motion.span>
      </div>
    </motion.div>
  );
}
