"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Download,
  Upload,
  ArrowRight,
  Play,
  RefreshCw,
  Check,
  ExternalLink,
  Headphones,
} from "lucide-react";
import {
  BatchBudget,
  CaptionJob,
  CaptionWord,
  PaymentReceipt,
  ReviewTask,
} from "@/lib/types";
import { computeCostMetrics } from "@/lib/captions";
import { SIKIO_TRANSCRIPTION_PROVIDER } from "@/lib/x402";
import { explorerTxUrl, shortAddr, shortHash } from "@/lib/aevum";
import { WaveformPlayer } from "@/components/WaveformPlayer";
import { CaptionTimeline } from "@/components/CaptionTimeline";
import { BudgetRail } from "@/components/BudgetRail";
import { useWallet } from "@/components/WalletContext";
import { Button, buttonClass, ModeTag } from "@/components/ui";

interface ShowcaseClipOption {
  id: string;
  title: string;
  shortLabel?: string;
  sourceLabel: string;
  languageTag: string;
  city: string;
  audioUrl: string;
  recommendedEditorCity: string;
}

interface StatePayload {
  batch: BatchBudget;
  jobs: CaptionJob[];
  tasks: ReviewTask[];
  receipts: PaymentReceipt[];
  availableBudgetTusd8: number;
  showcaseClips: ShowcaseClipOption[];
}

const PIPELINE_STEPS = [
  "Asking for the transcript",
  "Paying 0.04 tUSD8 over x402",
  "Finding words the AI is unsure of",
  "Holding fees for native speakers",
];

type ColumnKey = "offered" | "submitted" | "accepted" | "returned";

const COLUMNS: {
  key: ColumnKey;
  title: string;
  tone: string;
  empty: string;
  explain: string;
}[] = [
  {
    key: "offered",
    title: "Needs an ear",
    tone: "text-[var(--signal)]",
    empty: "No unsure words. The AI was confident on every word above the floor.",
    explain: "Words the AI is unsure of wait here for a native speaker in Ear.",
  },
  {
    key: "submitted",
    title: "Heard",
    tone: "text-[var(--heard)]",
    empty: "When a native speaker answers in Ear, their fix waits here for the approver.",
    explain: "The native speaker's answer waits here for the agency's approver.",
  },
  {
    key: "accepted",
    title: "Paid once",
    tone: "text-[var(--green)]",
    empty: "Approved fixes are paid exactly once and merged into the captions.",
    explain: "Approved fixes are paid exactly once and merged into the captions.",
  },
  {
    key: "returned",
    title: "Returned",
    tone: "text-[var(--mute)]",
    empty: "Rejected or expired fees go back to the budget.",
    explain: "Rejected or expired fees go back to the budget.",
  },
];

function columnOf(t: ReviewTask): ColumnKey {
  if (t.status === "offered") return "offered";
  if (t.status === "submitted") return "submitted";
  if (t.status === "accepted") return "accepted";
  return "returned";
}

function notifyNavSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sikio:state-updated"));
  }
}

export default function StudioPage() {
  const {
    address,
    isAevum,
    liveEscrowMode,
    payInferenceOnChain,
    acceptTaskOnChain,
  } = useWallet();
  const [data, setData] = useState<StatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<number>(-1);
  const [uploading, setUploading] = useState(false);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [boardMsg, setBoardMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const [selectedClipId, setSelectedClipId] = useState("lagos-fintech-ep14");
  const [threshold, setThreshold] = useState(0.78);
  const [feePerTask, setFeePerTask] = useState(0.1);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [seekToTime, setSeekToTime] = useState<number | null>(null);
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
  const playerRef = useRef<HTMLDivElement | null>(null);

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
      if (probe402.status === 402) {
        const challengeData = (await probe402.json()) as {
          challenge: { requestId: string; amountDisplay: string; operator: string };
        };
        setLastX402(challengeData.challenge);
        challengeReqId = challengeData.challenge.requestId;
      }

      let x402TxHash: `0x${string}` | undefined;
      let runMode: "aevum-live" | "sandbox" = "sandbox";

      if (liveEscrowMode && address && isAevum && data) {
        x402TxHash = await payInferenceOnChain({
          batchId: data.batch.batchId,
          requestId: challengeReqId,
          provider: SIKIO_TRANSCRIPTION_PROVIDER,
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
      const n = json.createdTasks.length as number;
      setNotice(
        `Paid 0.04 tUSD8 for the transcript. Found ${n} unsure ${
          n === 1 ? "word" : "words"
        } and is holding ${(n * feePerTask).toFixed(2)} tUSD8 for native speakers.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The agent could not reach the server."
      );
    } finally {
      stepTimerRef.current.forEach(clearTimeout);
      setRunning(false);
      setPipelineStep(-1);
    }
  };

  const handleUpdatePolicy = async (patch: {
    maxBudgetTusd8?: number;
    maxTaskFeeTusd8?: number;
    autoAcceptTrusted?: boolean;
    agentRevoked?: boolean;
  }) => {
    setPolicyBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_policy", ...patch }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error || "Could not update the agent rules.");
      else await loadState();
    } finally {
      setPolicyBusy(false);
    }
  };

  const handleResetDemo = async () => {
    setPolicyBusy(true);
    setNotice(null);
    setError(null);
    try {
      await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      setLastX402(null);
      await loadState();
    } finally {
      setPolicyBusy(false);
    }
  };

  // Approver actions, same rules as /approve (server verifies approver identity)
  const handleTaskAction = async (
    task: ReviewTask,
    action: "accept" | "reject" | "expire"
  ) => {
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
          approverAddress: address || data?.batch.approverAddress,
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
      setBoardMsg({
        tone: "ok",
        text:
        action === "accept"
          ? `Paid ${task.feeTusd8.toFixed(2)} tUSD8 once to ${task.editorName}. "${
              task.submittedText || task.aiGuess
            }" is now in the captions.`
          : `Returned ${task.feeTusd8.toFixed(2)} tUSD8 to the budget.`,
      });
    } catch (err) {
      setBoardMsg({ tone: "error", text: err instanceof Error ? err.message : "That action failed." });
    } finally {
      setBusyTaskId(null);
    }
  };

  const seekTo = (sec: number) => {
    setSeekToTime(Math.max(0, sec));
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleWordClick = (w: CaptionWord) => seekTo(w.start - 0.15);

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading the studio">
        <div className="h-10 w-2/3 max-w-xl rounded-[var(--r)] bg-[var(--panel)] animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-[var(--r)] bg-[var(--panel)] animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-[var(--r)] bg-[var(--panel)] animate-pulse" />
      </div>
    );
  }

  if (loadFailed || !data) {
    return (
      <div className="max-w-lg rounded-[var(--r)] hairline bg-[var(--paper)] p-6 space-y-3">
        <h1 className="type-section">The studio could not load</h1>
        <p className="text-[15px] text-[var(--ink-2)]">
          The Sikio server did not answer. Check that it is running, then try again.
        </p>
        <Button variant="primary" onClick={() => { setLoading(true); loadState(); }}>
          <RefreshCw className="w-4 h-4" /> Try again
        </Button>
      </div>
    );
  }

  const batch = data.batch;
  const spentPct = Math.min(100, (batch.spentTusd8 / Math.max(batch.maxBudgetTusd8, 0.01)) * 100);
  const reservedPct = Math.min(
    100 - spentPct,
    (batch.reservedTusd8 / Math.max(batch.maxBudgetTusd8, 0.01)) * 100
  );

  const grouped: Record<ColumnKey, ReviewTask[]> = {
    offered: [],
    submitted: [],
    accepted: [],
    returned: [],
  };
  for (const t of activeJobTasks) grouped[columnOf(t)].push(t);

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Page head */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 sikio-rise">
        <div className="space-y-1.5 max-w-2xl">
          <h1 className="type-page text-[var(--ink)]">Captions for African voices</h1>
          <p className="text-[16px] text-[var(--ink-2)]">
            When the AI is unsure of a word, Sikio asks a native speaker to hear just
            those seconds, then pays them once.
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
          <Button variant="ghost" size="sm" disabled={policyBusy} onClick={handleResetDemo}>
            <RefreshCw className="w-4 h-4" /> Reset demo
          </Button>
        </div>
      </section>

      {/* Money strip */}
      <section
        aria-label="Budget"
        className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-[var(--r)] hairline bg-[var(--line)] overflow-hidden [&>*]:min-w-0 [&>*]:bg-[var(--paper)] sikio-rise"
        style={{ ["--i" as string]: 1 }}
      >
        <div className="p-4 sm:p-5 space-y-2">
          <div className="text-[13px] text-[var(--mute)]">Budget left</div>
          <div className="text-2xl sm:text-[28px] font-extrabold tabular-nums tracking-[-0.02em]">
            {data.availableBudgetTusd8.toFixed(2)}
            <span className="ml-1.5 text-[13px] font-medium text-[var(--mute)] tracking-normal">
              of {batch.maxBudgetTusd8.toFixed(2)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--panel)] overflow-hidden flex" aria-hidden="true">
            <div style={{ width: `${spentPct}%` }} className="h-full bg-[var(--green)] sikio-bar-fill" />
            <div style={{ width: `${reservedPct}%` }} className="h-full bg-[var(--signal)] sikio-bar-fill" />
          </div>
        </div>
        <div className="p-4 sm:p-5 space-y-1">
          <div className="text-[13px] text-[var(--mute)]">Paid once</div>
          <div className="text-2xl sm:text-[28px] font-extrabold tabular-nums tracking-[-0.02em] text-[var(--green-ink)]">
            {batch.spentTusd8.toFixed(2)}
          </div>
          <div className="text-[13px] text-[var(--mute)]">tUSD8, AI and humans</div>
        </div>
        <div className="p-4 sm:p-5 space-y-1">
          <div className="text-[13px] text-[var(--mute)]">Held for review</div>
          <div className="text-2xl sm:text-[28px] font-extrabold tabular-nums tracking-[-0.02em] text-[var(--signal-ink)]">
            {batch.reservedTusd8.toFixed(2)}
          </div>
          <div className="text-[13px] text-[var(--mute)]">tUSD8 in escrow</div>
        </div>
        <div className="p-4 sm:p-5 space-y-1">
          <div className="text-[13px] text-[var(--mute)]">Cost per minute</div>
          {costMetrics ? (
            <>
              <div
                className={`text-2xl sm:text-[28px] font-extrabold tabular-nums tracking-[-0.02em] ${
                  costMetrics.isCheaperThanFull ? "text-[var(--ink)]" : "text-[var(--amber)]"
                }`}
              >
                ${costMetrics.costPerMinuteProjected.toFixed(2)}
              </div>
              <div className="text-[13px] text-[var(--mute)]">
                vs ${costMetrics.fullHumanReviewCostPerMin.toFixed(2)} for a full human pass
              </div>
            </>
          ) : (
            <div className="text-[15px] text-[var(--mute)] pt-1">Run a clip to see it</div>
          )}
        </div>
      </section>

      {/* Run the agent */}
      <section
        aria-labelledby="run-heading"
        className="rounded-[var(--r)] hairline bg-[var(--paper)] overflow-hidden sikio-rise"
        style={{ ["--i" as string]: 2 }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[var(--line)]">
          <div className="lg:col-span-5 p-4 sm:p-5 space-y-2.5 min-w-0">
            <h2 id="run-heading" className="text-sm font-bold text-[var(--ink)]">
              Run the agent on a clip
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {data.showcaseClips.map((c) => {
                const active = selectedClipId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedClipId(c.id)}
                    className={`min-h-[44px] sm:min-h-[38px] px-3 rounded-full text-[13px] font-semibold hairline transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? "bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]"
                        : "bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--hover)]"
                    }`}
                  >
                    {c.shortLabel || `${c.city} · ${c.languageTag}`}
                  </button>
                );
              })}
              <label
                className={`min-h-[44px] sm:min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-full text-[13px] font-semibold hairline border-dashed cursor-pointer transition-colors whitespace-nowrap focus-within:outline focus-within:outline-2 focus-within:outline-[var(--heard)] ${
                  selectedClipId === "custom-upload"
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "bg-[var(--paper)] text-[var(--ink-2)] hover:text-[var(--ink)]"
                }`}
              >
                <Upload className="w-4 h-4" />
                {uploading
                  ? "Uploading"
                  : customFileName
                  ? customFileName.length > 16
                    ? `${customFileName.slice(0, 14)}…`
                    : customFileName
                  : "Your own audio"}
                <input
                  type="file"
                  accept="audio/*,video/*"
                  disabled={uploading}
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          <div className="lg:col-span-3 p-4 sm:p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="conf-slider" className="text-[13px] text-[var(--ink-2)]">
                Ask a human when the AI is below
              </label>
              <span className="font-mono text-[15px] tabular-nums text-[var(--ink)]">
                {Math.round(threshold * 100)}%
              </span>
            </div>
            <input
              id="conf-slider"
              type="range"
              min={0.5}
              max={0.9}
              step={0.02}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="lg:col-span-2 p-4 sm:p-5 space-y-1.5">
            <label htmlFor="fee-input" className="block text-[13px] text-[var(--ink-2)]">
              Pay per word, tUSD8
            </label>
            <input
              id="fee-input"
              type="number"
              inputMode="decimal"
              min={0.05}
              max={batch.maxTaskFeeTusd8}
              step={0.05}
              value={feePerTask}
              onChange={(e) => setFeePerTask(Number(e.target.value))}
              className="w-full min-h-[44px] sm:min-h-[40px] px-3 rounded-[var(--r-sm)] font-mono text-[15px] tabular-nums hairline bg-[var(--bg)] text-[var(--ink)]"
            />
          </div>

          <div className="lg:col-span-2 p-4 sm:p-5 flex items-end">
            <Button
              variant="primary"
              disabled={running || uploading || batch.agentRevoked}
              onClick={runSikioAgent}
              className="w-full"
            >
              <Play className="w-4 h-4 fill-current" />
              {running ? "Running" : "Run agent"}
            </Button>
          </div>
        </div>

        {batch.agentRevoked && (
          <div className="px-4 sm:px-5 py-3 hairline-t text-[14px] text-[var(--red)] bg-[var(--red-bg)]">
            The agent is stopped. Restart it in the agent rules below to run a clip.
          </div>
        )}

        {running && pipelineStep >= 0 && (
          <ol
            aria-live="polite"
            className="px-4 sm:px-5 py-3 hairline-t bg-[var(--bg)] grid grid-cols-1 sm:grid-cols-4 gap-2 text-[13px]"
          >
            {PIPELINE_STEPS.map((label, i) => {
              const done = i < pipelineStep;
              const active = i === pipelineStep;
              return (
                <li key={label} className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-full shrink-0 inline-flex items-center justify-center font-mono text-[11px] ${
                      done
                        ? "bg-[var(--green)] text-white sikio-check-pop"
                        : active
                        ? "bg-[var(--ink)] text-[var(--paper)] sikio-led"
                        : "bg-[var(--panel)] text-[var(--mute)]"
                    }`}
                  >
                    {done ? <Check className="w-3 h-3" /> : i + 1}
                  </span>
                  <span className={done || active ? "text-[var(--ink)] font-medium" : "text-[var(--mute)]"}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {selectedClipId === "custom-upload" && (
          <div className="px-4 sm:px-5 py-4 hairline-t bg-[var(--bg)] space-y-1.5">
            <label htmlFor="custom-script" className="block text-[13px] text-[var(--ink-2)]">
              Rough transcript, optional ({customDuration}s of audio)
            </label>
            <input
              id="custom-script"
              type="text"
              value={customTranscript}
              onChange={(e) => setCustomTranscript(e.target.value)}
              placeholder="Paste a rough transcript, or leave empty for the Sikio local ASR engine"
              className="w-full min-h-[44px] px-3 rounded-[var(--r-sm)] text-[15px] hairline bg-[var(--paper)] text-[var(--ink)]"
            />
          </div>
        )}

        {error && (
          <div role="alert" className="px-4 sm:px-5 py-3 hairline-t bg-[var(--red-bg)] text-[14px] font-medium text-[var(--red)]">
            {error}
          </div>
        )}

        {notice && (
          <div
            aria-live="polite"
            className="px-4 sm:px-5 py-2.5 hairline-t bg-[var(--green-bg)] text-[14px] font-medium text-[var(--green-ink)] flex flex-wrap items-center justify-between gap-2"
          >
            <span className="min-w-0">{notice}</span>
            <Link href="/ear" className="min-h-[40px] inline-flex items-center gap-1 font-semibold underline underline-offset-2">
              Open Ear <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </section>

      {/* Job switcher */}
      {data.jobs.length > 1 && (
        <nav aria-label="Clips in this batch" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {data.jobs.map((j) => (
            <button
              key={j.id}
              type="button"
              aria-pressed={activeJob?.id === j.id}
              onClick={() => setActiveJobId(j.id)}
              className={`min-h-[44px] sm:min-h-[36px] px-3.5 rounded-full text-[13px] font-semibold hairline transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeJob?.id === j.id
                  ? "bg-[var(--ink)] text-[var(--paper)]"
                  : "bg-[var(--paper)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
              }`}
            >
              {j.title}
            </button>
          ))}
        </nav>
      )}

      {activeJob ? (
        <>
          {/* Hear and read */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
            <div ref={playerRef} className="lg:col-span-7 min-w-0 scroll-mt-24">
              <WaveformPlayer
                job={activeJob}
                tasks={activeJobTasks}
                seekToTime={seekToTime}
                onTimeChange={setPlayheadTime}
              />
            </div>
            <div className="lg:col-span-5 min-w-0">
              <CaptionTimeline
                words={activeJob.words}
                tasks={activeJobTasks}
                currentTime={playheadTime}
                onWordClick={handleWordClick}
              />
            </div>
          </section>

          {/* Lifecycle board */}
          <section aria-labelledby="board-heading" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="board-heading" className="type-section text-[var(--ink)]">
                Every unsure word, from flag to payment
              </h2>
              <span className="text-[13px] text-[var(--mute)]">
                Tap a card to hear it in the clip
              </span>
            </div>
            {boardMsg && (
              <div
                role={boardMsg.tone === "error" ? "alert" : "status"}
                className={`rounded-[var(--r-sm)] px-4 py-2.5 text-[14px] font-medium sikio-verdict ${
                  boardMsg.tone === "error"
                    ? "bg-[var(--red-bg)] text-[var(--red)]"
                    : "bg-[var(--green-bg)] text-[var(--green-ink)]"
                }`}
              >
                {boardMsg.text}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
              {COLUMNS.map((col) => {
                const items = grouped[col.key];
                return (
                  <div key={col.key} className="space-y-2.5 min-w-0">
                    <div className={`flex items-center justify-between pb-1.5 col-rule ${col.tone}`}>
                      <h3 className="text-[13px] font-bold uppercase tracking-[0.05em]">
                        {col.title}
                      </h3>
                      <span className="font-mono text-[13px] tabular-nums">{items.length}</span>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-[13px] leading-snug text-[var(--mute)] rounded-[var(--r-sm)] border border-dashed border-[var(--line)] px-3 py-3">
                        {col.empty}
                      </p>
                    ) : (
                      items.map((t) => (
                        <TaskCard
                          key={`${t.id}-${t.status}`}
                          task={t}
                          busy={busyTaskId === t.id}
                          onSeek={() => seekTo(t.start)}
                          onAction={(a) => handleTaskAction(t, a)}
                        />
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Rules and the money behind this clip */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
            <BudgetRail
              batch={batch}
              availableBudgetTusd8={data.availableBudgetTusd8}
              busy={policyBusy}
              onUpdatePolicy={handleUpdatePolicy}
            />

            {costMetrics && (
              <div className="rounded-[var(--r)] hairline bg-[var(--paper)] overflow-hidden">
                <div className="px-4 sm:px-5 py-3 hairline-b flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-[var(--ink)]">What this clip cost</h2>
                  <span className="text-[13px] text-[var(--mute)] tabular-nums">
                    {costMetrics.reviewTimeSavedPct > 0
                      ? `Humans skipped ${costMetrics.reviewTimeSavedPct}% of the audio`
                      : "Humans heard all of the audio"}
                  </span>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="space-y-2 text-[13px] tabular-nums">
                    <div className="flex items-center gap-3">
                      <span className="w-20 text-[var(--mute)]">Full pass</span>
                      <div className="flex-1 h-2 rounded-full bg-[var(--panel)] overflow-hidden">
                        <div className="h-full w-full bg-[var(--mute)] opacity-40" />
                      </div>
                      <span className="w-14 text-right text-[var(--mute)] font-mono">
                        ${costMetrics.fullHumanReviewCostPerMin.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-20 font-semibold text-[var(--ink)]">Sikio</span>
                      <div className="flex-1 h-2 rounded-full bg-[var(--panel)] overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                6,
                                (costMetrics.costPerMinuteProjected /
                                  costMetrics.fullHumanReviewCostPerMin) *
                                  100
                              )
                            )}%`,
                          }}
                          className={`h-full sikio-bar-fill ${
                            costMetrics.isCheaperThanFull ? "bg-[var(--green)]" : "bg-[var(--amber)]"
                          }`}
                        />
                      </div>
                      <span
                        className={`w-14 text-right font-mono font-semibold ${
                          costMetrics.isCheaperThanFull ? "text-[var(--green-ink)]" : "text-[var(--amber)]"
                        }`}
                      >
                        ${costMetrics.costPerMinuteProjected.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {!costMetrics.isCheaperThanFull && (
                    <p className="text-[13px] text-[var(--amber)]">
                      At this fee per word, Sikio costs more than a full human pass on this
                      clip. Lower the fee for short clips.
                    </p>
                  )}

                  <dl className="text-[14px] tabular-nums">
                    <div className="flex justify-between gap-3 py-2 hairline-t">
                      <dt className="text-[var(--mute)] min-w-0">
                        AI transcript, {activeJob.transcriptionEngine}
                      </dt>
                      <dd className="font-mono shrink-0">{activeJob.inferenceCostTusd8.toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2 hairline-t">
                      <dt className="text-[var(--mute)]">Native speakers, paid</dt>
                      <dd className="font-mono text-[var(--green-ink)]">
                        {(costMetrics.totalSettled - activeJob.inferenceCostTusd8).toFixed(2)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2 hairline-t">
                      <dt className="text-[var(--mute)]">Native speakers, held</dt>
                      <dd className="font-mono text-[var(--signal-ink)]">
                        {(costMetrics.totalProjected - costMetrics.totalSettled).toFixed(2)}
                      </dd>
                    </div>
                  </dl>

                  {lastX402 && (
                    <div className="rounded-[var(--r-sm)] bg-[var(--bg)] px-3 py-2.5 text-[13px] space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[var(--ink)]">x402 payment</span>
                        <span className="font-mono text-[var(--green-ink)]">402 then 200</span>
                      </div>
                      <div className="font-mono text-[12px] text-[var(--mute)] truncate">
                        {lastX402.amountDisplay} · {lastX402.requestId}
                      </div>
                    </div>
                  )}

                  <Link href="/receipts" className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-[var(--ink)] underline underline-offset-4">
                    All receipts <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="rounded-[var(--r)] hairline bg-[var(--paper)] p-5 sm:p-7 space-y-5">
          <div className="space-y-1.5 max-w-xl">
            <h2 className="type-section">No clip in this batch yet</h2>
            <p className="text-[15px] text-[var(--ink-2)]">
              Pick a sample clip above and run the agent. Each unsure word then moves
              across these four steps.
            </p>
          </div>
          <ol className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {COLUMNS.map((col, i) => (
              <li key={col.key} className="space-y-2">
                <div className={`flex items-center justify-between pb-1.5 col-rule ${col.tone}`}>
                  <span className="text-[13px] font-bold uppercase tracking-[0.05em]">{col.title}</span>
                  <span className="font-mono text-[13px]">{i + 1}</span>
                </div>
                <p className="text-[13px] text-[var(--mute)]">{col.explain}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function TaskCard({
  task: t,
  busy,
  onSeek,
  onAction,
}: {
  task: ReviewTask;
  busy: boolean;
  onSeek: () => void;
  onAction: (a: "accept" | "reject" | "expire") => void;
}) {
  const changed = t.submittedText && t.submittedText !== t.aiGuess;
  const live = t.settleMode === "aevum-live";

  return (
    <article className="rounded-[var(--r-sm)] hairline bg-[var(--paper)] sikio-card-in overflow-hidden">
      <button
        type="button"
        onClick={onSeek}
        className="w-full text-left px-3.5 pt-3 pb-2.5 space-y-1 hover:bg-[var(--hover)] transition-colors cursor-pointer"
        aria-label={`Hear "${t.aiGuess}" at ${t.focusStart.toFixed(1)} seconds`}
      >
        <div className="text-[16px] font-bold leading-snug text-[var(--ink)] break-words">
          {t.status === "offered" ? (
            t.aiGuess
          ) : changed ? (
            <>
              <s className="font-medium text-[var(--mute)]">{t.aiGuess}</s>{" "}
              {t.submittedText}
            </>
          ) : (
            <>
              {t.submittedText || t.aiGuess}
              {t.confirmedAiRight && (
                <span className="ml-1.5 text-[12px] font-semibold text-[var(--mute)]">AI was right</span>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--mute)] tabular-nums">
          <span className="inline-flex items-center gap-1 font-mono">
            <Headphones className="w-3 h-3" aria-hidden="true" />
            {t.focusStart.toFixed(1)}s
          </span>
          <span>AI {Math.round(t.minConfidence * 100)}% sure</span>
          <span>
            {t.editorName.split(" ")[0]} · {t.editorCity}
          </span>
        </div>
      </button>

      <div className="px-3.5 py-2 hairline-t flex flex-wrap items-center justify-between gap-2 text-[12px] tabular-nums">
        {t.status === "offered" && (
          <>
            <span className="font-mono text-[var(--signal-ink)]">{t.feeTusd8.toFixed(2)} held</span>
            <span className="flex items-center gap-1">
              <Link href="/ear" className={buttonClass("ghost", "sm", "!px-2.5")}>
                Ear
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="!px-2.5"
                disabled={busy}
                onClick={() => onAction("expire")}
              >
                Return fee
              </Button>
            </span>
          </>
        )}
        {t.status === "submitted" && (
          <div className="w-full grid grid-cols-[1fr_auto] gap-2 py-0.5">
            <Button variant="pay" size="sm" disabled={busy} onClick={() => onAction("accept")}>
              {busy ? "Paying" : `Approve and pay ${t.feeTusd8.toFixed(2)}`}
            </Button>
            <Button variant="danger" size="sm" disabled={busy} onClick={() => onAction("reject")}>
              Reject
            </Button>
          </div>
        )}
        {t.status === "accepted" && (
          <>
            <span className="font-mono text-[var(--green-ink)]">
              {t.feeTusd8.toFixed(2)} paid{t.approvedBy ? ` · ${shortAddr(t.approvedBy)}` : ""}
            </span>
            {t.settleTxHash && live ? (
              <a
                href={explorerTxUrl(t.settleTxHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[var(--green-ink)] hover:underline"
              >
                {shortHash(t.settleTxHash)} <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <ModeTag live={false} />
            )}
          </>
        )}
        {(t.status === "rejected" || t.status === "expired") && (
          <span className="text-[var(--mute)]">
            {t.feeTusd8.toFixed(2)} back in the budget
            {t.status === "expired" ? " after expiry" : ""}
          </span>
        )}
      </div>
    </article>
  );
}
