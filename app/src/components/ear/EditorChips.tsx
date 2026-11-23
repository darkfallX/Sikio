"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";

export interface EditorOption {
  address: string;
  label: string;
  /* Full name and city, read by screen readers and shown on hover */
  hint?: string;
}

/* Who is answering. One outlined track, the active pill slides between chips. */
export function EditorChips({
  options,
  value,
  onChange,
}: {
  options: EditorOption[];
  value: string;
  onChange: (address: string) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      role="group"
      aria-label="Answering as"
      className="max-w-full overflow-x-auto no-scrollbar rounded-full border-2 border-[var(--outline)] bg-[var(--paper)] p-1 inline-flex"
    >
      <div className="flex items-center gap-0.5">
        {options.map((o) => {
          const active = o.address === value;
          return (
            <button
              key={o.address}
              type="button"
              aria-pressed={active}
              aria-label={o.hint}
              title={o.hint}
              onClick={() => onChange(o.address)}
              className={`relative min-h-[44px] sm:min-h-[38px] px-4 rounded-full text-[13px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-200 ${
                active ? "text-[var(--bg)]" : "text-[var(--ink-2)] hover:text-[var(--ink)]"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="ear-editor-pill"
                  className="absolute inset-0 rounded-full bg-[var(--ink)]"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 34 }}
                  aria-hidden="true"
                />
              )}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
