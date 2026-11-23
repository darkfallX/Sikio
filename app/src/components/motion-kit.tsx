"use client";

import React, { useEffect, useRef } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";

/* ---------------- Motion helpers ---------------- */

/* Fades and lifts children into place when they scroll into view (once). */
export function Reveal({
  children,
  delay = 0,
  y = 22,
  className = "",
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  const M = motion[as] as typeof motion.div;
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay }}
    >
      {children}
    </M>
  );
}

/* Counts a number up from 0 when it first scrolls into view. */
export function CountUp({
  value,
  decimals = 2,
  prefix = "",
  suffix = "",
  duration = 1.1,
  className = "",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const last = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) => `${prefix}${n.toFixed(decimals)}${suffix}`;
    if (!inView || reduce) {
      el.textContent = fmt(value);
      last.current = value;
      return;
    }
    const controls = animate(last.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = fmt(v);
      },
    });
    last.current = value;
    return () => controls.stop();
  }, [value, inView, reduce, decimals, prefix, suffix, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {`${prefix}${value.toFixed(decimals)}${suffix}`}
    </span>
  );
}

/* Shared spring presets so pages feel the same */
export const SPRING = {
  snappy: { type: "spring", stiffness: 520, damping: 34 } as const,
  soft: { type: "spring", stiffness: 240, damping: 26 } as const,
  bouncy: { type: "spring", stiffness: 420, damping: 16 } as const,
};
