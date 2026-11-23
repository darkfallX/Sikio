"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { CaptionJob, ReviewTask } from "@/lib/types";
import { buildSubtitleCues } from "@/lib/captions";
import { OrganicWaveRibbon, WaveSpan } from "./OrganicWaveRibbon";
import { CaptionTimeline } from "./CaptionTimeline";
import { SPRING } from "./motion-kit";
import { formatClock, segmentWords, WORD_PILL } from "./studio/wordStates";

export interface SeekRequest {
  time: number;
  /** Changes on every request so tapping the same word twice still seeks */
  nonce: number;
}

interface WaveformPlayerProps {
  job: CaptionJob;
  tasks: ReviewTask[];
  seekRequest?: SeekRequest | null;
  onTimeChange?: (t: number) => void;
}

const ICON_BTN =
  "w-11 h-11 shrink-0 inline-flex items-center justify-center brut-sm press !rounded-full bg-[var(--paper)] text-[var(--ink)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

/*
  The listening card: play, see the voice, read the live caption.
  Word pills use the lane colours. The full transcript folds out below.
*/
export function WaveformPlayer({ job, tasks, seekRequest, onTimeChange }: WaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(job.durationSeconds || 15);
  const [playbackRate, setPlaybackRate] = useState<0.8 | 1>(1);
  const [compareRawAi, setCompareRawAi] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const hasHumanFixes = useMemo(() => job.words.some((w) => w.fixedByHuman), [job.words]);
  const raw = compareRawAi && hasHumanFixes;

  const taskById = useMemo(() => {
    const map = new Map<string, ReviewTask>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

  // Reset only when the clip changes (never when the speed toggles)
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(job.durationSeconds || 15);
    setAudioError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [job.id, job.audioUrl, job.durationSeconds]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // Throttled playhead sync (~15fps) keeps the caption smooth without flooding React
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let lastSync = 0;
    const sync = (now: number) => {
      if (now - lastSync >= 66) {
        lastSync = now;
        const el = audioRef.current;
        if (el) {
          setCurrentTime(el.currentTime);
          onTimeChange?.(el.currentTime);
        }
      }
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [playing, onTimeChange]);

  useEffect(() => {
    if (!seekRequest || !audioRef.current) return;
    const t = Math.max(0, seekRequest.time);
    audioRef.current.currentTime = t;
    setCurrentTime(t);
    onTimeChange?.(t);
    audioRef.current
      .play()
      .then(() => setPlaying(true))
      .catch(() => {});
  }, [seekRequest, onTimeChange]);

  const waveSpans: WaveSpan[] = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "rejected" && t.status !== "expired")
        .map((t) => ({
          start: t.focusStart,
          end: t.focusEnd,
          status:
            t.status === "accepted" ? "accepted" : t.status === "submitted" ? "submitted" : "flagged",
        })),
    [tasks]
  );

  const cues = useMemo(() => buildSubtitleCues(job.words), [job.words]);

  // Hold the latest cue that has started, so the line never blinks empty between phrases
  const activeCue = useMemo(() => {
    if (cues.length === 0) return null;
    let found = cues[0];
    for (const c of cues) {
      if (c.start - 0.15 <= currentTime) found = c;
      else break;
    }
    return found;
  }, [cues, currentTime]);

  const lineSegments = useMemo(() => {
    if (!activeCue) return [];
    const inCue = job.words.filter(
      (w) => w.start >= activeCue.start - 0.05 && w.end <= activeCue.end + 0.05
    );
    return segmentWords(inCue, taskById, raw, job.confidenceThreshold);
  }, [activeCue, job.words, taskById, raw, job.confidenceThreshold]);

  const sortedTasks = useMemo(
    () =>
      [...tasks]
        .filter((t) => t.status !== "rejected" && t.status !== "expired")
        .sort((a, b) => a.focusStart - b.focusStart),
    [tasks]
  );

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.playbackRate = playbackRate;
      el.play()
        .then(() => {
          setPlaying(true);
          setAudioError(null);
        })
        .catch(() => setAudioError("Tap play again to start the audio."));
    }
  };

  const seekAndPlay = (t: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, t);
    setCurrentTime(el.currentTime);
    onTimeChange?.(el.currentTime);
    el.play()
      .then(() => setPlaying(true))
      .catch(() => {});
  };

  const jumpToFlag = (direction: -1 | 1) => {
    if (sortedTasks.length === 0) return;
    const target =
      direction === 1
        ? sortedTasks.find((t) => t.focusStart > currentTime + 0.3) || sortedTasks[0]
        : [...sortedTasks].reverse().find((t) => t.focusStart < currentTime - 0.5) ||
          sortedTasks[sortedTasks.length - 1];
    if (target) seekAndPlay(target.start);
  };

  const handleScrub = (targetSec: number) => {
    if (audioRef.current) audioRef.current.currentTime = targetSec;
    setCurrentTime(targetSec);
    onTimeChange?.(targetSec);
  };

  const started = playing || currentTime > 0;

  return (
    <div className="brut bg-[var(--paper)] text-[var(--ink)] p-4 sm:p-7 space-y-5 sm:space-y-7">
      <audio
        ref={audioRef}
        src={job.audioUrl}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          if (playing) return;
          const t = e.currentTarget.currentTime;
          setCurrentTime(t);
          onTimeChange?.(t);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setAudioError("The audio for this clip did not load.")}
      />

      {/* Play, voice, time */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-5">
        <motion.button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          whileTap={{ scale: 0.9 }}
          transition={SPRING.snappy}
          className="w-14 h-14 rounded-full bg-[var(--ink)] text-[var(--bg)] grid place-items-center cursor-pointer border-2 border-[var(--outline)] shadow-[3px_3px_0_var(--outline)]"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={playing ? "pause" : "play"}
              initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.4, opacity: 0, rotate: 30 }}
              transition={SPRING.snappy}
              className="grid place-items-center"
            >
              {playing ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </motion.span>
          </AnimatePresence>
        </motion.button>

        <OrganicWaveRibbon
          audioUrl={job.audioUrl}
          seedKey={job.clipId}
          duration={duration}
          currentTime={currentTime}
          playing={playing}
          spans={raw ? waveSpans.map((s) => ({ ...s, status: "flagged" as const })) : waveSpans}
          height={64}
          onScrub={handleScrub}
          onJumpToSpan={jumpToFlag}
          onTogglePlay={togglePlay}
        />

        <span className="col-span-2 sm:col-span-1 justify-self-end sm:justify-self-auto font-mono text-[13px] tabular-nums text-[var(--mute)]">
          <span className="text-[var(--ink)] font-bold">{formatClock(currentTime)}</span> /{" "}
          {formatClock(duration)}
        </span>
      </div>

      {/* Live caption */}
      <div aria-live="polite" className="relative min-h-[3.1em] text-[22px] sm:text-[30px] leading-[1.5]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={`${activeCue?.index ?? "none"}-${raw ? "raw" : "fix"}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.18 } }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="font-medium tracking-[-0.015em] text-balance"
          >
            {lineSegments.length === 0 ? (
              <span className="text-[var(--mute)]">No words in this clip.</span>
            ) : (
              lineSegments.map((seg) => {
                const speaking =
                  started && currentTime >= seg.start - 0.05 && currentTime <= seg.end + 0.08;
                const upcoming = started && currentTime < seg.start - 0.05;
                if (seg.state === "plain") {
                  return (
                    <React.Fragment key={seg.key}>
                      <span
                        className={`transition-colors duration-200 ${
                          upcoming ? "text-[var(--mute)] opacity-70" : "text-[var(--ink)]"
                        }`}
                      >
                        {seg.text}
                      </span>{" "}
                    </React.Fragment>
                  );
                }
                return (
                  <React.Fragment key={seg.key}>
                    <motion.span
                      animate={{ y: speaking ? -3 : 0, scale: speaking ? 1.04 : 1 }}
                      transition={SPRING.bouncy}
                      className={`inline-block whitespace-nowrap px-[0.28em] mx-[0.04em] rounded-[12px] border-2 border-[var(--outline)] font-bold ${
                        WORD_PILL[seg.state]
                      } ${speaking ? "shadow-[3px_3px_0_var(--outline)]" : ""}`}
                    >
                      {seg.text}
                    </motion.span>{" "}
                  </React.Fragment>
                );
              })
            )}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Quiet controls */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        {sortedTasks.length > 0 && (
          <>
            <button
              type="button"
              aria-label="Previous unsure word"
              onClick={() => jumpToFlag(-1)}
              className={ICON_BTN}
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Next unsure word"
              onClick={() => jumpToFlag(1)}
              className={ICON_BTN}
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setPlaybackRate((r) => (r === 1 ? 0.8 : 1))}
          aria-pressed={playbackRate === 0.8}
          aria-label={`Playback speed ${playbackRate === 0.8 ? "0.8x" : "1x"}`}
          className={`${ICON_BTN} !w-auto px-3.5 font-mono text-[12px] font-bold ${
            playbackRate === 0.8 ? "!bg-[var(--lilac)] !text-[var(--on-pastel)]" : ""
          }`}
        >
          {playbackRate === 0.8 ? "0.8x" : "1x"}
        </button>

        {hasHumanFixes && (
          <div
            role="group"
            aria-label="Caption source"
            className="relative inline-flex p-1 rounded-full border-2 border-[var(--outline)] bg-[var(--paper)]"
          >
            {(
              [
                { raw: false, label: "With fixes", tone: "bg-[var(--paid-bg)]" },
                { raw: true, label: "Raw AI", tone: "bg-[var(--flag-bg)]" },
              ] as const
            ).map((opt) => {
              const on = compareRawAi === opt.raw;
              return (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCompareRawAi(opt.raw)}
                  className={`relative min-h-[36px] px-3.5 rounded-full text-[13px] font-bold cursor-pointer transition-colors ${
                    on ? "text-[var(--on-pastel)]" : "text-[var(--mute)] hover:text-[var(--ink)]"
                  }`}
                >
                  {on && (
                    <motion.span
                      layoutId={`compare-pill-${job.id}`}
                      transition={SPRING.snappy}
                      className={`absolute inset-0 rounded-full border-2 border-[var(--outline)] ${opt.tone}`}
                    />
                  )}
                  <span className="relative">{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          aria-expanded={showTranscript}
          aria-controls={`transcript-${job.id}`}
          onClick={() => setShowTranscript((v) => !v)}
          className="ml-auto min-h-[44px] px-2 inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--ink)] cursor-pointer rounded-full hover:bg-[var(--hover)]"
        >
          Full transcript
          <motion.span animate={{ rotate: showTranscript ? 180 : 0 }} transition={SPRING.snappy}>
            <ChevronDown className="w-4 h-4" />
          </motion.span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showTranscript && (
          <motion.div
            id={`transcript-${job.id}`}
            key="transcript"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden -mt-2"
          >
            <div className="pt-5 border-t-2 border-dashed border-[var(--line)]">
              <CaptionTimeline
                words={job.words}
                tasks={tasks}
                currentTime={currentTime}
                raw={raw}
                threshold={job.confidenceThreshold}
                onWordClick={(w) => seekAndPlay(w.start - 0.15)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {audioError && (
        <p role="alert" className="text-[13px] font-bold text-[var(--error)]">
          {audioError}
        </p>
      )}
    </div>
  );
}
