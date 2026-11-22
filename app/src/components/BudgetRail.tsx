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
    <div className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#DDD7CA] flex items-center justify-between gap-2 bg-[#F4F1EA]/70">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-[#141311]" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.05em] text-[#141311]">
            Batch #{batch.batchId} Policy
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-medium ${
            batch.agentRevoked
              ? "bg-[#FAEAE4] text-[#C94A22]"
              : "bg-[#E7F4ED] text-[#1B6B46]"
          }`}
        >
          {batch.agentRevoked ? (
            <>
              <ShieldAlert className="w-3 h-3" /> REVOKED
            </>
          ) : (
            <>
              <ShieldCheck className="w-3 h-3" /> {daysLeft}D LEFT
            </>
          )}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Stacked Cap Meter */}
        <div>
          <div className="flex items-baseline justify-between text-xs mb-1.5 tabular-nums">
            <span className="text-[#5C574E]">Available cap</span>
            <span className="font-mono font-semibold text-[#141311]">
              {availableBudgetTusd8.toFixed(2)}{" "}
              <span className="text-[#847D72] font-normal">
                / {batch.maxBudgetTusd8.toFixed(2)} tUSD8
              </span>
            </span>
          </div>

          <div className="h-2.5 w-full rounded-[3px] bg-[#EBE6DB] overflow-hidden flex border border-[#DDD7CA]">
            <div
              style={{ width: `${spentPct}%` }}
              className="bg-[#1B6B46] h-full transition-all duration-200"
              title={`Settled: ${batch.spentTusd8.toFixed(2)} tUSD8`}
            />
            <div
              style={{ width: `${reservedPct}%` }}
              className="bg-[#C94A22] h-full transition-all duration-200"
              title={`Reserved: ${batch.reservedTusd8.toFixed(2)} tUSD8`}
            />
          </div>

          <div className="mt-2.5 grid grid-cols-3 border border-[#DDD7CA] rounded-[5px] divide-x divide-[#DDD7CA] bg-[#F4F1EA] text-[11px] tabular-nums">
            <div className="px-2.5 py-2">
              <div className="text-[#5C574E]">Settled</div>
              <div className="font-mono font-semibold text-[#1B6B46] mt-0.5">
                {batch.spentTusd8.toFixed(2)}
              </div>
            </div>
            <div className="px-2.5 py-2">
              <div className="text-[#5C574E]">Escrowed</div>
              <div className="font-mono font-semibold text-[#C94A22] mt-0.5">
                {batch.reservedTusd8.toFixed(2)}
              </div>
            </div>
            <div className="px-2.5 py-2">
              <div className="text-[#5C574E]">Task Cap</div>
              <div className="font-mono font-semibold text-[#141311] mt-0.5">
                {batch.maxTaskFeeTusd8.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Enforced Contract Parameters */}
        <div className="pt-3 border-t border-[#DDD7CA] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#5C574E]">Approver</span>
            <span className="font-mono text-[#141311]">
              {shortAddr(batch.approverAddress)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5C574E]">Trusted editors</span>
            <span className="font-mono font-medium text-[#141311]">
              {batch.trustedEditors.length} allowlisted
            </span>
          </div>

          <label className="flex items-center justify-between gap-2 pt-2 border-t border-[#DDD7CA] cursor-pointer select-none">
            <span className="text-[#141311] font-medium">
              Auto-accept trusted editors
            </span>
            <input
              type="checkbox"
              disabled={busy}
              checked={batch.autoAcceptTrusted}
              onChange={(e) =>
                onUpdatePolicy({ autoAcceptTrusted: e.target.checked })
              }
              className="h-4 w-4 accent-[#C94A22] cursor-pointer"
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onUpdatePolicy({ agentRevoked: !batch.agentRevoked })
            }
            className={`w-full mt-1 py-2 px-3 rounded-[5px] text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
              batch.agentRevoked
                ? "bg-[#141311] text-[#FBF9F4] border-[#141311] hover:bg-[#2B2926]"
                : "bg-[#FBF9F4] text-[#C94A22] border-[#E8C5B8] hover:bg-[#FAEAE4]"
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
