"use client";

import React from "react";
import { motion } from "motion/react";
import { Loader2, Play, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "../ui";
import { SPRING } from "../motion-kit";
import { LANES } from "./LifecycleLanes";

const BLOCK = "rounded-[var(--r)] bg-[var(--panel)] animate-pulse";

/* Loading: the real layout in soft placeholder blocks, so nothing jumps when data lands. */
export function StudioSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8" aria-busy="true" aria-label="Loading the studio">
      <div className="space-y-3">
        <div className={`${BLOCK} h-11 w-3/4 max-w-[520px]`} />
        <div className={`${BLOCK} h-4 w-56 !rounded-full`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        <div className={`${BLOCK} lg:col-span-8 h-[300px] sm:h-[340px]`} />
        <div className={`${BLOCK} lg:col-span-4 h-[300px] sm:h-[340px]`} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {LANES.map((l, i) => (
          <div
            key={l.key}
            className={`rounded-[var(--r)] h-40 sm:h-[220px] ${l.bg} opacity-40 animate-pulse`}
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function StudioLoadError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.soft}
      className="max-w-xl mx-auto mt-6 sm:mt-14 brut bg-[var(--paper)] p-6 sm:p-9 text-center space-y-4"
    >
      <div className="mx-auto w-16 h-16 rounded-full border-2 border-[var(--outline)] bg-[var(--peach)] text-[#111] grid place-items-center shadow-[3px_3px_0_var(--outline)]">
        <WifiOff className="w-7 h-7" aria-hidden="true" />
      </div>
      <h1 className="type-section">The studio could not load</h1>
      <p className="text-[15px] text-[var(--mute)] max-w-[36ch] mx-auto">
        The Sikio server did not answer. Check that it is running, then try again.
      </p>
      <Button variant="primary" onClick={onRetry} disabled={retrying}>
        {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Try again
      </Button>
    </motion.div>
  );
}

/* No clip yet: show the four lanes as the promise, with one clear action. */
export function StudioEmpty({
  clipLabel,
  onRun,
  disabled,
  running,
}: {
  clipLabel: string;
  onRun: () => void;
  disabled: boolean;
  running: boolean;
}) {
  return (
    <div className="brut bg-[var(--paper)] p-5 sm:p-8 h-full flex flex-col gap-6">
      <div className="space-y-2 max-w-[44ch]">
        <h2 className="type-section">Every unsure word gets an ear</h2>
        <p className="text-[15px] text-[var(--mute)]">
          Run the agent on a clip. Each word the AI is unsure of moves through four lanes.
        </p>
      </div>
      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {LANES.map((l, i) => (
          <motion.li
            key={l.key}
            initial={{ opacity: 0, y: 12, rotate: i % 2 ? 1.2 : -1.2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ ...SPRING.soft, delay: 0.08 * i }}
            className={`rounded-[var(--r-sm)] border-2 border-[var(--outline)] ${l.bg} ${l.ink} px-4 py-3`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[14px] font-bold">{l.title}</span>
              <span className="font-mono text-[12px] opacity-60">0{i + 1}</span>
            </div>
            <p className="text-[13px] leading-snug opacity-80">{l.explain}</p>
          </motion.li>
        ))}
      </ol>
      <div className="mt-auto">
        <Button variant="primary" size="lg" onClick={onRun} disabled={disabled || running}>
          {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
          {running ? "Running" : `Run on ${clipLabel}`}
        </Button>
      </div>
    </div>
  );
}
