"use client";

import React from "react";
import { motion } from "motion/react";
import { IllustrationAI, IllustrationEar, IllustrationPay } from "@/components/art";
import { TONE_BG, type Tone } from "@/components/ui";

const STEPS: {
  n: string;
  tone: Tone;
  title: string;
  line: string;
  Art: React.ComponentType<{ className?: string }>;
  tilt: number;
}[] = [
  {
    n: "01",
    tone: "pink",
    title: "The AI listens",
    line: "It writes the captions and flags every word it is unsure of.",
    Art: IllustrationAI,
    tilt: -1.4,
  },
  {
    n: "02",
    tone: "yellow",
    title: "A local ear fixes it",
    line: "A native speaker hears just those seconds and types the right word.",
    Art: IllustrationEar,
    tilt: 1.2,
  },
  {
    n: "03",
    tone: "mint",
    title: "Paid once",
    line: "You approve, and the editor is paid exactly once on chain.",
    Art: IllustrationPay,
    tilt: -1.2,
  },
];

const list = {
  hidden: {},
  show: { transition: { staggerChildren: 0.13, delayChildren: 0.05 } },
};

export function Steps() {
  return (
    <motion.ol
      variants={list}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className="grid gap-5 md:grid-cols-3 md:gap-6"
    >
      {STEPS.map((s) => (
        <motion.li
          key={s.n}
          variants={{
            hidden: { opacity: 0, y: 34, rotate: s.tilt * 1.6 },
            show: {
              opacity: 1,
              y: 0,
              rotate: 0,
              transition: { type: "spring", stiffness: 220, damping: 22 },
            },
            hover: { y: -10, rotate: s.tilt, transition: { type: "spring", stiffness: 380, damping: 18 } },
          }}
          whileHover="hover"
          className={`brut-lg ${TONE_BG[s.tone]} relative flex min-h-[236px] flex-col p-6 sm:min-h-[320px] sm:p-7`}
        >
          <div className="flex items-start justify-between gap-4">
            <span className="font-display text-[56px] leading-none tabular-nums sm:text-[64px]">{s.n}</span>
            <motion.div
              variants={{
                hover: { rotate: -10, scale: 1.1, transition: { type: "spring", stiffness: 380, damping: 12 } },
              }}
            >
              <s.Art className="h-20 w-20 sm:h-24 sm:w-24" />
            </motion.div>
          </div>
          <div className="mt-auto pt-10">
            <h3 className="type-section">{s.title}</h3>
            <p className="mt-2 max-w-[30ch] text-[15.5px] leading-relaxed text-[#111]/80">{s.line}</p>
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}
