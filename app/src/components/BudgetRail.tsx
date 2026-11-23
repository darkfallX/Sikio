"use client";

import React from "react";
import { motion } from "motion/react";
import { Power } from "lucide-react";
import { BatchBudget } from "@/lib/types";
import { shortAddr } from "@/lib/aevum";
import { Button, Tag } from "./ui";
import { SPRING } from "./motion-kit";

interface BudgetRailProps {
  batch: BatchBudget;
  availableBudgetTusd8: number;
  busy?: boolean;
  onUpdatePolicy: (patch: {
    maxBudgetTusd8?: number;
    maxTaskFeeTusd8?: number;
    autoAcceptTrusted?: boolean;
    agentRevoked?: boolean;
  }) => void;
}

/* The rules the agency set for the agent. Enforced by ReviewEscrow. */
export function BudgetRail({ batch, busy, onUpdatePolicy }: BudgetRailProps) {
  const daysLeft = Math.max(
    0,
    Math.ceil((batch.expiryTimestamp - Math.floor(Date.now() / 1000)) / 86400)
  );

  const rows: [string, React.ReactNode][] = [
    ["Spending cap", `${batch.maxBudgetTusd8.toFixed(2)} tUSD8`],
    ["Most per word", `${batch.maxTaskFeeTusd8.toFixed(2)} tUSD8`],
    ["Ends in", batch.agentRevoked ? "Stopped" : `${daysLeft} days`],
    ["Approver", shortAddr(batch.approverAddress)],
    ["Trusted editors", `${batch.trustedEditors.length}`],
  ];

  const on = batch.autoAcceptTrusted;

  return (
    <section
      aria-labelledby="rules-heading"
      className="brut-flat bg-[var(--paper)] p-5 sm:p-6 space-y-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="rules-heading" className="type-section">
          Agent rules
        </h2>
        <Tag tone={batch.agentRevoked ? "peach" : "mint"}>
          <span
            aria-hidden="true"
            className={`w-2 h-2 rounded-full bg-[#111] ${batch.agentRevoked ? "" : "sikio-led"}`}
          />
          {batch.agentRevoked ? "Stopped" : "Running"}
        </Tag>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="type-label">{k}</dt>
            <dd className="font-mono text-[14px] font-bold tabular-nums text-[var(--ink)] truncate">
              {v}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center justify-between gap-3 min-h-[44px] pt-4 border-t-2 border-dashed border-[var(--line)]">
        <span id="auto-accept-label" className="text-[14px] font-bold text-[var(--ink)]">
          Pay trusted editors without review
        </span>
        <button
          type="button"
          role="switch"
          aria-labelledby="auto-accept-label"
          aria-checked={on}
          disabled={busy}
          onClick={() => onUpdatePolicy({ autoAcceptTrusted: !on })}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-[var(--outline)] cursor-pointer transition-colors disabled:opacity-50 before:absolute before:-inset-2 before:content-[''] ${
            on ? "bg-[var(--mint)]" : "bg-[var(--panel)]"
          }`}
        >
          <motion.span
            layout
            transition={SPRING.bouncy}
            className={`absolute top-[3px] h-[22px] w-[22px] rounded-full border-2 border-[#111] bg-white ${
              on ? "right-[3px]" : "left-[3px]"
            }`}
          />
        </button>
      </div>

      <Button
        variant={batch.agentRevoked ? "primary" : "danger"}
        size="sm"
        disabled={busy}
        onClick={() => onUpdatePolicy({ agentRevoked: !batch.agentRevoked })}
        className="w-full"
      >
        <Power className="w-4 h-4" />
        {batch.agentRevoked ? "Restart the agent" : "Stop the agent"}
      </Button>
    </section>
  );
}
