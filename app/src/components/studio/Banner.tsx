"use client";

import React from "react";
import { motion } from "motion/react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { SPRING } from "../motion-kit";

/* Outlined pastel message that pops in next to where the user acted. */
export function Banner({
  tone,
  children,
  action,
  onClose,
}: {
  tone: "ok" | "error" | "warn";
  children: React.ReactNode;
  action?: React.ReactNode;
  onClose?: () => void;
}) {
  const bg =
    tone === "ok"
      ? "bg-[var(--mint)] text-[var(--on-pastel)]"
      : tone === "warn"
      ? "bg-[var(--peach)] text-[var(--on-pastel)]"
      : "bg-[var(--error-bg)] text-[var(--ink)]";
  const Icon = tone === "ok" ? CheckCircle2 : AlertCircle;
  return (
    <motion.div
      role={tone === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={SPRING.soft}
      className={`flex items-start gap-2.5 rounded-[var(--r-sm)] border-2 border-[var(--outline)] px-3.5 py-2.5 text-[14px] font-medium leading-snug ${bg}`}
    >
      <Icon
        aria-hidden="true"
        className={`w-[18px] h-[18px] shrink-0 mt-[1px] ${tone === "error" ? "text-[var(--error)]" : ""}`}
      />
      <div className="min-w-0 flex-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="min-w-0">{children}</span>
        {action}
      </div>
      {onClose && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className="-my-2 -mr-2 w-10 h-10 shrink-0 grid place-items-center rounded-full cursor-pointer hover:bg-black/10"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}
