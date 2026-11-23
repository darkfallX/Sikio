"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { CaptionJob, ReviewTask } from "@/lib/types";
import { buildSubtitleCues } from "@/lib/captions";
import { OrganicWaveRibbon, WaveSpan } from "./OrganicWaveRibbon";
import { buttonClass } from "./ui";

interface WaveformPlayerProps {
  job: CaptionJob;
  tasks: ReviewTask[];
  seekToTime?: number | null;
  onTimeChange?: (t: number) => void;
}

function formatTimecode(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const whole = Math.floor(s % 60);
  const tenths = Math.floor((s - Math.floor(s)) * 10);
  return `${String(m).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${tenths}`;
}

export function WaveformPlayer({
  job,
  tasks,
  seekToTime,
  onTimeChange,
}: WaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(job.durationSeconds || 15);
  const [playbackRate, setPlaybackRate] = useState<0.8 | 1>(1);
  const [compareRawAi, setCompareRawAi] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const hasHumanFixes = useMemo(
    () => job.words.some((w) => w.fixedByHuman),
    [job.words]
  );

  // Reset player ONLY when the clip or job changes (never when playbackRate toggles!)
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

  // Adjust playbackRate without disrupting playback position or paused/playing state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Throttled playhead sync (~15fps) to keep caption highlight smooth without flooding React
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
    if (typeof seekToTime === "number" && audioRef.current) {
      audioRef.current.currentTime = seekToTime;
      setCurrentTime(seekToTime);
      onTimeChange?.(seekToTime);
      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => {});
    }
  }, [seekToTime, onTimeChange]);

  const waveSpans: WaveSpan[] = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "rejected" && t.status !== "expired")
        .map((t) => ({
          start: t.focusStart,
          end: t.focusEnd,
          status:
            t.status === "accepted"
              ? "accepted"
              : t.status === "submitted"
              ? "submitted"
              : "flagged",
        })),
    [tasks]
  );

  const cues = useMemo(() => buildSubtitleCues(job.words), [job.words]);

  const activeCue = useMemo(() => {
    return (
      cues.find(
        (c) => currentTime >= c.start - 0.15 && currentTime <= c.end + 0.25
      ) || (currentTime === 0 ? cues[0] : null)
    );
  }, [cues, currentTime]);

  const activeWords = useMemo(() => {
    if (!activeCue) return [];
    return job.words.filter(
      (w) =>
        (compareRawAi ? w.aiText : w.currentText).trim().length > 0 &&
        w.start >= activeCue.start - 0.05 &&
        w.end <= activeCue.end + 0.05
    );
  }, [activeCue, job.words, compareRawAi]);

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
        .then(() => setPlaying(true))
        .catch(() => setAudioError("Click play again to start audio."));
    }
  };

  const jumpToFlag = (direction: -1 | 1) => {
    if (sortedTasks.length === 0) return;
    const target =
      direction === 1
        ? sortedTasks.find((t) => t.focusStart > currentTime + 0.3) || sortedTasks[0]
        : [...sortedTasks].reverse().find((t) => t.focusStart < currentTime - 0.5) ||
          sortedTasks[sortedTasks.length - 1];
    if (target && audioRef.current) {
      const t = Math.max(0, target.start);
      audioRef.current.currentTime = t;
      setCurrentTime(t);
      onTimeChange?.(t);
      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => {});
    }
  };

  const handleScrub = (targetSec: number) => {
    if (audioRef.current) audioRef.current.currentTime = targetSec;
    setCurrentTime(targetSec);
    onTimeChange?.(targetSec);
  };

  const ticks = useMemo(() => {
    const step = duration > 30 ? 5 : 3;
    const list: number[] = [];
    for (let t = 0; t <= duration; t += step) list.push(t);
    return list;
  }, [duration]);

  return (
    <div className="rounded-[var(--r)] hairline bg-[var(--paper)] overflow-hidden">
      <audio
        ref={audioRef}
        src={job.audioUrl}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrentTime(t);
          onTimeChange?.(t);
        }}
        onEnded={() => setPlaying(false)}
        onError={() => setAudioError("Audio unavailable for this clip.")}
      />

      {/* Editorial Proof Folio Bar */}
      <div className="px-4 sm:px-5 py-3 hairline-b flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              playing ? "bg-[var(--signal)] sikio-led" : "bg-[var(--mute)]"
            }`}
          />
          <span className="text-sm font-bold text-[var(--ink)] truncate">
            {job.title}
          </span>
          <span className="font-mono text-[12px] text-[var(--mute)] shrink-0">
            {job.languageTag}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {hasHumanFixes && (
            <div
              role="group"
              aria-label="Caption source"
              className="inline-flex rounded-full hairline bg-[var(--paper)] p-0.5 text-[12px]"
            >
              <button
                type="button"
                onClick={() => setCompareRawAi(false)}
                className={`min-h-[32px] px-3 rounded-full font-semibold cursor-pointer transition-colors ${
                  !compareRawAi
                    ? "bg-[var(--green)] text-white"
                    : "text-[var(--mute)] hover:text-[var(--ink)]"
                }`}
              >
                With fixes
              </button>
              <button
                type="button"
                onClick={() => setCompareRawAi(true)}
                className={`min-h-[32px] px-3 rounded-full font-semibold cursor-pointer transition-colors ${
                  compareRawAi
                    ? "bg-[var(--signal)] text-white"
                    : "text-[var(--mute)] hover:text-[var(--ink)]"
                }`}
              >
                Raw AI
              </button>
            </div>
          )}

          <span className="font-mono text-xs tabular-nums text-[var(--ink)] font-medium">
            {formatTimecode(currentTime)}
            <span className="text-[var(--mute)]"> / {formatTimecode(duration)}</span>
          </span>
        </div>
      </div>

      {/* Live Caption Stage */}
      <div
        aria-live="polite"
        className="px-4 sm:px-5 py-5 hairline-b bg-[#101713] min-h-[84px] flex items-center justify-center"
      >
        {activeWords.length > 0 ? (
          <p className="text-center text-[19px] sm:text-[22px] font-semibold leading-[1.45] tracking-[-0.01em] text-white max-w-2xl">
            {activeWords.map((w, idx) => {
              const isSpeaking =
                currentTime >= w.start - 0.05 && currentTime <= w.end + 0.08;
              const displayWord = compareRawAi ? w.aiText : w.currentText;
              const isFixed = !compareRawAi && w.fixedByHuman;
              const isUncertain = compareRawAi
                ? w.confidence < job.confidenceThreshold
                : w.flagged;

              return (
                <span
                  key={`${w.index}-${idx}`}
                  className={`inline-block mx-[2px] px-1 rounded-[4px] transition-colors ${
                    isFixed
                      ? "text-white underline decoration-[#4cc27a] decoration-[3px] underline-offset-[6px]"
                      : isUncertain
                      ? "text-[#f6c27a] underline decoration-dashed decoration-[#e29a3f] decoration-[3px] underline-offset-[6px]"
                      : isSpeaking
                      ? "text-white"
                      : "text-white/65"
                  }`}
                >
                  {displayWord}
                </span>
              );
            })}
          </p>
        ) : (
          <p className="text-sm text-white/70">
            Press play to see the captions in time with the audio.
          </p>
        )}
      </div>

      {/* Silky Organic Wavy Acoustic Timeline */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="relative h-4 select-none">
          {ticks.map((t) => {
            const pct = (t / Math.max(duration, 1)) * 100;
            if (pct > 92 && t > 0) return null;
            return (
              <span
                key={t}
                style={{ left: `${pct}%` }}
                className="absolute top-0 font-mono text-[10px] text-[var(--mute)] tabular-nums"
              >
                {formatTimecode(t)}
              </span>
            );
          })}
        </div>

        <div className="rounded-[var(--r-sm)] bg-[var(--bg)] px-1.5 py-1">
          <OrganicWaveRibbon
            audioUrl={job.audioUrl}
            seedKey={job.clipId}
            duration={duration}
            currentTime={currentTime}
            playing={playing}
            spans={waveSpans}
            height={78}
            onScrub={handleScrub}
            onJumpToSpan={jumpToFlag}
            onTogglePlay={togglePlay}
          />
        </div>

        {/* Transport Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={togglePlay}
              className={buttonClass("primary")}
            >
              {playing ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Play
                </>
              )}
            </button>

            <button
              type="button"
              aria-label="Restart"
              onClick={() => handleScrub(0)}
              className={buttonClass("secondary", "md", "min-w-[44px] !px-0")}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {sortedTasks.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => jumpToFlag(-1)}
                  className={buttonClass("secondary", "sm")}
                >
                  <SkipBack className="w-3.5 h-3.5" /> Previous unsure
                </button>
                <button
                  type="button"
                  onClick={() => jumpToFlag(1)}
                  className={buttonClass("secondary", "sm")}
                >
                  Next unsure <SkipForward className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setPlaybackRate((r) => (r === 1 ? 0.8 : 1))}
            aria-pressed={playbackRate === 0.8}
            className={`min-h-[44px] sm:min-h-[36px] px-3.5 rounded-full font-mono text-[12px] hairline cursor-pointer transition-colors ${
              playbackRate === 0.8
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "bg-[var(--paper)] text-[var(--mute)] hover:text-[var(--ink)]"
            }`}
          >
            {playbackRate === 0.8 ? "0.8x" : "1.0x"}
          </button>
        </div>

        {audioError && (
          <p className="text-xs text-[var(--red)]">{audioError}</p>
        )}
      </div>
    </div>
  );
}
