"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { AEVUM_CONFIG, explorerAddressUrl, explorerTxUrl, shortAddr } from "@/lib/aevum";

type Proof = {
  id: string;
  kind: string;
  actorLabel: string;
  amountTusd8: number;
  txHash: string;
  mode: string;
  timestamp?: string;
};

type Load = { status: "loading" } | { status: "error" } | { status: "ok"; proofs: Proof[] };

const PLAIN: Record<string, string> = {
  editor_payout: "Editor paid once",
  x402_inference: "AI transcript bought",
  batch_funded: "Budget set aside",
  task_reserved: "Fee held for a word",
  task_refund: "Fee returned",
};

function shortHash(h: string) {
  return h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h;
}

function day(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function ProofStrip() {
  const [state, setState] = useState<Load>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { verifiedOnChainProofs?: Proof[] };
      const list = Array.isArray(json.verifiedOnChainProofs) ? json.verifiedOnChainProofs : [];
      // Only genuine confirmed chain 44005 transactions get an explorer link.
      setState({ status: "ok", proofs: list.filter((p) => p.mode === "aevum-live" && /^0x[0-9a-fA-F]{64}$/.test(p.txHash)) });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="brut-lg overflow-hidden bg-[var(--paper)]">
        {state.status === "loading" && (
          <ul aria-label="Loading transactions" className="divide-y-2 divide-[var(--line)]">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-5 sm:px-7">
                <span className="h-9 w-28 rounded-full bg-[var(--line-soft)] sikio-led" />
                <span className="h-4 flex-1 rounded-full bg-[var(--line-soft)] sikio-led" />
              </li>
            ))}
          </ul>
        )}

        {state.status === "error" && (
          <div className="flex flex-col items-start gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-[15px] text-[var(--ink-2)]">
              Could not load the live list right now. The contract link below still works.
            </p>
            <button
              type="button"
              onClick={load}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-[var(--outline)] bg-[var(--paper)] px-4 text-[14px] font-bold press shadow-[3px_3px_0_var(--outline)]"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
          </div>
        )}

        {state.status === "ok" && state.proofs.length === 0 && (
          <p className="px-5 py-8 text-[15px] text-[var(--ink-2)] sm:px-7">
            No live transactions to show yet. The contract link below shows everything on chain.
          </p>
        )}

        {state.status === "ok" && state.proofs.length > 0 && (
          <ul className="divide-y-2 divide-[var(--line)]">
            {state.proofs.map((p, i) => (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 24, delay: i * 0.08 }}
              >
                <a
                  href={explorerTxUrl(p.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="group grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-[var(--hover)] sm:px-7"
                >
                  <span className="rounded-full border-2 border-[#111] bg-[var(--mint)] px-3 py-1 font-mono text-[13px] font-bold tabular-nums text-[#111]">
                    {p.amountTusd8.toFixed(2)}
                    <span className="hidden sm:inline"> tUSD8</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15.5px] font-bold leading-tight text-[var(--ink)]">
                      {PLAIN[p.kind] ?? p.actorLabel}
                    </span>
                    <span className="block truncate font-mono text-[12px] text-[var(--mute)]">
                      {shortHash(p.txHash)}
                      {day(p.timestamp) && <span className="hidden sm:inline">  ·  {day(p.timestamp)}</span>}
                    </span>
                  </span>
                  <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-[var(--outline)] bg-[var(--paper)] text-[var(--ink)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                    <ArrowUpRight className="h-4 w-4" />
                    <span className="sr-only">Open in the Aevum explorer</span>
                  </span>
                </a>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={explorerAddressUrl(AEVUM_CONFIG.reviewEscrowAddress)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-[var(--outline)] bg-[var(--paper)] px-4 text-[14px] font-bold text-[var(--ink)] press shadow-[3px_3px_0_var(--outline)]"
        >
          ReviewEscrow
          <span className="font-mono text-[12.5px] text-[var(--mute)]">{shortAddr(AEVUM_CONFIG.reviewEscrowAddress)}</span>
          <ArrowUpRight className="h-4 w-4" />
        </a>
        <Link
          href="/receipts"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[14px] font-bold text-[var(--ink)] underline-offset-4 hover:underline"
        >
          All receipts
        </Link>
      </div>
    </div>
  );
}
