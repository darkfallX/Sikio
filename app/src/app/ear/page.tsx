"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Play, Pause, Repeat, Check, SendHorizontal, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { BatchBudget, ReviewTask } from "@/lib/types";
import { OrganicWaveRibbon } from "@/components/OrganicWaveRibbon";
import { ButtonLink } from "@/components/ui";

interface EarState {
  batch: BatchBudget;
  tasks: ReviewTask[];
}

interface LastReply {
  taskId: string;
  aiGuess: string;
  text: string;
  confirmedAiRight: boolean;
  paid: boolean;
  fee: number;
}

function notifyNavSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sikio:state-updated"));
  }
}

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

/*
  Ear: the native speaker's phone. The agent sends a short voice note, the
  editor replies with the word they heard, and the payment arrives as a message.
  No crypto words on this screen.
*/
export default function EarPage() {
  const [state, setState] = useState<EarState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedEditor, setSelectedEditor] = useState<string>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [excerptTime, setExcerptTime] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [lastReply, setLastReply] = useState<LastReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error("state");
      const json = (await res.json()) as EarState;
      setState(json);
      setLoadFailed(false);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const t of json.tasks) {
          if (next[t.id] === undefined) next[t.id] = t.aiGuess;
        }
        return next;
      });
      notifyNavSync();
    } catch {
      setLoadFailed(true);
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

  const safeIndex = Math.min(activeIndex, Math.max(0, openTasks.length - 1));
  const currentTask = openTasks[safeIndex] || null;

  // Stop playback whenever the task or the editor changes
  useEffect(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlayingId(null);
    setExcerptTime(0);
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

  // Throttled playhead sync (~15fps)
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
      .then(() => setPlayingId(task.id))
      .catch(() => setError("Your phone blocked the audio. Tap play again."));
  };

  const handleSubmit = async (task: ReviewTask, confirmedAiRight: boolean) => {
    setError(null);
    const submittedText = confirmedAiRight
      ? task.aiGuess
      : (drafts[task.id] || "").trim();
    if (!submittedText) {
      setError("Type the word you heard, or tap the button if the AI got it right.");
      return;
    }
    setSubmittingId(task.id);
    try {
      if (playingId === task.id && audioRef.current) {
        audioRef.current.pause();
        setPlayingId(null);
      }
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
        setError(json.error || "Your answer did not send. Try again.");
        return;
      }
      setLastReply({
        taskId: task.id,
        aiGuess: task.aiGuess,
        text: submittedText,
        confirmedAiRight,
        paid: json.task?.status === "accepted",
        fee: task.feeTusd8,
      });
      setActiveIndex(0);
      await load();
    } catch {
      setError("Your answer did not send. Check your connection and try again.");
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4" aria-busy="true" aria-label="Loading your queue">
        <div className="h-10 w-40 rounded-[var(--r)] bg-[var(--panel)] animate-pulse" />
        <div className="h-[460px] rounded-[var(--r)] bg-[var(--panel)] animate-pulse" />
      </div>
    );
  }

  if (loadFailed || !state) {
    return (
      <div className="max-w-md mx-auto rounded-[var(--r)] hairline bg-[var(--paper)] p-6 space-y-3">
        <h1 className="type-section">Could not load your queue</h1>
        <p className="text-[15px] text-[var(--ink-2)]">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="min-h-[44px] px-4 rounded-[var(--r-sm)] bg-[var(--ink)] text-[var(--paper)] font-semibold cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }

  const editorName =
    selectedEditor === "all"
      ? null
      : state.batch.trustedEditors.find((e) => e.address === selectedEditor);

  const focusStartInExcerpt = currentTask
    ? Math.max(0, currentTask.focusStart - currentTask.start)
    : 0;
  const focusEndInExcerpt = currentTask
    ? Math.min(
        excerptDuration,
        Math.max(focusStartInExcerpt + 0.35, currentTask.focusEnd - currentTask.start)
      )
    : 0;

  return (
    <div className="space-y-5 sm:space-y-7">
      <audio
        ref={audioRef}
        onEnded={() => {
          if (!loopEnabled) {
            setPlayingId(null);
            setExcerptTime(0);
          }
        }}
      />

      <section className="space-y-3 sikio-rise">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h1 className="type-page text-[var(--ink)]">Ear</h1>
          <p className="text-[14px] tabular-nums text-[var(--mute)]">
            <span className="font-semibold text-[var(--green-ink)]">{money(earningsPaid)}</span> paid
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-semibold text-[var(--heard-ink)]">{money(earningsPending)}</span> waiting
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5" role="group" aria-label="Answering as">
          {[{ address: "all", name: "All editors", city: "" }, ...state.batch.trustedEditors].map((ed) => {
            const active = selectedEditor === ed.address;
            return (
              <button
                key={ed.address}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSelectedEditor(ed.address);
                  setActiveIndex(0);
                  setLastReply(null);
                }}
                className={`min-h-[44px] sm:min-h-[38px] px-3.5 rounded-full text-[13px] font-semibold hairline cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? "bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]"
                    : "bg-[var(--paper)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
                }`}
              >
                {ed.city ? `${ed.name.split(" ")[0]} · ${ed.city}` : ed.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 items-start">
        {/* The thread */}
        <div className="lg:col-span-7 w-full max-w-[560px] mx-auto lg:mx-0 lg:max-w-none">
          <div className="rounded-[18px] hairline bg-[var(--thread)] overflow-hidden hero-elevation">
            <div className="px-4 py-3 bg-[var(--paper)] hairline-b flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--bubble-out)] text-white grid place-items-center font-extrabold text-[15px] shrink-0" aria-hidden="true">
                S
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold text-[var(--ink)] leading-tight">Sikio agent</div>
                <div className="text-[13px] text-[var(--mute)] truncate">
                  {currentTask
                    ? `${currentTask.clipTitle} · ${safeIndex + 1} of ${openTasks.length}`
                    : editorName
                    ? `For ${editorName.name.split(" ")[0]}`
                    : "Nothing waiting"}
                </div>
              </div>
              {openTasks.length > 1 && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label="Previous word"
                    onClick={() => setActiveIndex((i) => (i - 1 + openTasks.length) % openTasks.length)}
                    className="min-h-[44px] min-w-[44px] rounded-full text-[var(--ink-2)] hover:bg-[var(--hover)] cursor-pointer inline-flex items-center justify-center"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next word"
                    onClick={() => setActiveIndex((i) => (i + 1) % openTasks.length)}
                    className="min-h-[44px] min-w-[44px] rounded-full text-[var(--ink-2)] hover:bg-[var(--hover)] cursor-pointer inline-flex items-center justify-center"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            <div className="px-3 sm:px-4 py-4 flex flex-col gap-2.5 sm:min-h-[360px]" aria-live="polite">
              {lastReply && (
                <>
                  <div className="self-end max-w-[85%] rounded-[18px] rounded-br-[6px] bg-[var(--bubble-out)] text-[var(--bubble-out-ink)] px-3.5 py-2 text-[16px] font-semibold sikio-bubble">
                    {lastReply.confirmedAiRight ? `"${lastReply.text}" is right` : lastReply.text}
                  </div>
                  <div
                    className="self-start max-w-[85%] rounded-[18px] rounded-bl-[6px] bg-[var(--bubble-in)] px-3.5 py-2.5 sikio-bubble"
                    style={{ ["--i" as string]: 1 }}
                  >
                    {lastReply.paid ? (
                      <div className="space-y-0.5">
                        <div className="text-[20px] font-extrabold text-[var(--green-ink)] tabular-nums">
                          +{money(lastReply.fee)}
                        </div>
                        <div className="text-[13px] text-[var(--mute)]">Paid. Your trusted status approved it right away.</div>
                      </div>
                    ) : (
                      <div className="text-[15px] text-[var(--ink)]">
                        Got it. The agency checks your answer next, then you get{" "}
                        <span className="font-semibold tabular-nums">{money(lastReply.fee)}</span>.
                      </div>
                    )}
                  </div>
                </>
              )}

              {currentTask ? (
                <>
                  {lastReply && (
                    <div className="self-center text-[12px] text-[var(--mute)] py-1">Next word</div>
                  )}
                  {/* Voice note */}
                  <div
                    key={`vn-${currentTask.id}`}
                    className="self-start w-full max-w-[420px] rounded-[18px] rounded-bl-[6px] bg-[var(--bubble-in)] p-2.5 sikio-bubble"
                    style={{ ["--i" as string]: lastReply ? 2 : 0 }}
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        aria-label={playingId === currentTask.id ? "Pause voice note" : "Play voice note"}
                        onClick={() => playExcerpt(currentTask)}
                        className="w-12 h-12 shrink-0 rounded-full bg-[var(--bubble-out)] text-white grid place-items-center cursor-pointer hover:opacity-90"
                      >
                        {playingId === currentTask.id ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <OrganicWaveRibbon
                          audioUrl={excerptUrl}
                          seedKey={currentTask.id}
                          duration={excerptDuration}
                          currentTime={excerptTime}
                          playing={playingId === currentTask.id}
                          spans={[{ start: focusStartInExcerpt, end: focusEndInExcerpt, status: "flagged" }]}
                          height={44}
                          onScrub={(sec) => {
                            if (audioRef.current) {
                              audioRef.current.currentTime = sec;
                              setExcerptTime(sec);
                            }
                          }}
                          onTogglePlay={() => playExcerpt(currentTask)}
                        />
                      </div>
                      <span className="font-mono text-[12px] text-[var(--mute)] tabular-nums shrink-0 pr-1">
                        0:{String(Math.ceil(excerptDuration)).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 pl-1">
                      <button
                        type="button"
                        aria-pressed={loopEnabled}
                        onClick={() => setLoopEnabled((v) => !v)}
                        className={`min-h-[44px] sm:min-h-[36px] px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                          loopEnabled ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-[var(--bg)] text-[var(--ink-2)]"
                        }`}
                      >
                        <Repeat className="w-3.5 h-3.5" /> Repeat
                      </button>
                      <button
                        type="button"
                        aria-pressed={slowMode}
                        onClick={() => setSlowMode((v) => !v)}
                        className={`min-h-[44px] sm:min-h-[36px] px-3.5 rounded-full text-[13px] font-semibold cursor-pointer transition-colors ${
                          slowMode ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-[var(--bg)] text-[var(--ink-2)]"
                        }`}
                      >
                        Slower
                      </button>
                    </div>
                  </div>

                  {/* Question */}
                  <div
                    key={`q-${currentTask.id}`}
                    className="self-start max-w-[92%] rounded-[18px] rounded-bl-[6px] bg-[var(--bubble-in)] px-3.5 py-2.5 space-y-2 sikio-bubble"
                    style={{ ["--i" as string]: lastReply ? 3 : 1 }}
                  >
                    <p className="text-[16px] text-[var(--ink)] leading-snug">
                      I heard <span className="font-bold">&ldquo;{currentTask.aiGuess}&rdquo;</span>. What did they say?
                    </p>
                    <p className="text-[15px] leading-relaxed text-[var(--mute)]">
                      {currentTask.contextBefore}{" "}
                      <mark className="bg-[var(--signal-bg)] text-[var(--signal-ink)] font-semibold rounded-[4px] px-1">
                        {currentTask.aiGuess}
                      </mark>{" "}
                      {currentTask.contextAfter}
                    </p>
                    <p className="text-[13px] text-[var(--mute)]">
                      Pays <span className="font-semibold text-[var(--ink)] tabular-nums">{money(currentTask.feeTusd8)}</span> when the agency approves.
                    </p>
                  </div>
                </>
              ) : (
                <div className="self-start max-w-[90%] rounded-[18px] rounded-bl-[6px] bg-[var(--bubble-in)] px-3.5 py-3 space-y-3 sikio-bubble">
                  <p className="text-[15px] text-[var(--ink)]">
                    No words waiting for you right now. When a clip has a word the AI could not hear, it lands here.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href="/" variant="primary" size="sm">Run a clip in Studio</ButtonLink>
                    <ButtonLink href="/approve" variant="secondary" size="sm">Approve answers</ButtonLink>
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            {currentTask && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit(currentTask, false);
                }}
                className="px-3 sm:px-4 pt-2.5 pb-3 bg-[var(--paper)] hairline-t space-y-2"
              >
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={submittingId === currentTask.id}
                    onClick={() => handleSubmit(currentTask, true)}
                    className="min-h-[44px] sm:min-h-[40px] px-3.5 rounded-full hairline border-[var(--bubble-out)] text-[var(--bubble-out)] text-[14px] font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-[var(--hover)] disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" /> &ldquo;{currentTask.aiGuess}&rdquo; is right
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="ear-fix-input" className="sr-only">
                    Type the word you heard
                  </label>
                  <input
                    id="ear-fix-input"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="off"
                    value={drafts[currentTask.id] ?? currentTask.aiGuess}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [currentTask.id]: e.target.value }))
                    }
                    placeholder="Type the word you heard"
                    className="flex-1 min-w-0 min-h-[48px] px-4 rounded-full hairline bg-[var(--bg)] text-[var(--ink)] text-[16px]"
                  />
                  <button
                    type="submit"
                    aria-label={`Send answer for ${money(currentTask.feeTusd8)}`}
                    disabled={submittingId === currentTask.id}
                    className="w-12 h-12 shrink-0 rounded-full bg-[var(--bubble-out)] text-white grid place-items-center cursor-pointer hover:opacity-90 disabled:opacity-50"
                  >
                    <SendHorizontal className="w-5 h-5" />
                  </button>
                </div>
                {error && (
                  <p role="alert" className="text-[13px] text-[var(--red)] px-1">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Earnings and history */}
        <aside className="lg:col-span-5 space-y-4 w-full max-w-[560px] mx-auto lg:mx-0 lg:max-w-none">
          <div className="grid grid-cols-2 gap-px rounded-[var(--r)] hairline bg-[var(--line)] overflow-hidden">
            <div className="bg-[var(--paper)] p-4 sm:p-5">
              <div className="text-[13px] text-[var(--mute)]">Paid to you</div>
              <div className="text-[28px] font-extrabold tabular-nums tracking-[-0.02em] text-[var(--green-ink)]">
                {money(earningsPaid)}
              </div>
            </div>
            <div className="bg-[var(--paper)] p-4 sm:p-5">
              <div className="text-[13px] text-[var(--mute)]">Waiting for approval</div>
              <div className="text-[28px] font-extrabold tabular-nums tracking-[-0.02em] text-[var(--heard-ink)]">
                {money(earningsPending)}
              </div>
            </div>
          </div>

          <div className="rounded-[var(--r)] hairline bg-[var(--paper)] overflow-hidden">
            <div className="px-4 sm:px-5 py-3 hairline-b flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--ink)]">Your answers</h2>
              <span className="text-[13px] text-[var(--mute)] tabular-nums">{completedTasks.length}</span>
            </div>
            {completedTasks.length === 0 ? (
              <p className="px-4 sm:px-5 py-5 text-[14px] text-[var(--mute)]">
                Words you answer show up here with their payment.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {completedTasks.map((t) => (
                  <li key={t.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-[15px]">
                    <div className="min-w-0">
                      {t.submittedText && t.submittedText !== t.aiGuess ? (
                        <>
                          <s className="text-[var(--mute)] mr-1.5">{t.aiGuess}</s>
                          <span className="font-semibold text-[var(--ink)]">{t.submittedText}</span>
                        </>
                      ) : (
                        <span className="font-semibold text-[var(--ink)]">{t.submittedText || t.aiGuess}</span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-0.5 rounded-full text-[12px] font-semibold tabular-nums ${
                        t.status === "accepted"
                          ? "bg-[var(--green-bg)] text-[var(--green-ink)]"
                          : t.status === "submitted"
                          ? "bg-[var(--heard-bg)] text-[var(--heard-ink)]"
                          : "bg-[var(--panel)] text-[var(--mute)]"
                      }`}
                    >
                      {t.status === "accepted"
                        ? `Paid ${money(t.feeTusd8)}`
                        : t.status === "submitted"
                        ? "Waiting"
                        : t.status === "rejected"
                        ? "Not accepted"
                        : "Expired"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="flex items-start gap-2 text-[13px] text-[var(--mute)] px-1">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            You only ever hear up to 12 seconds around each word. The full recording stays with the agency.
          </p>
          <p className="text-[13px] text-[var(--mute)] px-1">
            Agency view:{" "}
            <Link href="/approve" className="font-semibold text-[var(--ink)] underline underline-offset-2">
              approve answers
            </Link>
          </p>
        </aside>
      </section>
    </div>
  );
}
