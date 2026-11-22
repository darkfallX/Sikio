"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  Upload,
  ArrowRight,
  PlayCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  BatchBudget,
  CaptionJob,
  CaptionWord,
  PaymentReceipt,
  ReviewTask,
} from "@/lib/types";
import { computeCostMetrics } from "@/lib/captions";
import { WaveformPlayer } from "@/components/WaveformPlayer";
import { CaptionTimeline } from "@/components/CaptionTimeline";
import { BudgetRail } from "@/components/BudgetRail";
import { useWallet } from "@/components/WalletContext";

interface ShowcaseClipOption {
  id: string;
  title: string;
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

export default function StudioPage() {
  const { address, isAevum } = useWallet();
  const [data, setData] = useState<StatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedClipId, setSelectedClipId] = useState("lagos-fintech-ep14");
  const [threshold, setThreshold] = useState(0.78);
  const [feePerTask, setFeePerTask] = useState(0.25);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [seekToTime, setSeekToTime] = useState<number | null>(null);
  const [playheadTime, setPlayheadTime] = useState(0);

  // Custom upload state
  const [customFileUrl, setCustomFileUrl] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const [customDuration, setCustomDuration] = useState<number>(16);
  const [customTranscript, setCustomTranscript] = useState("");
  const [lastX402, setLastX402] = useState<{
    requestId: string;
    amountDisplay: string;
    operator: string;
  } | null>(null);

  const loadState = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const json = (await res.json()) as StatePayload;
      setData(json);
      if (json.jobs.length > 0) {
        setActiveJobId((prev) =>
          prev && json.jobs.some((j) => j.id === prev) ? prev : json.jobs[0].id
        );
      } else {
        setActiveJobId(null);
      }
    } catch {
      setError("Could not reach Sikio backend state.");
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
    return data.tasks.filter((t) => t.jobId === activeJob.id);
  }, [data, activeJob]);

  const costMetrics = useMemo(() => {
    if (!activeJob) return null;
    const humanSpent = activeJobTasks
      .filter((t) => t.status === "accepted")
      .reduce((acc, t) => acc + t.feeTusd8, 0);
    const humanReserved = activeJobTasks
      .filter((t) => t.status === "offered" || t.status === "submitted")
      .reduce((acc, t) => acc + t.feeTusd8, 0);
    const flaggedSeconds = activeJobTasks.reduce(
      (acc, t) => acc + Math.max(0, t.end - t.start),
      0
    );
    return computeCostMetrics({
      durationSeconds: activeJob.durationSeconds,
      inferenceCostTusd8: activeJob.inferenceCostTusd8,
      humanSpentTusd8: humanSpent,
      humanReservedTusd8: humanReserved,
      flaggedSeconds,
    });
  }, [activeJob, activeJobTasks]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setCustomFileUrl(objectUrl);
    setCustomFileName(file.name);
    setSelectedClipId("custom-upload");

    // Measure actual duration via temporary HTMLMediaElement
    const probe = document.createElement("audio");
    probe.src = objectUrl;
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        setCustomDuration(Number(probe.duration.toFixed(1)));
      }
    };
  };

  const runSikioAgent = async () => {
    setError(null);
    setNotice(null);
    setRunning(true);
    try {
      const isCustom = selectedClipId === "custom-upload";
      // First demonstrate real HTTP 402 Payment Required handshake against /api/transcribe
      const probe402 = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId: isCustom ? undefined : selectedClipId,
          confidenceThreshold: threshold,
        }),
      });

      if (probe402.status === 402) {
        const challengeData = (await probe402.json()) as {
          challenge: { requestId: string; amountDisplay: string; operator: string };
        };
        setLastX402(challengeData.challenge);
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId: isCustom ? undefined : selectedClipId,
          customTitle: isCustom ? customFileName || "Uploaded Agency Clip" : undefined,
          customAudioUrl: isCustom ? customFileUrl : undefined,
          customDurationSeconds: isCustom ? customDuration : undefined,
          customTranscript: isCustom ? customTranscript : undefined,
          confidenceThreshold: threshold,
          feePerTaskTusd8: feePerTask,
          mode: address && isAevum ? "aevum-live" : "sandbox",
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Agent run rejected by budget policy.");
        return;
      }

      await loadState();
      if (json.job?.id) {
        setActiveJobId(json.job.id);
      }
      setNotice(
        `x402 paid 0.04 tUSD8 · Flagged ${json.createdTasks.length} uncertain passage${
          json.createdTasks.length === 1 ? "" : "s"
        } and locked ${(json.createdTasks.length * feePerTask).toFixed(2)} tUSD8 in ReviewEscrow.`
      );
    } catch {
      setError("Network error while running Sikio Agent.");
    } finally {
      setRunning(false);
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
      if (!res.ok) {
        setError(json.error || "Could not update policy.");
      } else {
        await loadState();
      }
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

  const handleWordClick = (w: CaptionWord) => {
    setSeekToTime(Math.max(0, w.start - 0.15));
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 rounded-[6px] bg-[#EFECE4] animate-pulse" />
        <div className="h-64 w-full rounded-[8px] bg-[#EFECE4] animate-pulse" />
      </div>
    );
  }

  const pendingSubmitCount = data.tasks.filter((t) => t.status === "offered").length;
  const pendingApproveCount = data.tasks.filter((t) => t.status === "submitted").length;

  return (
    <div className="space-y-6">
      {/* Compact Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold tracking-[-0.025em] text-[#161513]">
            Studio
          </h1>
          <p className="text-sm text-[#5C584F] mt-0.5">
            AI captions for African voices. Hire a native ear only for uncertain seconds, settled once in tUSD8 on Aevum.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeJob && (
            <>
              <a
                href={`/api/jobs/${activeJob.id}/export?format=srt`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium bg-[#FCFBF8] border border-[#E2DDD2] text-[#161513] hover:border-[#CFC8B8] transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export .srt
              </a>
              <a
                href={`/api/jobs/${activeJob.id}/export?format=vtt`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium bg-[#FCFBF8] border border-[#E2DDD2] text-[#161513] hover:border-[#CFC8B8] transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export .vtt
              </a>
            </>
          )}
          <button
            type="button"
            disabled={policyBusy}
            onClick={handleResetDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium text-[#5C584F] bg-[#EFECE4] hover:text-[#161513] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Batch
          </button>
        </div>
      </div>

      {/* Pipeline Intake Bar: Pick African-voice clip or upload custom file */}
      <section className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] p-4 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-5 space-y-1.5">
            <label className="block text-xs font-medium text-[#5C584F]">
              Source clip (real audio) or upload your own
            </label>
            <div className="flex flex-wrap gap-2">
              {data.showcaseClips.map((c) => {
                const active = selectedClipId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClipId(c.id)}
                    className={`px-3 py-1.5 rounded-[6px] text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? "bg-[#161513] text-[#FCFBF8] border-[#161513]"
                        : "bg-[#F7F5F0] text-[#161513] border-[#E2DDD2] hover:border-[#CFC8B8]"
                    }`}
                  >
                    {c.city} · {c.languageTag}
                  </button>
                );
              })}
              <label
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium border cursor-pointer transition-colors ${
                  selectedClipId === "custom-upload"
                    ? "bg-[#161513] text-[#FCFBF8] border-[#161513]"
                    : "bg-[#FCFBF8] text-[#5C584F] border-[#E2DDD2] hover:border-[#CFC8B8] hover:text-[#161513]"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                {customFileName ? customFileName.slice(0, 18) : "Upload audio"}
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="conf-slider" className="font-medium text-[#5C584F]">
                Confidence floor
              </label>
              <span className="font-mono font-medium text-[#161513] tabular-nums">
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

          <div className="lg:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="fee-input" className="font-medium text-[#5C584F]">
                Fee / task
              </label>
              <span className="font-mono text-[#5C584F]">tUSD8</span>
            </div>
            <input
              id="fee-input"
              type="number"
              min={0.05}
              max={1.0}
              step={0.05}
              value={feePerTask}
              onChange={(e) => setFeePerTask(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-[6px] text-sm font-mono bg-[#F7F5F0] border border-[#E2DDD2] text-[#161513]"
            />
          </div>

          <div className="lg:col-span-2">
            <button
              type="button"
              disabled={running}
              onClick={runSikioAgent}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[6px] text-sm font-medium bg-[#C54B24] text-[#FCFBF8] hover:bg-[#A93E1B] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <PlayCircle className="w-4 h-4" />
              {running ? "Running…" : "Run Agent"}
            </button>
          </div>
        </div>

        {selectedClipId === "custom-upload" && (
          <div className="mt-3 pt-3 border-t border-[#E2DDD2]">
            <label className="block text-xs font-medium text-[#5C584F] mb-1">
              Optional spoken script / reference notes for local ASR analysis ({customDuration}s detected)
            </label>
            <input
              type="text"
              value={customTranscript}
              onChange={(e) => setCustomTranscript(e.target.value)}
              placeholder="Paste rough transcript or leave blank for Sikio Local ASR Analyzer..."
              className="w-full px-3 py-1.5 rounded-[6px] text-sm bg-[#F7F5F0] border border-[#E2DDD2] text-[#161513]"
            />
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-[6px] bg-[#F9EAE4] border border-[#EBC7BA] px-3 py-2 text-xs text-[#B8381A]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[6px] bg-[#E9F4EE] border border-[#C6E3D3] px-3 py-2 text-xs text-[#1D6B48]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notice}</span>
            </div>
            <Link
              href="/ear"
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              Open Editor Ear <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* Main Workspace Grid: Caption Hero (Left) + Budget & Cost Rail (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          {/* Job switcher if multiple clips processed */}
          {data.jobs.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {data.jobs.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setActiveJobId(j.id)}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-medium border transition-colors cursor-pointer ${
                    activeJob?.id === j.id
                      ? "bg-[#161513] text-[#FCFBF8] border-[#161513]"
                      : "bg-[#FCFBF8] text-[#5C584F] border-[#E2DDD2] hover:text-[#161513]"
                  }`}
                >
                  {j.title}
                </button>
              ))}
            </div>
          )}

          {activeJob ? (
            <>
              <WaveformPlayer
                job={activeJob}
                tasks={activeJobTasks}
                seekToTime={seekToTime}
                onTimeChange={setPlayheadTime}
              />

              <CaptionTimeline
                words={activeJob.words}
                tasks={activeJobTasks}
                currentTime={playheadTime}
                onWordClick={handleWordClick}
              />

              {/* Flagged Micro-Review Tasks Table */}
              <div className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2DDD2] flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[#161513]">
                    Escrowed Micro-Review Tasks ({activeJobTasks.length})
                  </h2>
                  <div className="flex items-center gap-3 text-xs">
                    <Link
                      href="/ear"
                      className="text-[#C54B24] font-medium hover:underline inline-flex items-center gap-1"
                    >
                      Editor Ear ({pendingSubmitCount} open)
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href="/approve"
                      className="text-[#161513] font-medium hover:underline inline-flex items-center gap-1"
                    >
                      Approve Queue ({pendingApproveCount} waiting)
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                {activeJobTasks.length === 0 ? (
                  <div className="p-6 text-sm text-[#5C584F]">
                    No words scored below {Math.round(activeJob.confidenceThreshold * 100)}%. Lower the confidence floor or try another clip.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E2DDD2]">
                    {activeJobTasks.map((t) => (
                      <div
                        key={t.id}
                        className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm hover:bg-[#F7F5F0]/70 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSeekToTime(t.start)}
                              className="font-mono text-xs px-1.5 py-0.5 rounded-[4px] bg-[#EFECE4] text-[#161513] hover:bg-[#E2DDD2] cursor-pointer"
                            >
                              {t.start.toFixed(1)}s–{t.end.toFixed(1)}s
                            </button>
                            <span className="font-medium text-[#161513]">
                              “{t.aiGuess}”
                            </span>
                            {t.submittedText && t.submittedText !== t.aiGuess && (
                              <span className="text-[#1D6B48] font-medium">
                                → “{t.submittedText}”
                              </span>
                            )}
                            <span className="text-xs font-mono text-[#5C584F]">
                              {Math.round(t.minConfidence * 100)}% AI
                            </span>
                          </div>
                          <div className="text-xs text-[#5C584F] mt-0.5">
                            Assigned to {t.editorName} ({t.editorCity}) · Excerpt-only audio
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono text-xs font-medium text-[#161513] tabular-nums">
                            {t.feeTusd8.toFixed(2)} tUSD8
                          </span>
                          <TaskStatusPill status={t.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Clean Empty State inviting the first Agent Run */
            <div className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] p-8 sm:p-10 space-y-5">
              <div className="max-w-lg space-y-2">
                <span className="inline-block text-[11px] font-mono uppercase tracking-wider text-[#C54B24] font-medium">
                  Ready on Batch #{data.batch.batchId}
                </span>
                <h2 className="text-xl font-semibold text-[#161513] tracking-[-0.02em]">
                  Select a clip above and run the Sikio Agent
                </h2>
                <p className="text-sm text-[#5C584F] leading-relaxed">
                  The agent buys word-level AI transcription over HTTP 402 (x402), flags misheard local names and code-switching, and reserves tUSD8 micro-fees in ReviewEscrow inside your approved cap.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {data.showcaseClips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClipId(c.id)}
                    className={`text-left p-3.5 rounded-[6px] border transition-colors cursor-pointer ${
                      selectedClipId === c.id
                        ? "border-[#C54B24] bg-[#F9EAE4]/45"
                        : "border-[#E2DDD2] bg-[#F7F5F0] hover:border-[#CFC8B8]"
                    }`}
                  >
                    <div className="text-xs font-mono text-[#5C584F]">{c.languageTag}</div>
                    <div className="text-sm font-semibold text-[#161513] mt-0.5">
                      {c.title}
                    </div>
                    <div className="text-xs text-[#5C584F] mt-1">{c.sourceLabel}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Rail: Budget Policy + Publishable Minute Economics + x402 Proof */}
        <div className="lg:col-span-4 space-y-5">
          <BudgetRail
            batch={data.batch}
            availableBudgetTusd8={data.availableBudgetTusd8}
            busy={policyBusy}
            onUpdatePolicy={handleUpdatePolicy}
          />

          {activeJob && costMetrics && (
            <div className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#161513]">
                  Cost per Publishable Minute
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-[4px] bg-[#E9F4EE] text-[#1D6B48]">
                  {costMetrics.reviewTimeSavedPct}% less audio reviewed
                </span>
              </div>

              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="text-3xl font-semibold tracking-[-0.03em] text-[#161513]">
                  ${costMetrics.costPerMinuteProjected.toFixed(2)}
                </span>
                <span className="text-xs text-[#5C584F]">
                  / min projected (vs. ${costMetrics.fullHumanReviewCostPerMin.toFixed(2)} full review)
                </span>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#E2DDD2] text-xs tabular-nums">
                <div className="flex justify-between">
                  <span className="text-[#5C584F]">AI transcription (x402)</span>
                  <span className="font-mono text-[#161513]">
                    {activeJob.inferenceCostTusd8.toFixed(2)} tUSD8
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5C584F]">Settled human fixes</span>
                  <span className="font-mono text-[#1D6B48]">
                    {(costMetrics.totalSettled - activeJob.inferenceCostTusd8).toFixed(2)} tUSD8
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5C584F]">Reserved in escrow</span>
                  <span className="font-mono text-[#C54B24]">
                    {(costMetrics.totalProjected - costMetrics.totalSettled).toFixed(2)} tUSD8
                  </span>
                </div>
              </div>

              <Link
                href="/receipts"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#C54B24] hover:underline pt-1"
              >
                Inspect itemized receipts & A/B benchmark <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {lastX402 && (
            <div className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#161513]">x402 Handshake Verified</span>
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-[4px] bg-[#EFECE4] text-[#161513]">
                  402 → 200
                </span>
              </div>
              <div className="text-[#5C584F] space-y-1 font-mono text-[11px]">
                <div>Operator: {lastX402.operator}</div>
                <div>Request: {lastX402.requestId}</div>
                <div>Settled: {lastX402.amountDisplay}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskStatusPill({ status }: { status: ReviewTask["status"] }) {
  const styles: Record<ReviewTask["status"], string> = {
    offered: "bg-[#F9EAE4] text-[#B8381A]",
    submitted: "bg-[#FBF2DE] text-[#945F00]",
    accepted: "bg-[#E9F4EE] text-[#1D6B48]",
    rejected: "bg-[#EFECE4] text-[#5C584F]",
    expired: "bg-[#EFECE4] text-[#5C584F]",
  };
  const labels: Record<ReviewTask["status"], string> = {
    offered: "Offered",
    submitted: "In Review",
    accepted: "Paid Once",
    rejected: "Refunded",
    expired: "Expired",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-medium ${styles[status]}`}
    >
      {status === "offered" && <Clock className="w-3 h-3" />}
      {status === "accepted" && <CheckCircle2 className="w-3 h-3" />}
      {labels[status]}
    </span>
  );
}
