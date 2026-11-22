"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Volume2 } from "lucide-react";
import { CaptionJob, ReviewTask } from "@/lib/types";
import { buildSubtitleCues } from "@/lib/captions";

interface WaveformPlayerProps {
  job: CaptionJob;
  tasks: ReviewTask[];
  seekToTime?: number | null;
  onTimeChange?: (t: number) => void;
}

function formatClock(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${r.toFixed(1).padStart(4, "0")}`;
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
  const [audioError, setAudioError] = useState<string | null>(null);

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
    if (typeof seekToTime === "number" && audioRef.current) {
      audioRef.current.currentTime = seekToTime;
      setCurrentTime(seekToTime);
      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => {});
    }
  }, [seekToTime]);

  const cues = useMemo(() => buildSubtitleCues(job.words), [job.words]);

  const activeCue = useMemo(() => {
    return (
      cues.find((c) => currentTime >= c.start - 0.15 && currentTime <= c.end + 0.25) ||
      (currentTime === 0 ? cues[0] : null)
    );
  }, [cues, currentTime]);

  const activeWords = useMemo(() => {
    if (!activeCue) return [];
    return job.words.filter(
      (w) =>
        w.currentText.trim().length > 0 &&
        w.start >= activeCue.start - 0.05 &&
        w.end <= activeCue.end + 0.05
    );
  }, [activeCue, job.words]);

  // Deterministic editorial waveform bar heights (clean architectural bars)
  const bars = useMemo(() => {
    const count = 88;
    return Array.from({ length: count }, (_, i) => {
      const seed = (i * 37 + job.clipId.length * 19) % 100;
      const envelope = Math.sin((i / count) * Math.PI);
      const val = 0.22 + (seed / 100) * 0.58 * (0.45 + 0.55 * envelope);
      return Number(val.toFixed(2));
    });
  }, [job.clipId]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play()
        .then(() => setPlaying(true))
        .catch(() => setAudioError("Browser blocked audio autoplay; click play again."));
    }
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const target = ratio * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
    setCurrentTime(target);
    onTimeChange?.(target);
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="rounded-[8px] border border-[#E2DDD2] bg-[#FCFBF8] overflow-hidden">
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
        onError={() =>
          setAudioError("Audio source unavailable for this custom clip.")
        }
      />

      {/* Live Synced Caption Stage */}
      <div className="bg-[#161513] text-[#FCFBF8] px-5 py-6 min-h-[118px] flex flex-col justify-between">
        <div className="flex items-center justify-between text-[11px] text-[#ABA599]">
          <span className="font-medium tracking-wide uppercase">
            {job.title} · {job.languageTag}
          </span>
          <span className="font-mono tabular-nums">
            {formatClock(currentTime)} / {formatClock(duration)}
          </span>
        </div>

        <div className="my-3 text-center">
          {activeWords.length > 0 ? (
            <p className="text-lg sm:text-[21px] leading-snug font-medium tracking-[-0.01em]">
              {activeWords.map((w, idx) => {
                const isSpeaking =
                  currentTime >= w.start - 0.05 && currentTime <= w.end + 0.08;
                return (
                  <span
                    key={`${w.index}-${idx}`}
                    className={`inline-block mx-[3px] px-1 rounded-[4px] transition-colors ${
                      w.fixedByHuman
                        ? "bg-[#1D6B48]/30 text-[#A6E5C5] underline decoration-[#34A874] decoration-2 underline-offset-4"
                        : w.flagged
                        ? "bg-[#C54B24]/30 text-[#FFD0C0] underline decoration-[#C54B24] decoration-2 underline-offset-4"
                        : isSpeaking
                        ? "text-[#FCFBF8]"
                        : "text-[#D7D2C7]"
                    }`}
                  >
                    {w.currentText}
                  </span>
                );
              })}
            </p>
          ) : (
            <p className="text-sm text-[#8F897D]">
              Press play to preview synchronized captions.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#8F897D]">
          <span>
            Engine: {job.transcriptionEngine}
          </span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[2px] bg-[#C54B24]" />
              Uncertain
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[2px] bg-[#34A874]" />
              Verified fix
            </span>
          </div>
        </div>
      </div>

      {/* Waveform Timeline with Flagged / Accepted Spans */}
      <div className="p-4">
        <div
          role="slider"
          aria-label="Audio timeline scrubber"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          onClick={handleScrub}
          className="relative h-16 rounded-[6px] bg-[#EFECE4] border border-[#E2DDD2] cursor-pointer overflow-hidden select-none"
        >
          {/* Highlighted review spans */}
          {tasks.map((t) => {
            const leftPct = (t.focusStart / Math.max(duration, 1)) * 100;
            const widthPct = Math.max(
              2,
              ((t.focusEnd - t.focusStart) / Math.max(duration, 1)) * 100
            );
            const isAccepted = t.status === "accepted";
            const isRejectedOrExpired =
              t.status === "rejected" || t.status === "expired";
            if (isRejectedOrExpired) return null;
            return (
              <div
                key={t.id}
                title={`${t.aiGuess} (${Math.round(t.minConfidence * 100)}% conf) · ${t.status}`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                className={`absolute top-0 bottom-0 ${
                  isAccepted ? "bg-[#1D6B48]/20" : "bg-[#C54B24]/22"
                }`}
              />
            );
          })}

          {/* Architectural waveform bars */}
          <div className="absolute inset-0 flex items-center justify-between px-2 gap-[2px]">
            {bars.map((h, idx) => {
              const barPct = (idx / bars.length) * 100;
              const played = barPct <= progressPct;
              return (
                <div
                  key={idx}
                  style={{ height: `${Math.round(h * 100)}%` }}
                  className={`flex-1 rounded-[1px] transition-colors ${
                    played ? "bg-[#161513]" : "bg-[#B8B1A3]"
                  }`}
                />
              );
            })}
          </div>

          {/* Playhead */}
          <div
            style={{ left: `${progressPct}%` }}
            className="absolute top-0 bottom-0 w-[2px] bg-[#C54B24] pointer-events-none"
          />
        </div>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] text-sm font-medium bg-[#161513] text-[#FCFBF8] hover:bg-[#2C2A26] transition-colors cursor-pointer"
            >
              {playing ? (
                <>
                  <Pause className="w-4 h-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Play Clip
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  setCurrentTime(0);
                }
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-[6px] text-xs font-medium text-[#5C584F] bg-[#EFECE4] hover:text-[#161513] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restart
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#5C584F]">
            <Volume2 className="w-3.5 h-3.5" />
            <span>Click any word below to jump straight to that timestamp.</span>
          </div>
        </div>

        {audioError && (
          <p className="mt-2 text-xs text-[#B8381A]">{audioError}</p>
        )}
      </div>
    </div>
  );
}
