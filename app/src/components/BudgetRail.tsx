"use client";

import React from "react";
import { ShieldAlert, ShieldCheck, Lock } from "lucide-react";
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
    <div className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#161513]" />
          <h2 className="text-sm font-semibold text-[#161513]">
            Approved Agent Budget
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-medium ${
            batch.agentRevoked
              ? "bg-[#F9EAE4] text-[#B8381A]"
              : "bg-[#E9F4EE] text-[#1D6B48]"
          }`}
        >
          {batch.agentRevoked ? (
            <>
              <ShieldAlert className="w-3 h-3" /> Revoked
            </>
          ) : (
            <>
              <ShieldCheck className="w-3 h-3" /> Active · {daysLeft}d left
            </>
          )}
        </span>
      </div>

      {/* Stacked Budget Bar */}
      <div>
        <div className="flex items-baseline justify-between text-xs mb-1.5 tabular-nums">
          <span className="text-[#5C584F]">Batch #{batch.batchId} Cap</span>
          <span className="font-mono font-semibold text-[#161513]">
            {availableBudgetTusd8.toFixed(2)} / {batch.maxBudgetTusd8.toFixed(2)} tUSD8 left
          </span>
        </div>

        <div className="h-2.5 w-full rounded-[4px] bg-[#EFECE4] overflow-hidden flex">
          <div
            style={{ width: `${spentPct}%` }}
            className="bg-[#1D6B48] h-full transition-all"
            title={`Spent: ${batch.spentTusd8.toFixed(2)} tUSD8`}
          />
          <div
            style={{ width: `${reservedPct}%` }}
            className="bg-[#C54B24] h-full transition-all"
            title={`Reserved in escrow: ${batch.reservedTusd8.toFixed(2)} tUSD8`}
          />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
          <div className="rounded-[5px] bg-[#F7F5F0] px-2.5 py-1.5 border border-[#E2DDD2]">
            <div className="text-[#5C584F]">Settled</div>
            <div className="font-mono font-medium text-[#1D6B48]">
              {batch.spentTusd8.toFixed(2)}
            </div>
          </div>
          <div className="rounded-[5px] bg-[#F7F5F0] px-2.5 py-1.5 border border-[#E2DDD2]">
            <div className="text-[#5C584F]">Reserved</div>
            <div className="font-mono font-medium text-[#C54B24]">
              {batch.reservedTusd8.toFixed(2)}
            </div>
          </div>
          <div className="rounded-[5px] bg-[#F7F5F0] px-2.5 py-1.5 border border-[#E2DDD2]">
            <div className="text-[#5C584F]">Max / Task</div>
            <div className="font-mono font-medium text-[#161513]">
              {batch.maxTaskFeeTusd8.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Policy Controls */}
      <div className="pt-3 border-t border-[#E2DDD2] space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#5C584F]">Agent key</span>
          <span className="font-mono text-[#161513]">{shortAddr(batch.agentAddress)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#5C584F]">Named approver</span>
          <span className="font-mono text-[#161513]">
            {shortAddr(batch.approverAddress)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#5C584F]">Trusted editors</span>
          <span className="font-medium text-[#161513]">
            {batch.trustedEditors.length} allowlisted
          </span>
        </div>

        <label className="flex items-center justify-between gap-2 pt-1 cursor-pointer select-none">
          <span className="text-[#161513] font-medium">
            Auto-accept trusted editors
          </span>
          <input
            type="checkbox"
            disabled={busy}
            checked={batch.autoAcceptTrusted}
            onChange={(e) =>
              onUpdatePolicy({ autoAcceptTrusted: e.target.checked })
            }
            className="h-4 w-4 accent-[#C54B24] cursor-pointer"
          />
        </label>

        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onUpdatePolicy({ agentRevoked: !batch.agentRevoked })
            }
            className={`w-full py-1.5 px-3 rounded-[6px] text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
              batch.agentRevoked
                ? "bg-[#161513] text-[#FCFBF8] border-[#161513] hover:bg-[#2C2A26]"
                : "bg-[#FCFBF8] text-[#B8381A] border-[#EBC7BA] hover:bg-[#F9EAE4]"
            }`}
          >
            {batch.agentRevoked
              ? "Restore Agent Session"
              : "Emergency Revoke Agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
