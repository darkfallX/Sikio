"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Play, Pause, Repeat, Check, Send } from "lucide-react";
import { BatchBudget, ReviewTask } from "@/lib/types";

interface EarState {
  batch: BatchBudget;
  tasks: ReviewTask[];
}

function notifyNavSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sikio:state-updated"));
  }
}

export default function EarPage() {
  const [state, setState] = useState<EarState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEditor, setSelectedEditor] = useState<string>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [lcdStatus, setLcdStatus] = useState("READY · EXCERPT ONLY");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const json = (await res.json()) as EarState;
      setState(json);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const t of json.tasks) {
          if (next[t.id] === undefined) next[t.id] = t.aiGuess;
        }
        return next;
      });
      notifyNavSync();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = loopEnabled;
      audioRef.current.playbackRate = slowMode ? 0.8 : 1.0;
    }
  }, [loopEnabled, slowMode]);

  const filteredTasks = useMemo(() => {
    if (!state) return [];
    if (selectedEditor === "all") return state.tasks;
    return state.tasks.filter((t) => t.editorAddress === selectedEditor);
  }, [state, selectedEditor]);

  const openTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === "offered"),
    [filteredTasks]
  );

  const completedTasks = useMemo(
    () => filteredTasks.filter((t) => t.status !== "offered"),
    [filteredTasks]
  );

  const currentTask = openTasks[Math.min(activeIndex, Math.max(0, openTasks.length - 1))] || null;

  const earningsPaid = useMemo(
    () =>
      filteredTasks
        .filter((t) => t.status === "accepted")
        .reduce((acc, t) => acc + t.feeTusd8, 0),
    [filteredTasks]
  );

  const earningsPending = useMemo(
    () =>
      filteredTasks
        .filter((t) => t.status === "submitted")
        .reduce((acc, t) => acc + t.feeTusd8, 0),
    [filteredTasks]
  );

  const playExcerpt = (task: ReviewTask) => {
    const el = audioRef.current;
    if (!el) return;
    if (playingId === task.id) {
      el.pause();
      setPlayingId(null);
      setLcdStatus("PAUSED");
      return;
    }
    const src = task.clipId.startsWith("custom-")
      ? "/clips/lagos-fintech-ep14.wav"
      : `/api/excerpt/${task.clipId}?start=${task.start}&end=${task.end}`;
    el.src = src;
    el.loop = loopEnabled;
    el.playbackRate = slowMode ? 0.8 : 1.0;
    el.currentTime = 0;
    el.play()
      .then(() => {
        setPlayingId(task.id);
        setLcdStatus(
          `PLAYING ${Math.max(0.5, task.end - task.start).toFixed(1)}S ${slowMode ? "0.8X" : "1.0X"}`
        );
      })
      .catch(() => setError("Tap play again to start audio."));
  };

  const handleSubmit = async (task: ReviewTask, confirmedAiRight: boolean) => {
    setError(null);
    setSubmittingId(task.id);
    try {
      if (playingId === task.id && audioRef.current) {
        audioRef.current.pause();
        setPlayingId(null);
      }
      const submittedText = confirmedAiRight
        ? task.aiGuess
        : (drafts[task.id] || "").trim();
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          taskId: task.id,
          submittedText,
          confirmedAiRight,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not submit fix.");
        return;
      }
      setActiveIndex(0);
      await load();
      setLcdStatus(
        json.task?.status === "accepted"
          ? `PAID +$${task.feeTusd8.toFixed(2)} TUSD8`
          : `SENT "${submittedText.toUpperCase()}" · 0 GAS`
      );
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading || !state) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="h-14 w-48 rounded-[14px] bg-[var(--panel)] animate-pulse" />
        <div className="h-[440px] rounded-[14px] bg-[var(--panel)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-16 sm:space-y-24">
      <audio
        ref={audioRef}
        onEnded={() => {
          if (!loopEnabled) {
            setPlayingId(null);
            setLcdStatus("EXCERPT ENDED");
          }
        }}
      />

      {/* Page heading */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="type-page text-[var(--ink)]">Ear</h1>
          <p className="text-[16px] text-[var(--ink-2)]">
            Listen to the flagged seconds, type what you hear, earn tUSD8 with zero gas.
          </p>
        </div>

        {/* Editor filter pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedEditor("all");
              setActiveIndex(0);
            }}
            className={`min-h-[44px] sm:min-h-[36px] px-3.5 rounded-full text-xs font-medium hairline cursor-pointer transition-colors ${
              selectedEditor === "all"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "bg-[var(--paper)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
            }`}
          >
            All editors
          </button>
          {state.batch.trustedEditors.map((ed) => (
            <button
              key={ed.address}
              type="button"
              onClick={() => {
                setSelectedEditor(ed.address);
                setActiveIndex(0);
              }}
              className={`min-h-[44px] sm:min-h-[36px] px-3.5 rounded-full text-xs font-medium hairline cursor-pointer transition-colors ${
                selectedEditor === ed.address
                  ? "bg-[var(--ink)] text-[var(--paper)]"
                  : "bg-[var(--paper)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
              }`}
            >
              {ed.name.split(" ")[0]} · {ed.city}
            </button>
          ))}
        </div>
      </section>

      {/* Hero object: tactile handheld Ear device + earnings & queue ledger */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Handheld Hardware Unit (only soft shadow on page) */}
        <div className="lg:col-span-6 flex justify-center lg:justify-start">
          <div className="w-full max-w-[440px] rounded-[20px] bg-[var(--body)] text-[var(--key-ink)] p-5 sm:p-6 hero-elevation border border-black/30 space-y-5">
            {/* Hardware speaker grille + ear serial */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    playingId ? "bg-[var(--signal)] sikio-led" : "bg-[#6c6759]"
                  }`}
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#9b9586]">
                  SIKIO EAR · EXCERPT UNIT
                </span>
              </div>
              <span className="font-mono text-[11px] tabular-nums text-[#d5d0c3]">
                PAID ${earningsPaid.toFixed(2)}
              </span>
            </div>

            {/* Olive LCD Screen (VT323 strictly inside phone/handheld LCD) */}
            <div
              aria-live="polite"
              className="rounded-[10px] bg-[var(--lcd)] text-[var(--lcd-ink)] p-4 border-2 border-black/35 space-y-2.5 min-h-[190px] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between font-lcd text-[18px] leading-none border-b border-[var(--lcd-dim)] pb-1.5">
                <span>
                  {currentTask
                    ? `TASK ${activeIndex + 1}/${openTasks.length} · ${currentTask.editorCity.toUpperCase()}`
                    : "QUEUE EMPTY"}
                </span>
                <span>
                  {currentTask
                    ? `+$${currentTask.feeTusd8.toFixed(2)}`
                    : `$${earningsPaid.toFixed(2)}`}
                </span>
              </div>

              {currentTask ? (
                <div className="font-lcd text-[23px] leading-[1.15] tracking-[0.01em] py-1">
                  <span className="opacity-70">{currentTask.contextBefore} </span>
                  <span className="bg-[var(--lcd-ink)] text-[var(--lcd)] px-1.5">
                    {currentTask.aiGuess}
                  </span>
                  <span className="opacity-70"> {currentTask.contextAfter}</span>
                </div>
              ) : (
                <div className="font-lcd text-[22px] leading-tight py-4">
                  NO OPEN TASKS. RUN A CLIP IN STUDIO OR CHECK APPROVE.
                </div>
              )}

              <div className="flex items-center justify-between font-lcd text-[17px] leading-none border-t border-[var(--lcd-dim)] pt-1.5">
                <span className="truncate">{lcdStatus}</span>
                <span>
                  {currentTask
                    ? `${Math.max(0.5, currentTask.end - currentTask.start).toFixed(1)}S`
                    : "0 GAS"}
                </span>
              </div>
            </div>

            {/* Hardware keypad controls */}
            {currentTask ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit(currentTask, false);
                }}
                className="space-y-3"
              >
                {/* Physical transport keypad row */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    aria-label={playingId === currentTask.id ? "Pause excerpt" : "Play excerpt"}
                    onClick={() => playExcerpt(currentTask)}
                    className="min-h-[48px] rounded-[8px] bg-[var(--key)] text-[var(--key-ink)] hover:brightness-110 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                  >
                    {playingId === currentTask.id ? (
                      <>
                        <Pause className="w-4 h-4" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" /> Play
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    aria-label="Toggle audio loop"
                    aria-pressed={loopEnabled}
                    onClick={() => {
                      const next = !loopEnabled;
                      setLoopEnabled(next);
                      setLcdStatus(next ? "LOOP ON" : "LOOP OFF");
                    }}
                    className={`min-h-[48px] rounded-[8px] flex items-center justify-center gap-1.5 font-mono text-xs font-medium cursor-pointer ${
                      loopEnabled
                        ? "bg-[#ecebe4] text-[#12110d]"
                        : "bg-[var(--key)] text-[var(--key-ink)]"
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" /> Loop
                  </button>

                  <button
                    type="button"
                    aria-label="Toggle slow playback speed"
                    aria-pressed={slowMode}
                    onClick={() => {
                      const next = !slowMode;
                      setSlowMode(next);
                      setLcdStatus(next ? "SPEED 0.8X" : "SPEED 1.0X");
                    }}
                    className={`min-h-[48px] rounded-[8px] font-mono text-xs font-medium cursor-pointer ${
                      slowMode
                        ? "bg-[#ecebe4] text-[#12110d]"
                        : "bg-[var(--key)] text-[var(--key-ink)]"
                    }`}
                  >
                    {slowMode ? "0.8x" : "1.0x"}
                  </button>
                </div>

                {/* Word correction field */}
                <div>
                  <label htmlFor="ear-fix-input" className="sr-only">
                    Type the corrected word
                  </label>
                  <input
                    id="ear-fix-input"
                    type="text"
                    value={drafts[currentTask.id] ?? currentTask.aiGuess}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [currentTask.id]: e.target.value,
                      }))
                    }
                    placeholder="Type what you hear"
                    className="w-full min-h-[48px] px-3.5 rounded-[8px] bg-[#141310] border border-white/15 text-[#faf8f2] text-base font-medium"
                  />
                </div>

                {/* Action keys: one signal orange key */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="submit"
                    disabled={submittingId === currentTask.id}
                    className="min-h-[48px] rounded-[8px] bg-[var(--signal)] text-[#faf8f2] hover:opacity-90 flex items-center justify-center gap-1.5 text-sm font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    {submittingId === currentTask.id ? "Sending…" : "Submit fix"}
                  </button>

                  <button
                    type="button"
                    disabled={submittingId === currentTask.id}
                    onClick={() => handleSubmit(currentTask, true)}
                    className="min-h-[48px] rounded-[8px] bg-[var(--key)] text-[var(--key-ink)] hover:brightness-110 flex items-center justify-center gap-1.5 text-sm font-medium cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> AI right
                  </button>
                </div>

                {/* Task pager if multiple open */}
                {openTasks.length > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-white/10 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIndex((i) => (i - 1 + openTasks.length) % openTasks.length)
                      }
                      className="min-h-[40px] px-3 rounded-[8px] bg-[var(--key)] text-[var(--key-ink)] cursor-pointer"
                    >
                      Prev
                    </button>
                    <span className="text-[#9b9586] tabular-nums">
                      {activeIndex + 1} / {openTasks.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIndex((i) => (i + 1) % openTasks.length)
                      }
                      className="min-h-[40px] px-3 rounded-[8px] bg-[var(--key)] text-[var(--key-ink)] cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/"
                  className="min-h-[48px] rounded-[8px] bg-[var(--signal)] text-[#faf8f2] flex items-center justify-center text-sm font-semibold"
                >
                  Open Studio
                </Link>
                <Link
                  href="/approve"
                  className="min-h-[48px] rounded-[8px] bg-[var(--key)] text-[var(--key-ink)] flex items-center justify-center text-sm font-medium"
                >
                  Open Approve
                </Link>
              </div>
            )}

            {error && (
              <p role="alert" className="text-xs text-[#ff8254]">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Right: Earnings & Task Ledger */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-[14px] hairline bg-[var(--paper)] overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-[var(--line)]">
              <div className="p-5">
                <div className="type-label">Paid today</div>
                <div className="font-mono text-3xl font-semibold text-[var(--green)] tabular-nums mt-1">
                  ${earningsPaid.toFixed(2)}
                </div>
              </div>
              <div className="p-5">
                <div className="type-label">Pending approval</div>
                <div className="font-mono text-3xl font-semibold text-[var(--amber)] tabular-nums mt-1">
                  ${earningsPending.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 hairline-t text-xs text-[var(--mute)]">
              Audio is sliced server-side to at most 12 seconds. Full client files stay private.
            </div>
          </div>

          {/* Completed ledger */}
          <div className="rounded-[14px] hairline bg-[var(--paper)] overflow-hidden">
            <div className="px-5 py-3.5 hairline-b flex items-center justify-between">
              <h2 className="type-label">History ({completedTasks.length})</h2>
              <Link
                href="/approve"
                className="text-xs font-medium text-[var(--ink)] hover:underline"
              >
                Approve desk
              </Link>
            </div>

            {completedTasks.length === 0 ? (
              <div className="p-6 text-sm text-[var(--mute)]">
                Submitted fixes appear here.
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {completedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="px-5 py-3 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0 truncate">
                      <span className="line-through text-[var(--mute)] mr-2">
                        {t.aiGuess}
                      </span>
                      <span className="font-semibold text-[var(--ink)]">
                        {t.submittedText || t.aiGuess}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-medium tabular-nums ${
                        t.status === "accepted"
                          ? "bg-[var(--green-bg)] text-[var(--green)]"
                          : t.status === "submitted"
                          ? "bg-[var(--amber-bg)] text-[var(--amber)]"
                          : "bg-[var(--panel)] text-[var(--mute)]"
                      }`}
                    >
                      {t.status === "accepted"
                        ? `Paid $${t.feeTusd8.toFixed(2)}`
                        : t.status === "submitted"
                        ? "Pending"
                        : t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
