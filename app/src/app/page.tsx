"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Upload, ArrowRight, Play, RefreshCw } from "lucide-react";
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
      setError("Could not reach Sikio backend.");
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

  const runSikioAgent = async () => {
    setError(null);
    setNotice(null);
    setRunning(true);
    try {
      const isCustom = selectedClipId === "custom-upload";
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
          customTitle: isCustom ? customFileName || "Uploaded clip" : undefined,
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
      if (json.job?.id) setActiveJobId(json.job.id);
      setNotice(
        `x402 paid 0.04 tUSD8. Flagged ${json.createdTasks.length} spans and locked ${(
          json.createdTasks.length * feePerTask
        ).toFixed(2)} tUSD8.`
      );
    } catch {
      setError("Network error while running agent.");
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
        <div className="h-16 w-3/4 rounded-[14px] bg-[var(--panel)] animate-pulse" />
        <div className="h-80 w-full rounded-[14px] bg-[var(--panel)] animate-pulse" />
      </div>
    );
  }

  const pendingSubmitCount = data.tasks.filter((t) => t.status === "offered").length;
  const pendingApproveCount = data.tasks.filter((t) => t.status === "submitted").length;

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* First viewport: tight display type + single control strip */}
      <section className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <h1 className="type-display text-[var(--ink)]">
              AI captions for African voices.
            </h1>
            <p className="text-[17px] text-[var(--ink-2)] max-w-xl">
              When ASR hesitates, Sikio hires a native ear for those seconds and pays once in tUSD8 on Aevum.
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

        {/* Shared-border intake strip */}
        <div className="rounded-[14px] hairline bg-[var(--paper)] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[var(--line)]">
            <div className="lg:col-span-5 p-4 sm:p-5 space-y-2.5">
              <div className="type-label">Clip</div>
              <div className="flex flex-wrap gap-1.5">
                {data.showcaseClips.map((c) => {
                  const active = selectedClipId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedClipId(c.id)}
                      className={`min-h-[44px] sm:min-h-[36px] px-3 rounded-[8px] text-xs font-medium hairline transition-colors cursor-pointer ${
                        active
                          ? "bg-[var(--ink)] text-[var(--paper)]"
                          : "bg-[var(--bg)] text-[var(--ink)] hover:bg-[var(--hover)]"
                      }`}
                    >
                      {c.city} · <span className="font-mono">{c.languageTag}</span>
                    </button>
                  );
                })}
                <label
                  className={`min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-[8px] text-xs font-medium hairline cursor-pointer transition-colors ${
                    selectedClipId === "custom-upload"
                      ? "bg-[var(--ink)] text-[var(--paper)]"
                      : "bg-[var(--paper)] text-[var(--mute)] hover:text-[var(--ink)]"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {customFileName ? customFileName.slice(0, 14) : "Upload"}
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            <div className="lg:col-span-3 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="conf-slider" className="type-label">
                  Confidence floor
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

            <div className="lg:col-span-2 p-4 sm:p-5 space-y-2">
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

            <div className="lg:col-span-2 p-4 sm:p-5 flex items-end">
              <button
                type="button"
                disabled={running}
                onClick={runSikioAgent}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-[8px] text-sm font-semibold bg-[var(--signal)] text-[#faf8f2] hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {running ? "Running…" : "Run agent"}
              </button>
            </div>
          </div>

          {selectedClipId === "custom-upload" && (
            <div className="p-4 sm:p-5 hairline-t bg-[var(--bg)]/50">
              <label htmlFor="custom-script" className="block type-label mb-2">
                Optional transcript ({customDuration}s audio)
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
              className="px-5 py-3 hairline-t bg-[var(--green-bg)] text-xs font-medium text-[var(--green)] flex flex-wrap items-center justify-between gap-2"
            >
              <span>{notice}</span>
              <Link
                href="/ear"
                className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
              >
                Open Ear <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Hero workspace + Budget ledger */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        <div className="lg:col-span-8 space-y-7">
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
              <div className="rounded-[14px] hairline bg-[var(--paper)] overflow-hidden">
                <div className="px-5 py-3.5 hairline-b flex flex-wrap items-center justify-between gap-2">
                  <h2 className="type-label">
                    Escrowed tasks ({activeJobTasks.length})
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
                        className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm hover:bg-[var(--hover)] transition-colors"
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
            /* Pre-run hero object: hardware audition monitor */
            <div className="rounded-[14px] hairline bg-[var(--paper)] hero-elevation overflow-hidden">
              <div className="bg-[var(--body)] text-[#eeeadf] p-6 sm:p-7 space-y-6">
                <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-[#9b9586]">
                  <span>Sample ASR errors</span>
                  <span>x402 · 0.04 tUSD8</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10 border border-white/10 rounded-[10px]">
                  {(CLIP_SAMPLE_ERRORS[selectedClipId] ||
                    CLIP_SAMPLE_ERRORS["lagos-fintech-ep14"]
                  ).map(([wrong, right]) => (
                    <div key={wrong} className="p-4 space-y-1">
                      <div className="text-sm text-[#f3b6a0] line-through">
                        {wrong}
                      </div>
                      <div className="text-base font-semibold text-[#8ee3b8]">
                        {right}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--line)]">
                {data.showcaseClips.map((c, idx) => {
                  const active = selectedClipId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedClipId(c.id)}
                      className={`text-left p-5 transition-colors cursor-pointer ${
                        active
                          ? "bg-[var(--panel)]"
                          : "bg-[var(--paper)] hover:bg-[var(--hover)]"
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[11px] text-[var(--mute)]">
                        <span>0{idx + 1}</span>
                        <span className={active ? "text-[var(--signal-ink)] font-semibold" : ""}>
                          {c.languageTag}
                        </span>
                      </div>
                      <div className="text-[15px] font-semibold text-[var(--ink)] mt-2">
                        {c.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right rail: budget + cost comparison */}
        <div className="lg:col-span-4 space-y-7">
          <BudgetRail
            batch={data.batch}
            availableBudgetTusd8={data.availableBudgetTusd8}
            busy={policyBusy}
            onUpdatePolicy={handleUpdatePolicy}
          />

          {activeJob && costMetrics && (
            <div className="rounded-[14px] hairline bg-[var(--paper)] overflow-hidden">
              <div className="px-5 py-3.5 hairline-b flex items-center justify-between">
                <span className="type-label">Cost per minute</span>
                <span className="px-2 py-0.5 rounded-full font-mono text-[11px] bg-[var(--green-bg)] text-[var(--green)] tabular-nums">
                  -{costMetrics.reviewTimeSavedPct}% time
                </span>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="font-mono text-3xl font-semibold text-[var(--ink)]">
                    ${costMetrics.costPerMinuteProjected.toFixed(2)}
                  </span>
                  <span className="font-mono text-xs text-[var(--mute)]">
                    vs ${costMetrics.fullHumanReviewCostPerMin.toFixed(2)} full
                  </span>
                </div>

                <div className="space-y-2 font-mono text-xs tabular-nums">
                  <div className="flex items-center gap-2">
                    <span className="w-11 text-[var(--mute)]">Full</span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--panel)] overflow-hidden">
                      <div className="h-full w-full bg-[var(--mute)]/50" />
                    </div>
                    <span className="w-11 text-right text-[var(--mute)]">$3.50</span>
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
                        className="h-full bg-[var(--green)]"
                      />
                    </div>
                    <span className="w-11 text-right font-semibold text-[var(--green)]">
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
            <div className="rounded-[14px] hairline bg-[var(--paper)] px-5 py-4 space-y-1.5 font-mono text-xs tabular-nums">
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
