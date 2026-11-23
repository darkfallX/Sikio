"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Check, RotateCcw } from "lucide-react";

/*
  A real line from the Lagos demo clip. The flagged words, the AI confidence
  and the timestamps come from the clip's own data.
*/
type Fix = { heard: string; fixed: string; conf: number; at: string };
type Seg = string | Fix;

const LINE: Seg[] = [
  "…founders use ",
  { heard: "Pay stark", fixed: "Paystack", conf: 48, at: "0:06.5" },
  " and Flutterwave to settle ",
  { heard: "Nara", fixed: "Naira", conf: 61, at: "0:08.4" },
  " payouts without ",
  { heard: "wall holler", fixed: "wahala", conf: 41, at: "0:09.6" },
  ". Even when ",
  { heard: "down for", fixed: "danfo", conf: 52, at: "0:11.5" },
  " traffic holds you…",
];

const FIX_COUNT = LINE.filter((s) => typeof s !== "string").length;
/* index of each fix within the line, so render stays pure */
const FIX_INDEX = LINE.map((s, i) =>
  typeof s === "string" ? -1 : LINE.slice(0, i).filter((x) => typeof x !== "string").length
);
const MAX_T = FIX_COUNT * 2;
const FLIP = { type: "spring", stiffness: 300, damping: 20 } as const;

function Word({ fix, t, index }: { fix: Fix; t: number; index: number }) {
  const struck = t >= index * 2 + 1;
  const fixed = t >= index * 2 + 2;
  return (
    <span className="relative mx-[0.08em] inline-grid align-baseline" style={{ perspective: 700 }}>
      {/* the misheard word */}
      <motion.span
        aria-hidden={fixed}
        initial={false}
        animate={fixed ? { rotateX: 90, opacity: 0, y: -6 } : { rotateX: 0, opacity: 1, y: 0 }}
        transition={fixed ? { duration: 0.22, ease: [0.4, 0, 1, 1] } : FLIP}
        style={{ gridArea: "1 / 1", transformOrigin: "50% 0%" }}
        className="relative whitespace-nowrap rounded-[0.35em] border-2 border-[#111] bg-[var(--yellow)] px-[0.25em] py-[0.06em] leading-[1.2] text-center font-bold text-[#111]"
      >
        {fix.heard}
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{ scaleX: struck ? 1 : 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "0% 50%" }}
          className="absolute left-[0.2em] right-[0.2em] top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#111]"
        />
        <span className="absolute -top-[1.9em] left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] font-bold text-[var(--flag-ink)] sm:text-[12px]">
          {fix.conf}% sure
        </span>
      </motion.span>

      {/* what the Lagos ear heard */}
      <motion.span
        aria-hidden={!fixed}
        initial={false}
        animate={fixed ? { rotateX: 0, opacity: 1, y: 0 } : { rotateX: -90, opacity: 0, y: 6 }}
        transition={fixed ? { ...FLIP, delay: 0.12 } : { duration: 0.18 }}
        style={{ gridArea: "1 / 1", transformOrigin: "50% 100%" }}
        className="relative whitespace-nowrap rounded-[0.35em] border-2 border-[#111] bg-[var(--mint)] px-[0.25em] py-[0.06em] leading-[1.2] text-center font-bold text-[#111] shadow-[3px_3px_0_#111]"
      >
        {fix.fixed}
        <span className="absolute -top-[1.9em] left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap font-mono text-[11px] font-bold text-[var(--paid-ink)] sm:text-[12px]">
          <Check className="h-3 w-3" strokeWidth={3.2} />
          {fix.at}
        </span>
      </motion.span>
    </span>
  );
}

export function FixItDemo() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.55 });
  const [t, setT] = useState(0);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const play = useCallback(() => {
    clear();
    if (reduce) {
      setT(MAX_T);
      return;
    }
    setT(0);
    for (let step = 1; step <= MAX_T; step++) {
      // strike, short pause, flip; then a breath before the next word
      const at = 500 + Math.floor((step - 1) / 2) * 900 + ((step - 1) % 2) * 380;
      timers.current.push(window.setTimeout(() => setT(step), at));
    }
  }, [reduce]);

  useEffect(() => {
    if (inView) play();
    return clear;
  }, [inView, play]);

  const done = t >= MAX_T;

  return (
    <div ref={ref}>
      <p className="sr-only">
        The AI heard Pay stark, Nara, wall holler and down for. A Lagos editor corrected them to Paystack,
        Naira, wahala and danfo.
      </p>
      <p
        aria-hidden="true"
        className="text-[clamp(1.45rem,3.4vw,2.6rem)] font-medium leading-[2.15] tracking-[-0.02em] text-[var(--ink)]"
      >
        {LINE.map((seg, i) => {
          if (typeof seg === "string") return <React.Fragment key={i}>{seg}</React.Fragment>;
          return <Word key={i} fix={seg} t={t} index={FIX_INDEX[i]} />;
        })}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-[var(--ink-2)]">
          <span className="h-4 w-4 rounded-[5px] border-2 border-[#111] bg-[var(--yellow)]" aria-hidden="true" />
          What the AI heard
        </span>
        <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-[var(--ink-2)]">
          <span className="h-4 w-4 rounded-[5px] border-2 border-[#111] bg-[var(--mint)]" aria-hidden="true" />
          What a Lagos ear heard
        </span>
        <button
          type="button"
          onClick={() => {
            if (reduce) {
              setT((v) => (v >= MAX_T ? 0 : MAX_T));
              return;
            }
            play();
          }}
          className="ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-[var(--outline)] bg-[var(--paper)] px-4 text-[14px] font-bold text-[var(--ink)] press shadow-[3px_3px_0_var(--outline)]"
        >
          <RotateCcw className="h-4 w-4" />
          {reduce ? (done ? "Show what the AI heard" : "Show the fix") : "Play again"}
        </button>
      </div>
    </div>
  );
}
