"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { BatchBudget, ReviewTask } from "@/lib/types";
import { explorerTxUrl, shortAddr } from "@/lib/aevum";
import { useWallet } from "@/components/WalletContext";

interface ApproveState {
  batch: BatchBudget;
  tasks: ReviewTask[];
  availableBudgetTusd8: number;
}

function notifyNavSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sikio:state-updated"));
  }
}

export default function ApprovePage() {
  const { address, isAevum } = useWallet();
  const [state, setState] = useState<ApproveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const json = (await res.json()) as ApproveState;
      setState(json);
      notifyNavSync();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const waiting = useMemo(
    () =>
      (state?.tasks || []).filter(
        (t) => t.status === "submitted" || t.status === "offered"
      ),
    [state]
  );

  const settled = useMemo(
    () =>
      (state?.tasks || []).filter(
        (t) =>
          t.status === "accepted" ||
          t.status === "rejected" ||
          t.status === "expired"
      ),
    [state]
  );

  const playExcerpt = (task: ReviewTask) => {
    const el = audioRef.current;
    if (!el) return;
    if (playingId === task.id) {
      el.pause();
      setPlayingId(null);
      return;
    }
    const src = task.clipId.startsWith("custom-")
      ? "/clips/lagos-fintech-ep14.wav"
      : `/api/excerpt/${task.clipId}?start=${task.start}&end=${task.end}`;
    el.src = src;
    el.currentTime = 0;
    el.play()
      .then(() => setPlayingId(task.id))
      .catch(() => {});
  };

  const handleAction = async (
    task: ReviewTask,
    action: "accept" | "reject" | "expire"
  ) => {
    setError(null);
    setBanner(null);
    setBusyId(task.id);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          taskId: task.id,
          approverAddress: address || state?.batch.approverAddress,
          mode: address && isAevum ? "aevum-live" : "sandbox",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `Failed to ${action} task.`);
        return;
      }
      await load();
      if (action === "accept") {
        setBanner(
          `Paid ${task.feeTusd8.toFixed(2)} tUSD8 once to ${task.editorName} (${task.editorCity}) and merged "${
            task.submittedText || task.aiGuess
          }" into Studio captions.`
        );
      } else {
        setBanner(
          `Returned ${task.feeTusd8.toFixed(2)} tUSD8 back to available batch budget.`
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  if (loading || !state) {
    return (
      <div className="space-y-4">
        <div className="h-12 w-60 rounded-[5px] bg-[#EBE6DB] animate-pulse" />
        <div className="h-48 rounded-[6px] bg-[#EBE6DB] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#DDD7CA]">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#5C574E]">
            Quality Control · Approver {shortAddr(state.batch.approverAddress)}
          </div>
          <h1 className="text-2xl sm:text-[30px] font-semibold tracking-[-0.03em] text-[#141311] mt-0.5">
            Approve & Settle Once
          </h1>
          <p className="text-sm text-[#5C574E] mt-0.5">
            Verify the editor’s wording against the excerpt. ReviewEscrow releases tUSD8 once per taskId.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs shrink-0">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-[5px] bg-[#FBF9F4] border border-[#DDD7CA] font-medium text-[#141311] hover:border-[#141311] transition-colors"
          >
            Replay in Studio
          </Link>
          <Link
            href="/receipts"
            className="px-3 py-1.5 rounded-[5px] bg-[#EBE6DB] font-medium text-[#141311] hover:bg-[#DDD7CA] transition-colors"
          >
            Receipts
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-[5px] bg-[#FAEAE4] border border-[#E8C5B8] px-4 py-2.5 text-xs text-[#B33C17]">
          {error}
        </div>
      )}

      {banner && (
        <div className="rounded-[5px] bg-[#E7F4ED] border border-[#C3E2D1] px-4 py-2.5 text-xs text-[#1B6B46] flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {banner}
          </span>
          <Link
            href="/"
            className="font-semibold underline inline-flex items-center gap-1"
          >
            Replay corrected captions <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Pending QC Queue */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-[0.06em] font-semibold text-[#5C574E]">
            Pending Decisions ({waiting.length})
          </h2>
          <span className="text-xs font-mono text-[#5C574E] tabular-nums">
            Escrowed: {state.batch.reservedTusd8.toFixed(2)} tUSD8
          </span>
        </div>

        {waiting.length === 0 ? (
          <div className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-[#141311]">
              Approval queue is clear.
            </p>
            <p className="text-xs text-[#5C574E]">
              Run a clip in Studio and submit an editor fix in Ear to verify and settle tUSD8.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {waiting.map((task) => {
              const isSubmitted = task.status === "submitted";
              return (
                <div
                  key={task.id}
                  className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] overflow-hidden"
                >
                  <div className="px-5 py-2.5 border-b border-[#DDD7CA] bg-[#F4F1EA]/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-[4px] font-mono text-[11px] font-medium ${
                          isSubmitted
                            ? "bg-[#FBF2DD] text-[#945D00]"
                            : "bg-[#EBE6DB] text-[#5C574E]"
                        }`}
                      >
                        {isSubmitted ? "SUBMITTED" : "AWAITING EDITOR"}
                      </span>
                      <span className="font-semibold text-[#141311]">
                        {task.clipTitle}
                      </span>
                      <span className="font-mono text-[#5C574E]">
                        {task.start.toFixed(1)}s–{task.end.toFixed(1)}s
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-[#141311] tabular-nums">
                      {task.feeTusd8.toFixed(2)} tUSD8 escrowed
                    </span>
                  </div>

                  <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="space-y-3 flex-1">
                      {/* Split-Comparison Diff */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                        <div className="rounded-[5px] bg-[#FAEAE4]/60 border border-[#E8C5B8] p-3">
                          <div className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#B33C17] mb-1">
                            AI Guess ({Math.round(task.minConfidence * 100)}%)
                          </div>
                          <div className="font-medium text-[#141311] line-through">
                            {task.aiGuess}
                          </div>
                        </div>
                        <div className="rounded-[5px] bg-[#E7F4ED]/70 border border-[#C3E2D1] p-3">
                          <div className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#1B6B46] mb-1">
                            {task.editorName} ({task.editorCity})
                          </div>
                          <div className="font-semibold text-[#141311]">
                            {task.submittedText || task.aiGuess}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-[#5C574E] leading-relaxed">
                        Context: “{task.contextBefore}{" "}
                        <strong className="text-[#141311]">
                          {task.submittedText || task.aiGuess}
                        </strong>{" "}
                        {task.contextAfter}”
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => playExcerpt(task)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-[#141311] text-[#FBF9F4] font-medium hover:bg-[#2B2926] cursor-pointer"
                        >
                          {playingId === task.id ? (
                            <>
                              <Pause className="w-3.5 h-3.5" /> Pause excerpt
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" /> Hear excerpt
                            </>
                          )}
                        </button>
                        <span className="text-[#5C574E]">
                          Editor pays 0 tQDAY · Payout settles once
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap lg:flex-col gap-2 shrink-0 lg:w-48">
                      <button
                        type="button"
                        disabled={busyId === task.id}
                        onClick={() => handleAction(task, "accept")}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[5px] text-xs font-semibold bg-[#1B6B46] text-[#FBF9F4] hover:bg-[#145537] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Accept & Pay {task.feeTusd8.toFixed(2)}
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === task.id}
                          onClick={() => handleAction(task, "reject")}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-[5px] text-xs font-medium bg-[#FBF9F4] border border-[#DDD7CA] text-[#C94A22] hover:bg-[#FAEAE4] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button
                          type="button"
                          disabled={busyId === task.id}
                          onClick={() => handleAction(task, "expire")}
                          title="Simulate task expiry returning fee to batch budget"
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-[5px] text-xs font-medium bg-[#FBF9F4] border border-[#DDD7CA] text-[#5C574E] hover:text-[#141311] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" /> Expire
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Settled Audit History */}
      {settled.length > 0 && (
        <section className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#DDD7CA] bg-[#F4F1EA]/70 flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-[0.06em] font-semibold text-[#5C574E]">
              Settled Decisions ({settled.length})
            </h2>
            <span className="text-xs text-[#5C574E]">
              Exact-once settlement per taskId
            </span>
          </div>
          <div className="divide-y divide-[#DDD7CA]">
            {settled.map((t) => (
              <div
                key={t.id}
                className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-medium text-[#141311]">
                    “{t.aiGuess}” → “{t.submittedText || t.aiGuess}” · {t.editorName}
                  </div>
                  <div className="text-[#5C574E] font-mono">
                    {t.approvedBy
                      ? `Approved by ${shortAddr(t.approvedBy)}`
                      : t.rejectionReason || t.status}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-[4px] font-mono font-medium tabular-nums ${
                      t.status === "accepted"
                        ? "bg-[#E7F4ED] text-[#1B6B46]"
                        : "bg-[#EBE6DB] text-[#5C574E]"
                    }`}
                  >
                    {t.status === "accepted"
                      ? `Paid ${t.feeTusd8.toFixed(2)} tUSD8`
                      : `Refunded ${t.feeTusd8.toFixed(2)} tUSD8`}
                  </span>
                  {t.settleTxHash && (
                    <a
                      href={explorerTxUrl(t.settleTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[#5C574E] hover:text-[#141311]"
                    >
                      {t.settleTxHash.slice(0, 10)}…
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
