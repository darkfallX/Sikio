"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
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
  verifiedOnChainProofs: PaymentReceipt[];
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

const CONTRACT_RULES: [string, string][] = [
  ["Exact-once settlement", "Each taskId and x402 requestId settles at most once. Repeated acceptTask reverts."],
  ["Budget and task caps", "Agent cannot spend or reserve beyond maxBudget, maxTaskFee, or expiry."],
  ["Editor allowlist", "Agent assigns tasks only to agency-approved native speakers."],
  ["Approver authority", "Only batch.approver or batch.agency releases funds."],
  ["Excerpt confidentiality", "/api/excerpt slices raw WAV PCM bytes to at most 12 seconds."],
  ["Zero-gas editor submit", "EIP-712 submitCorrectionBySig verified live on Aevum 44005 with a 0 tQDAY editor wallet."],
];

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
        "Accept one submitted task in Approve first, then test double-pay rejection."
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
      `HTTP ${res.status} · ${json.error || "Task already settled"}`
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
      <div className="space-y-6">
        <div className="h-14 w-56 rounded-[12px] bg-[var(--panel)] animate-pulse" />
        <div className="h-72 rounded-[12px] bg-[var(--panel)] animate-pulse" />
      </div>
    );
  }

  const totalFull = data.benchmarks.reduce((a, b) => a + b.fullReviewSec, 0);
  const totalTargeted = data.benchmarks.reduce(
    (a, b) => a + b.targetedReviewSec,
    0
  );
  const avgSaved =
    totalFull > 0 ? Math.round((1 - totalTargeted / totalFull) * 100) : 0;
  const totalMisses = data.benchmarks.reduce(
    (a, b) => a + b.overconfidentAiMisses,
    0
  );

  return (
    <div className="space-y-12 sm:space-y-16">
      <section className="space-y-2 sikio-rise">
        <h1 className="type-page text-[var(--ink)]">Receipts</h1>
        <p className="text-[16px] text-[var(--ink-2)]">
          Every payment in this session, the live transactions on QDay Aevum, the contract rules, and our review timings.
        </p>
      </section>

      {/* Section 1: Reconciled Active Session Ledger */}
      <section className="rounded-[12px] hairline double-rule bg-[var(--paper)] hero-elevation overflow-hidden">
        <div className="px-5 py-3.5 hairline-b bg-[var(--bg)]/45 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="type-label">
              This session ({data.receipts.length})
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-[var(--panel)] text-[var(--mute)] font-mono text-[10px]">
              Reconciled
            </span>
          </div>
          <span className="font-mono text-xs tabular-nums text-[var(--ink-2)]">
            Settled {data.batch.spentTusd8.toFixed(2)} · Escrowed{" "}
            {data.batch.reservedTusd8.toFixed(2)} · Left{" "}
            {data.availableBudgetTusd8.toFixed(2)} tUSD8
          </span>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="hairline-b text-[var(--mute)] font-mono uppercase text-[10px] tracking-[0.08em]">
                <th className="py-3 px-5 font-medium">Event</th>
                <th className="py-3 px-5 font-medium">Detail</th>
                <th className="py-3 px-5 font-medium text-right">Amount</th>
                <th className="py-3 px-5 font-medium">Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {data.receipts.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--hover)]">
                  <td className="py-3.5 px-5 align-top whitespace-nowrap">
                    <ReceiptBadge kind={r.kind} settlementState={r.settlementState} />
                  </td>
                  <td className="py-3.5 px-5 align-top max-w-md">
                    <div className="font-semibold text-[var(--ink)]">{r.actorLabel}</div>
                    <div className="text-[var(--mute)] mt-0.5">{r.note}</div>
                  </td>
                  <td className="py-3.5 px-5 align-top text-right font-mono font-semibold tabular-nums whitespace-nowrap text-[var(--ink)]">
                    {r.amountTusd8.toFixed(2)} tUSD8
                  </td>
                  <td className="py-3.5 px-5 align-top font-mono whitespace-nowrap">
                    <ReceiptRefCell receipt={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked Editorial Ledger Rows (Zero clipping at 375px) */}
        <div className="md:hidden divide-y divide-[var(--line)]">
          {data.receipts.map((r) => (
            <div key={r.id} className="p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <ReceiptBadge kind={r.kind} settlementState={r.settlementState} />
                <span className="font-mono font-semibold tabular-nums text-[var(--ink)]">
                  {r.amountTusd8.toFixed(2)} tUSD8
                </span>
              </div>
              <div className="font-semibold text-[var(--ink)]">{r.actorLabel}</div>
              <div className="text-[var(--mute)]">{r.note}</div>
              <div className="pt-1 font-mono text-[11px]">
                <ReceiptRefCell receipt={r} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Verified QDay Aevum 44005 Proof */}
      <section className="rounded-[12px] hairline bg-[var(--paper)] overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--line)] bg-[var(--bg)]/45 hairline-b">
          <div className="p-5 space-y-1">
            <div className="type-label">ReviewEscrow · 44005</div>
            <div className="flex items-center gap-2">
              {data.network.reviewEscrowAddress ? (
                <>
                  <a
                    href={explorerAddressUrl(data.network.reviewEscrowAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-[var(--ink)] hover:text-[var(--signal)]"
                  >
                    {shortAddr(data.network.reviewEscrowAddress)}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={copyContract}
                    aria-label="Copy contract address"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-[6px] hairline bg-[var(--paper)] text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    {copiedAddr ? (
                      <Check className="w-3.5 h-3.5 text-[var(--green)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </>
              ) : (
                <span className="font-mono text-sm">Not deployed</span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-1">
            <div className="type-label">tUSD8 · 6 decimals</div>
            <a
              href={explorerAddressUrl(data.network.tusd8Address)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-[var(--ink)] hover:text-[var(--signal)]"
            >
              {shortAddr(data.network.tusd8Address)}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="p-5 space-y-1">
            <div className="type-label">Verified on-chain proof</div>
            <div className="text-sm font-medium text-[var(--ink)]">
              Chain proves payout once. Approver verifies words.
            </div>
          </div>
        </div>

        <div className="px-5 py-3 hairline-b bg-[var(--bg)]/25 flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-label">
            Confirmed Aevum 44005 transactions ({data.verifiedOnChainProofs.length})
          </h2>
          <span className="font-mono text-[11px] text-[var(--green)]">
            Nov 22, 2026 · Live testnet settlement
          </span>
        </div>

        <div className="divide-y divide-[var(--line)]">
          {data.verifiedOnChainProofs.map((p) => (
            <div
              key={p.id}
              className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-[var(--hover)]"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ReceiptBadge kind={p.kind} />
                  <span className="font-semibold text-[var(--ink)]">
                    {p.actorLabel}
                  </span>
                </div>
                <div className="text-[var(--mute)]">{p.note}</div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 font-mono">
                <span className="font-semibold tabular-nums text-[var(--ink)]">
                  {p.amountTusd8.toFixed(2)} tUSD8
                </span>
                <a
                  href={explorerTxUrl(p.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--green)] font-semibold hover:underline"
                >
                  {shortHash(p.txHash)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Contract rules */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="type-section text-[var(--ink)]">Contract rules</h2>
          <button
            type="button"
            onClick={testDoublePayProtection}
            className="min-h-[44px] sm:min-h-[40px] px-4 rounded-[var(--r-sm)] text-sm font-semibold bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 cursor-pointer"
          >
            Try to pay twice
          </button>
        </div>

        {doublePayResult && (
          <div
            aria-live="polite"
            className="rounded-[12px] hairline bg-[var(--panel)] px-5 py-3 font-mono text-xs text-[var(--ink)]"
          >
            {doublePayResult}
          </div>
        )}

        <div className="rounded-[12px] hairline bg-[var(--paper)] divide-y divide-[var(--line)] overflow-hidden">
          {CONTRACT_RULES.map(([rule, detail]) => (
            <div
              key={rule}
              className="px-5 py-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2 text-sm"
            >
              <div className="sm:col-span-4 font-semibold text-[var(--ink)]">
                {rule}
              </div>
              <div className="sm:col-span-8 text-[var(--ink-2)]">{detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: A/B benchmark */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="type-section text-[var(--ink)]">A/B review benchmark</h2>
          <button
            type="button"
            onClick={() => setShowBenchForm((v) => !v)}
            className="min-h-[44px] sm:min-h-[38px] px-4 rounded-[8px] text-xs font-semibold hairline bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer"
          >
            {showBenchForm ? "Close" : "Log run"}
          </button>
        </div>

        <div className="rounded-[12px] hairline bg-[var(--paper)] overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--line)] hairline-b">
            <div className="p-5">
              <div className="type-label">Time saved (pilot)</div>
              <div className="font-mono text-2xl font-semibold text-[var(--green)] tabular-nums mt-1">
                {avgSaved}% faster
              </div>
            </div>
            <div className="p-5">
              <div className="type-label">Overconfident AI misses</div>
              <div className="font-mono text-2xl font-semibold text-[var(--amber)] tabular-nums mt-1">
                {totalMisses} in {data.benchmarks.length} clips
              </div>
            </div>
            <div className="p-5 text-xs text-[var(--ink-2)] flex items-center">
              Pilot dataset. Production benchmark runs await studio partner clips.
            </div>
          </div>

          {showBenchForm && (
            <form
              onSubmit={handleAddBenchmark}
              className="p-5 hairline-b bg-[var(--bg)]/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs"
            >
              <input
                required
                placeholder="Clip title"
                value={benchForm.clipTitle}
                onChange={(e) =>
                  setBenchForm((f) => ({ ...f, clipTitle: e.target.value }))
                }
                className="min-h-[44px] px-3 rounded-[8px] hairline bg-[var(--paper)] text-[var(--ink)]"
              />
              <input
                required
                placeholder="Dialect"
                value={benchForm.dialect}
                onChange={(e) =>
                  setBenchForm((f) => ({ ...f, dialect: e.target.value }))
                }
                className="min-h-[44px] px-3 rounded-[8px] hairline bg-[var(--paper)] text-[var(--ink)]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Full sec"
                  value={benchForm.fullReviewSec}
                  onChange={(e) =>
                    setBenchForm((f) => ({
                      ...f,
                      fullReviewSec: Number(e.target.value),
                    }))
                  }
                  className="min-h-[44px] px-3 rounded-[8px] hairline bg-[var(--paper)] font-mono tabular-nums"
                />
                <input
                  type="number"
                  placeholder="Sikio sec"
                  value={benchForm.targetedReviewSec}
                  onChange={(e) =>
                    setBenchForm((f) => ({
                      ...f,
                      targetedReviewSec: Number(e.target.value),
                    }))
                  }
                  className="min-h-[44px] px-3 rounded-[8px] hairline bg-[var(--paper)] font-mono tabular-nums"
                />
              </div>
              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="min-h-[44px] px-4 rounded-[8px] bg-[var(--ink)] text-[var(--paper)] font-semibold cursor-pointer"
                >
                  Save run
                </button>
              </div>
            </form>
          )}

          {/* Desktop benchmark table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="hairline-b text-[var(--mute)] font-mono uppercase text-[10px] tracking-[0.08em]">
                  <th className="py-3 px-5 font-medium">Clip</th>
                  <th className="py-3 px-5 font-medium">Review time</th>
                  <th className="py-3 px-5 font-medium">Errors</th>
                  <th className="py-3 px-5 font-medium">AI misses</th>
                  <th className="py-3 px-5 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {data.benchmarks.map((b) => {
                  const pct = Math.min(
                    100,
                    Math.max(
                      8,
                      Math.round(
                        (b.targetedReviewSec / Math.max(b.fullReviewSec, 1)) *
                          100
                      )
                    )
                  );
                  return (
                    <tr key={b.id}>
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-[var(--ink)]">
                          {b.clipTitle}
                        </div>
                        <div className="text-[var(--mute)]">{b.dialect}</div>
                      </td>
                      <td className="py-3.5 px-5 min-w-[180px]">
                        <div className="flex justify-between font-mono text-[11px] mb-1">
                          <span className="text-[var(--mute)]">
                            {b.fullReviewSec}s
                          </span>
                          <span className="text-[var(--green)] font-semibold">
                            {b.targetedReviewSec}s
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[var(--panel)] overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-[var(--green)] sikio-bar-fill"
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-mono">
                        {b.fullReviewErrorsLeft} / {b.targetedReviewErrorsLeft}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-[var(--amber)] font-semibold">
                        {b.overconfidentAiMisses}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono whitespace-nowrap">
                        <span className="line-through text-[var(--mute)] mr-2">
                          ${b.fullReviewCostUsd.toFixed(2)}
                        </span>
                        <span className="text-[var(--green)] font-semibold">
                          ${b.targetedCostUsd.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Benchmark Cards (Zero horizontal clipping at 375px!) */}
          <div className="md:hidden divide-y divide-[var(--line)] text-xs tabular-nums">
            {data.benchmarks.map((b) => {
              const pct = Math.min(
                100,
                Math.max(
                  8,
                  Math.round(
                    (b.targetedReviewSec / Math.max(b.fullReviewSec, 1)) * 100
                  )
                )
              );
              return (
                <div key={b.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[var(--ink)]">
                        {b.clipTitle}
                      </div>
                      <div className="text-[var(--mute)]">{b.dialect}</div>
                    </div>
                    <div className="font-mono text-right shrink-0">
                      <span className="line-through text-[var(--mute)] block">
                        ${b.fullReviewCostUsd.toFixed(2)}
                      </span>
                      <span className="text-[var(--green)] font-semibold">
                        ${b.targetedCostUsd.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-[var(--mute)]">
                        Full {b.fullReviewSec}s
                      </span>
                      <span className="text-[var(--green)] font-semibold">
                        Sikio {b.targetedReviewSec}s
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--panel)] overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-[var(--green)] sikio-bar-fill"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between font-mono text-[11px] text-[var(--mute)]">
                    <span>
                      Errors {b.fullReviewErrorsLeft} / {b.targetedReviewErrorsLeft}
                    </span>
                    <span className="text-[var(--amber)]">
                      {b.overconfidentAiMisses} AI misses
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function ReceiptRefCell({ receipt }: { receipt: PaymentReceipt }) {
  if (receipt.mode === "aevum-live") {
    return (
      <div>
        <a
          href={explorerTxUrl(receipt.txHash)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[var(--green)] font-semibold hover:underline"
        >
          {shortHash(receipt.txHash)}
          <ExternalLink className="w-3 h-3" />
        </a>
        <div className="text-[10px] text-[var(--mute)]">Testnet 44005</div>
      </div>
    );
  }
  return (
    <div>
      <span className="text-[var(--mute)]">
        local · {receipt.txHash.slice(0, 10)}…
      </span>
      <div className="text-[10px] text-[var(--mute)]">Sandbox</div>
    </div>
  );
}

function ReceiptBadge({
  kind,
  settlementState,
}: {
  kind: PaymentReceipt["kind"];
  settlementState?: PaymentReceipt["settlementState"];
}) {
  if (kind === "task_reserved" && settlementState === "settled") {
    return (
      <span className="inline-block px-2.5 py-0.5 rounded-full font-mono text-[10px] font-medium bg-[var(--panel)] text-[var(--mute)]">
        Lock settled
      </span>
    );
  }
  if (kind === "task_reserved" && settlementState === "refunded") {
    return (
      <span className="inline-block px-2.5 py-0.5 rounded-full font-mono text-[10px] font-medium bg-[var(--panel)] text-[var(--mute)]">
        Lock refunded
      </span>
    );
  }

  const map: Record<PaymentReceipt["kind"], { label: string; cls: string }> = {
    batch_funded: { label: "Funded", cls: "bg-[var(--panel)] text-[var(--ink)]" },
    x402_inference: { label: "x402 AI", cls: "bg-[var(--ink)] text-[var(--paper)]" },
    task_reserved: { label: "Held", cls: "bg-[var(--signal-bg)] text-[var(--signal-ink)]" },
    editor_payout: { label: "Paid once", cls: "bg-[var(--green-bg)] text-[var(--green-ink)]" },
    task_refund: { label: "Refunded", cls: "bg-[var(--red-bg)] text-[var(--red)]" },
  };
  const item = map[kind];
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full font-mono text-[10px] font-medium ${item.cls}`}
    >
      {item.label}
    </span>
  );
}
