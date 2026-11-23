"use client";

import React from "react";
import { motion } from "motion/react";
import { CountUp, SPRING } from "@/components/motion-kit";

export interface Stat {
  label: string;
  value: number;
  sub: string;
  tone: "lilac" | "mint" | "yellow" | "pink";
}

/* Four outlined pastel money cards. Values come straight from the batch. */
export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 18, rotate: i % 2 ? 1.5 : -1.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          whileHover={{ y: -3, rotate: i % 2 ? 0.6 : -0.6 }}
          transition={{ ...SPRING.soft, delay: 0.08 + i * 0.07 }}
          className={`brut pastel-${s.tone} p-4 sm:p-6 grid gap-1 content-start min-w-0`}
        >
          <span className="font-mono text-[12.5px] font-bold text-[#111]/70">{s.label}</span>
          <CountUp
            value={s.value}
            decimals={2}
            className="font-mono font-bold text-[28px] sm:text-[40px] leading-[1.05] tracking-[-0.06em]"
          />
          <span className="text-[12.5px] sm:text-[13px] text-[#111]/70 leading-snug">{s.sub}</span>
        </motion.div>
      ))}
    </div>
  );
}
