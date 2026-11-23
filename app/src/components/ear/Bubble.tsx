"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";

/*
  Chat bubbles for the Ear thread. Incoming bubbles grow from their bottom-left
  corner, outgoing ones fly up from the composer and settle bottom-right.
*/

const IN_SPRING = { type: "spring", stiffness: 380, damping: 28, mass: 0.8 } as const;
const OUT_SPRING = { type: "spring", stiffness: 330, damping: 24, mass: 0.9 } as const;

type Side = "in" | "out";

const TONES = {
  paper: "bg-[var(--paper)] text-[var(--ink)]",
  ink: "bg-[var(--ink)] text-[var(--bg)]",
  yellow: "bg-[var(--yellow)] text-[var(--on-pastel)]",
  sky: "bg-[var(--sky)] text-[var(--on-pastel)]",
  mint: "bg-[var(--mint)] text-[var(--on-pastel)]",
} as const;

export function Bubble({
  side = "in",
  tone,
  delay = 0,
  className = "",
  children,
  label,
}: {
  side?: Side;
  tone?: keyof typeof TONES;
  delay?: number;
  className?: string;
  children: React.ReactNode;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const t = tone ?? (side === "out" ? "ink" : "paper");
  const shape =
    side === "out"
      ? "self-end rounded-[22px] rounded-br-[8px]"
      : "self-start rounded-[22px] rounded-bl-[8px]";

  const initial = reduce
    ? { opacity: 0 }
    : side === "out"
    ? { opacity: 0, y: 46, x: 18, scale: 0.7 }
    : { opacity: 0, y: 14, scale: 0.88 };

  return (
    <motion.div
      layout="position"
      aria-label={label}
      initial={initial}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ ...(side === "out" ? OUT_SPRING : IN_SPRING), delay }}
      style={{ transformOrigin: side === "out" ? "100% 100%" : "0% 100%" }}
      className={`relative border-2 border-[var(--outline)] ${shape} ${TONES[t]} ${className} scroll-mb-44 lg:scroll-mb-4`}
    >
      {children}
    </motion.div>
  );
}

export function TypingBubble() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.14 } }}
      transition={IN_SPRING}
      style={{ transformOrigin: "0% 100%" }}
      className="self-start rounded-[22px] rounded-bl-[8px] border-2 border-[var(--outline)] bg-[var(--paper)] px-4 py-3.5 flex items-center gap-1.5"
      role="status"
      aria-label="Sikio agent is typing"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-2 h-2 rounded-full bg-[var(--ink)]"
          animate={reduce ? undefined : { y: [0, -5, 0], opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </motion.div>
  );
}

export function ThreadDivider({ label }: { label: string }) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scaleX: 0.6 }}
      animate={{ opacity: 1, scaleX: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="self-stretch flex items-center gap-3 py-2"
      role="separator"
      aria-label={label}
    >
      <span className="h-[2px] flex-1 rounded-full bg-[var(--line)]" />
      <span className="font-mono text-[11px] font-bold text-[var(--mute)]">{label}</span>
      <span className="h-[2px] flex-1 rounded-full bg-[var(--line)]" />
    </motion.div>
  );
}
