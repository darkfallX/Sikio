"use client";

import React from "react";
import { BatchBudget } from "@/lib/types";
import { shortAddr } from "@/lib/aevum";
import { Button } from "./ui";

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
    ["Approver", <span key="a" className="font-mono">{shortAddr(batch.approverAddress)}</span>],
    ["Trusted editors", `${batch.trustedEditors.length}`],
  ];

  return (
    <div className="rounded-[var(--r)] hairline bg-[var(--paper)] overflow-hidden">
      <div className="px-4 sm:px-5 py-3 hairline-b flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[var(--ink)]">
          Agent rules · batch {batch.batchId}
        </h2>
        <span
          className={`px-2 py-0.5 rounded-full text-[12px] font-semibold ${
            batch.agentRevoked
              ? "bg-[var(--red-bg)] text-[var(--red)]"
              : "bg-[var(--green-bg)] text-[var(--green-ink)]"
          }`}
        >
          {batch.agentRevoked ? "Agent stopped" : "Agent active"}
        </span>
      </div>

      <dl className="px-4 sm:px-5 py-2 text-[14px]">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between gap-3 py-2 hairline-b last:border-b-0 tabular-nums"
          >
            <dt className="text-[var(--mute)]">{k}</dt>
            <dd className="text-[var(--ink)] font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="px-4 sm:px-5 py-3 hairline-t space-y-3">
        <div className="flex items-center justify-between gap-3 min-h-[44px]">
          <span id="auto-accept-label" className="text-[14px] text-[var(--ink)] font-medium">
            Pay trusted editors without review
          </span>
          <button
            type="button"
            role="switch"
            aria-labelledby="auto-accept-label"
            aria-checked={batch.autoAcceptTrusted}
            disabled={busy}
            onClick={() =>
              onUpdatePolicy({ autoAcceptTrusted: !batch.autoAcceptTrusted })
            }
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
              batch.autoAcceptTrusted ? "bg-[var(--green)]" : "bg-[var(--panel)] hairline"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-[var(--paper)] shadow-sm transition-transform duration-200 ${
                batch.autoAcceptTrusted ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <Button
          variant={batch.agentRevoked ? "primary" : "danger"}
          disabled={busy}
          onClick={() => onUpdatePolicy({ agentRevoked: !batch.agentRevoked })}
          className="w-full"
        >
          {batch.agentRevoked ? "Restart the agent" : "Stop the agent"}
        </Button>
      </div>
    </div>
  );
}
