"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, RotateCcw } from "lucide-react";
import { BatchBudget, CaptionJob, PaymentReceipt, ReviewTask } from "@/lib/types";
import { computeCostMetrics } from "@/lib/captions";
import { SIKIO_TRANSCRIPTION_PROVIDER } from "@/lib/x402";
import { SeekRequest, WaveformPlayer } from "@/components/WaveformPlayer";
import { BudgetRail } from "@/components/BudgetRail";
import { useWallet } from "@/components/WalletContext";
import { buttonClass, Reveal, SPRING } from "@/components/ui";
import { RunPanel, ShowcaseClipOption } from "@/components/studio/RunPanel";
import { LifecycleLanes } from "@/components/studio/LifecycleLanes";
import { MoneyRow } from "@/components/studio/MoneyRow";
import { CostBreakdown } from "@/components/studio/CostBreakdown";
import { Banner } from "@/components/studio/Banner";
import { StudioEmpty, StudioLoadError, StudioSkeleton } from "@/components/studio/StudioStates";

interface StatePayload {
  batch: BatchBudget;
  jobs: CaptionJob[];
  tasks: ReviewTask[];
  receipts: PaymentReceipt[];
  availableBudgetTusd8: number;
  showcaseClips: ShowcaseClipOption[];
}

function notifyNavSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sikio:state-updated"));
  }
}

const rise = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { ...SPRING.soft, delay: i * 0.07 },
});

export default function StudioPage() {
  const { address, isAevum, liveEscrowMode, payInferenceOnChain, acceptTaskOnChain } = useWallet();
  const [data, setData] = useState<StatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<number>(-1);
  const [uploading, setUploading] = useState(false);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [boardMsg, setBoardMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const [selectedClipId, setSelectedClipId] = useState("lagos-fintech-ep14");
  const [threshold, setThreshold] = useState(0.78);
  const [feePerTask, setFeePerTask] = useState(0.1);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [seekRequest, setSeekRequest] = useState<SeekRequest | null>(null);
  const [playheadTime, setPlayheadTime] = useState(0);

  const [customClipId, setCustomClipId] = useState<string | null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const [customDuration, setCustomDuration] = useState<number>(15);
  const [customTranscript, setCustomTranscript] = useState("");
  const [lastX402, setLastX402] = useState<{
    requestId: string;
    amountDisplay: string;
    operator: string;
  } | null>(null);

  const stepTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const seekNonce = useRef(0);

  const loadState = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error("state");
      const json = (await res.json()) as StatePayload;
      setData(json);
      setLoadFailed(false);
      if (json.jobs.length > 0) {
        setActiveJobId((prev) =>
          prev && json.jobs.some((j) => j.id === prev) ? prev : json.jobs[0].id
        );
      } else {
        setActiveJobId(null);
      }
      notifyNavSync();
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Answers sent from Ear in another tab show up when the agency comes back here
  useEffect(() => {
    let last = Date.now();
    const onFocus = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 4000) return;
      last = Date.now();
      loadState();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [loadState]);

  useEffect(
    () => () => {
      stepTimerRef.current.forEach(clearTimeout);
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    },
    []
  );

  const activeJob = useMemo(() => {
    if (!data || data.jobs.length === 0) return null;
    return data.jobs.find((j) => j.id === activeJobId) || data.jobs[0];
  }, [data, activeJobId]);

  const activeJobTasks = useMemo(() => {
    if (!data || !activeJob) return [];
    return data.tasks
      .filter((t) => t.jobId === activeJob.id)
      .sort((a, b) => a.focusStart - b.focusStart);
  }, [data, activeJob]);

  const costMetrics = useMemo(() => {
    if (!activeJob) return null;
    const humanSpent = activeJobTasks
      .filter((t) => t.status === "accepted")
      .reduce((acc, t) => acc + t.feeTusd8, 0);
    const humanReserved = activeJobTasks
      .filter((t) => t.status === "offered" || t.status === "submitted")
      .reduce((acc, t) => acc + t.feeTusd8, 0);

    return computeCostMetrics({
      durationSeconds: activeJob.durationSeconds,
      inferenceCostTusd8: activeJob.inferenceCostTusd8,
      humanSpentTusd8: humanSpent,
      humanReservedTusd8: humanReserved,
      excerptSpans: activeJobTasks.map((t) => ({ start: t.start, end: t.end })),
    });
  }, [activeJob, activeJobTasks]);

  const x402Receipt = useMemo(
    () =>
      data && activeJob
        ? data.receipts.find((r) => r.kind === "x402_inference" && r.jobId === activeJob.id)
        : undefined,
    [data, activeJob]
  );

  // The card whose seconds are playing right now gets a lift on the board
  const playingTaskId = useMemo(() => {
    if (playheadTime <= 0) return null;
    const hit = activeJobTasks.find(
      (t) => playheadTime >= t.focusStart - 0.1 && playheadTime <= t.focusEnd + 0.15
    );
    return hit ? hit.id : null;
  }, [activeJobTasks, playheadTime]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        clipId?: string;
        audioUrl?: string;
        fileName?: string;
        wavDurationSeconds?: number | null;
      };
      if (!res.ok || !json.clipId || !json.audioUrl) {
        setError(json.error || "Could not upload that file. Try a WAV or MP3 under 12 MB.");
        return;
      }

      setCustomClipId(json.clipId);
      setCustomAudioUrl(json.audioUrl);
      setCustomFileName(json.fileName || file.name);
      setSelectedClipId("custom-upload");

      if (json.wavDurationSeconds) {
        setCustomDuration(json.wavDurationSeconds);
      } else {
        const probe = document.createElement("audio");
        probe.src = json.audioUrl;
        probe.onloadedmetadata = () => {
          if (Number.isFinite(probe.duration) && probe.duration > 0) {
            setCustomDuration(Number(probe.duration.toFixed(1)));
          }
        };
      }
    } catch {
      setError("The upload did not reach the server. Check your connection and try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const runSikioAgent = async () => {
    setError(null);
    setNotice(null);
    setRunning(true);
    setPipelineStep(0);
    stepTimerRef.current.forEach(clearTimeout);
    stepTimerRef.current = [
      setTimeout(() => setPipelineStep(1), 180),
      setTimeout(() => setPipelineStep(2), 380),
      setTimeout(() => setPipelineStep(3), 580),
    ];
    let succeeded = false;

    try {
      const isCustom = selectedClipId === "custom-upload";
      if (isCustom && !customClipId) {
        setError("Upload an audio file first, or pick one of the sample clips.");
        return;
      }

      const probe402 = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId: isCustom ? customClipId : selectedClipId,
          confidenceThreshold: threshold,
        }),
      });

      let challengeReqId = `x402-${Date.now().toString(36)}`;
      let challengePayTo: `0x${string}` = SIKIO_TRANSCRIPTION_PROVIDER;
      if (probe402.status === 402) {
        const challengeData = (await probe402.json()) as {
          challenge: {
            requestId: string;
            amountDisplay: string;
            operator: string;
            payTo?: `0x${string}`;
          };
        };
        setLastX402(challengeData.challenge);
        challengeReqId = challengeData.challenge.requestId;
        if (challengeData.challenge.payTo) challengePayTo = challengeData.challenge.payTo;
      }

      let x402TxHash: `0x${string}` | undefined;
      let runMode: "aevum-live" | "sandbox" = "sandbox";

      if (liveEscrowMode && address && isAevum && data) {
        x402TxHash = await payInferenceOnChain({
          batchId: data.batch.batchId,
          requestId: challengeReqId,
          provider: challengePayTo,
          amountTusd8: 0.04,
        });
        runMode = "aevum-live";
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId: isCustom ? customClipId : selectedClipId,
          customTitle: isCustom ? customFileName || "Uploaded clip" : undefined,
          customAudioUrl: isCustom ? customAudioUrl : undefined,
          customDurationSeconds: isCustom ? customDuration : undefined,
          customTranscript: isCustom ? customTranscript : undefined,
          confidenceThreshold: threshold,
          feePerTaskTusd8: feePerTask,
          x402TxHash,
          x402RequestId: x402TxHash ? challengeReqId : undefined,
          mode: runMode,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "The agent's rules blocked this run.");
        return;
      }

      await loadState();
      if (json.job?.id) setActiveJobId(json.job.id);
      setBoardMsg(null);
      const n = (json.createdTasks?.length ?? 0) as number;
      succeeded = true;
      setNotice(
        n === 0
          ? "Bought the transcript for 0.04 tUSD8. The AI was sure of every word."
          : `Bought the transcript for 0.04 tUSD8. ${n} unsure ${
              n === 1 ? "word" : "words"
            }, ${(n * feePerTask).toFixed(2)} tUSD8 held for native speakers.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "The agent could not reach the server.");
    } finally {
      stepTimerRef.current.forEach(clearTimeout);
      setRunning(false);
      if (succeeded) {
        // Let the last check pop land before the steps fold away
        setPipelineStep(4);
        stepTimerRef.current = [setTimeout(() => setPipelineStep(-1), 1300)];
      } else {
        setPipelineStep(-1);
      }
    }
  };

  const handleUpdatePolicy = async (patch: {
    maxBudgetTusd8?: number;
    maxTaskFeeTusd8?: number;
    autoAcceptTrusted?: boolean;
    agentRevoked?: boolean;
  }) => {
    setPolicyBusy(true);
    setPolicyError(null);
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_policy", ...patch }),
      });
      const json = await res.json();
      if (!res.ok) setPolicyError(json.error || "Could not update the agent rules.");
      else await loadState();
    } catch {
      setPolicyError("Could not reach the server to update the agent rules.");
    } finally {
      setPolicyBusy(false);
    }
  };

  const handleResetDemo = async () => {
    setPolicyBusy(true);
    setNotice(null);
    setError(null);
    setBoardMsg(null);
    setPolicyError(null);
    try {
      await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      setLastX402(null);
      setPlayheadTime(0);
      await loadState();
    } finally {
      setPolicyBusy(false);
    }
  };

  // Approver actions, same rules as /approve (server verifies approver identity)
  const approverFallback = data?.batch.approverAddress;
  const handleTaskAction = useCallback(
    async (task: ReviewTask, action: "accept" | "reject" | "expire") => {
      setBoardMsg(null);
      setBusyTaskId(task.id);
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
            approverAddress: address || approverFallback,
            txHash,
            mode: runMode,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setBoardMsg({ tone: "error", text: json.error || "That action was not allowed." });
          return;
        }
        await loadState();
        if (action === "accept") {
          setCelebrateId(task.id);
          if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
          celebrateTimer.current = setTimeout(() => setCelebrateId(null), 1900);
        }
        setBoardMsg({
          tone: "ok",
          text:
            action === "accept"
              ? `Paid ${task.feeTusd8.toFixed(2)} tUSD8 once to ${task.editorName.split(" ")[0]}. "${
                  task.submittedText || task.aiGuess
                }" is now in the captions.`
              : `Returned ${task.feeTusd8.toFixed(2)} tUSD8 to the budget.`,
        });
      } catch (err) {
        setBoardMsg({ tone: "error", text: err instanceof Error ? err.message : "That action failed." });
      } finally {
        setBusyTaskId(null);
      }
    },
    [liveEscrowMode, address, isAevum, acceptTaskOnChain, approverFallback, loadState]
  );

  const seekToTask = useCallback((t: ReviewTask) => {
    seekNonce.current += 1;
    setSeekRequest({ time: Math.max(0, t.start), nonce: seekNonce.current });
    const el = playerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 64 || r.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, []);

  // A failed background refresh keeps the last good board; only a first load failure blocks the page
  if (!data && (loading || !loadFailed)) return <StudioSkeleton />;

  if (!data) {
    return (
      <StudioLoadError
        retrying={loading}
        onRetry={() => {
          setLoading(true);
          loadState();
        }}
      />
    );
  }

  const batch = data.batch;
  const selectedClip = data.showcaseClips.find((c) => c.id === selectedClipId);
  const unsureCount = activeJobTasks.length;

  const runPanel = (
    <RunPanel
      clips={data.showcaseClips}
      selectedClipId={selectedClipId}
      onSelectClip={setSelectedClipId}
      uploading={uploading}
      customFileName={customFileName}
      customDuration={customDuration}
      customTranscript={customTranscript}
      onCustomTranscript={setCustomTranscript}
      onUpload={handleFileUpload}
      threshold={threshold}
      onThreshold={setThreshold}
      fee={feePerTask}
      onFee={setFeePerTask}
      maxFee={batch.maxTaskFeeTusd8}
      running={running}
      pipelineStep={pipelineStep}
      agentStopped={batch.agentRevoked}
      policyBusy={policyBusy}
      onRun={runSikioAgent}
      onRestartAgent={() => handleUpdatePolicy({ agentRevoked: false })}
      error={error}
      notice={notice}
      onDismissError={() => setError(null)}
      onDismissNotice={() => setNotice(null)}
    />
  );

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Header */}
      <motion.header {...rise(0)} className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <span className="type-label">Studio · batch {batch.batchId}</span>
            <h1 className="type-page text-[var(--ink)] break-words">
              {activeJob ? activeJob.title : "Captions for African voices"}
            </h1>
            <p className="font-mono text-[13px] text-[var(--mute)] tabular-nums">
              {activeJob ? (
                <>
                  {activeJob.durationSeconds.toFixed(1)}s · {activeJob.languageTag} ·{" "}
                  <span className="text-[var(--ink)] font-bold">
                    {unsureCount} unsure {unsureCount === 1 ? "word" : "words"}
                  </span>
                </>
              ) : (
                "No clip yet"
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {activeJob && (
              <>
                <a
                  href={`/api/jobs/${activeJob.id}/export?format=srt`}
                  className={buttonClass("secondary", "sm")}
                >
                  <Download className="w-4 h-4" /> .srt
                </a>
                <a
                  href={`/api/jobs/${activeJob.id}/export?format=vtt`}
                  className={buttonClass("secondary", "sm")}
                >
                  <Download className="w-4 h-4" /> .vtt
                </a>
              </>
            )}
            <button
              type="button"
              disabled={policyBusy}
              onClick={handleResetDemo}
              className={buttonClass("ghost", "sm")}
            >
              <RotateCcw className={`w-4 h-4 ${policyBusy ? "animate-spin [animation-direction:reverse]" : ""}`} />
              Reset demo
            </button>
          </div>
        </div>

        {data.jobs.length > 1 && (
          <nav aria-label="Clips in this batch" className="flex flex-wrap gap-2">
            {data.jobs.map((j) => {
              const on = activeJob?.id === j.id;
              return (
                <button
                  key={j.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setActiveJobId(j.id);
                    setPlayheadTime(0);
                    setBoardMsg(null);
                  }}
                  className={`relative min-h-[44px] sm:min-h-[38px] px-4 rounded-full text-[13px] font-bold cursor-pointer whitespace-nowrap border-2 ${
                    on
                      ? "border-[var(--outline)] text-[var(--bg)]"
                      : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--outline)]"
                  }`}
                >
                  {on && (
                    <motion.span
                      layoutId="studio-job-pill"
                      transition={SPRING.snappy}
                      className="absolute -inset-[2px] rounded-full bg-[var(--ink)]"
                    />
                  )}
                  <span className="relative">{j.title}</span>
                </button>
              );
            })}
          </nav>
        )}
      </motion.header>

      {/* Hero: listen + run */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
        <motion.div
          {...rise(1)}
          ref={playerRef}
          className="lg:col-span-8 min-w-0 scroll-mt-24"
        >
          {activeJob ? (
            <WaveformPlayer
              job={activeJob}
              tasks={activeJobTasks}
              seekRequest={seekRequest}
              onTimeChange={setPlayheadTime}
            />
          ) : (
            <StudioEmpty
              clipLabel={selectedClip?.city || "your clip"}
              onRun={runSikioAgent}
              disabled={uploading || batch.agentRevoked}
              running={running}
            />
          )}
        </motion.div>
        <motion.div {...rise(2)} className="lg:col-span-4 min-w-0">
          {runPanel}
        </motion.div>
      </div>

      {/* Lifecycle lanes */}
      {activeJob && (
        <Reveal as="section" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="type-section">From unsure to paid</h2>
            <span className="type-label">Tap a word to hear it</span>
          </div>
          <AnimatePresence initial={false}>
            {boardMsg && (
              <Banner key="board" tone={boardMsg.tone} onClose={() => setBoardMsg(null)}>
                {boardMsg.text}
              </Banner>
            )}
          </AnimatePresence>
          <LifecycleLanes
            jobId={activeJob.id}
            tasks={activeJobTasks}
            busyTaskId={busyTaskId}
            celebrateId={celebrateId}
            playingTaskId={playingTaskId}
            onSeek={seekToTask}
            onAction={handleTaskAction}
          />
        </Reveal>
      )}

      {/* Money */}
      <Reveal>
        <MoneyRow batch={batch} available={data.availableBudgetTusd8} metrics={costMetrics} />
      </Reveal>

      {/* Behind the scenes */}
      <Reveal className="space-y-4">
        <AnimatePresence initial={false}>
          {policyError && (
            <Banner key="policy" tone="error" onClose={() => setPolicyError(null)}>
              {policyError}
            </Banner>
          )}
        </AnimatePresence>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
          <BudgetRail
            batch={batch}
            availableBudgetTusd8={data.availableBudgetTusd8}
            busy={policyBusy}
            onUpdatePolicy={handleUpdatePolicy}
          />
          {activeJob && costMetrics && (
            <CostBreakdown
              job={activeJob}
              metrics={costMetrics}
              lastX402={lastX402}
              x402Receipt={x402Receipt}
            />
          )}
        </div>
      </Reveal>
    </div>
  );
}
