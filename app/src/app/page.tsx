"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  Upload,
  ArrowRight,
  Play,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Radio,
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

const CLIP_SAMPLE_ERRORS: Record<string, [string, string][]> = {
  "lagos-fintech-ep14": [
    ["Pay stark", "Paystack"],
    ["wall holler", "wahala"],
    ["down for", "danfo"],
  ],
  "nairobi-matatu-doc": [
    ["my tattoo", "matatu"],
    ["one anchi", "mwananchi"],
    ["Killy Manny", "Kilimani"],
  ],
  "accra-nollywood-scene": [
    ["jaw love", "jollof"],
    ["Quarry", "Kwame"],
    ["McCullough", "Makola"],
  ],
};

function notifyNavSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sikio:state-updated"));
  }
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
      notifyNavSync();
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

    const probe = document.createElement("audio");
    probe.src = objectUrl;
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        setCustomDuration(Number(probe.duration.toFixed(1)));
      }
    };
  };

  const runSikioAgent = async (overrideClipId?: string) => {
    const clipToRun = overrideClipId || selectedClipId;
    setError(null);
    setNotice(null);
    setRunning(true);
    try {
      const isCustom = clipToRun === "custom-upload";
      const probe402 = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId: isCustom ? undefined : clipToRun,
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
          clipId: isCustom ? undefined : clipToRun,
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
        `x402 settled 0.04 tUSD8 · Flagged ${json.createdTasks.length} uncertain span${
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
        <div className="h-12 w-72 rounded-[5px] bg-[#EBE6DB] animate-pulse" />
        <div className="h-72 w-full rounded-[6px] bg-[#EBE6DB] animate-pulse" />
      </div>
    );
  }

  const pendingSubmitCount = data.tasks.filter((t) => t.status === "offered").length;
  const pendingApproveCount = data.tasks.filter((t) => t.status === "submitted").length;

  return (
    <div className="space-y-6">
      {/* Editorial Studio Masthead */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#DDD7CA]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.08em] text-[#C94A22]">
            <Radio className="w-3.5 h-3.5" />
            <span>Broadcast Caption Desk</span>
          </div>
          <h1 className="text-2xl sm:text-[32px] font-semibold tracking-[-0.03em] text-[#141311] leading-tight">
            Pay for the human ear only where AI hesitates.
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {activeJob && (
            <>
              <a
                href={`/api/jobs/${activeJob.id}/export?format=srt`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-xs font-medium bg-[#FBF9F4] border border-[#DDD7CA] text-[#141311] hover:border-[#141311] transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> .SRT
              </a>
              <a
                href={`/api/jobs/${activeJob.id}/export?format=vtt`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-xs font-medium bg-[#FBF9F4] border border-[#DDD7CA] text-[#141311] hover:border-[#141311] transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> .VTT
              </a>
            </>
          )}
          <button
            type="button"
            disabled={policyBusy}
            onClick={handleResetDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-xs font-medium text-[#5C574E] bg-[#EBE6DB] hover:text-[#141311] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Batch
          </button>
        </div>
      </div>

      {/* Hardware-Styled Control Deck */}
      <section className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] p-4 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-5 space-y-2">
            <span className="block text-[11px] font-mono uppercase tracking-[0.06em] text-[#5C574E]">
              Input Tape / Custom Upload
            </span>
            <div className="flex flex-wrap gap-1.5">
              {data.showcaseClips.map((c) => {
                const active = selectedClipId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClipId(c.id)}
                    className={`px-3 py-1.5 rounded-[5px] text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? "bg-[#141311] text-[#FBF9F4] border-[#141311]"
                        : "bg-[#F4F1EA] text-[#141311] border-[#DDD7CA] hover:border-[#141311]"
                    }`}
                  >
                    {c.city}{" "}
                    <span className="font-mono text-[10px] opacity-75">
                      {c.languageTag}
                    </span>
                  </button>
                );
              })}
              <label
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-xs font-medium border cursor-pointer transition-colors ${
                  selectedClipId === "custom-upload"
                    ? "bg-[#141311] text-[#FBF9F4] border-[#141311]"
                    : "bg-[#FBF9F4] text-[#5C574E] border-[#DDD7CA] hover:border-[#141311] hover:text-[#141311]"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                {customFileName ? customFileName.slice(0, 16) : "Upload"}
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.05em]">
              <label htmlFor="conf-slider" className="text-[#5C574E]">
                Confidence Floor
              </label>
              <span className="font-semibold text-[#141311] tabular-nums">
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
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.05em]">
              <label htmlFor="fee-input" className="text-[#5C574E]">
                Task Fee
              </label>
              <span className="text-[#847D72]">tUSD8</span>
            </div>
            <input
              id="fee-input"
              type="number"
              min={0.05}
              max={1.0}
              step={0.05}
              value={feePerTask}
              onChange={(e) => setFeePerTask(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-[5px] text-sm font-mono bg-[#F4F1EA] border border-[#DDD7CA] text-[#141311]"
            />
          </div>

          <div className="lg:col-span-2">
            <button
              type="button"
              disabled={running}
              onClick={() => runSikioAgent()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[5px] text-sm font-medium bg-[#C94A22] text-[#FBF9F4] hover:bg-[#AB3B18] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {running ? "Running…" : "Run Agent"}
            </button>
          </div>
        </div>

        {selectedClipId === "custom-upload" && (
          <div className="mt-3 pt-3 border-t border-[#DDD7CA]">
            <label className="block text-xs font-medium text-[#5C574E] mb-1">
              Optional spoken script for local ASR ({customDuration}s detected)
            </label>
            <input
              type="text"
              value={customTranscript}
              onChange={(e) => setCustomTranscript(e.target.value)}
              placeholder="Paste rough transcript or leave blank for Sikio Local ASR Analyzer..."
              className="w-full px-3 py-1.5 rounded-[5px] text-sm bg-[#F4F1EA] border border-[#DDD7CA] text-[#141311]"
            />
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-[5px] bg-[#FAEAE4] border border-[#E8C5B8] px-3 py-2 text-xs text-[#B33C17]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[5px] bg-[#E7F4ED] border border-[#C3E2D1] px-3 py-2 text-xs text-[#1B6B46]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notice}</span>
            </div>
            <Link
              href="/ear"
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              Next: Open Editor Ear <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          {data.jobs.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {data.jobs.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setActiveJobId(j.id)}
                  className={`px-3 py-1.5 rounded-[5px] text-xs font-medium border transition-colors cursor-pointer ${
                    activeJob?.id === j.id
                      ? "bg-[#141311] text-[#FBF9F4] border-[#141311]"
                      : "bg-[#FBF9F4] text-[#5C574E] border-[#DDD7CA] hover:text-[#141311]"
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

              {/* Flagged Micro-Review Desk */}
              <div className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] overflow-hidden">
                <div className="px-5 py-3 border-b border-[#DDD7CA] flex flex-wrap items-center justify-between gap-2 bg-[#F4F1EA]/70">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#847D72]">
                      Escrow Queue
                    </span>
                    <h2 className="text-sm font-semibold text-[#141311]">
                      {activeJobTasks.length} Flagged Spans
                    </h2>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <Link
                      href="/ear"
                      className="text-[#C94A22] font-medium hover:underline inline-flex items-center gap-1"
                    >
                      Ear ({pendingSubmitCount} open)
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href="/approve"
                      className="text-[#141311] font-medium hover:underline inline-flex items-center gap-1"
                    >
                      Approve ({pendingApproveCount} waiting)
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                {activeJobTasks.length === 0 ? (
                  <div className="p-6 text-sm text-[#5C574E]">
                    No words scored below{" "}
                    {Math.round(activeJob.confidenceThreshold * 100)}%. Raise the confidence floor to inspect more words.
                  </div>
                ) : (
                  <div className="divide-y divide-[#DDD7CA]">
                    {activeJobTasks.map((t) => (
                      <div
                        key={t.id}
                        className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm hover:bg-[#F4F1EA]/70 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSeekToTime(t.start)}
                              className="font-mono text-[11px] px-1.5 py-0.5 rounded-[4px] bg-[#EBE6DB] text-[#141311] hover:bg-[#DDD7CA] cursor-pointer tabular-nums"
                            >
                              {t.start.toFixed(1)}s–{t.end.toFixed(1)}s
                            </button>
                            <span className="font-medium text-[#141311]">
                              “{t.aiGuess}”
                            </span>
                            {t.submittedText && t.submittedText !== t.aiGuess && (
                              <span className="text-[#1B6B46] font-semibold">
                                → “{t.submittedText}”
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-[#847D72]">
                              {Math.round(t.minConfidence * 100)}% AI
                            </span>
                          </div>
                          <div className="text-xs text-[#5C574E] mt-0.5">
                            {t.editorName} ({t.editorCity}) · Excerpt-only WAV
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono text-xs font-medium text-[#141311] tabular-nums">
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
            /* Sculptural First-Visit Broadcast Intake Deck */
            <div className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] overflow-hidden">
              <div className="bg-[#121110] text-[#FBF9F4] p-6 sm:p-7 space-y-5">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.08em] text-[#9C9589]">
                  <span>African Speech ASR · Where Models Break</span>
                  <span className="text-[#C94A22]">x402 + ReviewEscrow</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(CLIP_SAMPLE_ERRORS[selectedClipId] ||
                    CLIP_SAMPLE_ERRORS["lagos-fintech-ep14"]
                  ).map(([wrong, right]) => (
                    <div
                      key={wrong}
                      className="rounded-[5px] border border-[#292623] bg-[#1C1A18] p-3.5 space-y-1.5"
                    >
                      <div className="text-[11px] font-mono text-[#8A8378]">
                        AI hears
                      </div>
                      <div className="text-sm font-medium text-[#FFD3C4] line-through">
                        “{wrong}”
                      </div>
                      <div className="text-sm font-semibold text-[#AEE8C9]">
                        → “{right}”
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#262320]">
                  <p className="text-xs text-[#ABA498] max-w-md">
                    Pick a real spoken clip below. Sikio pays 0.04 tUSD8 via HTTP 402, isolates the misheard seconds, and locks micro-fees for a native speaker.
                  </p>
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => runSikioAgent()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-[5px] text-xs font-semibold bg-[#C94A22] text-[#FBF9F4] hover:bg-[#AB3B18] transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {running ? "Running…" : "Start Live Run · 0.04 tUSD8"}
                  </button>
                </div>
              </div>

              {/* 3 Tactile Tape Reels */}
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#DDD7CA]">
                {data.showcaseClips.map((c, idx) => {
                  const active = selectedClipId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedClipId(c.id)}
                      className={`text-left p-4 transition-colors cursor-pointer ${
                        active
                          ? "bg-[#FAEAE4]/55"
                          : "bg-[#FBF9F4] hover:bg-[#F4F1EA]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-[#847D72]">TAPE 0{idx + 1}</span>
                        <span
                          className={
                            active ? "text-[#C94A22] font-semibold" : "text-[#5C574E]"
                          }
                        >
                          {c.languageTag}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-[#141311] mt-1.5">
                        {c.title}
                      </div>
                      <div className="text-xs text-[#5C574E] mt-0.5">
                        {c.sourceLabel}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Architectural Rail */}
        <div className="lg:col-span-4 space-y-5">
          <BudgetRail
            batch={data.batch}
            availableBudgetTusd8={data.availableBudgetTusd8}
            busy={policyBusy}
            onUpdatePolicy={handleUpdatePolicy}
          />

          {activeJob && costMetrics && (
            <div className="rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#DDD7CA] flex items-center justify-between bg-[#F4F1EA]/70">
                <h2 className="text-xs font-semibold uppercase tracking-[0.05em] text-[#141311]">
                  Publishable Minute Cost
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-[4px] bg-[#E7F4ED] text-[#1B6B46] font-medium">
                  -{costMetrics.reviewTimeSavedPct}% review time
                </span>
              </div>

              <div className="p-4 space-y-3.5">
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-3xl font-semibold tracking-[-0.03em] text-[#141311]">
                    ${costMetrics.costPerMinuteProjected.toFixed(2)}
                  </span>
                  <span className="text-xs text-[#5C574E]">
                    / min vs. ${costMetrics.fullHumanReviewCostPerMin.toFixed(2)} full review
                  </span>
                </div>

                {/* Visual bar comparison */}
                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-[#5C574E]">Full</span>
                    <div className="flex-1 h-2 bg-[#EBE6DB] rounded-[2px] overflow-hidden">
                      <div className="h-full w-full bg-[#B4ACA0]" />
                    </div>
                    <span className="w-11 text-right text-[#5C574E]">$3.50</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-[#141311] font-semibold">Sikio</span>
                    <div className="flex-1 h-2 bg-[#EBE6DB] rounded-[2px] overflow-hidden">
                      <div
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              8,
                              (costMetrics.costPerMinuteProjected /
                                costMetrics.fullHumanReviewCostPerMin) *
                                100
                            )
                          )}%`,
                        }}
                        className="h-full bg-[#1B6B46]"
                      />
                    </div>
                    <span className="w-11 text-right text-[#1B6B46] font-semibold">
                      ${costMetrics.costPerMinuteProjected.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-[#DDD7CA] text-xs tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-[#5C574E]">AI transcription (x402)</span>
                    <span className="font-mono text-[#141311]">
                      {activeJob.inferenceCostTusd8.toFixed(2)} tUSD8
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5C574E]">Settled human fixes</span>
                    <span className="font-mono text-[#1B6B46]">
                      {(costMetrics.totalSettled - activeJob.inferenceCostTusd8).toFixed(2)}{" "}
                      tUSD8
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5C574E]">Escrowed pending</span>
                    <span className="font-mono text-[#C94A22]">
                      {(costMetrics.totalProjected - costMetrics.totalSettled).toFixed(2)}{" "}
                      tUSD8
                    </span>
                  </div>
                </div>

                <Link
                  href="/receipts"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#C94A22] hover:underline"
                >
                  Open receipts & A/B benchmark <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {lastX402 && (
            <div className="rounded-[6px] border border-[#DDD7CA] bg-[#121110] text-[#FBF9F4] p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold">x402 Payment Proof</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[#1B6B46] text-[#FBF9F4]">
                  402 → 200 OK
                </span>
              </div>
              <div className="text-[#ABA498] space-y-1 font-mono text-[11px]">
                <div>{lastX402.operator}</div>
                <div>req: {lastX402.requestId}</div>
                <div className="text-[#FBF9F4]">paid: {lastX402.amountDisplay}</div>
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
    offered: "bg-[#FAEAE4] text-[#C94A22]",
    submitted: "bg-[#FBF2DD] text-[#945D00]",
    accepted: "bg-[#E7F4ED] text-[#1B6B46]",
    rejected: "bg-[#EBE6DB] text-[#5C574E]",
    expired: "bg-[#EBE6DB] text-[#5C574E]",
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
