"use client";

import React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Ear,
  Fuel,
  Loader2,
  Repeat1,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Wallet,
} from "lucide-react";
import { Button, Reveal } from "@/components/ui";
import { SPRING } from "@/components/motion-kit";

const RULES: { title: string; text: string; tone: string; Icon: typeof Repeat1 }[] = [
  {
    title: "Pays once",
    text: "Each task and each AI request settles one time. A second payout reverts.",
    tone: "pastel-mint",
    Icon: Repeat1,
  },
  {
    title: "Stays in budget",
    text: "The agent cannot spend past the batch cap, the fee cap per word, or the end date.",
    tone: "pastel-yellow",
    Icon: Wallet,
  },
  {
    title: "Trusted ears only",
    text: "Words go only to native speakers the agency added.",
    tone: "pastel-sky",
    Icon: Ear,
  },
  {
    title: "Approver decides",
    text: "Money moves only when the named approver or the agency says so.",
    tone: "pastel-pink",
    Icon: UserCheck,
  },
  {
    title: "12 seconds at most",
    text: "Editors hear a short slice, never the full recording.",
    tone: "pastel-lilac",
    Icon: Scissors,
  },
  {
    title: "No gas for editors",
    text: "Answers are signed and relayed. Proven live on chain 44005 with a wallet holding 0 tQDAY.",
    tone: "pastel-peach",
    Icon: Fuel,
  },
];

export type DoublePayResult =
  | { kind: "blocked"; status: number; message: string }
  | { kind: "allowed"; status: number; message: string }
  | { kind: "none" }
  | { kind: "error"; message: string };

export function ContractRules({
  result,
  testing,
  onTest,
}: {
  result: DoublePayResult | null;
  testing: boolean;
  onTest: () => void;
}) {
  return (
    <section aria-labelledby="rules-h" className="space-y-5">
      <div className="space-y-2">
        <h2 id="rules-h" className="type-section">
          Contract rules
        </h2>
        <p className="text-[15px] text-[var(--ink-2)]">Written into ReviewEscrow, checked on every call.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        {RULES.map(({ title, text, tone, Icon }, i) => (
          <Reveal key={title} delay={i * 0.05}>
            <motion.div
              whileHover={{ y: -3 }}
              transition={SPRING.snappy}
              className={`brut ${tone} h-full p-5 sm:p-6 grid gap-3 content-start`}
            >
              <span className="w-11 h-11 rounded-full border-2 border-[#111] bg-white grid place-items-center">
                <Icon className="w-5 h-5 text-[#111]" />
              </span>
              <h3 className="font-mono font-bold text-[18px] tracking-[-0.04em] leading-tight">{title}</h3>
              <p className="text-[14.5px] text-[#111]/75 leading-snug">{text}</p>
            </motion.div>
          </Reveal>
        ))}
      </div>

      {/* Try to pay twice */}
      <div className="brut bg-[var(--paper)] p-5 sm:p-7 grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="space-y-1.5 min-w-0">
          <h3 className="font-mono font-bold text-[18px] tracking-[-0.04em]">Try to pay twice</h3>
          <p className="text-[15px] text-[var(--ink-2)]">
            Ask the server to pay a word that is already paid. It should refuse.
          </p>
        </div>
        <Button variant="dark" size="lg" onClick={onTest} disabled={testing} className="w-full md:w-auto">
          {testing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Repeat1 className="w-5 h-5" />}
          Try to pay twice
        </Button>

        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key={JSON.stringify(result) + (testing ? "t" : "")}
              className="md:col-span-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={SPRING.soft}
            >
              <DoublePayOutcome result={result} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function DoublePayOutcome({ result }: { result: DoublePayResult }) {
  if (result.kind === "none") {
    return (
      <div role="status" className="rounded-[18px] border-2 border-dashed border-[var(--line)] px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px]">
        <span className="text-[var(--ink-2)]">Nothing is paid yet. Approve one answer first, then try again.</span>
        <Link href="/approve" className="inline-flex items-center gap-1 min-h-[44px] font-bold underline underline-offset-4 decoration-2">
          Go to Approve <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }
  if (result.kind === "error") {
    return (
      <div role="alert" className="rounded-[18px] border-2 border-[var(--outline)] bg-[var(--error-bg)] px-5 py-4 text-[15px] font-semibold">
        The test did not run: {result.message}
      </div>
    );
  }

  const blocked = result.kind === "blocked";
  return (
    <motion.div
      role="status"
      animate={blocked ? { x: [0, -10, 9, -6, 4, 0] } : undefined}
      transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-[18px] border-2 border-[var(--outline)] px-5 py-4 sm:pr-40 ${
        blocked ? "pastel-mint" : "bg-[var(--error-bg)] text-[var(--ink)]"
      }`}
    >
      <div className="flex items-start gap-3">
        {blocked ? (
          <ShieldCheck className="w-6 h-6 shrink-0 text-[#111]" />
        ) : (
          <ShieldAlert className="w-6 h-6 shrink-0 text-[var(--error)]" />
        )}
        <div className="min-w-0">
          <div className="font-mono font-bold text-[17px] tracking-[-0.03em]">
            {blocked ? "Blocked" : "Not blocked"}: HTTP {result.status}
          </div>
          <div className={`text-[14px] mt-0.5 break-words ${blocked ? "text-[#111]/75" : "text-[var(--ink-2)]"}`}>
            {result.message}
          </div>
        </div>
      </div>
      {blocked && (
        <motion.span
          aria-hidden="true"
          initial={{ opacity: 0, scale: 2.2, rotate: -24 }}
          animate={{ opacity: 1, scale: 1, rotate: -10 }}
          transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.05 }}
          className="hidden sm:inline-block absolute right-5 top-1/2 -translate-y-1/2 px-3 py-1 rounded-[10px] border-[3px] border-[#b3261e] text-[#b3261e] font-mono font-bold text-[20px] tracking-[-0.03em] bg-white/60"
        >
          Paid once
        </motion.span>
      )}
    </motion.div>
  );
}
