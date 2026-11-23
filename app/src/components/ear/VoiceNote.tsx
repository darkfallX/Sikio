"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Repeat, Snail } from "lucide-react";
import { OrganicWaveRibbon } from "@/components/OrganicWaveRibbon";
import { WaveGlyph } from "@/components/art";

export function clock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* Play triangle split in two halves that morph into the two pause bars. */
const PATHS = {
  play: ["M7.8 4.5 L13.8 8.25 L13.8 15.75 L7.8 19.5 Z", "M13.8 8.25 L19.8 12 L19.8 12 L13.8 15.75 Z"],
  pause: ["M6.5 5 L10.5 5 L10.5 19 L6.5 19 Z", "M13.5 5 L17.5 5 L17.5 19 L13.5 19 Z"],
};

export function PlayMorphButton({
  playing,
  progress,
  onClick,
  size = 56,
}: {
  playing: boolean;
  progress: number;
  onClick: () => void;
  size?: number;
}) {
  const reduce = useReducedMotion();
  const p = playing ? PATHS.pause : PATHS.play;
  const t = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 420, damping: 30 };
  return (
    <motion.button
      type="button"
      aria-label={playing ? "Pause voice note" : "Play voice note"}
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.9 }}
      whileHover={reduce ? undefined : { scale: 1.04 }}
      transition={{ type: "spring", stiffness: 500, damping: 26 }}
      className="relative shrink-0 rounded-full bg-[var(--ink)] text-[var(--bg)] border-2 border-[var(--outline)] grid place-items-center cursor-pointer"
      style={{ width: size, height: size, boxShadow: "3px 3px 0 var(--outline)" }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.42} height={size * 0.42} aria-hidden="true">
        {p.map((d, i) => (
          <motion.path
            key={i}
            initial={false}
            animate={{ d }}
            transition={t}
            fill="currentColor"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        ))}
      </svg>
      {/* Playback progress ring, drawn inside the outline */}
      <svg
        aria-hidden="true"
        viewBox="0 0 56 56"
        className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
      >
        <motion.circle
          cx="28"
          cy="28"
          r="24.5"
          fill="none"
          stroke="var(--pink)"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          animate={{ strokeDashoffset: 1 - progress, opacity: progress > 0.01 ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.12, ease: "linear" }}
        />
      </svg>
    </motion.button>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-[44px] sm:min-h-[36px] px-3.5 rounded-full border-2 text-[13px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-200 ${
        on
          ? "bg-[var(--ink)] text-[var(--bg)] border-[var(--outline)]"
          : "bg-[var(--panel)] text-[var(--ink-2)] border-transparent hover:border-[var(--outline)]"
      }`}
    >
      {children}
    </button>
  );
}

export function VoiceNote({
  taskId,
  audioUrl,
  duration,
  time,
  playing,
  focusStart,
  focusEnd,
  loop,
  slow,
  onToggle,
  onScrub,
  onLoop,
  onSlow,
}: {
  taskId: string;
  audioUrl: string;
  duration: number;
  time: number;
  playing: boolean;
  focusStart: number;
  focusEnd: number;
  loop: boolean;
  slow: boolean;
  onToggle: () => void;
  onScrub: (sec: number) => void;
  onLoop: () => void;
  onSlow: () => void;
}) {
  const progress = playing || time > 0 ? Math.min(1, time / Math.max(duration, 0.5)) : 0;
  return (
    <div className="p-3 sm:p-3.5 space-y-2.5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <PlayMorphButton playing={playing} progress={progress} onClick={onToggle} />
        <div className="min-w-0">
          <OrganicWaveRibbon
            audioUrl={audioUrl}
            seedKey={taskId}
            duration={duration}
            currentTime={time}
            playing={playing}
            spans={[{ start: focusStart, end: focusEnd, status: "flagged" }]}
            height={52}
            onScrub={onScrub}
            onTogglePlay={onToggle}
          />
        </div>
        <span className="font-mono text-[12px] font-bold tabular-nums text-[var(--mute)] w-9 text-right">
          {clock(playing || time > 0 ? time : duration)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Toggle on={loop} onClick={onLoop}>
          <Repeat className="w-3.5 h-3.5" aria-hidden="true" /> Repeat
        </Toggle>
        <Toggle on={slow} onClick={onSlow}>
          <Snail className="w-3.5 h-3.5" aria-hidden="true" /> Slower
        </Toggle>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-[var(--mute)] pr-1">
          <span className="w-3 h-3 rounded-[4px] bg-[var(--yellow)] border-2 border-[var(--outline)]" aria-hidden="true" />
          Unsure part
        </span>
      </div>
    </div>
  );
}

/* A voice note that has been answered: collapses to a small played pill. */
export function PlayedNote({ seed, duration }: { seed: number; duration: number }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <span className="w-7 h-7 rounded-full bg-[var(--panel)] grid place-items-center shrink-0" aria-hidden="true">
        <Check className="w-3.5 h-3.5" />
      </span>
      <WaveGlyph seed={seed} className="w-24 h-5 text-[var(--mute)]" progress={1} />
      <span className="font-mono text-[12px] font-bold tabular-nums text-[var(--mute)]">{clock(duration)}</span>
    </div>
  );
}
