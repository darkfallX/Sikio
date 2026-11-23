"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, Upload, ArrowRight, Play, RefreshCw, Check } from "lucide-react";
import {
  BatchBudget,
  CaptionJob,
  CaptionWord,
  PaymentReceipt,
  ReviewTask,
} from "@/lib/types";
import { computeCostMetrics } from "@/lib/captions";
import { SIKIO_TRANSCRIPTION_PROVIDER } from "@/lib/x402";
import { WaveformPlayer } from "@/components/WaveformPlayer";
import { CaptionTimeline } from "@/components/CaptionTimeline";
import { BudgetRail } from "@/components/BudgetRail";
import { OrganicWaveRibbon, WaveSpan } from "@/components/OrganicWaveRibbon";
import { useWallet } from "@/components/WalletContext";

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

interface ProofPreviewSlide {
  clipId: string;
  city: string;
  lang: string;
  duration: number;
  before: string;
  after: string;
  pairs: [string, string, number, number, number][]; // [wrong, right, start, end, conf%]
}

const PREVIEW_SLIDES: ProofPreviewSlide[] = [
  {
    clipId: "lagos-fintech-ep14",
    city: "Lagos",
    lang: "en-NG / pcm",
    duration: 17.4,
    before: "Today we are talking with Tunde from Yaba about how founders use",
    after: "and Flutterwave to settle Naira payouts without wahala.",
    pairs: [
      ["Pay stark", "Paystack", 6.2, 7.6, 48],
      ["wall holler", "wahala", 9.3, 11.4, 41],
      ["down for", "danfo", 11.3, 12.6, 52],
    ],
  },
  {
    clipId: "nairobi-matatu-doc",
    city: "Nairobi",
    lang: "en-KE / sw",
    duration: 14.4,
    before: "Every morning at six, commuters along Ngong Road board the",
    after: "heading toward Kilimani and Westlands.",
    pairs: [
      ["my tattoo", "matatu", 3.4, 4.9, 38],
      ["Killy Manny", "Kilimani", 4.7, 6.2, 56],
      ["one anchi", "mwananchi", 11.8, 13.4, 34],
    ],
  },
  {
    clipId: "accra-nollywood-scene",
    city: "Accra",
    lang: "en-GH",
    duration: 12.5,
    before: "Listen Kwame, the client in Osu needs the final cut. If we delay the",
    after: "campaign for Makola Market, the agency moves budget.",
    pairs: [
      ["jaw love", "jollof", 5.8, 7.4, 42],
      ["Quarry", "Kwame", 0.3, 1.8, 46],
      ["McCullough", "Makola", 7.1, 8.8, 47],
    ],
  },
];

const PIPELINE_STEPS = [
  "HTTP 402 payment challenge",
  "Settling 0.04 tUSD8 x402",
  "Flagging uncertain African speech spans",
  "Locking escrow for native Ear review",
];

function notifyNavSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sikio:state-updated"));
  }
}

export default function StudioPage() {
  const { address, isAevum, liveEscrowMode, payInferenceOnChain } = useWallet();
  const [data, setData] = useState<StatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<number>(-1);
  const [uploading, setUploading] = useState(false);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedClipId, setSelectedClipId] = useState("lagos-fintech-ep14");
  const [threshold, setThreshold] = useState(0.78);
  const [feePerTask, setFeePerTask] = useState(0.1);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [seekToTime, setSeekToTime] = useState<number | null>(null);
  const [playheadTime, setPlayheadTime] = useState(0);

  // Uploaded persistent clip state
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

  // Living pre-run proof preview animation state
  const [previewFixed, setPreviewFixed] = useState(false);
  const [previewSlideIdx, setPreviewSlideIdx] = useState(0);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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
      setError("Could not reach Sikio backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Sync preview slide with user's selected showcase clip or cycle gently when idle
  useEffect(() => {
    const idx = PREVIEW_SLIDES.findIndex((s) => s.clipId === selectedClipId);
    if (idx >= 0) {
      setPreviewSlideIdx(idx);
      setPreviewFixed(false);
    }
  }, [selectedClipId]);

  useEffect(() => {
    if (activeJobId) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setPreviewFixed(true);
      return;
    }

    const fixTimer = setTimeout(() => setPreviewFixed(true), 2200);
    const nextTimer = setTimeout(() => {
      setPreviewFixed(false);
      setPreviewSlideIdx((i) => (i + 1) % PREVIEW_SLIDES.length);
    }, 6400);

    return () => {
      clearTimeout(fixTimer);
      clearTimeout(nextTimer);
    };
  }, [activeJobId, previewSlideIdx]);

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
        setError(json.error || "Could not upload audio clip.");
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
      setError("Network error while uploading audio file.");
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
        setError("Select or upload an audio file before running the agent.");
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
        setError(json.error || "Agent run rejected by budget policy.");
        return;
      }

      await loadState();
      if (json.job?.id) setActiveJobId(json.job.id);
      setNotice(
        `x402 settled 0.04 tUSD8. Flagged ${json.createdTasks.length} spans and escrowed ${(
          json.createdTasks.length * feePerTask
        ).toFixed(2)} tUSD8.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error while running agent."
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
      if (!res.ok) setError(json.error || "Could not update policy.");
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

  const handleWordClick = (w: CaptionWord) => {
    setSeekToTime(Math.max(0, w.start - 0.15));
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-14 w-3/4 rounded-[12px] bg-[var(--panel)] animate-pulse" />
        <div className="h-72 w-full rounded-[12px] bg-[var(--panel)] animate-pulse" />
      </div>
    );
  }

  const pendingSubmitCount = data.tasks.filter((t) => t.status === "offered").length;
  const pendingApproveCount = data.tasks.filter((t) => t.status === "submitted").length;
  const activePreview = PREVIEW_SLIDES[previewSlideIdx] || PREVIEW_SLIDES[0];

  const previewWaveSpans: WaveSpan[] = activePreview.pairs.map((p) => ({
    start: p[2],
    end: p[3],
    status: previewFixed ? "accepted" : "flagged",
  }));

  return (
    <div className="space-y-7 sm:space-y-9">
      {/* Masthead + balanced single intake strip */}
      <section className="space-y-5 sikio-rise">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <h1 className="type-display text-[var(--ink)]">
              AI captions for <em className="italic font-semibold">African voices</em>.
            </h1>
            <p className="text-[16px] text-[var(--ink-2)]">
              Read captions like a proof sheet. Native ears fix only underlined spans, paid once in tUSD8.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {activeJob && (
              <>
                <a
                  href={`/api/jobs/${activeJob.id}/export?format=srt`}
                  className="min-h-[44px] sm:min-h-[38px] inline-flex items-center gap-1.5 px-3.5 rounded-[8px] text-xs font-semibold hairline bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--hover)]"
                >
                  <Download className="w-3.5 h-3.5" /> Export .srt
                </a>
                <a
                  href={`/api/jobs/${activeJob.id}/export?format=vtt`}
                  className="min-h-[44px] sm:min-h-[38px] inline-flex items-center gap-1.5 px-3.5 rounded-[8px] text-xs font-semibold hairline bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--hover)]"
                >
                  <Download className="w-3.5 h-3.5" /> Export .vtt
                </a>
              </>
            )}
            <button
              type="button"
              disabled={policyBusy}
              onClick={handleResetDemo}
              className="min-h-[44px] sm:min-h-[38px] inline-flex items-center gap-1.5 px-3.5 rounded-[8px] text-xs font-medium hairline bg-[var(--paper)] text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>

        {/* Shared-border studio intake strip: fits cleanly on one line on desktop */}
        <div className="rounded-[12px] hairline bg-[var(--paper)] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[var(--line)]">
            <div className="lg:col-span-6 p-3.5 sm:p-4 space-y-2">
              <div className="type-label">Clip source</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {data.showcaseClips.map((c) => {
                  const active = selectedClipId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedClipId(c.id)}
                      className={`min-h-[44px] sm:min-h-[36px] px-3 rounded-[8px] text-xs font-medium hairline transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? "bg-[var(--ink)] text-[var(--paper)]"
                          : "bg-[var(--bg)] text-[var(--ink)] hover:bg-[var(--hover)]"
                      }`}
                    >
                      {c.shortLabel || `${c.city} · ${c.languageTag}`}
                    </button>
                  );
                })}
                <label
                  className={`min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-[8px] text-xs font-medium hairline cursor-pointer transition-colors whitespace-nowrap ${
                    selectedClipId === "custom-upload"
                      ? "bg-[var(--ink)] text-[var(--paper)]"
                      : "bg-[var(--paper)] text-[var(--mute)] hover:text-[var(--ink)]"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploading
                    ? "Uploading…"
                    : customFileName
                    ? customFileName.slice(0, 12)
                    : "Upload"}
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

            <div className="lg:col-span-2 p-3.5 sm:p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="conf-slider" className="type-label">
                  Floor
                </label>
                <span className="font-mono text-xs font-semibold tabular-nums text-[var(--ink)]">
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

            <div className="lg:col-span-2 p-3.5 sm:p-4 space-y-1.5">
              <label htmlFor="fee-input" className="block type-label">
                Task fee (tUSD8)
              </label>
              <input
                id="fee-input"
                type="number"
                min={0.05}
                max={1.0}
                step={0.05}
                value={feePerTask}
                onChange={(e) => setFeePerTask(Number(e.target.value))}
                className="w-full min-h-[44px] sm:min-h-[36px] px-3 rounded-[8px] font-mono text-sm tabular-nums hairline bg-[var(--bg)] text-[var(--ink)]"
              />
            </div>

            <div className="lg:col-span-2 p-3.5 sm:p-4 flex items-end">
              <button
                type="button"
                disabled={running || uploading}
                onClick={runSikioAgent}
                className="w-full min-h-[44px] sm:min-h-[38px] inline-flex items-center justify-center gap-2 px-4 rounded-[8px] text-sm font-semibold bg-[var(--signal)] text-[#fbf8f1] hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {running ? "Running…" : "Run agent"}
              </button>
            </div>
          </div>

          {/* Animated 4-step pipeline progress indicator */}
          {running && pipelineStep >= 0 && (
            <div
              aria-live="polite"
              className="px-4 py-3 hairline-t bg-[var(--bg)]/55 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs"
            >
              {PIPELINE_STEPS.map((label, i) => {
                const done = i < pipelineStep;
                const active = i === pipelineStep;
                return (
                  <div key={label} className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-4 h-4 rounded-full shrink-0 inline-flex items-center justify-center font-mono text-[10px] ${
                        done
                          ? "bg-[var(--green)] text-[#fbf8f1] sikio-check-pop"
                          : active
                          ? "bg-[var(--signal)] text-[#fbf8f1] sikio-led"
                          : "bg-[var(--panel)] text-[var(--mute)]"
                      }`}
                    >
                      {done ? <Check className="w-2.5 h-2.5" /> : i + 1}
                    </span>
                    <span
                      className={`truncate ${
                        done || active
                          ? "text-[var(--ink)] font-medium"
                          : "text-[var(--mute)]"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {selectedClipId === "custom-upload" && (
            <div className="p-4 hairline-t bg-[var(--bg)]/50">
              <label htmlFor="custom-script" className="block type-label mb-1.5">
                Optional reference transcript ({customDuration}s audio)
              </label>
              <input
                id="custom-script"
                type="text"
                value={customTranscript}
                onChange={(e) => setCustomTranscript(e.target.value)}
                placeholder="Paste rough transcript or leave empty for local ASR"
                className="w-full min-h-[44px] px-3 rounded-[8px] text-sm hairline bg-[var(--paper)] text-[var(--ink)]"
              />
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="px-5 py-3 hairline-t bg-[var(--red-bg)] text-xs font-medium text-[var(--red)]"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              aria-live="polite"
              className="px-5 py-2.5 hairline-t bg-[var(--green-bg)] text-xs font-medium text-[var(--green)] flex flex-wrap items-center justify-between gap-2"
            >
              <span>{notice}</span>
              <Link
                href="/ear"
                className="min-h-[40px] px-2.5 inline-flex items-center gap-1 font-semibold underline underline-offset-2"
              >
                Open Ear <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Main 2-column Editorial Print Desk Workspace */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          {data.jobs.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {data.jobs.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setActiveJobId(j.id)}
                  className={`min-h-[40px] px-3.5 rounded-full text-xs font-medium hairline transition-colors cursor-pointer ${
                    activeJob?.id === j.id
                      ? "bg-[var(--ink)] text-[var(--paper)]"
                      : "bg-[var(--paper)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
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

              {/* Flagged tasks ledger */}
              <div className="rounded-[12px] hairline bg-[var(--paper)] overflow-hidden">
                <div className="px-5 py-3 hairline-b bg-[var(--bg)]/35 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="type-label">
                    Escrowed spans ({activeJobTasks.length})
                  </h2>
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <Link
                      href="/ear"
                      className="text-[var(--signal-ink)] hover:underline"
                    >
                      Ear ({pendingSubmitCount})
                    </Link>
                    <Link
                      href="/approve"
                      className="text-[var(--ink)] hover:underline"
                    >
                      Approve ({pendingApproveCount})
                    </Link>
                  </div>
                </div>

                {activeJobTasks.length === 0 ? (
                  <div className="p-6 text-sm text-[var(--mute)]">
                    No words scored below {Math.round(activeJob.confidenceThreshold * 100)}%.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--line)]">
                    {activeJobTasks.map((t) => (
                      <div
                        key={t.id}
                        className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm hover:bg-[var(--hover)] transition-colors"
                      >
                        <div className="min-w-0 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSeekToTime(t.start)}
                            className="font-mono text-xs px-2 py-0.5 rounded-[6px] bg-[var(--panel)] text-[var(--ink)] tabular-nums cursor-pointer"
                          >
                            {t.start.toFixed(1)}s · {t.end.toFixed(1)}s
                          </button>
                          <span className="font-semibold text-[var(--ink)]">
                            {t.aiGuess}
                          </span>
                          {t.submittedText && t.submittedText !== t.aiGuess && (
                            <span className="text-[var(--green)] font-semibold">
                              → {t.submittedText}
                            </span>
                          )}
                          <span className="font-mono text-xs text-[var(--mute)] tabular-nums">
                            {Math.round(t.minConfidence * 100)}% · {t.editorCity}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-xs tabular-nums text-[var(--ink)]">
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
            /* Pre-run Hero: Living Editorial Proof Sheet Preview with Silky Organic Ribbon */
            <div
              key={activePreview.clipId}
              className="rounded-[12px] hairline double-rule bg-[var(--paper)] hero-elevation overflow-hidden sikio-rise"
            >
              <div className="px-5 py-3 hairline-b bg-[var(--bg)]/45 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--mute)]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--signal)] sikio-led" />
                  <span className="text-[var(--ink-2)]">
                    Proof preview · {activePreview.city} ({activePreview.lang})
                  </span>
                </div>
                <span className="tabular-nums">x402 · 0.04 tUSD8</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[var(--line)]">
                {/* Galley wave + animated proof sentence */}
                <div className="md:col-span-8 p-5 sm:p-6 space-y-5">
                  <div className="rounded-[10px] hairline bg-[var(--bg)]/55 px-2 py-1.5">
                    <OrganicWaveRibbon
                      audioUrl={`/clips/${activePreview.clipId}.wav`}
                      seedKey={activePreview.clipId}
                      duration={activePreview.duration}
                      currentTime={previewFixed ? 11.4 : 6.4}
                      playing={false}
                      ambientWave
                      spans={previewWaveSpans}
                      height={74}
                      interactive={false}
                    />
                  </div>

                  <p
                    aria-live="polite"
                    className="text-[19px] sm:text-[21px] leading-[1.8] text-[var(--ink)]"
                  >
                    {activePreview.before}{" "}
                    <span
                      key={`${activePreview.clipId}-${previewFixed}`}
                      className={`inline-block px-1.5 py-0.5 rounded-[5px] font-semibold border-b-2 transition-colors ${
                        previewFixed
                          ? "sikio-verdict bg-[var(--green-bg)] text-[var(--green)] border-[var(--green)]"
                          : "bg-[var(--signal-bg)] text-[var(--signal-ink)] border-[var(--signal)]"
                      }`}
                    >
                      {previewFixed
                        ? activePreview.pairs[0][1]
                        : activePreview.pairs[0][0]}
                    </span>{" "}
                    {activePreview.after}
                  </p>
                </div>

                {/* Right Margin Notes inside Proof Sheet */}
                <div className="md:col-span-4 p-5 bg-[var(--bg)]/25 space-y-4">
                  <div className="type-label">Margin notes · Native fixes</div>
                  <div className="divide-y divide-[var(--line)]">
                    {activePreview.pairs.map(([wrong, right, start, , conf]) => (
                      <div key={wrong} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                        <div className="flex items-center justify-between font-mono text-[10px] tabular-nums">
                          <span className="text-[var(--mute)]">
                            {start.toFixed(1)}s · {conf}% AI
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full font-medium ${
                              previewFixed
                                ? "bg-[var(--green-bg)] text-[var(--green)]"
                                : "bg-[var(--signal-bg)] text-[var(--signal-ink)]"
                            }`}
                          >
                            {previewFixed ? "Paid 0.10" : "Escrow 0.10"}
                          </span>
                        </div>
                        <div className="text-xs flex items-center gap-1.5">
                          <span className="line-through text-[var(--mute)]">{wrong}</span>
                          <span className="font-semibold text-[var(--ink)]">→ {right}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right rail: margin notes, budget, honest cost comparison */}
        <div className="lg:col-span-4 space-y-6">
          {activeJob && activeJobTasks.length > 0 && (
            <div className="rounded-[12px] hairline bg-[var(--paper)] overflow-hidden">
              <div className="px-5 py-3 hairline-b bg-[var(--bg)]/35 flex items-center justify-between">
                <span className="type-label">Margin notes</span>
                <span className="font-mono text-[11px] text-[var(--mute)]">
                  Click to audition
                </span>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {activeJobTasks.slice(0, 5).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSeekToTime(t.start)}
                    className="w-full text-left px-5 py-3 hover:bg-[var(--hover)] transition-colors cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] tabular-nums">
                      <span className="text-[var(--mute)]">
                        {t.focusStart.toFixed(1)}s · {t.editorCity}
                      </span>
                      <span
                        className={
                          t.status === "accepted"
                            ? "text-[var(--green)] font-semibold"
                            : "text-[var(--signal-ink)] font-semibold"
                        }
                      >
                        {t.status === "accepted" ? "Fixed" : `${Math.round(t.minConfidence * 100)}% AI`}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--ink)] font-medium">
                      <span
                        className={
                          t.status === "accepted"
                            ? "line-through text-[var(--mute)] mr-1.5"
                            : "text-[var(--signal-ink)] mr-1.5"
                        }
                      >
                        {t.aiGuess}
                      </span>
                      {t.submittedText && t.submittedText !== t.aiGuess && (
                        <span className="text-[var(--green)] font-semibold">
                          → {t.submittedText}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <BudgetRail
            batch={data.batch}
            availableBudgetTusd8={data.availableBudgetTusd8}
            busy={policyBusy}
            onUpdatePolicy={handleUpdatePolicy}
          />

          {activeJob && costMetrics && (
            <div className="rounded-[12px] hairline bg-[var(--paper)] overflow-hidden">
              <div className="px-5 py-3 hairline-b bg-[var(--bg)]/35 flex items-center justify-between gap-2">
                <span className="type-label">Cost per minute</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-mono text-[11px] tabular-nums ${
                    costMetrics.reviewTimeSavedPct > 0
                      ? "bg-[var(--green-bg)] text-[var(--green)]"
                      : "bg-[var(--panel)] text-[var(--mute)]"
                  }`}
                >
                  {costMetrics.reviewTimeSavedPct}% audio skipped
                </span>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span
                    className={`font-mono text-3xl font-semibold ${
                      costMetrics.isCheaperThanFull
                        ? "text-[var(--ink)]"
                        : "text-[var(--amber)]"
                    }`}
                  >
                    ${costMetrics.costPerMinuteProjected.toFixed(2)}
                  </span>
                  <span className="font-mono text-xs text-[var(--mute)]">
                    vs ${costMetrics.fullHumanReviewCostPerMin.toFixed(2)} full review
                  </span>
                </div>

                {!costMetrics.isCheaperThanFull && (
                  <p className="text-xs text-[var(--amber)]">
                    Higher than $3.50/min full pass at this per-task fee. Lower fee per task for short clips.
                  </p>
                )}

                <div className="space-y-2 font-mono text-xs tabular-nums">
                  <div className="flex items-center gap-2">
                    <span className="w-11 text-[var(--mute)]">Full</span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--panel)] overflow-hidden">
                      <div className="h-full w-full bg-[var(--mute)]/45" />
                    </div>
                    <span className="w-12 text-right text-[var(--mute)]">$3.50</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-11 font-semibold text-[var(--ink)]">Sikio</span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--panel)] overflow-hidden">
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
                        className={`h-full sikio-bar-fill ${
                          costMetrics.isCheaperThanFull
                            ? "bg-[var(--green)]"
                            : "bg-[var(--amber)]"
                        }`}
                      />
                    </div>
                    <span
                      className={`w-12 text-right font-semibold ${
                        costMetrics.isCheaperThanFull
                          ? "text-[var(--green)]"
                          : "text-[var(--amber)]"
                      }`}
                    >
                      ${costMetrics.costPerMinuteProjected.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 hairline-t space-y-1.5 font-mono text-xs tabular-nums">
                  <div className="flex justify-between">
                    <span className="font-sans text-[var(--mute)]">AI x402</span>
                    <span>{activeJob.inferenceCostTusd8.toFixed(2)} tUSD8</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-[var(--mute)]">Human settled</span>
                    <span className="text-[var(--green)]">
                      {(costMetrics.totalSettled - activeJob.inferenceCostTusd8).toFixed(2)} tUSD8
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-[var(--mute)]">Escrowed</span>
                    <span className="text-[var(--amber)]">
                      {(costMetrics.totalProjected - costMetrics.totalSettled).toFixed(2)} tUSD8
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {lastX402 && (
            <div className="rounded-[12px] hairline bg-[var(--paper)] px-5 py-3.5 space-y-1 font-mono text-xs tabular-nums">
              <div className="flex items-center justify-between">
                <span className="type-label">x402 receipt</span>
                <span className="px-2 py-0.5 rounded-full bg-[var(--green-bg)] text-[var(--green)] text-[11px]">
                  402 · 200
                </span>
              </div>
              <div className="text-[var(--ink)]">{lastX402.amountDisplay}</div>
              <div className="text-[var(--mute)] truncate">{lastX402.requestId}</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TaskStatusPill({ status }: { status: ReviewTask["status"] }) {
  const styles: Record<ReviewTask["status"], string> = {
    offered: "bg-[var(--signal-bg)] text-[var(--signal-ink)]",
    submitted: "bg-[var(--amber-bg)] text-[var(--amber)]",
    accepted: "bg-[var(--green-bg)] text-[var(--green)]",
    rejected: "bg-[var(--red-bg)] text-[var(--red)]",
    expired: "bg-[var(--panel)] text-[var(--mute)]",
  };
  const labels: Record<ReviewTask["status"], string> = {
    offered: "Offered",
    submitted: "In review",
    accepted: "Paid once",
    rejected: "Refunded",
    expired: "Expired",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
