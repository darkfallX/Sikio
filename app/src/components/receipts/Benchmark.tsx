"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Plus, X } from "lucide-react";
import { BenchmarkRun } from "@/lib/types";
import { Button, CountUp, Tag } from "@/components/ui";
import { SPRING } from "@/components/motion-kit";

export interface BenchForm {
  clipTitle: string;
  dialect: string;
  clipDurationSec: number;
  fullReviewSec: number;
  targetedReviewSec: number;
  fullReviewErrorsLeft: number;
  targetedReviewErrorsLeft: number;
  overconfidentAiMisses: number;
  fullReviewCostUsd: number;
  targetedCostUsd: number;
}

export const DEFAULT_BENCH_FORM: BenchForm = {
  clipTitle: "",
  dialect: "Nigerian English / Pidgin",
  clipDurationSec: 120,
  fullReviewSec: 300,
  targetedReviewSec: 75,
  fullReviewErrorsLeft: 1,
  targetedReviewErrorsLeft: 1,
  overconfidentAiMisses: 1,
  fullReviewCostUsd: 7.0,
  targetedCostUsd: 1.04,
};

/* A/B review benchmark: full listen-through vs Sikio's targeted seconds. */
export function Benchmark({
  runs,
  onSave,
}: {
  runs: BenchmarkRun[];
  onSave: (form: BenchForm) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BenchForm>(DEFAULT_BENCH_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const totalFull = runs.reduce((a, b) => a + b.fullReviewSec, 0);
  const totalTargeted = runs.reduce((a, b) => a + b.targetedReviewSec, 0);
  const avgSaved = totalFull > 0 ? Math.round((1 - totalTargeted / totalFull) * 100) : 0;
  const totalMisses = runs.reduce((a, b) => a + b.overconfidentAiMisses, 0);
  const allPilot = runs.length > 0 && runs.every((r) => r.source === "measured-pilot");
  const saved = avgSaved > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const err = await onSave(form);
    setSaving(false);
    if (err) {
      setFormError(err);
      return;
    }
    setForm((f) => ({ ...f, clipTitle: "" }));
    setOpen(false);
  };

  const num = (key: keyof BenchForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: Number(e.target.value) }));

  return (
    <section aria-labelledby="bench-h" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 id="bench-h" className="type-section">
            A/B review benchmark
          </h2>
          <p className="text-[15px] text-[var(--ink-2)]">
            Listening to the whole clip vs only the seconds Sikio flags.
          </p>
        </div>
        <Button variant={open ? "secondary" : "primary"} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {open ? "Close" : "Log run"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.1fr] gap-3 sm:gap-5">
        <div className={`brut p-5 sm:p-6 grid gap-1 ${saved ? "pastel-mint" : "bg-[var(--paper)]"}`}>
          <span className={`font-mono text-[12.5px] font-bold ${saved ? "text-[#111]/70" : "text-[var(--mute)]"}`}>
            Review time saved
          </span>
          {saved ? (
            <CountUp
              value={avgSaved}
              decimals={0}
              suffix="%"
              className="font-mono font-bold text-[40px] sm:text-[48px] leading-none tracking-[-0.06em]"
            />
          ) : (
            <span className="font-mono font-bold text-[28px] leading-tight tracking-[-0.05em]">No time saved</span>
          )}
          <span className={`text-[13px] ${saved ? "text-[#111]/70" : "text-[var(--mute)]"}`}>
            across {runs.length} {runs.length === 1 ? "clip" : "clips"}
          </span>
        </div>
        <div className="brut pastel-peach p-5 sm:p-6 grid gap-1">
          <span className="font-mono text-[12.5px] font-bold text-[#111]/70">Misses the AI was sure about</span>
          <CountUp
            value={totalMisses}
            decimals={0}
            className="font-mono font-bold text-[40px] sm:text-[48px] leading-none tracking-[-0.06em]"
          />
          <span className="text-[13px] text-[#111]/70">Wrong words scored above 78%</span>
        </div>
        <div className="sm:col-span-2 lg:col-span-1 rounded-[var(--r)] border-2 border-dashed border-[var(--line)] p-5 sm:p-6 grid gap-2 content-center">
          <Tag tone="yellow">{allPilot ? "Pilot data" : "Pilot plus logged runs"}</Tag>
          <p className="text-[14px] text-[var(--ink-2)] leading-snug">
            Measured on short pilot cuts. Full production runs wait for partner studio clips. Runs you log are marked as yours.
          </p>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            key="form"
            onSubmit={submit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING.soft}
            className="overflow-hidden"
          >
            <div className="brut pastel-lilac p-5 sm:p-6 grid gap-4 m-1 mb-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Clip title">
                  <input
                    required
                    placeholder="Market interview, Kumasi"
                    value={form.clipTitle}
                    onChange={(e) => setForm((f) => ({ ...f, clipTitle: e.target.value }))}
                    className={INPUT}
                  />
                </Field>
                <Field label="Dialect">
                  <input
                    required
                    value={form.dialect}
                    onChange={(e) => setForm((f) => ({ ...f, dialect: e.target.value }))}
                    className={INPUT}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Full review, sec">
                  <input type="number" min={10} inputMode="numeric" value={form.fullReviewSec} onChange={num("fullReviewSec")} className={`${INPUT} font-mono tabular-nums`} />
                </Field>
                <Field label="With Sikio, sec">
                  <input type="number" min={5} inputMode="numeric" value={form.targetedReviewSec} onChange={num("targetedReviewSec")} className={`${INPUT} font-mono tabular-nums`} />
                </Field>
                <Field label="AI misses" className="col-span-2 sm:col-span-1">
                  <input type="number" min={0} inputMode="numeric" value={form.overconfidentAiMisses} onChange={num("overconfidentAiMisses")} className={`${INPUT} font-mono tabular-nums`} />
                </Field>
              </div>
              {formError && (
                <p role="alert" className="text-[14px] font-semibold text-[#b3261e]">
                  {formError}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" variant="dark" disabled={saving} className="w-full sm:w-auto">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save run
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {runs.length === 0 ? (
        <p className="rounded-[var(--r)] border-2 border-dashed border-[var(--line)] px-6 py-8 text-center text-[15px] text-[var(--mute)]">
          No runs yet. Log one to compare review times.
        </p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
          <AnimatePresence initial={false}>
            {runs.map((b, i) => (
              <RunCard key={b.id} run={b} index={i} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

const INPUT =
  "w-full min-h-[48px] px-4 rounded-[14px] border-2 border-[#111] bg-white text-[#111] text-[15px] placeholder:text-[#111]/40 focus:outline-none focus:shadow-[3px_3px_0_#111] transition-shadow";

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="font-mono text-[12.5px] font-bold text-[#111]/75">{label}</span>
      {children}
    </label>
  );
}

function RunCard({ run: b, index }: { run: BenchmarkRun; index: number }) {
  const pct = Math.min(100, Math.max(4, Math.round((b.targetedReviewSec / Math.max(b.fullReviewSec, 1)) * 100)));
  const cheaper = b.targetedCostUsd < b.fullReviewCostUsd;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ ...SPRING.soft, delay: Math.min(index, 6) * 0.05 }}
      className="brut-sm min-w-0 bg-[var(--paper)] p-5 grid gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold text-[15.5px] leading-snug">{b.clipTitle}</div>
          <div className="text-[13px] text-[var(--mute)]">{b.dialect}</div>
        </div>
        <Tag tone={b.source === "measured-pilot" ? "yellow" : "lilac"} className="shrink-0">
          {b.source === "measured-pilot" ? "Pilot" : "Logged by you"}
        </Tag>
      </div>

      <div className="grid gap-2.5">
        <Bar label="Full review" seconds={b.fullReviewSec} pct={100} fill="var(--returned-bg)" delay={0} />
        <Bar label="With Sikio" seconds={b.targetedReviewSec} pct={pct} fill="var(--mint)" delay={0.15} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[12.5px] text-[var(--mute)] tabular-nums">
        <span>
          Errors left {b.fullReviewErrorsLeft} vs {b.targetedReviewErrorsLeft}
        </span>
        <span className="text-[var(--warn)] font-bold">
          {b.overconfidentAiMisses} AI {b.overconfidentAiMisses === 1 ? "miss" : "misses"}
        </span>
        <span>
          {cheaper && <span className="line-through mr-1.5">${b.fullReviewCostUsd.toFixed(2)}</span>}
          <span className="font-bold text-[var(--ink)]">${b.targetedCostUsd.toFixed(2)}</span>
        </span>
      </div>
    </motion.li>
  );
}

function Bar({
  label,
  seconds,
  pct,
  fill,
  delay,
}: {
  label: string;
  seconds: number;
  pct: number;
  fill: string;
  delay: number;
}) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)_52px] items-center gap-3">
      <span className="text-[13px] font-bold">{label}</span>
      <div className="h-5 rounded-full border-2 border-[var(--outline)] bg-[var(--panel)] overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${pct < 100 ? "border-r-2 border-[var(--outline)]" : ""}`}
          style={{ background: fill }}
          initial={{ width: "0%" }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay }}
        />
      </div>
      <span className="font-mono text-[13px] font-bold tabular-nums text-right">{seconds}s</span>
    </div>
  );
}
