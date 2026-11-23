"use client";

import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Check, CircleAlert } from "lucide-react";

export function Composer({
  aiGuess,
  fee,
  draft,
  onDraft,
  onSend,
  busy,
  ready,
  error,
}: {
  aiGuess: string;
  fee: number;
  draft: string;
  onDraft: (v: string) => void;
  onSend: (confirmedAiRight: boolean) => void;
  busy: boolean;
  ready: boolean;
  error: string | null;
}) {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  const disabled = busy || !ready;

  const fire = (confirmed: boolean) => {
    if (disabled) return;
    setTick((t) => t + 1);
    onSend(confirmed);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        fire(false);
      }}
      className="sticky bottom-0 z-10 bg-[var(--paper)] border-t-2 border-[var(--outline)] px-3 sm:px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] space-y-2.5"
    >
      <div className="flex justify-end">
        <motion.button
          type="button"
          disabled={disabled}
          onClick={() => fire(true)}
          whileTap={reduce || disabled ? undefined : { scale: 0.95 }}
          className="max-w-full min-h-[44px] sm:min-h-[40px] px-4 rounded-full border-2 border-[var(--outline)] bg-[var(--paper)] text-[var(--ink)] text-[14px] font-bold inline-flex items-center gap-1.5 cursor-pointer hover:bg-[var(--panel)] transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">&ldquo;{aiGuess}&rdquo; is right</span>
        </motion.button>
      </div>

      <div className="flex items-center gap-2.5">
        <label htmlFor="ear-fix-input" className="sr-only">
          Type the word you heard
        </label>
        <input
          id="ear-fix-input"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          disabled={!ready}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          placeholder="Type the word you heard"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "ear-send-error" : undefined}
          className="flex-1 min-w-0 min-h-[52px] px-5 rounded-full border-2 border-[var(--outline)] bg-[var(--bg)] text-[var(--ink)] text-[16px] font-medium placeholder:text-[var(--mute)] outline-none focus-visible:outline-none focus:bg-[var(--paper)] focus:shadow-[3px_3px_0_var(--outline)] transition-[background-color,box-shadow] duration-200 disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label={`Send answer, pays $${fee.toFixed(2)}`}
          disabled={disabled}
          className="relative w-[52px] h-[52px] shrink-0 rounded-full border-2 border-[var(--outline)] bg-[var(--cta-bg)] text-[var(--cta-ink)] grid place-items-center cursor-pointer overflow-hidden press shadow-[3px_3px_0_var(--outline)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <AnimatePresence initial={false}>
            <motion.span
              key={tick}
              className="absolute inset-0 grid place-items-center"
              initial={reduce ? { opacity: 0 } : { y: 22, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { y: -30, opacity: 0, transition: { duration: 0.22, ease: [0.5, 0, 0.75, 0] } }}
              transition={{ type: "spring", stiffness: 420, damping: 26, delay: reduce ? 0 : 0.12 }}
            >
              <ArrowUp className="w-6 h-6" strokeWidth={2.6} aria-hidden="true" />
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            key="err"
            id="ear-send-error"
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduce ? 0 : 0.22 }}
            className="overflow-hidden"
          >
            <span className="flex items-start gap-2 rounded-[14px] bg-[var(--error-bg)] text-[var(--error)] px-3 py-2 text-[13px] font-semibold">
              <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              {error}
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}
