"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowUpRight, Ear, Loader2, RotateCw } from "lucide-react";
import { BatchBudget, ReviewTask } from "@/lib/types";
import { shortAddr } from "@/lib/aevum";
import { useWallet } from "@/components/WalletContext";
import { Button, ButtonLink, ModeTag } from "@/components/ui";
import { SPRING } from "@/components/motion-kit";
import { IllustrationEar, IllustrationPay } from "@/components/art";
import { Banner } from "@/components/approve/Banner";
import { HeardCard, TaskAction } from "@/components/approve/HeardCard";
import { SettledRow, WaitingRow } from "@/components/approve/TaskRows";

interface ApproveState {
  batch: BatchBudget;
  tasks: ReviewTask[];
  availableBudgetTusd8: number;
}

const SETTLED_PREVIEW = 5;

function notifyNavSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sikio:state-updated"));
  }
}

export default function ApprovePage() {
  const { address, isAevum, liveEscrowMode, acceptTaskOnChain } = useWallet();
  const [state, setState] = useState<ApproveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Whether the server can settle on-chain with its operator key (no wallet needed).
  const [serverLive, setServerLive] = useState(false);
  // Live settlement progress (0 reserve, 1 record, 2 pay) while the ~20s on-chain run happens.
  const [settling, setSettling] = useState<{ step: number } | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: TaskAction } | null>(
    null,
  );
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playTime, setPlayTime] = useState(0);
  const [banner, setBanner] = useState<{
    text: string;
    paid: boolean;
    txUrl?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [showAllSettled, setShowAllSettled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApproveState;
      setState(json);
      setLoadError(null);
      notifyNavSync();
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Could not load the queue.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Ask the server whether it can settle live on Aevum, so the badge reflects what
  // Approve really does (a real on-chain payout), not whether a wallet is connected.
  useEffect(() => {
    let alive = true;
    fetch("/api/settle", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j) setServerLive(Boolean(j.available));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 7000);
    return () => clearTimeout(t);
  }, [banner]);

  useEffect(() => {
    if (!celebrateId) return;
    const t = setTimeout(() => setCelebrateId(null), 2600);
    return () => clearTimeout(t);
  }, [celebrateId]);

  const submittedQueue = useMemo(
    () => (state?.tasks || []).filter((t) => t.status === "submitted"),
    [state],
  );
  const waitingEditors = useMemo(
    () => (state?.tasks || []).filter((t) => t.status === "offered"),
    [state],
  );
  // Ids decided in this visit, newest first. Rejects and returns carry no timestamp,
  // so this keeps every fresh decision at the top of Settled.
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const settled = useMemo(() => {
    const list = (state?.tasks || []).filter(
      (t) => t.status === "accepted" || t.status === "rejected" || t.status === "expired"
    );
    const rank = (t: ReviewTask) => {
      const i = recentIds.indexOf(t.id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...list].sort(
      (a, b) => rank(a) - rank(b) || (b.approvedAt || "").localeCompare(a.approvedAt || "")
    );
  }, [state, recentIds]);
  const paidCount = settled.filter((t) => t.status === "accepted").length;

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
      .catch(() =>
        setError("This excerpt could not play. Try again in a moment."),
      );
  };

  const handleAction = async (task: ReviewTask, action: TaskAction) => {
    setError(null);
    setBanner(null);
    setBusy({ id: task.id, action });
    let stepTimer: ReturnType<typeof setInterval> | undefined;
    if (playingId === task.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
    try {
      let json: {
        error?: string;
        mode?: "aevum-live" | "sandbox";
        settlement?: { explorerTxUrl?: string };
      };

      if (action === "accept" && !(liveEscrowMode && address && isAevum)) {
        // No connected wallet: the server settles on-chain with the operator key.
        // The approver pays once from the browser with no wallet, key, or extension.
        // Show the three on-chain steps and an elapsed counter while the server works.
        if (serverLive) {
          setSettling({ step: 0 });
        }
        const res = await fetch("/api/settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id }),
        });
        json = await res.json();
        if (!res.ok) {
          setError(json.error || "Could not settle this one. Nothing was paid.");
          return;
        }
      } else {
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
        json = await res.json();
        if (!res.ok) {
          setError(
            json.error ||
              `Could not ${action === "accept" ? "approve" : "return"} this one.`,
          );
          return;
        }
      }

      setRecentIds((ids) => [task.id, ...ids.filter((id) => id !== task.id)]);
      await load();
      if (action === "accept") setCelebrateId(task.id);
      const fee = task.feeTusd8.toFixed(2);
      const live = json.mode === "aevum-live";
      setBanner({
        paid: action === "accept",
        txUrl: json.settlement?.explorerTxUrl,
        text:
          action === "accept"
            ? `Paid ${task.editorName} ${fee} tUSD8 once${live ? " on Aevum" : ""}. "${task.submittedText || task.aiGuess}" is now in the captions.`
            : action === "reject"
              ? `Rejected "${task.submittedText || task.aiGuess}". ${fee} tUSD8 is back in the batch.`
              : `Returned ${fee} tUSD8 to the batch.`,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Nothing was paid.",
      );
    } finally {
      if (stepTimer) clearInterval(stepTimer);
      setSettling(null);
      setBusy(null);
    }
  };

  if (loading) return <ApproveSkeleton />;

  if (!state) {
    return (
      <div className="max-w-xl mx-auto pt-6">
        <div className="brut-lg bg-[var(--paper)] p-7 sm:p-9 grid gap-4 justify-items-start">
          <span className="type-label">Approve</span>
          <h1 className="type-section">The queue did not load</h1>
          <p className="text-[var(--ink-2)]">
            Nothing was paid or changed. Check that the app server is running,
            then try again.
          </p>
          {loadError && (
            <p className="font-mono text-[13px] text-[var(--error)]">
              {loadError}
            </p>
          )}
          <Button
            variant="primary"
            onClick={() => {
              setLoading(true);
              load();
            }}
          >
            <RotateCw className="w-4 h-4" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  // The badge reflects what Approve actually does: a real on-chain settlement, whether
  // the approver connects a wallet or the server settles with its operator key.
  const live = serverLive || (liveEscrowMode && !!address && isAevum);
  const nothingAnywhere =
    submittedQueue.length === 0 &&
    waitingEditors.length === 0 &&
    settled.length === 0;

  return (
    <div className="space-y-8 sm:space-y-10">
      <audio
        ref={audioRef}
        onEnded={() => {
          setPlayingId(null);
          setPlayTime(0);
        }}
      />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING.soft}
        className="flex flex-col md:flex-row md:items-end justify-between gap-5"
      >
        <div className="space-y-3 min-w-0">
          <h1 className="type-page">Approve</h1>
          <p className="text-[17px] text-[var(--ink-2)]">
            Listen, compare, then pay the native speaker once.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2.5 min-h-[44px] pl-1.5 pr-4 rounded-full border-2 border-[var(--outline)] bg-[var(--paper)]">
            <span
              aria-hidden="true"
              className="w-8 h-8 rounded-full pastel-lilac border-2 border-[var(--outline)] grid place-items-center"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#111]" />
            </span>
            <span className="leading-none">
              <span className="block text-[11px] font-bold text-[var(--mute)]">
                Approver
              </span>
              <span className="font-mono text-[13px] font-bold">
                {shortAddr(state.batch.approverAddress)}
              </span>
            </span>
            <span className="w-px h-6 bg-[var(--line)]" aria-hidden="true" />
            <ModeTag live={live} />
          </span>
          <ButtonLink href="/studio" variant="secondary">
            Open the board <ArrowUpRight className="w-4 h-4" />
          </ButtonLink>
        </div>
      </motion.header>

      {/* Feedback: a floating outlined banner so it is seen wherever the approver has scrolled */}
      <div className="fixed z-40 bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[520px] grid gap-3 pointer-events-none [&>*]:pointer-events-auto">
        <AnimatePresence initial={false}>
          {settling && (
            <motion.div
              key="settling"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={SPRING.soft}
              className="brut bg-[var(--paper)] p-4 sm:p-5 grid gap-3"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-2 font-mono text-[13.5px] font-bold">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Settling on QDay Aevum
                <ElapsedSeconds />
              </div>
              <ol className="grid gap-2">
                {[
                  "Reserve the fee in escrow",
                  "Record the editor's fix",
                  "Pay the editor once",
                ].map((label) => {
                  // The server reports the hashes when all three are mined, so no step is
                  // shown as done before the chain confirms it.
                  const done = false;
                  const active = false;
                  return (
                    <li
                      key={label}
                      className={`flex items-center gap-2.5 text-[13.5px] ${
                        active ? "font-bold text-[var(--ink)]" : "text-[var(--mute)]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-3 h-3 shrink-0 rounded-full border-2 border-[var(--outline)] ${
                          done || active ? "bg-[var(--mint)]" : "bg-[var(--paper)]"
                        }`}
                      />
                      <span className={done ? "line-through" : ""}>{label}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="text-[12px] text-[var(--mute)]">
                Three real transactions on chain 44005, one after another. Usually under a
                minute; the public testnet is sometimes slower.
              </p>
            </motion.div>
          )}
          {error && (
            <Banner key="err" tone="error" onClose={() => setError(null)}>
              {error}
            </Banner>
          )}
          {banner && (
            <Banner
              key="ok"
              tone="success"
              onClose={() => setBanner(null)}
              action={
                banner.paid && (
                  <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
                    {banner.txUrl && (
                      <a
                        href={banner.txUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 min-h-[32px] font-bold underline underline-offset-4 decoration-2"
                      >
                        See it on Aevum explorer{" "}
                        <ArrowUpRight className="w-4 h-4" />
                      </a>
                    )}
                    <Link
                      href="/studio"
                      className="inline-flex items-center gap-1 min-h-[32px] underline underline-offset-4 decoration-2"
                    >
                      Replay fixed captions <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </span>
                )
              }
            >
              {banner.text}
            </Banner>
          )}
        </AnimatePresence>
      </div>

      {nothingAnywhere ? (
        <EmptyAll />
      ) : (
        <LayoutGroup>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-8 lg:gap-10 items-start">
            {/* Main queue */}
            <section aria-labelledby="heard-h" className="space-y-4 min-w-0">
              <SectionHead
                id="heard-h"
                title="Heard, ready to approve"
                count={submittedQueue.length}
                tone="sky"
                aside={`${state.batch.reservedTusd8.toFixed(2)} tUSD8 held`}
              />
              <div className="grid gap-6">
                <AnimatePresence mode="popLayout">
                  {submittedQueue.length === 0 ? (
                    <EmptyHeard key="empty" waiting={waitingEditors.length} />
                  ) : (
                    submittedQueue.map((task, i) => (
                      <HeardCard
                        key={task.id}
                        task={task}
                        index={i}
                        isPlaying={playingId === task.id}
                        playTime={playTime}
                        busyAction={busy?.id === task.id ? busy.action : null}
                        disabled={!!busy}
                        onPlay={() => playExcerpt(task)}
                        onAction={(a) => handleAction(task, a)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* Side rail */}
            <aside className="space-y-8 min-w-0">
              <section aria-labelledby="settled-h" className="space-y-3">
                <SectionHead
                  id="settled-h"
                  title="Settled"
                  count={settled.length}
                  tone="mint"
                  aside={paidCount > 0 ? `${paidCount} paid once` : undefined}
                />
                {settled.length === 0 && (
                  <div className="rounded-[18px] border-2 border-dashed border-[var(--line)] px-5 py-6 flex items-center gap-4">
                    <IllustrationPay className="w-12 h-12 shrink-0" />
                    <p className="text-[14px] text-[var(--mute)]">
                      Nothing paid yet. Approved answers land here, paid once.
                    </p>
                  </div>
                )}
                {/* Always mounted so the first decision also animates in */}
                <ul className="grid gap-2.5 empty:hidden">
                  <AnimatePresence initial={false}>
                    {(showAllSettled
                      ? settled
                      : settled.slice(0, SETTLED_PREVIEW)
                    ).map((t) => (
                      <SettledRow
                        key={t.id}
                        task={t}
                        celebrate={celebrateId === t.id}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
                {settled.length > SETTLED_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllSettled((v) => !v)}
                    aria-expanded={showAllSettled}
                    className="inline-flex items-center gap-1.5 min-h-[44px] text-[14px] font-bold underline underline-offset-4 decoration-2 cursor-pointer"
                  >
                    {showAllSettled
                      ? "Show fewer"
                      : `Show all ${settled.length}`}
                  </button>
                )}
              </section>

              <section aria-labelledby="waiting-h" className="space-y-3">
                <SectionHead
                  id="waiting-h"
                  title="Waiting for a native speaker"
                  count={waitingEditors.length}
                  tone="yellow"
                />
                {waitingEditors.length === 0 ? (
                  <p className="rounded-[18px] border-2 border-dashed border-[var(--line)] px-5 py-5 text-[14px] text-[var(--mute)]">
                    No words are waiting. Every unsure word has an answer.
                  </p>
                ) : (
                  <>
                    <ul className="grid gap-2.5">
                      <AnimatePresence initial={false}>
                        {waitingEditors.map((t) => (
                          <WaitingRow
                            key={t.id}
                            task={t}
                            isPlaying={playingId === t.id}
                            busy={busy?.id === t.id}
                            disabled={!!busy}
                            onPlay={() => playExcerpt(t)}
                            onReturn={() => handleAction(t, "expire")}
                          />
                        ))}
                      </AnimatePresence>
                    </ul>
                    <Link
                      href="/ear"
                      className="inline-flex items-center gap-1.5 min-h-[44px] text-[14px] font-bold underline underline-offset-4 decoration-2"
                    >
                      Answer them in Ear <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </>
                )}
              </section>
            </aside>
          </div>
        </LayoutGroup>
      )}
    </div>
  );
}

/** Seconds since the settlement started, so a slow testnet reads as progress, not a hang. */
function ElapsedSeconds() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setSecs(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="ml-auto font-mono text-[12.5px] font-bold tabular-nums text-[var(--mute)]">
      {secs}s
    </span>
  );
}

function SectionHead({
  id,
  title,
  count,
  tone,
  aside,
}: {
  id: string;
  title: string;
  count: number;
  tone: "sky" | "mint" | "yellow";
  aside?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <h2
        id={id}
        className="flex items-center gap-2.5 font-mono font-bold text-[17px] sm:text-[19px] tracking-[-0.04em]"
      >
        {title}
        <motion.span
          key={count}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING.bouncy}
          className={`pastel-${tone} min-w-[30px] h-[30px] px-2 rounded-full border-2 border-[var(--outline)] grid place-items-center text-[13px] tabular-nums`}
        >
          {count}
        </motion.span>
      </h2>
      {aside && (
        <span className="font-mono text-[12.5px] font-bold text-[var(--mute)]">
          {aside}
        </span>
      )}
    </div>
  );
}

function EmptyHeard({
  waiting,
  ref,
}: {
  waiting: number;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={SPRING.soft}
      className="brut bg-[var(--paper)] p-7 sm:p-10 flex flex-col sm:flex-row sm:items-center gap-6"
    >
      <div className="w-20 h-20 shrink-0 rounded-full pastel-sky border-2 border-[var(--outline)] grid place-items-center">
        <IllustrationEar className="w-14 h-14" />
      </div>
      <div className="space-y-3 min-w-0">
        <h3 className="font-mono font-bold text-[20px] tracking-[-0.04em]">
          Nothing to approve yet
        </h3>
        <p className="text-[15px] text-[var(--ink-2)] max-w-[44ch]">
          {waiting > 0
            ? `${waiting} ${waiting === 1 ? "word is" : "words are"} with a native speaker. Their answers show up here.`
            : "Answers from native speakers show up here as soon as they reply."}
        </p>
        <ButtonLink href="/ear" variant="secondary" size="sm">
          <Ear className="w-4 h-4" /> Open Ear
        </ButtonLink>
      </div>
    </motion.div>
  );
}

function EmptyAll() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.soft}
      className="brut-lg bg-[var(--paper)] p-8 sm:p-14 grid gap-5 justify-items-center text-center"
    >
      <div className="w-24 h-24 rounded-full pastel-yellow border-2 border-[var(--outline)] grid place-items-center">
        <IllustrationEar className="w-16 h-16" />
      </div>
      <h2 className="type-section">No words to check yet</h2>
      <p className="text-[16px] text-[var(--ink-2)] max-w-[40ch]">
        Caption a clip in Studio. When the AI is unsure of a word, it asks a
        native speaker, and their answer comes here.
      </p>
      <ButtonLink href="/studio" variant="primary">
        Caption a clip <ArrowUpRight className="w-4 h-4" />
      </ButtonLink>
    </motion.div>
  );
}

function ApproveSkeleton() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="Loading the approval queue"
    >
      <div className="space-y-3">
        <div className="h-11 w-48 rounded-full bg-[var(--panel)] animate-pulse" />
        <div className="h-5 w-80 max-w-full rounded-full bg-[var(--panel)] animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-8 lg:gap-10">
        <div className="brut-lg bg-[var(--paper)] p-6 sm:p-7 grid gap-5">
          <div className="h-7 w-40 rounded-full bg-[var(--panel)] animate-pulse" />
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="h-24 rounded-[18px] bg-[var(--panel)] animate-pulse" />
            <div className="h-24 rounded-[18px] bg-[var(--panel)] animate-pulse" />
          </div>
          <div className="h-14 rounded-full bg-[var(--panel)] animate-pulse" />
          <div className="h-12 w-64 rounded-full bg-[var(--panel)] animate-pulse justify-self-end" />
        </div>
        <div className="grid gap-2.5 content-start">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-[18px] bg-[var(--panel)] animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
