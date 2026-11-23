"use client";

import React from "react";
import { BatchBudget } from "@/lib/types";
import { shortAddr } from "@/lib/aevum";

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

export function BudgetRail({
  batch,
  availableBudgetTusd8,
  busy,
  onUpdatePolicy,
}: BudgetRailProps) {
  const spentPct = Math.min(
    100,
    (batch.spentTusd8 / Math.max(batch.maxBudgetTusd8, 0.01)) * 100
  );
  const reservedPct = Math.min(
    100 - spentPct,
    (batch.reservedTusd8 / Math.max(batch.maxBudgetTusd8, 0.01)) * 100
  );

  const daysLeft = Math.max(
    0,
    Math.ceil((batch.expiryTimestamp - Math.floor(Date.now() / 1000)) / 86400)
  );

  return (
    <div className="rounded-[14px] hairline bg-[var(--paper)] overflow-hidden">
      <div className="px-5 py-3.5 hairline-b flex items-center justify-between gap-2">
        <span className="type-label">Batch #{batch.batchId} budget</span>
        <span
          className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] font-medium tabular-nums ${
            batch.agentRevoked
              ? "bg-[var(--red-bg)] text-[var(--red)]"
              : "bg-[var(--green-bg)] text-[var(--green)]"
          }`}
        >
          {batch.agentRevoked ? "Revoked" : `${daysLeft}d left`}
        </span>
      </div>

      {/* Main figure */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2 tabular-nums">
          <span className="font-mono text-2xl font-semibold text-[var(--ink)]">
            {availableBudgetTusd8.toFixed(2)}
          </span>
          <span className="font-mono text-xs text-[var(--mute)]">
            of {batch.maxBudgetTusd8.toFixed(2)} tUSD8 left
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-[var(--panel)] overflow-hidden flex">
          <div
            style={{ width: `${spentPct}%` }}
            className="bg-[var(--green)] h-full transition-all"
          />
          <div
            style={{ width: `${reservedPct}%` }}
            className="bg-[var(--amber)] h-full transition-all"
          />
        </div>
      </div>

      {/* Shared-border metric strip */}
      <div className="grid grid-cols-3 hairline-t hairline-b divide-x divide-[var(--line)] bg-[var(--bg)]/50 text-xs tabular-nums">
        <div className="px-3.5 py-2.5">
          <div className="type-label text-[10px]">Settled</div>
          <div className="font-mono font-semibold text-[var(--green)] mt-0.5">
            {batch.spentTusd8.toFixed(2)}
          </div>
        </div>
        <div className="px-3.5 py-2.5">
          <div className="type-label text-[10px]">Escrowed</div>
          <div className="font-mono font-semibold text-[var(--amber)] mt-0.5">
            {batch.reservedTusd8.toFixed(2)}
          </div>
        </div>
        <div className="px-3.5 py-2.5">
          <div className="type-label text-[10px]">Task cap</div>
          <div className="font-mono font-semibold text-[var(--ink)] mt-0.5">
            {batch.maxTaskFeeTusd8.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Policy ledger rows */}
      <div className="px-5 py-3.5 space-y-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--mute)]">Approver</span>
          <span className="font-mono text-[var(--ink)]">
            {shortAddr(batch.approverAddress)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--mute)]">Trusted editors</span>
          <span className="font-mono text-[var(--ink)] tabular-nums">
            {batch.trustedEditors.length} allowlisted
          </span>
        </div>

        <label className="flex items-center justify-between gap-2 pt-2.5 hairline-t min-h-[36px] cursor-pointer select-none">
          <span className="text-[var(--ink)] font-medium">
            Auto-accept trusted editors
          </span>
          <input
            type="checkbox"
            disabled={busy}
            checked={batch.autoAcceptTrusted}
            onChange={(e) =>
              onUpdatePolicy({ autoAcceptTrusted: e.target.checked })
            }
            className="h-4 w-4 accent-[var(--signal)] cursor-pointer"
          />
        </label>

        <button
          type="button"
          disabled={busy}
          onClick={() => onUpdatePolicy({ agentRevoked: !batch.agentRevoked })}
          className={`w-full min-h-[44px] sm:min-h-[38px] px-3 rounded-[8px] text-xs font-semibold hairline transition-colors cursor-pointer disabled:opacity-50 ${
            batch.agentRevoked
              ? "bg-[var(--ink)] text-[var(--paper)]"
              : "bg-[var(--paper)] text-[var(--red)] hover:bg-[var(--red-bg)]"
          }`}
        >
          {batch.agentRevoked ? "Restore agent" : "Revoke agent"}
        </button>
      </div>
    </div>
  );
}
