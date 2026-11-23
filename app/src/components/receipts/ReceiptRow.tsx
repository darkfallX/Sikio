"use client";

import React from "react";
import { motion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { PaymentReceipt, ReviewTask } from "@/lib/types";
import { explorerTxUrl, shortHash } from "@/lib/aevum";
import { SPRING } from "@/components/motion-kit";

type Badge = { label: string; cls: string };

/* State badge for a receipt. Colours follow the app-wide state meaning. */
export function receiptBadge(
  kind: PaymentReceipt["kind"],
  settlementState?: PaymentReceipt["settlementState"]
): Badge {
  if (kind === "task_reserved" && settlementState === "settled") {
    return { label: "Lock settled", cls: "bg-[var(--returned-bg)] text-[var(--ink)]" };
  }
  if (kind === "task_reserved" && settlementState === "refunded") {
    return { label: "Lock refunded", cls: "bg-[var(--returned-bg)] text-[var(--ink)]" };
  }
  const map: Record<PaymentReceipt["kind"], Badge> = {
    batch_funded: { label: "Funded", cls: "pastel-lilac" },
    x402_inference: { label: "x402 AI", cls: "bg-[var(--ink)] text-[var(--bg)]" },
    task_reserved: { label: "Held", cls: "pastel-yellow" },
    editor_payout: { label: "Paid once", cls: "pastel-mint" },
    task_refund: { label: "Returned", cls: "bg-[var(--returned-bg)] text-[var(--ink)]" },
  };
  return map[kind];
}

export function ReceiptBadge({
  kind,
  settlementState,
}: {
  kind: PaymentReceipt["kind"];
  settlementState?: PaymentReceipt["settlementState"];
}) {
  const b = receiptBadge(kind, settlementState);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border-2 border-[var(--outline)] font-mono text-[11.5px] font-bold whitespace-nowrap ${b.cls}`}
    >
      {b.label}
    </span>
  );
}

/* What happened, in plain words. The raw note stays visible underneath. */
export function describeReceipt(r: PaymentReceipt, task?: ReviewTask): string {
  const who = task ? task.editorName : "the native speaker";
  const word = task ? `"${task.submittedText || task.aiGuess}"` : "a word";
  switch (r.kind) {
    case "batch_funded":
      return "Agency funded the batch";
    case "x402_inference":
      return "AI captions bought per request";
    case "task_reserved":
      if (r.settlementState === "settled") {
        return task ? `Hold for "${task.aiGuess}" closed by the payout` : "Hold closed by the payout";
      }
      if (r.settlementState === "refunded") {
        return task ? `Hold for "${task.aiGuess}" returned to the batch` : "Hold returned to the batch";
      }
      return task ? `Fee held while ${who} hears "${task.aiGuess}"` : "Fee held for a native speaker";
    case "editor_payout":
      return `Paid ${who} once for ${word}`;
    case "task_refund":
      return "Fee returned to the batch";
  }
}

/*
  Reference cell. Honesty rule: only genuine chain 44005 receipts (mode "aevum-live")
  link to the explorer. Sandbox digests are shown short, labelled, and never linked.
*/
export function ReceiptRef({ receipt, onPastel = false }: { receipt: PaymentReceipt; onPastel?: boolean }) {
  if (receipt.mode === "aevum-live") {
    return (
      <a
        href={explorerTxUrl(receipt.txHash)}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex items-center gap-1.5 min-h-[44px] md:min-h-[32px] font-mono text-[12.5px] font-bold underline underline-offset-4 decoration-2 ${
          onPastel ? "text-[#111]" : "text-[var(--paid-ink)]"
        }`}
      >
        {shortHash(receipt.txHash)}
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[12px] text-[var(--mute)]"
      title="Local sandbox record, not on chain"
    >
      <span className="px-1.5 rounded-md border border-[var(--line)] text-[10.5px] font-bold">sandbox</span>
      {receipt.txHash.slice(0, 10)}
    </span>
  );
}

export function ReceiptRow({
  receipt,
  task,
  index,
}: {
  receipt: PaymentReceipt;
  task?: ReviewTask;
  index: number;
}) {
  const muted = receipt.kind === "task_reserved" && receipt.settlementState !== "active";
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ ...SPRING.soft, delay: Math.min(index, 10) * 0.035 }}
      className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[120px_minmax(0,1fr)_130px_190px] items-center gap-x-4 gap-y-2 px-4 sm:px-6 py-4 hover:bg-[var(--hover)] transition-colors"
    >
      <div className="md:order-1">
        <ReceiptBadge kind={receipt.kind} settlementState={receipt.settlementState} />
      </div>
      <div
        className={`order-0 md:order-3 text-right font-mono font-bold text-[15px] tabular-nums whitespace-nowrap ${
          muted ? "text-[var(--mute)]" : ""
        }`}
      >
        {receipt.amountTusd8.toFixed(2)}
        <span className="ml-1 text-[11px] text-[var(--mute)]">tUSD8</span>
      </div>
      <div className="col-span-2 md:col-span-1 md:order-2 min-w-0">
        <div className={`font-bold text-[15px] leading-snug ${muted ? "text-[var(--ink-2)]" : ""}`}>
          {describeReceipt(receipt, task)}
        </div>
        <div className="text-[13px] text-[var(--mute)] leading-snug mt-0.5 break-words">{receipt.note}</div>
      </div>
      <div className="col-span-2 md:col-span-1 md:order-4 md:text-right">
        <ReceiptRef receipt={receipt} />
      </div>
    </motion.li>
  );
}
