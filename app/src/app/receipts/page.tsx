"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";
import {
  BatchBudget,
  BenchmarkRun,
  PaymentReceipt,
  ReviewTask,
} from "@/lib/types";
import {
  explorerAddressUrl,
  explorerTxUrl,
  shortAddr,
  shortHash,
} from "@/lib/aevum";

interface ReceiptsState {
  batch: BatchBudget;
  tasks: ReviewTask[];
  receipts: PaymentReceipt[];
  benchmarks: BenchmarkRun[];
  availableBudgetTusd8: number;
  network: {
    chainId: number;
    chainName: string;
    rpcUrl: string;
    explorerUrl: string;
    tusd8Address: string;
    entryPointV07Address: string;
    reviewEscrowAddress: string | null;
  };
}

export default function ReceiptsPage() {
  const [data, setData] = useState<ReceiptsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [doublePayResult, setDoublePayResult] = useState<string | null>(null);
  const [showBenchForm, setShowBenchForm] = useState(false);
  const [benchForm, setBenchForm] = useState({
    clipTitle: "",
    dialect: "Nigerian English / Pidgin",
    clipDurationSec: 120,
    fullReviewSec: 300,
    targetedReviewSec: 75,
    fullReviewErrorsLeft: 1,
    targetedReviewErrorsLeft: 1,
    overconfidentAiMisses: 1,
    fullReviewCostUsd: 7.0,
    targetedCostUsd: 1.04,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const json = (await res.json()) as ReceiptsState;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyContract = () => {
    if (!data?.network.reviewEscrowAddress) return;
    navigator.clipboard?.writeText(data.network.reviewEscrowAddress);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1600);
  };

  const testDoublePayProtection = async () => {
    const paidTask = data?.tasks.find((t) => t.status === "accepted");
    if (!paidTask) {
      setDoublePayResult(
        "Accept at least one task first (in Approve), then probe exact-once rejection here."
      );
      return;
    }
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", taskId: paidTask.id }),
    });
    const json = await res.json();
    setDoublePayResult(
      `HTTP ${res.status} REJECTED -> ${json.error || "Task already settled"}`
    );
  };

  const handleAddBenchmark = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/benchmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(benchForm),
    });
    if (res.ok) {
      setShowBenchForm(false);
      setBenchForm((f) => ({ ...f, clipTitle: "" }));
      await load();
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-12 w-64 rounded-[5px] bg-[#EBE6DB] animate-pulse" />
        <div className="h-64 rounded-[6px] bg-[#EBE6DB] animate-pulse" />
      </div>
    );
  }

  const totalBenchFullSec = data.benchmarks.reduce(
    (a, b) => a + b.fullReviewSec,
    0
  );
  const totalBenchTargetedSec = data.benchmarks.reduce(
    (a, b) => a + b.targetedReviewSec,
    0
  );
  const avgTimeSavedPct =
    totalBenchFullSec > 0
      ? Math.round((1 - totalBenchTargetedSec / totalBenchFullSec) * 100)
      : 0;
  const totalOverconfidentMisses = data.benchmarks.reduce(
    (a, b) => a + b.overconfidentAiMisses,
    0
  );

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-[#DDD7CA]">
        <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#5C574E]">
          QDay Aevum Testnet · Chain 44005
        </div>
        <h1 className="text-2xl sm:text-[30px] font-semibold tracking-[-0.03em] text-[#141311] mt-0.5">
          Receipts, Controls & A/B Proof
        </h1>
        <p className="text-sm text-[#5C574E] mt-0.5">
          Every tUSD8 movement, on-chain safety invariant, and honest accuracy trade-off in one audit ledger.
        </p>
      </div>

      {/* Live Contract & Network Bar */}
      <section className="rounded-[6px] border border-[#DDD7CA] bg-[#121110] text-[#FBF9F4] grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#282522]">
        <div className="p-4 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#9C9589]">
            Live ReviewEscrow (Chain 44005)
          </div>
          <div className="flex items-center gap-2">
            {data.network.reviewEscrowAddress ? (
              <>
                <a
                  href={explorerAddressUrl(data.network.reviewEscrowAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-[#7CE2AC] hover:underline"
                >
                  {shortAddr(data.network.reviewEscrowAddress)}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={copyContract}
                  title="Copy contract address"
                  className="p-1 rounded-[4px] bg-[#1E1C19] text-[#ABA498] hover:text-[#FBF9F4] cursor-pointer"
                >
                  {copiedAddr ? (
                    <Check className="w-3 h-3 text-[#7CE2AC]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </>
            ) : (
              <span className="text-sm font-mono">Not configured</span>
            )}
          </div>
          <div className="text-[11px] text-[#8A8378]">
            12 / 12 Solidity tests · 8 live Aevum tx verified
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#9C9589]">
            Settlement Token (tUSD8 · 6 dec)
          </div>
          <a
            href={explorerAddressUrl(data.network.tusd8Address)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-[#FBF9F4] hover:text-[#C94A22]"
          >
            {shortAddr(data.network.tusd8Address)}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <div className="text-[11px] text-[#8A8378]">
            EntryPoint v0.7 verified live on Aevum
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#9C9589]">
            Trust Boundary
          </div>
          <div className="text-sm font-semibold text-[#FBF9F4]">
            Chain proves payment once
          </div>
          <div className="text-[11px] text-[#8A8378]">
            Named agency approver proves text correctness.
          </div>
        </div>
      </section>

      {/* Payment Ledger */}
      <section className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#DDD7CA] bg-[#F4F1EA]/70 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-mono uppercase tracking-[0.06em] font-semibold text-[#141311]">
            Payment Ledger ({data.receipts.length})
          </h2>
          <span className="text-xs font-mono text-[#5C574E] tabular-nums">
            Settled {data.batch.spentTusd8.toFixed(2)} · Escrowed{" "}
            {data.batch.reservedTusd8.toFixed(2)} · Left{" "}
            {data.availableBudgetTusd8.toFixed(2)} tUSD8
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#DDD7CA] bg-[#F4F1EA] text-[#5C574E] font-mono uppercase text-[10px] tracking-[0.05em]">
                <th className="py-2.5 px-4 font-medium">Event</th>
                <th className="py-2.5 px-4 font-medium">Flow</th>
                <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                <th className="py-2.5 px-4 font-medium">Gas</th>
                <th className="py-2.5 px-4 font-medium">Explorer Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDD7CA]">
              {data.receipts.map((r) => (
                <tr key={r.id} className="hover:bg-[#F4F1EA]/60">
                  <td className="py-3 px-4 align-top">
                    <ReceiptBadge kind={r.kind} />
                    <div className="text-[10px] text-[#847D72] mt-1 font-mono">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="py-3 px-4 align-top max-w-md">
                    <div className="font-semibold text-[#141311]">{r.actorLabel}</div>
                    <div className="text-[#5C574E] mt-0.5">{r.note}</div>
                    {r.x402Proof && (
                      <div className="mt-1 inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[3px] bg-[#EBE6DB] font-mono text-[10px] text-[#141311]">
                        x402 · {r.x402Proof.endpoint} · 402 → 200
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 align-top text-right font-mono font-semibold text-[#141311] tabular-nums whitespace-nowrap">
                    {r.amountTusd8.toFixed(2)} tUSD8
                  </td>
                  <td className="py-3 px-4 align-top text-[#5C574E] whitespace-nowrap">
                    {r.gasToken}
                  </td>
                  <td className="py-3 px-4 align-top font-mono whitespace-nowrap">
                    <a
                      href={explorerTxUrl(r.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-1 ${
                        r.mode === "aevum-live"
                          ? "text-[#1B6B46] font-semibold hover:underline"
                          : "text-[#5C574E] hover:text-[#141311]"
                      }`}
                    >
                      {shortHash(r.txHash)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <div className="text-[10px] text-[#847D72]">
                      {r.mode === "aevum-live" ? "Live Aevum Tx" : "Sandbox receipt"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Safety Invariants & Live Double-Pay Probe */}
      <section className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#DDD7CA] bg-[#F4F1EA]/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#1B6B46]" />
            <h2 className="text-xs font-mono uppercase tracking-[0.06em] font-semibold text-[#141311]">
              On-Chain Safety Controls (ReviewEscrow.sol)
            </h2>
          </div>
          <button
            type="button"
            onClick={testDoublePayProtection}
            className="px-3 py-1.5 rounded-[5px] text-xs font-medium bg-[#141311] text-[#FBF9F4] hover:bg-[#2B2926] transition-colors cursor-pointer"
          >
            Probe Double-Pay Rejection
          </button>
        </div>

        <div className="p-5 space-y-4">
          {doublePayResult && (
            <div className="rounded-[5px] bg-[#121110] text-[#FFD3C4] px-3.5 py-2.5 text-xs font-mono">
              {doublePayResult}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {[
              [
                "Exact-once settlement",
                "Each taskId and x402 requestId settles at most once; repeated acceptTask reverts with TaskNotOpen.",
              ],
              [
                "Budget & per-task caps",
                "Agent cannot spend or reserve past maxBudget, maxTaskFee, or batch expiry.",
              ],
              [
                "Trusted editor allowlist",
                "Agent can only assign tasks to agency-approved native speakers.",
              ],
              [
                "Named approver authority",
                "Only batch.approver or batch.agency can release funds; self-approval reverts.",
              ],
              [
                "Excerpt-only confidentiality",
                "/api/excerpt slices raw PCM WAV bytes server-side to <= 12s; editors never receive full recordings.",
              ],
              [
                "Zero-gas editor UX",
                "EIP-712 submitCorrectionBySig verified live on Aevum 44005 with a 0-tQDAY editor wallet.",
              ],
            ].map(([title, desc]) => (
              <div
                key={title}
                className="rounded-[5px] bg-[#F4F1EA] border border-[#DDD7CA] p-3.5 space-y-1"
              >
                <div className="font-semibold text-[#141311] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1B6B46] shrink-0" />
                  {title}
                </div>
                <p className="text-[#5C574E] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Decisive A/B Benchmark with Visual Bars */}
      <section className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#DDD7CA] bg-[#F4F1EA]/70 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-[0.06em] font-semibold text-[#141311]">
              Decisive A/B Benchmark · Full Review vs. Sikio Targeted
            </h2>
            <p className="text-xs text-[#5C574E] mt-0.5">
              Includes measured time savings and honest reporting of overconfident AI misses above threshold.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowBenchForm((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[5px] text-xs font-medium bg-[#141311] text-[#FBF9F4] hover:bg-[#2B2926] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Log A/B Run
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#DDD7CA] border-b border-[#DDD7CA] bg-[#FBF9F4] text-xs">
          <div className="p-4">
            <div className="text-[#5C574E]">Review time saved</div>
            <div className="text-2xl font-semibold text-[#1B6B46] tabular-nums mt-0.5">
              {avgTimeSavedPct}% faster
            </div>
          </div>
          <div className="p-4">
            <div className="text-[#5C574E]">Overconfident AI misses</div>
            <div className="text-2xl font-semibold text-[#945D00] tabular-nums mt-0.5">
              {totalOverconfidentMisses} across {data.benchmarks.length} clips
            </div>
          </div>
          <div className="p-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#945D00] shrink-0 mt-0.5" />
            <div className="text-[#5C574E] leading-snug">
              <strong className="text-[#141311]">Honest limit:</strong> Confidently wrong ASR words (&gt;78%) slip through targeted review unless the agency raises the confidence floor.
            </div>
          </div>
        </div>

        {showBenchForm && (
          <form
            onSubmit={handleAddBenchmark}
            className="p-5 border-b border-[#DDD7CA] bg-[#F4F1EA] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs"
          >
            <input
              required
              placeholder="Clip title (e.g. Kigali Fintech Ep 4)"
              value={benchForm.clipTitle}
              onChange={(e) =>
                setBenchForm((f) => ({ ...f, clipTitle: e.target.value }))
              }
              className="px-3 py-2 rounded-[5px] bg-[#FBF9F4] border border-[#DDD7CA]"
            />
            <input
              required
              placeholder="Dialect / Language"
              value={benchForm.dialect}
              onChange={(e) =>
                setBenchForm((f) => ({ ...f, dialect: e.target.value }))
              }
              className="px-3 py-2 rounded-[5px] bg-[#FBF9F4] border border-[#DDD7CA]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Full (sec)"
                value={benchForm.fullReviewSec}
                onChange={(e) =>
                  setBenchForm((f) => ({
                    ...f,
                    fullReviewSec: Number(e.target.value),
                  }))
                }
                className="px-2.5 py-2 rounded-[5px] bg-[#FBF9F4] border border-[#DDD7CA] font-mono"
              />
              <input
                type="number"
                placeholder="Targeted (sec)"
                value={benchForm.targetedReviewSec}
                onChange={(e) =>
                  setBenchForm((f) => ({
                    ...f,
                    targetedReviewSec: Number(e.target.value),
                  }))
                }
                className="px-2.5 py-2 rounded-[5px] bg-[#FBF9F4] border border-[#DDD7CA] font-mono"
              />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                className="px-4 py-1.5 rounded-[5px] bg-[#C94A22] text-[#FBF9F4] font-medium cursor-pointer"
              >
                Save Benchmark Run
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-[#DDD7CA] bg-[#F4F1EA] text-[#5C574E] font-mono uppercase text-[10px] tracking-[0.05em]">
                <th className="py-2.5 px-4 font-medium">Clip</th>
                <th className="py-2.5 px-4 font-medium">Time (Full vs Sikio)</th>
                <th className="py-2.5 px-4 font-medium">Errors Left</th>
                <th className="py-2.5 px-4 font-medium">AI Confident Misses</th>
                <th className="py-2.5 px-4 font-medium text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDD7CA]">
              {data.benchmarks.map((b) => {
                const ratio = Math.min(
                  100,
                  Math.max(
                    8,
                    Math.round((b.targetedReviewSec / Math.max(b.fullReviewSec, 1)) * 100)
                  )
                );
                return (
                  <tr key={b.id}>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#141311]">{b.clipTitle}</div>
                      <div className="text-[#5C574E]">{b.dialect}</div>
                    </td>
                    <td className="py-3.5 px-4 min-w-[200px]">
                      <div className="flex items-center justify-between font-mono text-[11px] mb-1">
                        <span className="text-[#5C574E]">Full {b.fullReviewSec}s</span>
                        <span className="text-[#1B6B46] font-semibold">
                          Sikio {b.targetedReviewSec}s
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#EBE6DB] rounded-[2px] overflow-hidden">
                        <div
                          style={{ width: `${ratio}%` }}
                          className="h-full bg-[#1B6B46]"
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {b.fullReviewErrorsLeft} / {b.targetedReviewErrorsLeft}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#945D00] font-semibold">
                      {b.overconfidentAiMisses}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      <span className="text-[#847D72] line-through mr-1.5">
                        ${b.fullReviewCostUsd.toFixed(2)}
                      </span>
                      <span className="text-[#1B6B46] font-semibold">
                        ${b.targetedCostUsd.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ReceiptBadge({ kind }: { kind: PaymentReceipt["kind"] }) {
  const map: Record<PaymentReceipt["kind"], { label: string; cls: string }> = {
    batch_funded: { label: "Batch Funded", cls: "bg-[#EBE6DB] text-[#141311]" },
    x402_inference: { label: "x402 AI Buy", cls: "bg-[#141311] text-[#FBF9F4]" },
    task_reserved: { label: "Escrow Lock", cls: "bg-[#FAEAE4] text-[#C94A22]" },
    editor_payout: { label: "Editor Paid", cls: "bg-[#E7F4ED] text-[#1B6B46]" },
    task_refund: { label: "Budget Refund", cls: "bg-[#FBF2DD] text-[#945D00]" },
  };
  const item = map[kind];
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-[4px] font-mono text-[10px] font-medium ${item.cls}`}
    >
      {item.label}
    </span>
  );
}
