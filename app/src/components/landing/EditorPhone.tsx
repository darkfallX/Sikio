"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Play } from "lucide-react";
import { Blob, Coin, Sparkle, WaveGlyph } from "@/components/art";

/* The editor's side, drawn in markup: a 3 second clip, one word to type, one payment. */
export function EditorPhone() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden="true" className="relative mx-auto grid h-[500px] w-full max-w-[480px] place-items-center sm:h-[540px]">
      <Blob
        color="var(--peach)"
        className="absolute h-[380px] w-[380px] sm:h-[440px] sm:w-[440px]"
        style={{ borderRadius: "58% 42% 40% 60% / 52% 58% 42% 48%" }}
      />
      <Sparkle size={30} color="var(--yellow)" className="absolute left-[8%] top-[12%] sikio-float" />
      <Sparkle size={20} color="var(--pink)" className="absolute right-[10%] bottom-[16%] sikio-float" style={{ animationDelay: "-3s" }} />

      <motion.div
        initial={{ opacity: 0, y: 40, rotate: 6 }}
        whileInView={{ opacity: 1, y: 0, rotate: 3 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative w-[262px] rounded-[40px] border-2 border-[var(--outline)] bg-[var(--paper)] p-2.5 shadow-[6px_6px_0_var(--outline)] sm:w-[286px]"
      >
        <div className="overflow-hidden rounded-[30px] border-2 border-[var(--outline)] bg-[var(--panel)]">
          <div className="flex justify-center pt-2">
            <span className="h-[6px] w-16 rounded-full bg-[var(--outline)]" />
          </div>
          <div className="px-4 pb-5 pt-4">
            <p className="font-mono text-[11px] font-bold text-[var(--mute)]">1 word for you</p>
            <p className="mt-1 text-[19px] font-bold leading-tight text-[var(--ink)]">What did they say?</p>

            <div className="mt-4 rounded-[18px] border-2 border-[var(--outline)] bg-[var(--paper)] p-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[var(--bg)]">
                  <Play className="ml-0.5 h-4 w-4" fill="currentColor" strokeWidth={0} />
                </span>
                <WaveGlyph seed={5.2} progress={0.62} className="h-8 min-w-0 flex-1 text-[var(--ink)]" />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10.5px] text-[var(--mute)]">
                <span>0:02</span>
                <span>0:03</span>
              </div>
            </div>

            <p className="mt-4 text-[13px] text-[var(--ink-2)]">
              The AI heard{" "}
              <span className="rounded-[6px] border-2 border-[#111] bg-[var(--yellow)] px-1 font-bold text-[#111]">
                wall holler
              </span>
            </p>

            <div className="mt-2.5 flex h-12 items-center rounded-[14px] border-2 border-[var(--outline)] bg-[var(--bg)] px-3.5 text-[16px] font-bold text-[var(--ink)]">
              wahala
              <motion.span
                animate={reduce ? undefined : { opacity: [1, 1, 0, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, times: [0, 0.5, 0.55, 1], ease: "linear" }}
                className="ml-0.5 inline-block h-5 w-[2px] bg-[var(--ink)]"
              />
            </div>

            <div className="mt-3 flex h-12 items-center justify-center gap-2 rounded-full border-2 border-[#111] bg-[var(--mint)] text-[15px] font-bold text-[#111] shadow-[3px_3px_0_#111]">
              <Check className="h-4 w-4" strokeWidth={3} />
              Send the word
            </div>
            <p className="mt-3 text-center font-mono text-[11px] text-[var(--mute)]">$0.10 when approved</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ scale: 0, rotate: -40 }}
        whileInView={{ scale: 1, rotate: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 320, damping: 12, delay: 0.35 }}
        className="absolute right-[4%] top-[14%] sm:right-[6%]"
      >
        <div className="sikio-float" style={{ ["--rot" as string]: "-10deg" }}>
          <Coin size={78} />
        </div>
      </motion.div>
    </div>
  );
}
