"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui";
import { IllustrationEar, Sparkle } from "@/components/art";

const bone = "bg-[var(--panel)] animate-pulse";

/* Phone first: header, thread, side. On desktop the thread sits on the right
   as the hero object and the header and side column stack on the left. */
export const EAR_GRID =
  "grid items-start gap-6 [grid-template-areas:'head'_'thread'_'side'] lg:[grid-template-areas:'head_thread'_'side_thread'] lg:grid-cols-[minmax(0,400px)_minmax(0,460px)] lg:grid-rows-[auto_1fr] lg:justify-center lg:gap-x-16 lg:gap-y-10";

/* Loading: the same shape as the real screen, a phone thread and a side column. */
export function EarSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your words" className={EAR_GRID}>
      <div className="[grid-area:head] space-y-4">
        <div className={`h-11 w-28 rounded-[14px] ${bone}`} />
        <div className={`h-4 w-48 rounded-full ${bone}`} />
        <div className={`h-[52px] w-full max-w-[360px] rounded-full ${bone}`} />
      </div>
      <div className="[grid-area:thread] rounded-[32px] border-2 border-[var(--line)] bg-[var(--paper)] overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b-2 border-[var(--line)]">
          <div className={`w-11 h-11 rounded-full ${bone}`} />
          <div className="space-y-2 flex-1">
            <div className={`h-3.5 w-28 rounded-full ${bone}`} />
            <div className={`h-3 w-40 rounded-full ${bone}`} />
          </div>
        </div>
        <div className="p-4 space-y-3 bg-[var(--bg)] min-h-[340px]">
          <div className={`h-[112px] w-[88%] rounded-[22px] rounded-bl-[8px] ${bone}`} />
          <div className={`h-[92px] w-[78%] rounded-[22px] rounded-bl-[8px] ${bone}`} />
          <div className={`h-11 w-[58%] rounded-[22px] rounded-bl-[8px] ${bone}`} />
        </div>
        <div className="p-4 border-t-2 border-[var(--line)] flex gap-2.5">
          <div className={`h-[52px] flex-1 rounded-full ${bone}`} />
          <div className={`h-[52px] w-[52px] rounded-full ${bone}`} />
        </div>
      </div>
      <div className="[grid-area:side] space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className={`h-[104px] rounded-[22px] ${bone}`} />
          <div className={`h-[104px] rounded-[22px] ${bone}`} />
        </div>
        <div className={`h-[170px] rounded-[22px] ${bone}`} />
      </div>
    </div>
  );
}

export function EarLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="max-w-md mx-auto brut bg-[var(--paper)] p-6 sm:p-8 space-y-4 sikio-rise">
      <span className="w-12 h-12 rounded-full bg-[var(--error-bg)] text-[var(--error)] border-2 border-[var(--outline)] grid place-items-center" aria-hidden="true">
        <CircleAlert className="w-5 h-5" />
      </span>
      <h1 className="type-section text-[var(--ink)]">Could not load your words</h1>
      <p className="text-[15px] text-[var(--mute)]">Check your connection and try again. Nothing you sent is lost.</p>
      <Button variant="primary" onClick={onRetry}>
        <RotateCcw className="w-4 h-4" aria-hidden="true" /> Try again
      </Button>
    </div>
  );
}

/* Empty thread: nothing to hear right now. */
export function EmptyThread({ forName }: { forName?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-4 py-10"
    >
      <div className="relative">
        <div className="w-28 h-28 rounded-full bg-[var(--sky)] border-2 border-[var(--outline)] grid place-items-center sikio-float" style={{ boxShadow: "4px 4px 0 var(--outline)" }}>
          <IllustrationEar className="w-20 h-20 text-[#111]" />
        </div>
        <Sparkle size={26} color="#fff27a" className="absolute -top-2 -right-3" />
      </div>
      <div className="space-y-1.5 max-w-[30ch]">
        <p className="font-mono font-bold text-[19px] leading-tight tracking-[-0.04em] text-[var(--ink)]">
          No words waiting for you right now
        </p>
        <p className="text-[14px] text-[var(--mute)]">
          {forName ? `When a clip has a word for ${forName}, it lands here.` : "When a clip has a word the AI could not hear, it lands here."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        <ButtonLink href="/studio" variant="primary" size="sm">Run a clip in Studio</ButtonLink>
        <ButtonLink href="/approve" variant="secondary" size="sm">Approve answers</ButtonLink>
      </div>
    </motion.div>
  );
}
