"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCheck, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { BatchBudget, ReviewTask } from "@/lib/types";
import { ButtonLink } from "@/components/ui";
import { Coin, Sparkle } from "@/components/art";
import { useEarThread, EarMsg } from "@/components/ear/useEarThread";
import { Bubble, ThreadDivider, TypingBubble } from "@/components/ear/Bubble";
import { PlayedNote, VoiceNote } from "@/components/ear/VoiceNote";
import { PaidMessage } from "@/components/ear/PaidMessage";
import { Composer } from "@/components/ear/Composer";
import { EditorChips } from "@/components/ear/EditorChips";
import { AnswerHistory, EarningsCards, PrivacyNote } from "@/components/ear/EarSide";
import { EAR_GRID, EarLoadError, EarSkeleton, EmptyThread } from "@/components/ear/EarStates";

interface EarState {
  batch: BatchBudget;
  tasks: ReviewTask[];
}

function notifyNavSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sikio:state-updated"));
  }
}

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function seedNum(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 97;
  return h / 7;
}

function excerptSrc(task: ReviewTask) {
  // Only ever the server-sliced excerpt (<= 12s), never the full clip.
  return `/api/excerpt/${task.clipId}?start=${task.start}&end=${task.end}`;
}

function excerptLength(task: ReviewTask) {
  return Math.max(0.6, Number((task.end - task.start).toFixed(1)));
}

function UnsureWord({ children, size = "md" }: { children: React.ReactNode; size?: "md" | "sm" }) {
  return (
    <span
      className={`inline-block align-baseline rounded-[10px] border-2 border-[var(--outline)] bg-[var(--yellow)] text-[var(--on-pastel)] font-bold leading-[1.3] ${
        size === "md" ? "px-1.5" : "px-1 text-[13px]"
      }`}
    >
      {children}
    </span>
  );
}

/*
  Ear: the native speaker's phone. The agent sends a short voice note, the
  editor replies with the word they heard, and the payment arrives as a message.
  No crypto words on this screen.
*/
export default function EarPage() {
  const reduce = !!useReducedMotion();
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
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const thread = useEarThread(reduce);
  const { seed, advance } = thread;
  const advanceRef = useRef<{ paid: boolean; fee: number } | null>(null);
  const seedModeRef = useRef<"arrive" | "browse">("arrive");
  const followRef = useRef(false);

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
  const currentId = currentTask?.id ?? null;
  const currentTaskRef = useRef<ReviewTask | null>(currentTask);
  currentTaskRef.current = currentTask;
  const loaded = !!state;

  // Start a fresh thread, or play the reply and the next word after a send.
  useEffect(() => {
    if (!loaded) return;
    const task = currentTaskRef.current;
    const adv = advanceRef.current;
    advanceRef.current = null;
    if (adv) {
      advance(adv, task);
    } else {
      followRef.current = false;
      seed(task, seedModeRef.current);
    }
    seedModeRef.current = "arrive";
  }, [currentId, selectedEditor, loaded, seed, advance]);

  // Stop playback whenever the task or the editor changes
  useEffect(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlayingId(null);
    setExcerptTime(0);
  }, [currentId, selectedEditor]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = loopEnabled;
      audioRef.current.playbackRate = slowMode ? 0.8 : 1.0;
    }
  }, [loopEnabled, slowMode]);

  // Keep the newest message in view: inside the phone on desktop, the page on phones.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
    const scrolls = getComputedStyle(el).overflowY !== "visible";
    if (scrolls) {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else if (followRef.current) {
      const last = el.lastElementChild?.lastElementChild as HTMLElement | null | undefined;
      last?.scrollIntoView({ block: "nearest", behavior });
    }
  }, [thread.log.length, thread.typing, reduce]);

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

  const excerptDuration = currentTask ? excerptLength(currentTask) : 3;

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
    const src = excerptSrc(task);
    if (el.src !== new URL(src, window.location.origin).href) {
      el.src = src;
    }
    el.loop = loopEnabled;
    el.playbackRate = slowMode ? 0.8 : 1.0;
    el.currentTime = 0;
    el.play()
      .then(() => {
        setPlayingId(task.id);
        setError(null);
      })
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
    if (playingId === task.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
    }
    followRef.current = true;
    const outId = thread.sendOut({ text: submittedText, aiGuess: task.aiGuess, confirmedAiRight });
    try {
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
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        thread.dropOut(outId);
        setError(json.error || "Your answer did not send. Try again.");
        return;
      }
      thread.confirmOut(outId);
      advanceRef.current = { paid: json.task?.status === "accepted", fee: task.feeTusd8 };
      setActiveIndex(0);
      await load();
    } catch {
      thread.dropOut(outId);
      setError("Your answer did not send. Check your connection and try again.");
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) return <EarSkeleton />;

  if (loadFailed || !state) {
    return (
      <EarLoadError
        onRetry={() => {
          setLoading(true);
          load();
        }}
      />
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

  const composerReady =
    !!currentTask && thread.log.some((m) => m.kind === "voice" && m.task.id === currentTask.id);

  const browse = (dir: 1 | -1) => {
    seedModeRef.current = "browse";
    setError(null);
    setActiveIndex((i) => (i + dir + openTasks.length) % openTasks.length);
  };

  const renderMsg = (m: EarMsg) => {
    switch (m.kind) {
      case "voice": {
        const live = currentTask && m.task.id === currentTask.id;
        if (!live) {
          return (
            <Bubble key={m.id} delay={m.delay} label="Voice note, answered">
              <PlayedNote seed={seedNum(m.task.id)} duration={excerptLength(m.task)} />
            </Bubble>
          );
        }
        return (
          <Bubble key={m.id} delay={m.delay} className="w-full max-w-[420px]" label="Voice note">
            <VoiceNote
              taskId={currentTask.id}
              audioUrl={excerptSrc(currentTask)}
              duration={excerptDuration}
              time={excerptTime}
              playing={playingId === currentTask.id}
              focusStart={focusStartInExcerpt}
              focusEnd={focusEndInExcerpt}
              loop={loopEnabled}
              slow={slowMode}
              onToggle={() => playExcerpt(currentTask)}
              onScrub={(sec) => {
                if (audioRef.current) {
                  audioRef.current.currentTime = sec;
                  setExcerptTime(sec);
                }
              }}
              onLoop={() => setLoopEnabled((v) => !v)}
              onSlow={() => setSlowMode((v) => !v)}
            />
          </Bubble>
        );
      }
      case "question":
        return (
          <Bubble key={m.id} delay={m.delay} className="max-w-[92%] px-4 py-3 space-y-2">
            <p className="text-[16px] leading-[1.5] text-[var(--ink)]">
              I heard <UnsureWord>&ldquo;{m.task.aiGuess}&rdquo;</UnsureWord>. What did they say?
            </p>
            <p className="text-[14px] leading-[1.6] text-[var(--mute)]">
              {m.task.contextBefore}{" "}
              <UnsureWord size="sm">{m.task.aiGuess}</UnsureWord>{" "}
              {m.task.contextAfter}
            </p>
          </Bubble>
        );
      case "fee":
        return (
          <Bubble key={m.id} delay={m.delay} className="max-w-[92%] pl-2.5 pr-4 py-2">
            <div className="flex items-center gap-2.5 text-[14px] text-[var(--ink)]">
              <Coin size={26} label="" style={{ boxShadow: "2px 2px 0 #111" }} className="shrink-0" />
              <p>
                Pays <b className="font-mono tabular-nums">{money(m.fee)}</b> when the agency approves.
              </p>
            </div>
          </Bubble>
        );
      case "out":
        return (
          <Bubble key={m.id} side="out" delay={m.delay} className="max-w-[85%] px-4 pt-2.5 pb-2">
            <p className="text-[16px] font-bold leading-snug break-words">
              {m.confirmedAiRight ? `“${m.text}” is right` : m.text}
            </p>
            <p className="mt-0.5 flex items-center justify-end gap-1 font-mono text-[11px] font-bold opacity-70">
              {m.status === "sending" ? (
                <>
                  <Clock3 className="w-3 h-3" aria-hidden="true" /> Sending
                </>
              ) : (
                <>
                  <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" /> Sent
                </>
              )}
            </p>
          </Bubble>
        );
      case "paid":
        return (
          <Bubble key={m.id} tone="mint" delay={m.delay} className="max-w-[92%]" label="Payment">
            <PaidMessage fee={m.fee} />
          </Bubble>
        );
      case "waiting":
        return (
          <Bubble key={m.id} tone="sky" delay={m.delay} className="max-w-[88%] px-4 py-3">
            <p className="text-[15px] font-semibold leading-snug">Got it. The agency checks your answer next.</p>
            <p className="mt-1 text-[13px]">
              You get <b className="font-mono tabular-nums">{money(m.fee)}</b> when they approve it.
            </p>
          </Bubble>
        );
      case "divider":
        return <ThreadDivider key={m.id} label={m.label} />;
      case "done":
        return (
          <Bubble key={m.id} delay={m.delay} className="max-w-[92%] px-4 py-3 space-y-3">
            <p className="text-[15px] leading-snug text-[var(--ink)]">
              That was the last word for now. New ones land here as soon as a clip needs an ear.
            </p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/studio" variant="primary" size="sm">Run a clip in Studio</ButtonLink>
              <ButtonLink href="/approve" variant="secondary" size="sm">Approve answers</ButtonLink>
            </div>
          </Bubble>
        );
    }
  };

  const showEmpty = !currentTask && thread.log.length === 0 && !thread.typing;
  const editorOptions = [
    { address: "all", label: "Everyone" },
    ...state.batch.trustedEditors.map((e) => ({
      address: e.address,
      label: e.name.split(" ")[0],
      hint: `${e.name}, ${e.city}`,
    })),
  ];

  return (
    <div className={EAR_GRID}>
      <audio
        ref={audioRef}
        className="hidden"
        onEnded={() => {
          if (!loopEnabled) {
            setPlayingId(null);
            setExcerptTime(0);
          }
        }}
      />

      {/* Header */}
      <header className="[grid-area:head] min-w-0 space-y-4 lg:pt-6 sikio-rise">
        <div className="space-y-2">
          <h1 className="type-page text-[var(--ink)]">Ear</h1>
          <p className="text-[15px] text-[var(--mute)] max-w-[34ch]">
            Hear a few seconds, type what was said, get paid once.
          </p>
        </div>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[13px] font-bold tabular-nums text-[var(--ink)]">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--mint)] border-2 border-[var(--outline)]" aria-hidden="true" />
            {money(earningsPaid)} paid
          </span>
          <span className="text-[var(--mute)]" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--sky)] border-2 border-[var(--outline)]" aria-hidden="true" />
            {money(earningsPending)} waiting
          </span>
        </p>
        <EditorChips
          options={editorOptions}
          value={selectedEditor}
          onChange={(address) => {
            if (address === selectedEditor) return;
            setSelectedEditor(address);
            setActiveIndex(0);
            setError(null);
          }}
        />
      </header>

      {/* The thread */}
      <section aria-label="Messages from the Sikio agent" className="[grid-area:thread] relative min-w-0">
        <Sparkle
          size={34}
          color="#fff27a"
          className="hidden lg:block absolute -top-5 -right-5 z-20 sikio-float"
          style={{ ["--rot" as string]: "12deg" }}
        />
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 24 }}
          className="rounded-[32px] border-2 border-[var(--outline)] bg-[var(--paper)] overflow-clip flex flex-col"
          style={{ boxShadow: "6px 6px 0 var(--outline)" }}
        >
          {/* Agent header */}
          <div className="flex items-center gap-3 pl-4 pr-2 py-3 border-b-2 border-[var(--outline)] bg-[var(--paper)]">
            <span
              className="w-11 h-11 rounded-full bg-[var(--pink)] text-[var(--on-pastel)] border-2 border-[var(--outline)] grid place-items-center font-mono font-bold text-[17px] shrink-0"
              aria-hidden="true"
            >
              S
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold text-[var(--ink)] leading-tight">Sikio agent</div>
              <div className="text-[13px] text-[var(--mute)] truncate">
                {currentTask
                  ? currentTask.clipTitle
                  : editorName
                  ? `For ${editorName.name.split(" ")[0]}`
                  : "Nothing waiting"}
              </div>
            </div>
            {openTasks.length > 0 && (
              <div className="flex items-center shrink-0">
                {openTasks.length > 1 && (
                  <button
                    type="button"
                    aria-label="Previous word"
                    onClick={() => browse(-1)}
                    className="w-11 h-11 rounded-full text-[var(--ink)] hover:bg-[var(--panel)] cursor-pointer grid place-items-center transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <span className="font-mono text-[12px] font-bold tabular-nums text-[var(--mute)] whitespace-nowrap px-0.5" aria-live="polite">
                  {safeIndex + 1} of {openTasks.length}
                </span>
                {openTasks.length > 1 && (
                  <button
                    type="button"
                    aria-label="Next word"
                    onClick={() => browse(1)}
                    className="w-11 h-11 rounded-full text-[var(--ink)] hover:bg-[var(--panel)] cursor-pointer grid place-items-center transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Messages */}
          <div
            ref={scrollerRef}
            className="bg-[var(--bg)] px-3 sm:px-4 py-4 min-h-[380px] flex flex-col lg:h-[min(560px,calc(100dvh-330px))] lg:min-h-[400px] lg:overflow-y-auto no-scrollbar"
          >
            {showEmpty ? (
              <EmptyThread forName={editorName ? editorName.name.split(" ")[0] : undefined} />
            ) : (
              <div key={thread.epoch} className="flex flex-col gap-2.5" aria-live="polite">
                <AnimatePresence initial>
                  {thread.log.map(renderMsg)}
                  {thread.typing && <TypingBubble key="typing" />}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Composer */}
          {currentTask && (
            <Composer
              aiGuess={currentTask.aiGuess}
              fee={currentTask.feeTusd8}
              draft={drafts[currentTask.id] ?? currentTask.aiGuess}
              onDraft={(v) => {
                setDrafts((prev) => ({ ...prev, [currentTask.id]: v }));
                if (error) setError(null);
              }}
              onSend={(confirmed) => handleSubmit(currentTask, confirmed)}
              busy={submittingId !== null}
              ready={composerReady}
              error={error}
            />
          )}
        </motion.div>
      </section>

      {/* Earnings and history */}
      <aside className="[grid-area:side] min-w-0 space-y-7">
        <EarningsCards paid={earningsPaid} waiting={earningsPending} />
        <AnswerHistory tasks={completedTasks} />
        <PrivacyNote />
      </aside>
    </div>
  );
}
