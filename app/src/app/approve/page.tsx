"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Play, Pause, ExternalLink } from "lucide-react";
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
      setBanner(
        action === "accept"
          ? `Paid ${task.feeTusd8.toFixed(2)} tUSD8 once to ${task.editorName} and merged "${
              task.submittedText || task.aiGuess
            }".`
          : `Returned ${task.feeTusd8.toFixed(2)} tUSD8 to available batch budget.`
      );
    } finally {
      setBusyId(null);
    }
  };

  if (loading || !state) {
    return (
      <div className="space-y-6">
        <div className="h-14 w-56 rounded-[14px] bg-[var(--panel)] animate-pulse" />
        <div className="h-56 rounded-[14px] bg-[var(--panel)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-16 sm:space-y-24">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />

      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="type-page text-[var(--ink)]">Approve</h1>
          <p className="text-[16px] text-[var(--ink-2)]">
            Approver <span className="font-mono text-sm">{shortAddr(state.batch.approverAddress)}</span> verifies wording. ReviewEscrow pays once per task.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/"
            className="min-h-[44px] sm:min-h-[38px] inline-flex items-center px-3.5 rounded-[8px] text-xs font-semibold hairline bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--hover)]"
          >
            Replay in Studio
          </Link>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-[14px] hairline bg-[var(--red-bg)] px-5 py-3.5 text-xs font-medium text-[var(--red)]"
        >
          {error}
        </div>
      )}

      {banner && (
        <div
          aria-live="polite"
          className="rounded-[14px] hairline bg-[var(--green-bg)] px-5 py-3.5 text-xs font-medium text-[var(--green)] flex flex-wrap items-center justify-between gap-2"
        >
          <span>{banner}</span>
          <Link href="/" className="font-semibold underline underline-offset-2">
            Replay fixed captions
          </Link>
        </div>
      )}

      {/* Pending queue ledger (hero object) */}
      <section className="rounded-[14px] hairline bg-[var(--paper)] hero-elevation overflow-hidden">
        <div className="px-5 py-3.5 hairline-b flex items-center justify-between">
          <h2 className="type-label">Waiting ({waiting.length})</h2>
          <span className="font-mono text-xs tabular-nums text-[var(--mute)]">
            Escrowed {state.batch.reservedTusd8.toFixed(2)} tUSD8
          </span>
        </div>

        {waiting.length === 0 ? (
          <div className="p-8 text-sm text-[var(--mute)]">
            No pending tasks. Run a clip in Studio and submit a fix in Ear.
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {waiting.map((task) => (
              <div
                key={task.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] font-medium ${
                        task.status === "submitted"
                          ? "bg-[var(--amber-bg)] text-[var(--amber)]"
                          : "bg-[var(--panel)] text-[var(--mute)]"
                      }`}
                    >
                      {task.status === "submitted" ? "Submitted" : "Offered"}
                    </span>
                    <span className="font-semibold text-[var(--ink)]">
                      {task.clipTitle}
                    </span>
                    <span className="font-mono text-[var(--mute)] tabular-nums">
                      {task.start.toFixed(1)}s · {task.end.toFixed(1)}s
                    </span>
                    <span className="text-[var(--mute)]">
                      {task.editorName} ({task.editorCity})
                    </span>
                  </div>

                  {/* Clean split diff */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 rounded-[10px] hairline overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-[var(--line)]">
                    <div className="px-4 py-3 bg-[var(--red-bg)]">
                      <div className="type-label text-[10px]">
                        AI · {Math.round(task.minConfidence * 100)}%
                      </div>
                      <div className="text-sm font-medium text-[var(--ink)] line-through mt-0.5">
                        {task.aiGuess}
                      </div>
                    </div>
                    <div className="px-4 py-3 bg-[var(--green-bg)]">
                      <div className="type-label text-[10px]">Editor</div>
                      <div className="text-sm font-semibold text-[var(--ink)] mt-0.5">
                        {task.submittedText || task.aiGuess}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--mute)]">
                    <button
                      type="button"
                      onClick={() => playExcerpt(task)}
                      className="min-h-[40px] inline-flex items-center gap-1.5 px-3 rounded-[8px] font-medium bg-[var(--ink)] text-[var(--paper)] cursor-pointer"
                    >
                      {playingId === task.id ? (
                        <>
                          <Pause className="w-3.5 h-3.5" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" /> Hear excerpt
                        </>
                      )}
                    </button>
                    <span className="font-mono tabular-nums">
                      {task.feeTusd8.toFixed(2)} tUSD8
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap lg:flex-col gap-2 shrink-0 lg:w-44">
                  <button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => handleAction(task, "accept")}
                    className="flex-1 min-h-[44px] px-4 rounded-[8px] text-xs font-semibold bg-[var(--signal)] text-[#faf8f2] hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    Accept · {task.feeTusd8.toFixed(2)}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busyId === task.id}
                      onClick={() => handleAction(task, "reject")}
                      className="min-h-[44px] sm:min-h-[38px] px-3 rounded-[8px] text-xs font-medium hairline bg-[var(--paper)] text-[var(--red)] hover:bg-[var(--red-bg)] cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={busyId === task.id}
                      onClick={() => handleAction(task, "expire")}
                      className="min-h-[44px] sm:min-h-[38px] px-3 rounded-[8px] text-xs font-medium hairline bg-[var(--paper)] text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      Expire
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Settled ledger */}
      {settled.length > 0 && (
        <section className="rounded-[14px] hairline bg-[var(--paper)] overflow-hidden">
          <div className="px-5 py-3.5 hairline-b flex items-center justify-between">
            <h2 className="type-label">Settled ({settled.length})</h2>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {settled.map((t) => (
              <div
                key={t.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--ink)]">
                    {t.aiGuess} → {t.submittedText || t.aiGuess} · {t.editorName}
                  </div>
                  <div className="font-mono text-[var(--mute)]">
                    {t.approvedBy
                      ? `Approved ${shortAddr(t.approvedBy)}`
                      : t.rejectionReason || t.status}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-mono font-medium tabular-nums ${
                      t.status === "accepted"
                        ? "bg-[var(--green-bg)] text-[var(--green)]"
                        : "bg-[var(--panel)] text-[var(--mute)]"
                    }`}
                  >
                    {t.status === "accepted"
                      ? `Paid ${t.feeTusd8.toFixed(2)}`
                      : `Refunded ${t.feeTusd8.toFixed(2)}`}
                  </span>
                  {t.settleTxHash && (
                    <a
                      href={explorerTxUrl(t.settleTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[var(--mute)] hover:text-[var(--ink)]"
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
