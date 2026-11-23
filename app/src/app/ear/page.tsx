"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Play, Pause, Repeat, Check, Send } from "lucide-react";
import { BatchBudget, ReviewTask } from "@/lib/types";
import { OrganicWaveRibbon } from "@/components/OrganicWaveRibbon";

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
  const [excerptTime, setExcerptTime] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [statusLine, setStatusLine] = useState("Ready · excerpt only");
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

  const currentTask =
    openTasks[Math.min(activeIndex, Math.max(0, openTasks.length - 1))] || null;

  // Stop & reset excerpt playback immediately when task or editor filter changes (Fixes #14 audio leak)
  useEffect(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlayingId(null);
    setExcerptTime(0);
    setStatusLine("Ready · excerpt only");
  }, [currentTask?.id, selectedEditor]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = loopEnabled;
      audioRef.current.playbackRate = slowMode ? 0.8 : 1.0;
    }
  }, [loopEnabled, slowMode]);

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

  const excerptUrl = useMemo(() => {
    if (!currentTask) return "";
    return `/api/excerpt/${currentTask.clipId}?start=${currentTask.start}&end=${currentTask.end}`;
  }, [currentTask]);

  const excerptDuration = currentTask
    ? Math.max(0.6, Number((currentTask.end - currentTask.start).toFixed(1)))
    : 3;

  // Throttled excerpt playhead sync (~15fps)
  useEffect(() => {
    if (!playingId) return;
    let raf = 0;
    let lastSync = 0;
    const tick = (now: number) => {
      if (now - lastSync >= 66) {
        lastSync = now;
        if (audioRef.current) {
          setExcerptTime(audioRef.current.currentTime % Math.max(excerptDuration, 0.5));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playingId, excerptDuration]);

  const playExcerpt = (task: ReviewTask) => {
    const el = audioRef.current;
    if (!el) return;
    if (playingId === task.id) {
      el.pause();
      setPlayingId(null);
      setStatusLine("Paused");
      return;
    }
    const src = `/api/excerpt/${task.clipId}?start=${task.start}&end=${task.end}`;
    if (el.src !== new URL(src, window.location.origin).href) {
      el.src = src;
    }
    el.loop = loopEnabled;
    el.playbackRate = slowMode ? 0.8 : 1.0;
    el.currentTime = 0;
    el.play()
      .then(() => {
        setPlayingId(task.id);
        setStatusLine(
          `Playing ${Math.max(0.5, task.end - task.start).toFixed(1)}s excerpt`
        );
      })
      .catch(() => setError("Tap Play again to start excerpt audio."));
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
      setStatusLine(
        json.task?.status === "accepted"
          ? `Paid +$${task.feeTusd8.toFixed(2)} · auto-accepted`
          : `Sent "${submittedText}" · awaiting approval`
      );
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading || !state) {
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <div className="h-12 w-48 rounded-[12px] bg-[var(--panel)] animate-pulse" />
        <div className="h-[420px] rounded-[12px] bg-[var(--panel)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-12">
      <audio
        ref={audioRef}
        onEnded={() => {
          if (!loopEnabled) {
            setPlayingId(null);
            setExcerptTime(0);
            setStatusLine("Excerpt finished");
          }
        }}
      />

      {/* Compact editorial heading + single-row scrollable mobile filter */}
      <section className="space-y-3 sikio-rise">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="type-page text-[var(--ink)]">Ear</h1>
          <div className="font-mono text-xs tabular-nums text-[var(--mute)]">
            <span className="text-[var(--green)] font-semibold">
              ${earningsPaid.toFixed(2)}
            </span>{" "}
            paid ·{" "}
            <span className="text-[var(--amber)] font-semibold">
              ${earningsPending.toFixed(2)}
            </span>{" "}
            pending
          </div>
        </div>

        {/* Single-row editor filter strip (never wraps an orphan pill onto line 2 at 375px!) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => {
              setSelectedEditor("all");
              setActiveIndex(0);
            }}
            className={`min-h-[44px] sm:min-h-[36px] px-3.5 rounded-full text-xs font-medium hairline cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
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
              className={`min-h-[44px] sm:min-h-[36px] px-3.5 rounded-full text-xs font-medium hairline cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
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

      {/* Main 2-column Editorial Proof Card & History */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left: Compact Editorial Mobile Proof Unit (all primary actions above the fold on 375x812!) */}
        <div className="lg:col-span-6 flex justify-center lg:justify-start">
          <div className="w-full max-w-[460px] rounded-[12px] hairline double-rule bg-[var(--paper)] hero-elevation overflow-hidden">
            {/* Metadata bar */}
            <div className="px-4 py-2.5 hairline-b bg-[var(--bg)]/45 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    playingId ? "bg-[var(--signal)] sikio-led" : "bg-[var(--mute)]"
                  }`}
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink-2)] truncate tabular-nums">
                  {currentTask
                    ? `Task ${activeIndex + 1}/${openTasks.length} · ${currentTask.editorCity} · ${excerptDuration}s`
                    : "Queue clear"}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[var(--green-bg)] text-[var(--green)] font-mono text-[11px] font-semibold tabular-nums shrink-0">
                {currentTask
                  ? `+$${currentTask.feeTusd8.toFixed(2)}`
                  : `$${earningsPaid.toFixed(2)} paid`}
              </span>
            </div>

            {currentTask ? (
              <div className="p-4 space-y-3.5">
                {/* Silky organic acoustic excerpt ribbon */}
                <div className="rounded-[10px] hairline bg-[var(--bg)]/55 px-1.5 py-1">
                  <OrganicWaveRibbon
                    audioUrl={excerptUrl}
                    seedKey={currentTask.id}
                    duration={excerptDuration}
                    currentTime={excerptTime}
                    playing={playingId === currentTask.id}
                    spans={[
                      {
                        start: Math.max(
                          0,
                          currentTask.focusStart - currentTask.start
                        ),
                        end: Math.min(
                          excerptDuration,
                          Math.max(
                            currentTask.focusStart - currentTask.start + 0.35,
                            currentTask.focusEnd - currentTask.start
                          )
                        ),
                        status: "flagged",
                      },
                    ]}
                    height={56}
                    onScrub={(sec) => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = sec;
                        setExcerptTime(sec);
                      }
                    }}
                    onTogglePlay={() => playExcerpt(currentTask)}
                  />
                </div>

                {/* Compact 3-button transport */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    aria-label={
                      playingId === currentTask.id ? "Pause excerpt" : "Play excerpt"
                    }
                    onClick={() => playExcerpt(currentTask)}
                    className="min-h-[44px] rounded-[8px] bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                  >
                    {playingId === currentTask.id ? (
                      <>
                        <Pause className="w-3.5 h-3.5" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" /> Play
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
                      setStatusLine(next ? "Loop on" : "Loop off");
                    }}
                    className={`min-h-[44px] rounded-[8px] hairline flex items-center justify-center gap-1.5 font-mono text-xs font-medium cursor-pointer transition-colors ${
                      loopEnabled
                        ? "bg-[var(--panel)] text-[var(--ink)] font-semibold"
                        : "bg-[var(--paper)] text-[var(--mute)]"
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
                      setStatusLine(next ? "Speed 0.8x" : "Speed 1.0x");
                    }}
                    className={`min-h-[44px] rounded-[8px] hairline font-mono text-xs font-medium cursor-pointer transition-colors ${
                      slowMode
                        ? "bg-[var(--signal-bg)] text-[var(--signal-ink)] font-semibold"
                        : "bg-[var(--paper)] text-[var(--mute)]"
                    }`}
                  >
                    {slowMode ? "0.8x" : "1.0x"}
                  </button>
                </div>

                {/* Proof sentence context */}
                <div
                  aria-live="polite"
                  className="px-3.5 py-3 rounded-[8px] hairline bg-[var(--bg)]/45 text-[17px] leading-[1.55] text-[var(--ink)]"
                >
                  <span className="text-[var(--mute)]">
                    {currentTask.contextBefore}{" "}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-[5px] bg-[var(--signal-bg)] text-[var(--signal-ink)] border-b-2 border-[var(--signal)] font-semibold">
                    {currentTask.aiGuess}
                  </span>
                  <span className="text-[var(--mute)]">
                    {" "}
                    {currentTask.contextAfter}
                  </span>
                </div>

                {/* Form input & Primary Action */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit(currentTask, false);
                  }}
                  className="space-y-2.5"
                >
                  <div>
                    <label htmlFor="ear-fix-input" className="sr-only">
                      Type what you hear
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
                      placeholder="Type the exact word or phrase"
                      className="w-full min-h-[46px] px-3.5 rounded-[8px] hairline bg-[var(--bg)] text-[var(--ink)] text-base font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="submit"
                      disabled={submittingId === currentTask.id}
                      className="min-h-[46px] rounded-[8px] bg-[var(--signal)] text-[#fbf8f1] hover:opacity-90 flex items-center justify-center gap-1.5 text-sm font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      {submittingId === currentTask.id
                        ? "Sending…"
                        : `Submit · $${currentTask.feeTusd8.toFixed(2)}`}
                    </button>

                    <button
                      type="button"
                      disabled={submittingId === currentTask.id}
                      onClick={() => handleSubmit(currentTask, true)}
                      className="min-h-[46px] rounded-[8px] hairline bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--hover)] flex items-center justify-center gap-1.5 text-sm font-medium cursor-pointer"
                    >
                      <Check className="w-4 h-4" /> AI right
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 hairline-t font-mono text-[11px] text-[var(--mute)]">
                    <span className="truncate">{statusLine}</span>
                    {openTasks.length > 1 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveIndex(
                              (i) => (i - 1 + openTasks.length) % openTasks.length
                            )
                          }
                          className="min-h-[36px] px-2.5 rounded-[6px] hairline bg-[var(--bg)] text-[var(--ink)] cursor-pointer"
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveIndex((i) => (i + 1) % openTasks.length)
                          }
                          className="min-h-[36px] px-2.5 rounded-[6px] hairline bg-[var(--bg)] text-[var(--ink)] cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                </form>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <p className="text-sm text-[var(--ink-2)]">
                  No open excerpts waiting for review. Run a clip in Studio or review submitted fixes in Approve.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/"
                    className="min-h-[46px] rounded-[8px] bg-[var(--signal)] text-[#fbf8f1] flex items-center justify-center text-sm font-semibold"
                  >
                    Open Studio
                  </Link>
                  <Link
                    href="/approve"
                    className="min-h-[46px] rounded-[8px] hairline bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center text-sm font-medium"
                  >
                    Open Approve
                  </Link>
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="px-4 pb-3 text-xs text-[var(--red)]">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Right: Earnings & Task Ledger */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-[12px] hairline bg-[var(--paper)] overflow-hidden">
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
            <div className="px-5 py-3 hairline-t bg-[var(--bg)]/35 text-xs text-[var(--mute)]">
              Audio is sliced server-side to at most 12 seconds. Full client masters stay private.
            </div>
          </div>

          <div className="rounded-[12px] hairline bg-[var(--paper)] overflow-hidden">
            <div className="px-5 py-3 hairline-b bg-[var(--bg)]/35 flex items-center justify-between">
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
