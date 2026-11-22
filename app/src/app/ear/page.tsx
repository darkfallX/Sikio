"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  Check,
  Send,
  Shield,
  ArrowRight,
  CheckCircle2,
  Repeat,
  Gauge,
} from "lucide-react";
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
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
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
          if (next[t.id] === undefined) {
            next[t.id] = t.aiGuess;
          }
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
      .then(() => setPlayingId(task.id))
      .catch(() => setError("Tap play again to allow audio playback."));
  };

  const handleSubmit = async (task: ReviewTask, confirmedAiRight: boolean) => {
    setError(null);
    setFeedback(null);
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
      await load();
      setFeedback(
        json.task?.status === "accepted"
          ? `Paid $${task.feeTusd8.toFixed(2)} immediately.`
          : `Sent "${submittedText}" for approval. Zero fee charged.`
      );
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading || !state) {
    return (
      <div className="max-w-[540px] mx-auto space-y-4">
        <div className="h-28 rounded-[6px] bg-[#EBE6DB] animate-pulse" />
        <div className="h-60 rounded-[6px] bg-[#EBE6DB] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-[540px] mx-auto space-y-5">
      <audio ref={audioRef} onEnded={() => !loopEnabled && setPlayingId(null)} />

      {/* Handheld Field Recorder Top Deck — Zero Crypto Jargon */}
      <div className="rounded-[6px] border border-[#DDD7CA] bg-[#121110] text-[#FBF9F4] overflow-hidden">
        <div className="p-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#C94A22]">
              Native Speaker Desk
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.025em] mt-0.5">
              Ear
            </h1>
            <p className="text-xs text-[#ABA498] mt-1">
              Listen to 3–5 seconds. Type what you hear. Get paid in dollars.
            </p>
          </div>
          <div className="text-right tabular-nums bg-[#1C1A18] border border-[#2B2825] rounded-[5px] px-3.5 py-2.5">
            <div className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#9C9589]">
              Earned
            </div>
            <div className="text-2xl font-semibold text-[#7CE2AC]">
              ${earningsPaid.toFixed(2)}
            </div>
            {earningsPending > 0 && (
              <div className="text-[10px] font-mono text-[#F5C97B]">
                +${earningsPending.toFixed(2)} pending
              </div>
            )}
          </div>
        </div>

        {/* Editor Selector + Playback Modifiers */}
        <div className="px-5 py-3 bg-[#1A1816] border-t border-[#282522] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedEditor("all")}
              className={`px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors cursor-pointer ${
                selectedEditor === "all"
                  ? "bg-[#FBF9F4] text-[#141311]"
                  : "bg-[#262320] text-[#B8B0A4] hover:text-[#FBF9F4]"
              }`}
            >
              All
            </button>
            {state.batch.trustedEditors.map((ed) => (
              <button
                key={ed.address}
                type="button"
                onClick={() => setSelectedEditor(ed.address)}
                className={`px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors cursor-pointer ${
                  selectedEditor === ed.address
                    ? "bg-[#FBF9F4] text-[#141311]"
                    : "bg-[#262320] text-[#B8B0A4] hover:text-[#FBF9F4]"
                }`}
              >
                {ed.name.split(" ")[0]} · {ed.city}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLoopEnabled((v) => !v)}
              title="Loop audio excerpt"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-[4px] text-[11px] font-mono transition-colors cursor-pointer ${
                loopEnabled
                  ? "bg-[#C94A22] text-[#FBF9F4]"
                  : "bg-[#262320] text-[#9C9589]"
              }`}
            >
              <Repeat className="w-3 h-3" /> Loop
            </button>
            <button
              type="button"
              onClick={() => setSlowMode((v) => !v)}
              title="Slow playback for rapid speech"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-[4px] text-[11px] font-mono transition-colors cursor-pointer ${
                slowMode
                  ? "bg-[#C94A22] text-[#FBF9F4]"
                  : "bg-[#262320] text-[#9C9589]"
              }`}
            >
              <Gauge className="w-3 h-3" /> 0.8×
            </button>
          </div>
        </div>
      </div>

      {/* Confidentiality Strip */}
      <div className="rounded-[5px] border border-[#DDD7CA] bg-[#FBF9F4] px-3.5 py-2.5 flex items-center gap-2 text-xs text-[#5C574E]">
        <Shield className="w-3.5 h-3.5 text-[#1B6B46] shrink-0" />
        <span>
          Excerpt-only audio delivered. Full client video stays private; zero fee to submit.
        </span>
      </div>

      {error && (
        <div className="rounded-[5px] bg-[#FAEAE4] border border-[#E8C5B8] px-3.5 py-2.5 text-xs text-[#B33C17]">
          {error}
        </div>
      )}

      {feedback && (
        <div className="rounded-[5px] bg-[#E7F4ED] border border-[#C3E2D1] px-3.5 py-2.5 text-xs text-[#1B6B46] flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {feedback}
          </span>
          <Link href="/approve" className="font-semibold underline shrink-0">
            Approve →
          </Link>
        </div>
      )}

      {/* Open Tasks Feed */}
      {openTasks.length === 0 ? (
        <div className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-[#141311]">
            All caught up.
          </p>
          <p className="text-xs text-[#5C574E]">
            Run a clip in Studio to flag uncertain passages, or open Approve to settle submitted fixes.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Link
              href="/"
              className="px-4 py-2 rounded-[5px] text-xs font-medium bg-[#141311] text-[#FBF9F4]"
            >
              Open Studio
            </Link>
            <Link
              href="/approve"
              className="px-4 py-2 rounded-[5px] text-xs font-medium bg-[#EBE6DB] text-[#141311]"
            >
              Open Approve
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {openTasks.map((task, idx) => {
            const excerptDur = Math.max(0.5, task.end - task.start).toFixed(1);
            const isPlaying = playingId === task.id;
            return (
              <article
                key={task.id}
                className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-[#DDD7CA] bg-[#F4F1EA]/70 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-[#141311]">
                      Task {idx + 1} · {task.editorName} ({task.editorCity})
                    </div>
                    <div className="text-[11px] font-mono text-[#5C574E]">
                      {task.clipTitle} · {excerptDur}s excerpt
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-[4px] bg-[#E7F4ED] text-[#1B6B46] text-xs font-mono font-semibold tabular-nums">
                    +${task.feeTusd8.toFixed(2)}
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  {/* Tactile Audio Button */}
                  <button
                    type="button"
                    onClick={() => playExcerpt(task)}
                    className={`w-full py-3.5 px-4 rounded-[5px] border flex items-center justify-center gap-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                      isPlaying
                        ? "bg-[#141311] text-[#FBF9F4] border-[#141311]"
                        : "bg-[#F4F1EA] text-[#141311] border-[#C7BFB0] hover:border-[#141311]"
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-[#C94A22] sikio-led-live" />
                        <Pause className="w-4 h-4" />
                        <span>Playing {excerptDur}s excerpt{slowMode ? " (0.8×)" : ""}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Listen to {excerptDur}s excerpt</span>
                      </>
                    )}
                  </button>

                  {/* Context Script */}
                  <div className="rounded-[5px] bg-[#F4F1EA] border border-[#DDD7CA] px-4 py-3 text-[15px] leading-relaxed text-[#141311]">
                    <span className="text-[#5C574E]">{task.contextBefore} </span>
                    <mark className="px-1.5 py-0.5 rounded-[4px] bg-[#FAEAE4] text-[#B33C17] font-semibold">
                      {task.aiGuess}
                    </mark>
                    <span className="text-[#5C574E]"> {task.contextAfter}</span>
                  </div>

                  {/* Fix Form (Enter submits directly) */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSubmit(task, false);
                    }}
                    className="space-y-3"
                  >
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`fix-${task.id}`}
                        className="block text-xs font-medium text-[#5C574E]"
                      >
                        Correct spelling or word heard
                      </label>
                      <input
                        id={`fix-${task.id}`}
                        type="text"
                        value={drafts[task.id] ?? task.aiGuess}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [task.id]: e.target.value,
                          }))
                        }
                        className="w-full px-3.5 py-3 rounded-[5px] text-base font-medium bg-[#FFFFFF] border border-[#C7BFB0] text-[#141311] focus:border-[#C94A22]"
                        placeholder="Type what the speaker said"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="submit"
                        disabled={submittingId === task.id}
                        className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-[5px] text-sm font-semibold bg-[#C94A22] text-[#FBF9F4] hover:bg-[#AB3B18] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        {submittingId === task.id
                          ? "Sending…"
                          : `Submit Fix · $${task.feeTusd8.toFixed(2)}`}
                      </button>
                      <button
                        type="button"
                        disabled={submittingId === task.id}
                        onClick={() => handleSubmit(task, true)}
                        className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-[5px] text-sm font-medium bg-[#EBE6DB] text-[#141311] hover:bg-[#DDD7CA] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Check className="w-4 h-4" /> AI was right
                      </button>
                    </div>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Completed Feed */}
      {completedTasks.length > 0 && (
        <section className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#DDD7CA] bg-[#F4F1EA]/70 flex items-center justify-between">
            <h2 className="text-[11px] font-mono uppercase tracking-[0.06em] font-semibold text-[#5C574E]">
              Submitted & Paid ({completedTasks.length})
            </h2>
            <Link
              href="/approve"
              className="text-xs font-medium text-[#C94A22] inline-flex items-center gap-1 hover:underline"
            >
              Approve desk <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-[#DDD7CA]">
            {completedTasks.slice(0, 8).map((t) => (
              <div
                key={t.id}
                className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="truncate">
                  <span className="line-through text-[#847D72] mr-1.5">
                    {t.aiGuess}
                  </span>
                  <span className="font-semibold text-[#141311]">
                    {t.submittedText || t.aiGuess}
                  </span>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-[4px] font-mono font-medium tabular-nums ${
                    t.status === "accepted"
                      ? "bg-[#E7F4ED] text-[#1B6B46]"
                      : t.status === "submitted"
                      ? "bg-[#FBF2DD] text-[#945D00]"
                      : "bg-[#EBE6DB] text-[#5C574E]"
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
        </section>
      )}
    </div>
  );
}
