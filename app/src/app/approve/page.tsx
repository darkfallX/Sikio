"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Play, Pause, ExternalLink } from "lucide-react";
import { BatchBudget, ReviewTask } from "@/lib/types";
import { explorerTxUrl, shortAddr, shortHash } from "@/lib/aevum";
import { useWallet } from "@/components/WalletContext";
import { OrganicWaveRibbon } from "@/components/OrganicWaveRibbon";

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
  const { address, isAevum, liveEscrowMode, acceptTaskOnChain } = useWallet();
  const [state, setState] = useState<ApproveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playTime, setPlayTime] = useState(0);
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

  const submittedQueue = useMemo(
    () => (state?.tasks || []).filter((t) => t.status === "submitted"),
    [state]
  );

  const waitingEditors = useMemo(
    () => (state?.tasks || []).filter((t) => t.status === "offered"),
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

  useEffect(() => {
    if (!playingId) return;
    let raf = 0;
    let lastSync = 0;
    const sync = (now: number) => {
      if (now - lastSync >= 66) {
        lastSync = now;
        if (audioRef.current) setPlayTime(audioRef.current.currentTime);
      }
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [playingId]);

  const playExcerpt = (task: ReviewTask) => {
    const el = audioRef.current;
    if (!el) return;
    if (playingId === task.id) {
      el.pause();
      setPlayingId(null);
      return;
    }
    el.src = `/api/excerpt/${task.clipId}?start=${task.start}&end=${task.end}`;
    el.currentTime = 0;
    setPlayTime(0);
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
      let txHash: `0x${string}` | undefined;
      let runMode: "aevum-live" | "sandbox" = "sandbox";

      if (action === "accept" && liveEscrowMode && address && isAevum) {
        txHash = await acceptTaskOnChain(task.taskIdBytes32);
        runMode = "aevum-live";
      }

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          taskId: task.id,
          approverAddress: address || state?.batch.approverAddress,
          txHash,
          mode: runMode,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} task.`);
    } finally {
      setBusyId(null);
    }
  };

  if (loading || !state) {
    return (
      <div className="space-y-6">
        <div className="h-14 w-56 rounded-[12px] bg-[var(--panel)] animate-pulse" />
        <div className="h-56 rounded-[12px] bg-[var(--panel)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-10 sm:space-y-14">
      <audio
        ref={audioRef}
        onEnded={() => {
          setPlayingId(null);
          setPlayTime(0);
        }}
      />

      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sikio-rise">
        <div className="space-y-1.5">
          <h1 className="type-page text-[var(--ink)]">Approve</h1>
          <p className="text-[16px] text-[var(--ink-2)]">
            Listen, compare, then pay the native speaker once. Approving as{" "}
            <span className="font-mono text-sm">
              {shortAddr(state.batch.approverAddress)}
            </span>
            .
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/"
            className="min-h-[44px] sm:min-h-[40px] inline-flex items-center px-4 rounded-[var(--r-sm)] text-sm font-semibold hairline bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--hover)]"
          >
            Open the board in Studio
          </Link>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-[var(--r)] bg-[var(--red-bg)] px-5 py-3.5 text-sm font-medium text-[var(--red)]"
        >
          {error}
        </div>
      )}

      {banner && (
        <div
          aria-live="polite"
          className="rounded-[var(--r)] bg-[var(--green-bg)] px-5 py-3.5 text-sm font-medium text-[var(--green-ink)] flex flex-wrap items-center justify-between gap-2"
        >
          <span>{banner}</span>
          <Link href="/" className="font-semibold underline underline-offset-2">
            Replay fixed captions
          </Link>
        </div>
      )}

      {/* Queue 1: Submitted edits ready for approval (only queue with Accept!) */}
      <section className="rounded-[12px] hairline double-rule bg-[var(--paper)] hero-elevation overflow-hidden">
        <div className="px-5 py-3 hairline-b bg-[var(--bg)]/45 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--heard-ink)]">
            Heard, ready to approve ({submittedQueue.length})
          </h2>
          <span className="text-[13px] tabular-nums text-[var(--mute)]">
            {state.batch.reservedTusd8.toFixed(2)} tUSD8 held
          </span>
        </div>

        {submittedQueue.length === 0 ? (
          <div className="p-7 text-sm text-[var(--mute)] flex flex-wrap items-center justify-between gap-3">
            <span>
              Nothing to approve yet. Answers from native speakers in{" "}
              <Link
                href="/ear"
                className="font-semibold text-[var(--ink)] underline underline-offset-2"
              >
                Ear
              </Link>{" "}
              show up here.
            </span>
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {submittedQueue.map((task) => {
              const dur = Math.max(0.6, task.end - task.start);
              const excerptUrl = `/api/excerpt/${task.clipId}?start=${task.start}&end=${task.end}`;
              const isPlaying = playingId === task.id;
              return (
                <div
                  key={task.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                >
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[var(--heard-bg)] text-[var(--heard-ink)]">
                        Heard
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

                    {/* Split AI vs Editor diff */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 rounded-[10px] hairline overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-[var(--line)]">
                      <div className="px-4 py-3 bg-[var(--red-bg)]">
                        <div className="text-[12px] font-semibold text-[var(--mute)]">
                          AI heard, {Math.round(task.minConfidence * 100)}% sure
                        </div>
                        <div className="text-sm font-medium text-[var(--ink)] line-through mt-0.5">
                          {task.aiGuess}
                        </div>
                      </div>
                      <div className="px-4 py-3 bg-[var(--green-bg)]">
                        <div className="text-[12px] font-semibold text-[var(--mute)]">
                          {task.editorName.split(" ")[0]} heard
                        </div>
                        <div className="text-sm font-semibold text-[var(--ink)] mt-0.5">
                          {task.submittedText}
                        </div>
                      </div>
                    </div>

                    {/* Audition bar with mini organic wave ribbon */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => playExcerpt(task)}
                        className="min-h-[44px] sm:min-h-[38px] shrink-0 inline-flex items-center gap-1.5 px-3.5 rounded-[8px] text-xs font-medium bg-[var(--ink)] text-[var(--paper)] cursor-pointer"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" /> Hear
                          </>
                        )}
                      </button>
                      <div className="flex-1 min-w-[120px] rounded-[8px] hairline bg-[var(--bg)]/45 px-1.5">
                        <OrganicWaveRibbon
                          audioUrl={excerptUrl}
                          seedKey={task.id}
                          duration={dur}
                          currentTime={isPlaying ? playTime : 0}
                          playing={isPlaying}
                          height={40}
                          interactive={false}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fixed-width desktop action rail (fixes stretched Accept button bug!) */}
                  <div className="flex flex-col gap-2 shrink-0 w-full lg:w-44">
                    <button
                      type="button"
                      disabled={busyId === task.id}
                      onClick={() => handleAction(task, "accept")}
                      className="w-full min-h-[44px] px-4 rounded-[var(--r-sm)] text-sm font-semibold bg-[var(--green)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      Approve and pay {task.feeTusd8.toFixed(2)}
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
                        Return fee
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Queue 2: Open offers still awaiting editor submission (read-only + Expire refund) */}
      {waitingEditors.length > 0 && (
        <section className="rounded-[12px] hairline bg-[var(--paper)] overflow-hidden">
          <div className="px-5 py-3 hairline-b bg-[var(--bg)]/35 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--signal-ink)]">
              Waiting for a native speaker ({waitingEditors.length})
            </h2>
            <Link
              href="/ear"
              className="text-xs font-medium text-[var(--signal-ink)] hover:underline"
            >
              Open Ear
            </Link>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {waitingEditors.map((task) => (
              <div
                key={task.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[12px] font-semibold bg-[var(--signal-bg)] text-[var(--signal-ink)]">
                      Needs an ear
                    </span>
                    <span className="font-semibold text-sm text-[var(--ink)]">
                      {task.aiGuess}
                    </span>
                    <span className="font-mono text-[var(--mute)] tabular-nums">
                      {task.start.toFixed(1)}s · {task.end.toFixed(1)}s
                    </span>
                  </div>
                  <div className="text-[var(--mute)]">
                    Sent to {task.editorName} in {task.editorCity} · {task.feeTusd8.toFixed(2)} tUSD8 held
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => playExcerpt(task)}
                    className="min-h-[40px] sm:min-h-[34px] px-3 rounded-[8px] hairline bg-[var(--bg)] text-[var(--ink)] inline-flex items-center gap-1 cursor-pointer"
                  >
                    {playingId === task.id ? (
                      <>
                        <Pause className="w-3 h-3" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" /> Hear
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => handleAction(task, "expire")}
                    className="min-h-[40px] sm:min-h-[34px] px-3 rounded-[8px] hairline bg-[var(--paper)] text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    Return fee
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Settled ledger */}
      {settled.length > 0 && (
        <section className="rounded-[12px] hairline bg-[var(--paper)] overflow-hidden">
          <div className="px-5 py-3 hairline-b bg-[var(--bg)]/35 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--ink)]">Settled ({settled.length})</h2>
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
                        ? "bg-[var(--green-bg)] text-[var(--green-ink)]"
                        : "bg-[var(--panel)] text-[var(--mute)]"
                    }`}
                  >
                    {t.status === "accepted"
                      ? `Paid once ${t.feeTusd8.toFixed(2)}`
                      : `Returned ${t.feeTusd8.toFixed(2)}`}
                  </span>
                  {t.settleTxHash && t.settleMode === "aevum-live" ? (
                    <a
                      href={explorerTxUrl(t.settleTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[var(--green)] hover:underline"
                    >
                      {shortHash(t.settleTxHash)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    t.settleTxHash && (
                      <span className="font-mono text-[var(--mute)]">
                        sandbox · {t.settleTxHash.slice(0, 8)}…
                      </span>
                    )
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
