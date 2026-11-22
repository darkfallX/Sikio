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
} from "lucide-react";
import { BatchBudget, ReviewTask } from "@/lib/types";

interface EarState {
  batch: BatchBudget;
  tasks: ReviewTask[];
}

export default function EarPage() {
  const [state, setState] = useState<EarState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEditor, setSelectedEditor] = useState<string>("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
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
    // Excerpt-only endpoint: editor ONLY receives [start, end] WAV slice (max 12s)
    const src = task.clipId.startsWith("custom-")
      ? "/clips/lagos-fintech-ep14.wav"
      : `/api/excerpt/${task.clipId}?start=${task.start}&end=${task.end}`;
    el.src = src;
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
          ? `Paid $${task.feeTusd8.toFixed(2)} (tUSD8) immediately under trusted-editor auto-accept.`
          : `Sent "${submittedText}" for approval. No fee charged to submit.`
      );
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading || !state) {
    return (
      <div className="max-w-[540px] mx-auto space-y-4">
        <div className="h-24 rounded-[8px] bg-[#EFECE4] animate-pulse" />
        <div className="h-56 rounded-[8px] bg-[#EFECE4] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-[540px] mx-auto space-y-5">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />

      {/* Mobile-first Editor Earnings Header (Zero crypto jargon) */}
      <div className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-[#161513]">
              Ear
            </h1>
            <p className="text-xs text-[#5C584F] mt-0.5">
              Listen to a few seconds. Fix the word. Get paid in dollars (tUSD8).
            </p>
          </div>
          <div className="text-right tabular-nums">
            <div className="text-[11px] uppercase tracking-wide text-[#5C584F]">
              Paid today
            </div>
            <div className="text-2xl font-semibold text-[#1D6B48]">
              ${earningsPaid.toFixed(2)}
            </div>
            {earningsPending > 0 && (
              <div className="text-[11px] text-[#945F00]">
                +${earningsPending.toFixed(2)} awaiting approval
              </div>
            )}
          </div>
        </div>

        {/* Editor Profile Filter */}
        <div className="mt-4 pt-3 border-t border-[#E2DDD2] flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedEditor("all")}
            className={`px-2.5 py-1 rounded-[5px] text-xs font-medium transition-colors cursor-pointer ${
              selectedEditor === "all"
                ? "bg-[#161513] text-[#FCFBF8]"
                : "bg-[#EFECE4] text-[#5C584F] hover:text-[#161513]"
            }`}
          >
            All editors
          </button>
          {state.batch.trustedEditors.map((ed) => (
            <button
              key={ed.address}
              type="button"
              onClick={() => setSelectedEditor(ed.address)}
              className={`px-2.5 py-1 rounded-[5px] text-xs font-medium transition-colors cursor-pointer ${
                selectedEditor === ed.address
                  ? "bg-[#161513] text-[#FCFBF8]"
                  : "bg-[#EFECE4] text-[#5C584F] hover:text-[#161513]"
              }`}
            >
              {ed.name.split(" ")[0]} · {ed.city}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 text-[11px] text-[#5C584F]">
          <Shield className="w-3.5 h-3.5 text-[#1D6B48] shrink-0" />
          <span>
            Confidentiality active: you receive only the flagged excerpt, and network fees are covered for you.
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-[6px] bg-[#F9EAE4] border border-[#EBC7BA] px-3.5 py-2.5 text-xs text-[#B8381A]">
          {error}
        </div>
      )}

      {feedback && (
        <div className="rounded-[6px] bg-[#E9F4EE] border border-[#C6E3D3] px-3.5 py-2.5 text-xs text-[#1D6B48] flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
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
        <div className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] p-7 text-center space-y-3">
          <p className="text-sm font-medium text-[#161513]">
            No open tasks right now.
          </p>
          <p className="text-xs text-[#5C584F]">
            Run a clip in Studio to flag uncertain words, or review submitted fixes in Approve.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Link
              href="/"
              className="px-3.5 py-2 rounded-[6px] text-xs font-medium bg-[#161513] text-[#FCFBF8]"
            >
              Go to Studio
            </Link>
            <Link
              href="/approve"
              className="px-3.5 py-2 rounded-[6px] text-xs font-medium bg-[#EFECE4] text-[#161513]"
            >
              Open Approve
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {openTasks.map((task) => {
            const excerptDur = Math.max(0.5, task.end - task.start).toFixed(1);
            const isPlaying = playingId === task.id;
            return (
              <article
                key={task.id}
                className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] p-5 space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium text-[#5C584F]">
                      {task.clipTitle} · {task.editorName} ({task.editorCity})
                    </div>
                    <div className="text-[11px] font-mono text-[#5C584F] mt-0.5">
                      Excerpt {excerptDur}s ({task.start.toFixed(1)}s–{task.end.toFixed(1)}s)
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-[5px] bg-[#E9F4EE] text-[#1D6B48] text-xs font-semibold tabular-nums">
                    Earn ${task.feeTusd8.toFixed(2)}
                  </span>
                </div>

                {/* Big Thumb-Friendly Excerpt Player */}
                <button
                  type="button"
                  onClick={() => playExcerpt(task)}
                  className={`w-full py-3 px-4 rounded-[6px] border flex items-center justify-center gap-2 text-sm font-medium transition-colors cursor-pointer ${
                    isPlaying
                      ? "bg-[#161513] text-[#FCFBF8] border-[#161513]"
                      : "bg-[#F7F5F0] text-[#161513] border-[#E2DDD2] hover:border-[#161513]"
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4" /> Playing excerpt ({excerptDur}s)…
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" /> Listen to {excerptDur}s excerpt
                    </>
                  )}
                </button>

                {/* Context Sentence */}
                <div className="rounded-[6px] bg-[#F7F5F0] border border-[#E2DDD2] px-3.5 py-3 text-[15px] leading-relaxed text-[#161513]">
                  <span className="text-[#5C584F]">{task.contextBefore} </span>
                  <mark className="px-1.5 py-0.5 rounded-[4px] bg-[#F9EAE4] text-[#B8381A] font-semibold">
                    {task.aiGuess}
                  </mark>
                  <span className="text-[#5C584F]"> {task.contextAfter}</span>
                </div>

                {/* Fix Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor={`fix-${task.id}`}
                    className="block text-xs font-medium text-[#5C584F]"
                  >
                    What did the speaker actually say?
                  </label>
                  <input
                    id={`fix-${task.id}`}
                    type="text"
                    value={drafts[task.id] ?? task.aiGuess}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-[6px] text-base font-medium bg-[#FCFBF8] border border-[#CFC8B8] text-[#161513] focus:border-[#C54B24]"
                    placeholder="Type the exact word or phrase"
                  />
                </div>

                {/* Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={submittingId === task.id}
                    onClick={() => handleSubmit(task, false)}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-[6px] text-sm font-medium bg-[#C54B24] text-[#FCFBF8] hover:bg-[#A93E1B] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    {submittingId === task.id ? "Sending…" : "Submit Fix"}
                  </button>
                  <button
                    type="button"
                    disabled={submittingId === task.id}
                    onClick={() => handleSubmit(task, true)}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-[6px] text-sm font-medium bg-[#EFECE4] text-[#161513] hover:bg-[#E2DDD2] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> AI was right
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Recent Editor Activity */}
      {completedTasks.length > 0 && (
        <section className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#5C584F]">
              Submitted & Paid ({completedTasks.length})
            </h2>
            <Link
              href="/approve"
              className="text-xs font-medium text-[#C54B24] inline-flex items-center gap-1 hover:underline"
            >
              View in Approve <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-[#E2DDD2]">
            {completedTasks.slice(0, 8).map((t) => (
              <div
                key={t.id}
                className="py-2 flex items-center justify-between gap-2 text-xs"
              >
                <div className="truncate">
                  <span className="line-through text-[#5C584F] mr-1.5">
                    {t.aiGuess}
                  </span>
                  <span className="font-medium text-[#161513]">
                    {t.submittedText || t.aiGuess}
                  </span>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-[4px] font-medium tabular-nums ${
                    t.status === "accepted"
                      ? "bg-[#E9F4EE] text-[#1D6B48]"
                      : t.status === "submitted"
                      ? "bg-[#FBF2DE] text-[#945F00]"
                      : "bg-[#EFECE4] text-[#5C584F]"
                  }`}
                >
                  {t.status === "accepted"
                    ? `Paid $${t.feeTusd8.toFixed(2)}`
                    : t.status === "submitted"
                    ? "Pending approval"
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
