"use client";

import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { CaptionJob, PaymentReceipt } from "@/lib/types";
import { explorerTxUrl, shortHash } from "@/lib/aevum";

interface Metrics {
  totalSettled: number;
  totalProjected: number;
  costPerMinuteProjected: number;
  fullHumanReviewCostPerMin: number;
  isCheaperThanFull: boolean;
  reviewTimeSavedPct: number;
}

/* What this clip cost, with the honest engine name and the x402 receipt. */
export function CostBreakdown({
  job,
  metrics,
  lastX402,
  x402Receipt,
}: {
  job: CaptionJob;
  metrics: Metrics;
  lastX402: { requestId: string; amountDisplay: string; operator: string } | null;
  x402Receipt?: PaymentReceipt;
}) {
  const humansPaid = Math.max(0, metrics.totalSettled - job.inferenceCostTusd8);
  const humansHeld = Math.max(0, metrics.totalProjected - metrics.totalSettled);
  const ratio = Math.min(
    1,
    Math.max(0.04, metrics.costPerMinuteProjected / metrics.fullHumanReviewCostPerMin)
  );
  const over = !metrics.isCheaperThanFull;

  // Always describe this clip's own payment; the last probe in this session may belong to another clip
  const requestId = x402Receipt?.x402Proof?.requestId || job.x402RequestId;
  const amount = `${job.inferenceCostTusd8.toFixed(2)} tUSD8`;
  const operator = lastX402?.operator;
  const live = x402Receipt?.mode === "aevum-live";

  const rows: [string, string, string][] = [
    ["AI transcript", job.inferenceCostTusd8.toFixed(2), ""],
    ["Native speakers, paid", humansPaid.toFixed(2), "text-[var(--paid-ink)]"],
    ["Native speakers, held", humansHeld.toFixed(2), "text-[var(--flag-ink)]"],
  ];

  return (
    <section aria-labelledby="cost-heading" className="brut-flat bg-[var(--paper)] p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="cost-heading" className="type-section">
          What this clip cost
        </h2>
        <span className="font-mono text-[12px] text-[var(--mute)]">
          {metrics.reviewTimeSavedPct > 0
            ? `humans skipped ${metrics.reviewTimeSavedPct}% of the audio`
            : "humans heard all of the audio"}
        </span>
      </div>

      {/* Sikio vs a full human pass */}
      <div className="space-y-2">
        {(
          [
            { label: "Full pass", value: metrics.fullHumanReviewCostPerMin, width: 1, fill: "bg-[var(--returned-bg)]" },
            {
              label: "Sikio",
              value: metrics.costPerMinuteProjected,
              width: ratio,
              fill: over ? "bg-[var(--peach)]" : "bg-[var(--mint)]",
            },
          ] as const
        ).map((bar, i) => (
          <div key={bar.label} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-3">
            <span className={`text-[13px] ${i === 1 ? "font-bold" : "text-[var(--mute)]"}`}>{bar.label}</span>
            <div className="h-4 rounded-full border-2 border-[var(--outline)] bg-[var(--paper)] overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${bar.fill} ${i === 1 ? "border-r-2 border-[var(--outline)]" : ""}`}
                initial={{ width: 0 }}
                whileInView={{ width: `${bar.width * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: i * 0.12 }}
              />
            </div>
            <span
              className={`text-right font-mono text-[13px] font-bold tabular-nums ${
                i === 1 ? (over ? "text-[var(--warn)]" : "text-[var(--paid-ink)]") : "text-[var(--mute)]"
              }`}
            >
              ${bar.value.toFixed(2)}
            </span>
          </div>
        ))}
        {over && (
          <p className="text-[13px] font-medium text-[var(--warn)]">
            At this fee, Sikio costs more than a full human pass on this clip.
          </p>
        )}
      </div>

      <dl className="space-y-2 text-[14px]">
        {rows.map(([k, v, tone]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-[var(--mute)]">{k}</dt>
            <dd className={`font-mono font-bold tabular-nums ${tone}`}>{v}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[var(--mute)]">Engine</dt>
          <dd className="text-right text-[13px] font-medium min-w-0 max-w-[60%]">{job.transcriptionEngine}</dd>
        </div>
      </dl>

      {/* x402 receipt */}
      <div className="rounded-[var(--r-sm)] border-2 border-dashed border-[var(--outline)] px-4 py-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[13px] font-bold">x402 receipt</span>
          <span className="font-mono text-[11.5px] font-bold">
            <span className="px-1.5 py-0.5 rounded-md bg-[var(--peach)] text-[var(--on-pastel)]">402</span>
            <span className="mx-1 text-[var(--mute)]">then</span>
            <span className="px-1.5 py-0.5 rounded-md bg-[var(--mint)] text-[var(--on-pastel)]">200</span>
          </span>
        </div>
        <div className="font-mono text-[12px] text-[var(--mute)] truncate">
          {amount} · {requestId}
        </div>
        {operator && <div className="text-[12px] text-[var(--mute)] truncate">{operator}</div>}
        {x402Receipt && (
          <div className="font-mono text-[12px] flex items-center gap-2">
            {live ? (
              <a
                href={explorerTxUrl(x402Receipt.txHash)}
                target="_blank"
                rel="noreferrer"
                className="min-h-[32px] inline-flex items-center gap-1 font-bold text-[var(--paid-ink)] hover:underline"
              >
                live 44005 · {shortHash(x402Receipt.txHash)} <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-[var(--mute)]">sandbox · {shortHash(x402Receipt.txHash)}</span>
            )}
          </div>
        )}
        {live && x402Receipt?.note.includes("EIP-3009") && (
          <div className="text-[12px] text-[var(--mute)]">
            Agent {shortHash(x402Receipt.from)} signed it, no gas. tUSD8 EIP-3009, settled once.
          </div>
        )}
      </div>

      <Link
        href="/receipts"
        className="min-h-[44px] inline-flex items-center gap-1.5 text-[14px] font-bold underline underline-offset-4"
      >
        All receipts <ArrowRight className="w-4 h-4" />
      </Link>
    </section>
  );
}
