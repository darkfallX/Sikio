"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, ChevronDown, RotateCw } from "lucide-react";
import { BatchBudget, BenchmarkRun, PaymentReceipt, ReviewTask } from "@/lib/types";
import { Button } from "@/components/ui";
import { SPRING } from "@/components/motion-kit";
import { StatCards } from "@/components/receipts/StatCards";
import { ReceiptRow } from "@/components/receipts/ReceiptRow";
import { LiveOnChain } from "@/components/receipts/LiveOnChain";
import { ContractRules, DoublePayResult } from "@/components/receipts/ContractRules";
import { Benchmark, BenchForm } from "@/components/receipts/Benchmark";

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

const near = (a: number, b: number) => Math.abs(a - b) < 0.0005;
const LEDGER_PREVIEW = 8;

export default function ReceiptsPage() {
  const [data, setData] = useState<ReceiptsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doublePay, setDoublePay] = useState<DoublePayResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ReceiptsState;
      setData(json);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load receipts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Check the session receipts against the batch totals, exactly as the data says.
  const reconcile = useMemo(() => {
    if (!data) return null;
    const sum = (f: (r: PaymentReceipt) => boolean) =>
      data.receipts.filter(f).reduce((a, r) => a + r.amountTusd8, 0);
    const funded = sum((r) => r.kind === "batch_funded");
    const settled = sum((r) => r.kind === "editor_payout" || r.kind === "x402_inference");
    const held = sum((r) => r.kind === "task_reserved" && r.settlementState === "active");
    const ok =
      near(funded, data.batch.fundedTusd8) &&
      near(settled, data.batch.spentTusd8) &&
      near(held, data.batch.reservedTusd8);
    return { ok, funded, settled, held };
  }, [data]);

  const taskById = useMemo(() => {
    const m = new Map<string, ReviewTask>();
    data?.tasks.forEach((t) => m.set(t.id, t));
    return m;
  }, [data]);

  const testDoublePayProtection = async () => {
    const paidTask = data?.tasks.find((t) => t.status === "accepted");
    if (!paidTask) {
      setDoublePay({ kind: "none" });
      return;
    }
    setTesting(true);
    setDoublePay(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", taskId: paidTask.id }),
      });
      const json = await res.json().catch(() => ({}));
      setDoublePay(
        res.ok
          ? { kind: "allowed", status: res.status, message: "The server accepted a second payout. This should not happen." }
          : { kind: "blocked", status: res.status, message: json.error || "Task already settled" }
      );
    } catch (err) {
      setDoublePay({ kind: "error", message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setTesting(false);
    }
  };

  const saveBenchmark = async (form: BenchForm): Promise<string | null> => {
    try {
      const res = await fetch("/api/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        return json.error || `Could not save the run (HTTP ${res.status}).`;
      }
      await load();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Could not save the run.";
    }
  };

  if (loading) return <ReceiptsSkeleton />;

  if (!data) {
    return (
      <div className="max-w-xl mx-auto pt-6">
        <div className="brut-lg bg-[var(--paper)] p-7 sm:p-9 grid gap-4 justify-items-start">
          <span className="type-label">Receipts</span>
          <h1 className="type-section">Receipts did not load</h1>
          <p className="text-[var(--ink-2)]">Check that the app server is running, then try again.</p>
          {loadError && <p className="font-mono text-[13px] text-[var(--error)]">{loadError}</p>}
          <Button
            variant="primary"
            onClick={() => {
              setLoading(true);
              load();
            }}
          >
            <RotateCw className="w-4 h-4" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  const { batch } = data;
  const cap = Math.min(batch.fundedTusd8, batch.maxBudgetTusd8);

  return (
    <div className="space-y-14 sm:space-y-20">
      {/* Header + money */}
      <section className="space-y-7 sm:space-y-9">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING.soft}
          className="space-y-3"
        >
          <h1 className="type-page">Receipts</h1>
          <p className="text-[17px] text-[var(--ink-2)] max-w-[72ch]">
            Every payment in this session, checked against the batch, plus the real ones on chain.
          </p>
        </motion.header>

        <StatCards
          stats={[
            {
              label: "Funded",
              value: batch.fundedTusd8,
              sub: `Cap ${cap.toFixed(2)} · up to ${batch.maxTaskFeeTusd8.toFixed(2)} a word`,
              tone: "lilac",
            },
            {
              label: "Paid once",
              value: batch.spentTusd8,
              sub: "Settled to editors and AI",
              tone: "mint",
            },
            {
              label: "Held",
              value: batch.reservedTusd8,
              sub: "Waiting on an answer or approval",
              tone: "yellow",
            },
            {
              label: "Left",
              value: data.availableBudgetTusd8,
              sub: "Free to spend, in tUSD8",
              tone: "pink",
            },
          ]}
        />
      </section>

      {/* This session */}
      <section aria-labelledby="session-h" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <h2 id="session-h" className="type-section">
              This session
            </h2>
            <p className="text-[15px] text-[var(--ink-2)]">
              {data.receipts.length} {data.receipts.length === 1 ? "entry" : "entries"}, newest first. Sandbox records stay local and are never linked to the explorer.
            </p>
          </div>
          {reconcile &&
            (reconcile.ok ? (
              <span className="inline-flex items-center gap-2 min-h-[36px] px-3.5 rounded-full border-2 border-[var(--outline)] pastel-mint text-[13px] font-bold">
                <CheckCircle2 className="w-4 h-4" /> Matches the batch totals
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-2 min-h-[36px] px-3.5 rounded-full border-2 border-[var(--outline)] bg-[var(--warn-bg)] text-[var(--ink)] text-[13px] font-bold"
                title={`Receipts: funded ${reconcile.funded.toFixed(2)}, paid ${reconcile.settled.toFixed(2)}, held ${reconcile.held.toFixed(2)}`}
              >
                <AlertTriangle className="w-4 h-4 text-[var(--warn)]" /> Does not match the batch totals
              </span>
            ))}
        </div>

        <div className="brut bg-[var(--paper)] overflow-hidden">
          {data.receipts.length === 0 ? (
            <p className="px-6 py-10 text-center text-[15px] text-[var(--mute)]">
              No payments yet. Caption a clip in Studio to start the ledger.
            </p>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[120px_minmax(0,1fr)_130px_190px] gap-x-4 px-6 py-3 border-b-2 border-[var(--outline)] bg-[var(--panel)] font-mono text-[12px] font-bold text-[var(--mute)]">
                <span>State</span>
                <span>What happened</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Reference</span>
              </div>
              <ul className="divide-y-2 divide-[var(--line)]">
                {(showAll ? data.receipts : data.receipts.slice(0, LEDGER_PREVIEW)).map((r, i) => (
                  <ReceiptRow
                    key={r.id}
                    receipt={r}
                    index={i}
                    task={r.taskId ? taskById.get(r.taskId) : undefined}
                  />
                ))}
              </ul>
              {data.receipts.length > LEDGER_PREVIEW && (
                <div className="border-t-2 border-[var(--line)] px-4 sm:px-6 py-3 flex justify-center">
                  <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                    {showAll ? "Show fewer" : `Show all ${data.receipts.length}`}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <LiveOnChain
        proofs={data.verifiedOnChainProofs}
        escrowAddress={data.network.reviewEscrowAddress}
        tokenAddress={data.network.tusd8Address}
      />

      <ContractRules result={doublePay} testing={testing} onTest={testDoublePayProtection} />

      <Benchmark runs={data.benchmarks} onSave={saveBenchmark} />
    </div>
  );
}

function ReceiptsSkeleton() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Loading receipts">
      <div className="space-y-3">
        <div className="h-11 w-52 rounded-full bg-[var(--panel)] animate-pulse" />
        <div className="h-5 w-96 max-w-full rounded-full bg-[var(--panel)] animate-pulse" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-[var(--r)] bg-[var(--panel)] animate-pulse" />
        ))}
      </div>
      <div className="brut bg-[var(--paper)] p-4 grid gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 rounded-[14px] bg-[var(--panel)] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
