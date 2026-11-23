"use client";

import React from "react";
import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { SPRING } from "@/components/motion-kit";

/*
  Outlined feedback banner used on Approve and Receipts.
  success = mint, error = soft red, info = white. Pastel fills keep dark ink in both themes.
*/
export function Banner({
  tone,
  children,
  action,
  onClose,
}: {
  tone: "success" | "error" | "info";
  children: React.ReactNode;
  action?: React.ReactNode;
  onClose?: () => void;
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertTriangle : Info;
  const surface =
    tone === "success"
      ? "pastel-mint"
      : tone === "error"
      ? // --error-bg is translucent in dark, so the floating banner falls back to solid paper there
        "bg-[var(--error-bg)] [[data-theme=dark]_&]:bg-[var(--paper)] text-[var(--ink)]"
      : "bg-[var(--paper)] text-[var(--ink)]";
  const iconColor =
    tone === "error" ? "text-[var(--error)]" : tone === "success" ? "text-[#111]" : "text-[var(--ink)]";

  return (
    <motion.div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 14, scale: 0.97 }}
      transition={SPRING.soft}
      className={`brut ${surface} flex items-start gap-3 pl-4 pr-2 py-2.5`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-[11px] ${iconColor}`} aria-hidden="true" />
      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-[15px] font-semibold leading-snug">
        <span className="min-w-0">{children}</span>
        {action}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 w-11 h-11 grid place-items-center rounded-full hover:bg-black/5 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}
