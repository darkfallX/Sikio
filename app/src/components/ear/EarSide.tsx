"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Lock } from "lucide-react";
import { ReviewTask } from "@/lib/types";
import { CountUp, StatusPill } from "@/components/ui";

const money = (n: number) => `$${n.toFixed(2)}`;

function stateLabel(t: ReviewTask) {
  if (t.status === "accepted") return `Paid ${money(t.feeTusd8)}`;
  if (t.status === "submitted") return "Waiting";
  if (t.status === "rejected") return "Not accepted";
  return "Expired";
}

export function EarningsCards({ paid, waiting }: { paid: number; waiting: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <div className="brut bg-[var(--mint)] text-[var(--on-pastel)] p-4 sm:p-5 min-w-0">
        <div className="text-[13px] font-semibold">Paid to you</div>
        <CountUp
          value={paid}
          prefix="$"
          className="block mt-2 font-mono font-bold text-[28px] sm:text-[34px] leading-none tracking-[-0.05em]"
        />
      </div>
      <div className="brut bg-[var(--sky)] text-[var(--on-pastel)] p-4 sm:p-5 min-w-0">
        <div className="text-[13px] font-semibold">Waiting for approval</div>
        <CountUp
          value={waiting}
          prefix="$"
          className="block mt-2 font-mono font-bold text-[28px] sm:text-[34px] leading-none tracking-[-0.05em]"
        />
      </div>
    </div>
  );
}

export function AnswerHistory({ tasks }: { tasks: ReviewTask[] }) {
  const reduce = useReducedMotion();
  const [all, setAll] = useState(false);
  const sorted = [...tasks].sort((a, b) =>
    (b.submittedAt || "").localeCompare(a.submittedAt || "")
  );
  const shown = all ? sorted : sorted.slice(0, 5);

  return (
    <section aria-labelledby="ear-history-h" className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 id="ear-history-h" className="font-mono font-bold text-[15px] tracking-[-0.03em] text-[var(--ink)]">
          Your answers
        </h2>
        <span className="font-mono text-[13px] font-bold tabular-nums text-[var(--mute)]">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="px-1 text-[14px] text-[var(--mute)]">
          Words you answer show up here with their payment.
        </p>
      ) : (
        <ul className="rounded-[var(--r)] border-2 border-[var(--outline)] bg-[var(--paper)] overflow-hidden">
          <AnimatePresence initial={false}>
            {shown.map((t, i) => {
              const changed = t.submittedText && t.submittedText !== t.aiGuess;
              return (
                <motion.li
                  key={t.id}
                  layout={reduce ? false : "position"}
                  initial={reduce ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                  className={`flex items-center justify-between gap-3 px-4 min-h-[56px] py-2.5 ${
                    i > 0 ? "border-t-2 border-[var(--line)]" : ""
                  }`}
                >
                  <div className="min-w-0 text-[15px] leading-snug">
                    {changed ? (
                      <>
                        <s className="text-[var(--mute)] mr-1.5 break-words">{t.aiGuess}</s>
                        <span className="font-bold text-[var(--ink)] break-words">{t.submittedText}</span>
                      </>
                    ) : (
                      <span className="font-bold text-[var(--ink)] break-words">{t.submittedText || t.aiGuess}</span>
                    )}
                  </div>
                  <StatusPill status={t.status}>{stateLabel(t)}</StatusPill>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {sorted.length > 5 && (
            <li className="border-t-2 border-[var(--line)]">
              <button
                type="button"
                onClick={() => setAll((v) => !v)}
                className="w-full min-h-[48px] px-4 text-left text-[14px] font-bold text-[var(--ink)] hover:bg-[var(--panel)] cursor-pointer"
              >
                {all ? "Show fewer" : `Show all ${sorted.length}`}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export function PrivacyNote() {
  return (
    <div className="space-y-3 px-1">
      <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-[var(--mute)]">
        <span className="w-8 h-8 rounded-full bg-[var(--lilac)] text-[var(--on-pastel)] border-2 border-[var(--outline)] grid place-items-center shrink-0" aria-hidden="true">
          <Lock className="w-3.5 h-3.5" />
        </span>
        <span>
          You only ever hear up to 12 seconds around each word. The full recording stays with the agency.
        </span>
      </p>
      <Link
        href="/approve"
        className="inline-flex items-center gap-1.5 min-h-[44px] text-[14px] font-bold text-[var(--ink)] underline-offset-4 hover:underline"
      >
        Agency view: approve answers <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
