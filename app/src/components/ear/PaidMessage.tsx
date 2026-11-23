"use client";

import React, { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Coin, Sparkle } from "@/components/art";

const COLORS = ["#ffc8ea", "#fff27a", "#b8efff", "#e2d4ff", "#ffd7b5", "#ffffff"];

/* A small one-shot burst of sparkles and dots around the coin. Motion only,
   no library, and nothing at all under reduced motion. */
function Burst() {
  const parts = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2 + (i % 2 ? 0.22 : -0.1);
        const dist = 40 + ((i * 37) % 26);
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          rot: (i % 2 ? 1 : -1) * (90 + i * 15),
          color: COLORS[i % COLORS.length],
          star: i % 3 !== 2,
          size: i % 3 === 0 ? 16 : 11,
          delay: 0.12 + (i % 4) * 0.025,
        };
      }),
    []
  );
  return (
    <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 w-0 h-0">
      {parts.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ left: -p.size / 2, top: -p.size / 2 }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, scale: [0, 1.15, 0.7], opacity: [1, 1, 0], rotate: p.rot }}
          transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1], delay: p.delay }}
        >
          {p.star ? (
            <Sparkle size={p.size} color={p.color} />
          ) : (
            <span
              className="block rounded-full border-2 border-[#111]"
              style={{ width: p.size - 2, height: p.size - 2, background: p.color }}
            />
          )}
        </motion.span>
      ))}
    </span>
  );
}

export function PaidMessage({ fee }: { fee: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-center gap-4 pl-4 pr-3 py-3">
      <div className="min-w-0">
        <motion.div
          className="font-mono font-bold text-[28px] leading-none tracking-[-0.05em] tabular-nums"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.18 }}
        >
          +${fee.toFixed(2)}
        </motion.div>
        <div className="mt-1.5 text-[14px] font-semibold leading-snug">Paid. Your trusted status approved it right away.</div>
      </div>
      <span className="relative shrink-0 w-[56px] h-[56px] grid place-items-center">
        {!reduce && <Burst />}
        <motion.span
          className="block"
          initial={reduce ? false : { scale: 0, rotate: -40, y: 10 }}
          animate={{ scale: 1, rotate: 0, y: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 14, delay: 0.05 }}
        >
          <Coin size={52} label="" style={{ boxShadow: "3px 3px 0 #111, inset -4px -5px 0 rgba(160,110,0,0.25)" }} />
        </motion.span>
      </span>
    </div>
  );
}
