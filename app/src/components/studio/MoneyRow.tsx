"use client";

import React from "react";
import { motion } from "motion/react";
import { AlertTriangle } from "lucide-react";
import { BatchBudget } from "@/lib/types";
import { CountUp } from "../motion-kit";

interface Metrics {
  costPerMinuteProjected: number;
  fullHumanReviewCostPerMin: number;
  isCheaperThanFull: boolean;
  costSavingsPct: number;
}

const BIG = "font-mono text-[34px] sm:text-[40px] font-bold leading-none tracking-[-0.05em]";

/* Budget left, paid once, cost per minute. Three calm outlined cards. */
export function MoneyRow({
  batch,
  available,
  metrics,
}: {
  batch: BatchBudget;
  available: number;
  metrics: Metrics | null;
}) {
  const cap = Math.max(batch.maxBudgetTusd8, 0.01);
  const paidPct = Math.min(100, (batch.spentTusd8 / cap) * 100);
  const heldPct = Math.min(100 - paidPct, (batch.reservedTusd8 / cap) * 100);
  const over = metrics ? !metrics.isCheaperThanFull : false;

  return (
    <section aria-label="Money" className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
      <div className="brut-flat bg-[var(--paper)] p-5 sm:p-6 flex flex-col gap-3">
        <span className="type-label">Budget left</span>
        <div className="flex items-baseline gap-2 flex-wrap">
          <CountUp value={available} className={BIG} />
          <span className="font-mono text-[13px] text-[var(--mute)]">
            of {batch.maxBudgetTusd8.toFixed(2)} tUSD8
          </span>
        </div>
        <div
          className="mt-auto h-3.5 rounded-full border-2 border-[var(--outline)] bg-[var(--paper)] p-[2px] flex gap-[2px] overflow-hidden"
          role="img"
          aria-label={`${batch.spentTusd8.toFixed(2)} paid, ${batch.reservedTusd8.toFixed(2)} held, ${available.toFixed(2)} left`}
        >
          <motion.span
            className="h-full rounded-full bg-[var(--mint)] border border-[#111]"
            initial={{ width: 0 }}
            animate={{ width: `${paidPct > 0 ? Math.max(3, paidPct) : 0}%` }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.span
            className="h-full rounded-full bg-[var(--yellow)] border border-[#111]"
            initial={{ width: 0 }}
            animate={{ width: `${heldPct > 0 ? Math.max(3, heldPct) : 0}%` }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11.5px] text-[var(--mute)] tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full bg-[var(--mint)] border border-[#111]" aria-hidden="true" />
            paid {batch.spentTusd8.toFixed(2)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full bg-[var(--yellow)] border border-[#111]" aria-hidden="true" />
            held {batch.reservedTusd8.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="brut-flat bg-[var(--paper)] p-5 sm:p-6 flex flex-col gap-3">
        <span className="type-label">Paid once</span>
        <CountUp value={batch.spentTusd8} className={BIG} />
        <span className="mt-auto text-[13px] text-[var(--mute)]">tUSD8 to the AI and to people</span>
      </div>

      <div
        className={`brut-flat p-5 sm:p-6 flex flex-col gap-3 ${
          over ? "bg-[var(--warn-bg)]" : "bg-[var(--paper)]"
        }`}
      >
        <span className={`type-label ${over ? "!text-[var(--warn)]" : ""}`}>Cost per minute</span>
        {metrics ? (
          <>
            <div className="flex items-center gap-2.5 flex-wrap">
              <CountUp
                value={metrics.costPerMinuteProjected}
                prefix="$"
                className={`${BIG} ${over ? "text-[var(--warn)]" : ""}`}
              />
              {over ? (
                <AlertTriangle className="w-6 h-6 text-[var(--warn)]" aria-hidden="true" />
              ) : metrics.costSavingsPct > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full border-2 border-[var(--outline)] bg-[var(--mint)] text-[var(--on-pastel)] font-mono text-[12px] font-bold">
                  {metrics.costSavingsPct}% less
                </span>
              ) : null}
            </div>
            <span className={`mt-auto text-[13px] ${over ? "text-[var(--warn)] font-medium" : "text-[var(--mute)]"}`}>
              {over
                ? `More than a $${metrics.fullHumanReviewCostPerMin.toFixed(2)} full human pass. Lower the fee for short clips.`
                : `vs $${metrics.fullHumanReviewCostPerMin.toFixed(2)} for a full human pass`}
            </span>
          </>
        ) : (
          <>
            <span className={`${BIG} text-[var(--line)]`} aria-hidden="true">
              $0.00
            </span>
            <span className="mt-auto text-[13px] text-[var(--mute)]">Run a clip to see it</span>
          </>
        )}
      </div>
    </section>
  );
}
