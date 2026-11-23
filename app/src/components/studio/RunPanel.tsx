"use client";

import React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Loader2, Minus, Play, Plus, Upload } from "lucide-react";
import { Button } from "../ui";
import { SPRING } from "../motion-kit";
import { Banner } from "./Banner";

export interface ShowcaseClipOption {
  id: string;
  title: string;
  shortLabel?: string;
  sourceLabel: string;
  languageTag: string;
  city: string;
  audioUrl: string;
  recommendedEditorCity: string;
}

export const PIPELINE_STEPS = [
  "Ask for the transcript",
  "Pay 0.04 tUSD8 over x402",
  "Find the unsure words",
  "Hold fees for native speakers",
];

interface RunPanelProps {
  clips: ShowcaseClipOption[];
  selectedClipId: string;
  onSelectClip: (id: string) => void;
  uploading: boolean;
  customFileName: string | null;
  customDuration: number;
  customTranscript: string;
  onCustomTranscript: (v: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  threshold: number;
  onThreshold: (v: number) => void;
  fee: number;
  onFee: (v: number) => void;
  maxFee: number;
  running: boolean;
  /** -1 hidden, 0..3 active step, 4 all done */
  pipelineStep: number;
  agentStopped: boolean;
  policyBusy: boolean;
  onRun: () => void;
  onRestartAgent: () => void;
  error: string | null;
  notice: string | null;
  onDismissError: () => void;
  onDismissNotice: () => void;
}

const CHIP =
  "min-h-[44px] px-4 inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--outline)] text-[14px] font-bold whitespace-nowrap cursor-pointer transition-[background-color,color,transform] duration-150 active:translate-y-[1px]";

export function RunPanel(p: RunPanelProps) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const stepFee = (dir: 1 | -1) =>
    p.onFee(round2(Math.min(p.maxFee, Math.max(0.05, p.fee + dir * 0.05))));
  const customOn = p.selectedClipId === "custom-upload";
  // Text draft so typing "0." is not fought by the formatter; committed values show as 0.10
  const [feeDraft, setFeeDraft] = React.useState<string | null>(null);

  return (
    <section
      aria-labelledby="run-heading"
      className="brut pastel-lilac p-5 sm:p-6 flex flex-col gap-5 h-full"
    >
      <h2 id="run-heading" className="type-section">
        Run the agent
      </h2>

      {/* Clip */}
      <div className="space-y-2">
        <span className="type-label !text-[var(--on-pastel)] opacity-70">Clip</span>
        <div className="flex flex-wrap gap-2">
          {p.clips.map((c) => {
            const on = p.selectedClipId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => p.onSelectClip(c.id)}
                className={`${CHIP} ${
                  on ? "bg-[#111] text-white" : "bg-white text-[#111] hover:bg-[#fff7fc]"
                }`}
              >
                {on && <Check className="w-4 h-4" aria-hidden="true" />}
                {c.shortLabel || c.city}
              </button>
            );
          })}
          <label
            className={`${CHIP} border-dashed focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[#111] ${
              customOn ? "bg-[#111] text-white" : "bg-white/60 text-[#111] hover:bg-white"
            }`}
          >
            {p.uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="w-4 h-4" aria-hidden="true" />
            )}
            {p.uploading
              ? "Uploading"
              : p.customFileName
              ? p.customFileName.length > 16
                ? `${p.customFileName.slice(0, 14)}…`
                : p.customFileName
              : "Your audio"}
            <input
              type="file"
              accept="audio/*,video/*"
              disabled={p.uploading}
              onChange={p.onUpload}
              className="sr-only"
            />
          </label>
        </div>

        <AnimatePresence initial={false}>
          {customOn && (
            <motion.div
              key="custom"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <label htmlFor="custom-script" className="block pt-2 text-[13px] font-medium">
                Rough transcript, optional ({p.customDuration}s)
              </label>
              <input
                id="custom-script"
                type="text"
                value={p.customTranscript}
                onChange={(e) => p.onCustomTranscript(e.target.value)}
                placeholder="Leave empty for the Sikio local ASR engine"
                className="mt-1.5 w-full min-h-[44px] px-3.5 rounded-[var(--r-sm)] border-2 border-[#111] bg-white text-[#111] text-[15px] placeholder:text-[#6b6b6b]"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Threshold */}
      <div className="space-y-1">
        <div className="flex items-end justify-between gap-3">
          <label htmlFor="conf-slider" className="text-[14px] font-medium leading-snug max-w-[24ch]">
            Ask a human when the AI is below
          </label>
          <span className="font-mono text-[26px] font-bold leading-none tabular-nums tracking-[-0.04em]">
            {Math.round(p.threshold * 100)}%
          </span>
        </div>
        <input
          id="conf-slider"
          type="range"
          min={0.5}
          max={0.9}
          step={0.02}
          value={p.threshold}
          onChange={(e) => p.onThreshold(Number(e.target.value))}
          className="w-full !h-11"
        />
      </div>

      {/* Fee */}
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="fee-input" className="text-[14px] font-medium">
          Pay per word
        </label>
        <div className="inline-flex items-center rounded-full border-2 border-[#111] bg-white text-[#111]">
          <button
            type="button"
            aria-label="Lower the fee"
            onClick={() => stepFee(-1)}
            disabled={p.fee <= 0.05}
            className="w-11 h-11 grid place-items-center rounded-full cursor-pointer hover:bg-black/5 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            id="fee-input"
            type="text"
            inputMode="decimal"
            aria-describedby="fee-unit"
            value={feeDraft ?? p.fee.toFixed(2)}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, "");
              setFeeDraft(v);
              const n = Number(v);
              if (v !== "" && Number.isFinite(n) && n > 0) p.onFee(round2(n));
            }}
            onBlur={() => setFeeDraft(null)}
            className="w-[4.6ch] h-11 bg-transparent text-center font-mono text-[15px] font-bold tabular-nums focus-visible:outline-none"
          />
          <span id="fee-unit" className="sr-only">
            tUSD8 per word
          </span>
          <button
            type="button"
            aria-label="Raise the fee"
            onClick={() => stepFee(1)}
            disabled={p.fee >= p.maxFee}
            className="w-11 h-11 grid place-items-center rounded-full cursor-pointer hover:bg-black/5 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-auto space-y-3">
        <AnimatePresence initial={false}>
          {p.agentStopped && (
            <Banner
              key="stopped"
              tone="warn"
              action={
                <button
                  type="button"
                  disabled={p.policyBusy}
                  onClick={p.onRestartAgent}
                  className="min-h-[36px] px-3 rounded-full border-2 border-[#111] bg-white font-bold text-[13px] cursor-pointer disabled:opacity-50"
                >
                  Restart
                </button>
              }
            >
              The agent is stopped.
            </Banner>
          )}
        </AnimatePresence>

        <Button
          variant="primary"
          size="lg"
          disabled={p.running || p.uploading || p.agentStopped}
          onClick={p.onRun}
          className="w-full"
        >
          {p.running ? (
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="w-5 h-5 fill-current" aria-hidden="true" />
          )}
          {p.running ? "Running" : "Run agent"}
        </Button>

        <AnimatePresence initial={false}>
          {p.pipelineStep >= 0 && (
            <motion.ol
              key="pipeline"
              aria-live="polite"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden space-y-2"
            >
              {PIPELINE_STEPS.map((label, i) => {
                const done = i < p.pipelineStep;
                const active = i === p.pipelineStep;
                return (
                  <li key={label} className="flex items-center gap-2.5 text-[14px] first:pt-1">
                    <span className="relative w-7 h-7 shrink-0">
                      <span className="absolute inset-0 rounded-full border-2 border-[#111] bg-white" />
                      <AnimatePresence>
                        {done && (
                          <motion.span
                            key="done"
                            initial={{ scale: 0, rotate: -40 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={SPRING.bouncy}
                            className="absolute inset-0 rounded-full border-2 border-[#111] bg-[var(--mint)] grid place-items-center"
                          >
                            <Check className="w-4 h-4 text-[#111]" strokeWidth={3} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {active && (
                        <motion.span
                          aria-hidden="true"
                          className="absolute inset-[7px] rounded-full bg-[#111]"
                          animate={{ scale: [0.7, 1, 0.7] }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}
                    </span>
                    <span className={done || active ? "font-bold" : "opacity-60"}>{label}</span>
                  </li>
                );
              })}
            </motion.ol>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false} mode="popLayout">
          {p.error && (
            <Banner key="error" tone="error" onClose={p.onDismissError}>
              {p.error}
            </Banner>
          )}
          {p.notice && !p.error && (
            <Banner
              key="notice"
              tone="ok"
              onClose={p.onDismissNotice}
              action={
                <Link
                  href="/ear"
                  className="min-h-[36px] inline-flex items-center gap-1 font-bold underline underline-offset-2"
                >
                  Open Ear <ArrowRight className="w-4 h-4" />
                </Link>
              }
            >
              {p.notice}
            </Banner>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
