"use client";

import React from "react";
import { motion } from "motion/react";
import { CountUp } from "@/components/motion-kit";

/*
  Real numbers from the Lagos demo clip (17.4 s): $0.04 for the AI transcript
  plus 5 flagged words at $0.10 = $0.54, which is $1.86 per minute.
  $3.50 per minute is the full human pass baseline used in lib/captions.ts.
*/
const SIKIO = 1.86;
const FULL = 3.5;

function Bar({ fraction, tone, delay }: { fraction: number; tone: string; delay: number }) {
  return (
    <div className="h-5 w-full overflow-hidden rounded-full border-2 border-[var(--outline)] bg-[var(--bg)]">
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: fraction }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay }}
        style={{ transformOrigin: "0% 50%", background: tone }}
        className="h-full w-full rounded-full border-r-2 border-[#111]"
      />
    </div>
  );
}

export function CostCompare() {
  return (
    <div className="brut-lg bg-[var(--paper)] p-6 sm:p-9">
      <p className="type-label">Lagos demo clip, cost per minute</p>

      <div className="mt-6">
        <div className="flex items-end justify-between gap-4">
          <span className="text-[15px] font-bold">With Sikio</span>
          <CountUp
            value={SIKIO}
            prefix="$"
            className="font-display text-[clamp(3rem,8vw,5.25rem)] leading-[0.9] text-[var(--ink)]"
          />
        </div>
        <div className="mt-3">
          <Bar fraction={SIKIO / FULL} tone="var(--mint)" delay={0.15} />
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <span className="text-[15px] font-bold text-[var(--ink-2)]">Full human pass</span>
          <span className="font-display text-[clamp(1.6rem,3.5vw,2.25rem)] leading-none text-[var(--mute)] tabular-nums">
            $3.50
          </span>
        </div>
        <div className="mt-3">
          <Bar fraction={1} tone="var(--returned-bg)" delay={0} />
        </div>
      </div>

      <p className="mt-7 font-mono text-[12px] leading-relaxed text-[var(--mute)]">
        $0.04 AI transcript + 5 words at $0.10, on a 17 second clip.
      </p>
    </div>
  );
}
