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
          }" into captions.`
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
        <div className="h-12 w-60 rounded-[6px] bg-[#EFECE4] animate-pulse" />
        <div className="h-48 rounded-[8px] bg-[#EFECE4] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold tracking-[-0.025em] text-[#161513]">
            Approve
          </h1>
          <p className="text-sm text-[#5C584F] mt-0.5">
            Named agency approver (<span className="font-mono">{shortAddr(state.batch.approverAddress)}</span>) verifies linguistic accuracy. ReviewEscrow pays each accepted task once.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-[6px] bg-[#FCFBF8] border border-[#E2DDD2] font-medium text-[#161513] hover:border-[#CFC8B8]"
          >
            Replay in Studio
          </Link>
          <Link
            href="/receipts"
            className="px-3 py-1.5 rounded-[6px] bg-[#EFECE4] font-medium text-[#161513]"
          >
            View Receipts
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-[6px] bg-[#F9EAE4] border border-[#EBC7BA] px-4 py-2.5 text-xs text-[#B8381A]">
          {error}
        </div>
      )}

      {banner && (
        <div className="rounded-[6px] bg-[#E9F4EE] border border-[#C6E3D3] px-4 py-2.5 text-xs text-[#1D6B48] flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {banner}
          </span>
          <Link href="/" className="font-semibold underline inline-flex items-center gap-1">
            Replay fixed captions <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Pending Review Queue */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#161513]">
          Waiting for Decision ({waiting.length})
        </h2>

        {waiting.length === 0 ? (
          <div className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] p-8 text-center space-y-2">
            <p className="text-sm font-medium text-[#161513]">
              No pending corrections in the approval queue.
            </p>
            <p className="text-xs text-[#5C584F]">
              Run a clip in Studio and submit an editor fix in Ear to approve and settle tUSD8.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {waiting.map((task) => {
              const isSubmitted = task.status === "submitted";
              return (
                <div
                  key={task.id}
                  className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-2.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-[4px] font-medium ${
                          isSubmitted
                            ? "bg-[#FBF2DE] text-[#945F00]"
                            : "bg-[#EFECE4] text-[#5C584F]"
                        }`}
                      >
                        {isSubmitted ? "Editor Submitted" : "Awaiting Editor"}
                      </span>
                      <span className="font-medium text-[#161513]">
                        {task.clipTitle}
                      </span>
                      <span className="font-mono text-[#5C584F]">
                        {task.start.toFixed(1)}s–{task.end.toFixed(1)}s
                      </span>
                      <span className="text-[#5C584F]">
                        Editor: {task.editorName} ({task.editorCity})
                      </span>
                    </div>

                    {/* Before / After Diff */}
                    <div className="rounded-[6px] bg-[#F7F5F0] border border-[#E2DDD2] p-3 text-sm leading-relaxed">
                      <span className="text-[#5C584F]">{task.contextBefore} </span>
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-[#F9EAE4] text-[#B8381A] line-through mr-1.5">
                        {task.aiGuess}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-[#E9F4EE] text-[#1D6B48] font-semibold">
                        {task.submittedText || task.aiGuess}
                      </span>
                      <span className="text-[#5C584F]"> {task.contextAfter}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#5C584F]">
                      <button
                        type="button"
                        onClick={() => playExcerpt(task)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[#EFECE4] text-[#161513] font-medium hover:bg-[#E2DDD2] cursor-pointer"
                      >
                        {playingId === task.id ? (
                          <>
                            <Pause className="w-3.5 h-3.5" /> Pause excerpt
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" /> Verify excerpt
                          </>
                        )}
                      </button>
                      <span className="font-mono tabular-nums">
                        Escrowed: {task.feeTusd8.toFixed(2)} tUSD8
                      </span>
                      <span>Gas: sponsored (editor pays 0 tQDAY)</span>
                    </div>
                  </div>

                  {/* Approver Controls */}
                  <div className="flex flex-wrap lg:flex-col gap-2 shrink-0 lg:w-44">
                    <button
                      type="button"
                      disabled={busyId === task.id}
                      onClick={() => handleAction(task, "accept")}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[6px] text-xs font-medium bg-[#1D6B48] text-[#FCFBF8] hover:bg-[#165539] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Accept & Pay {task.feeTusd8.toFixed(2)}
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === task.id}
                        onClick={() => handleAction(task, "reject")}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-[6px] text-xs font-medium bg-[#FCFBF8] border border-[#E2DDD2] text-[#B8381A] hover:bg-[#F9EAE4] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        type="button"
                        disabled={busyId === task.id}
                        onClick={() => handleAction(task, "expire")}
                        title="Simulate task expiry returning fee to batch budget"
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-[6px] text-xs font-medium bg-[#FCFBF8] border border-[#E2DDD2] text-[#5C584F] hover:text-[#161513] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" /> Expire
                      </button>
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
        <section className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2DDD2] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#161513]">
              Settled Decisions ({settled.length})
            </h2>
            <span className="text-xs text-[#5C584F]">
              Exact-once settlement enforced per taskId
            </span>
          </div>
          <div className="divide-y divide-[#E2DDD2]">
            {settled.map((t) => (
              <div
                key={t.id}
                className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-medium text-[#161513]">
                    “{t.aiGuess}” → “{t.submittedText || t.aiGuess}” · {t.editorName}
                  </div>
                  <div className="text-[#5C584F] font-mono">
                    {t.approvedBy
                      ? `Approved by ${shortAddr(t.approvedBy)}`
                      : t.rejectionReason || t.status}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-[4px] font-medium tabular-nums ${
                      t.status === "accepted"
                        ? "bg-[#E9F4EE] text-[#1D6B48]"
                        : "bg-[#EFECE4] text-[#5C584F]"
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
                      className="inline-flex items-center gap-1 font-mono text-[#5C584F] hover:text-[#161513]"
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
