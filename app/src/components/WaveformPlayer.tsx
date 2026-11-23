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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(job.durationSeconds || 15);
  const [playbackRate, setPlaybackRate] = useState<0.8 | 1>(1);
  const [compareRawAi, setCompareRawAi] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [themeTick, setThemeTick] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const hasHumanFixes = useMemo(
    () => job.words.some((w) => w.fixedByHuman),
    [job.words]
  );

  // Re-render canvas when dark/light theme changes
  useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick((t) => t + 1));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  // Decode actual PCM amplitude peaks via Web Audio API
  useEffect(() => {
    let cancelled = false;
    const decodePeaks = async () => {
      try {
        const res = await fetch(job.audioUrl);
        if (!res.ok) throw new Error("audio fetch failed");
        const buf = await res.arrayBuffer();
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioCtx();
        const decoded = await ctx.decodeAudioData(buf.slice(0));
        const channel = decoded.getChannelData(0);
        const barCount = 128;
        const blockSize = Math.max(1, Math.floor(channel.length / barCount));
        const rawPeaks: number[] = [];
        let maxPeak = 0.01;
        for (let i = 0; i < barCount; i++) {
          let peak = 0;
          const start = i * blockSize;
          const end = Math.min(channel.length, start + blockSize);
          for (let j = start; j < end; j += 8) {
            const amp = Math.abs(channel[j]);
            if (amp > peak) peak = amp;
          }
          if (peak > maxPeak) maxPeak = peak;
          rawPeaks.push(peak);
        }
        await ctx.close();
        if (!cancelled) {
          setPeaks(
            rawPeaks.map((p) =>
              Math.max(0.08, Number((p / maxPeak).toFixed(3)))
            )
          );
        }
      } catch {
        if (!cancelled) {
          setPeaks(
            Array.from({ length: 128 }, (_, i) => {
              const v = ((i * 37 + job.clipId.length * 19) % 100) / 100;
              return Number((0.18 + v * 0.72).toFixed(2));
            })
          );
        }
      }
    };
    decodePeaks();
    return () => {
      cancelled = true;
    };
  }, [job.audioUrl, job.clipId]);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(job.durationSeconds || 15);
    setAudioError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [job.id, job.audioUrl, job.durationSeconds, playbackRate]);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue("--ink").trim() || "#12110d";
    const mute = cs.getPropertyValue("--mute").trim() || "#6c6759";
    const line = cs.getPropertyValue("--line").trim() || "#d6cfbf";
    const signal = cs.getPropertyValue("--signal").trim() || "#dd4f1b";
    const green = cs.getPropertyValue("--green").trim() || "#0e7c4a";
    const signalBg = cs.getPropertyValue("--signal-bg").trim() || "rgba(221,79,27,0.1)";
    const greenBg = cs.getPropertyValue("--green-bg").trim() || "rgba(14,124,74,0.1)";

    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = line;
    ctx.fillRect(0, h / 2 - 0.5, w, 1);

    for (const t of tasks) {
      if (t.status === "rejected" || t.status === "expired") continue;
      const x1 = (t.focusStart / Math.max(duration, 1)) * w;
      const x2 = Math.max(x1 + 6, (t.focusEnd / Math.max(duration, 1)) * w);
      ctx.fillStyle = t.status === "accepted" ? greenBg : signalBg;
      ctx.fillRect(x1, 0, x2 - x1, h);
      ctx.fillStyle = t.status === "accepted" ? green : signal;
      ctx.fillRect(x1, 0, x2 - x1, 2.5);
    }

    const progressRatio = duration > 0 ? currentTime / duration : 0;
    const step = w / peaks.length;
    const barW = Math.max(1.5, step - 1.5);

    for (let i = 0; i < peaks.length; i++) {
      const ratio = i / peaks.length;
      const barH = Math.max(4, peaks[i] * (h - 14));
      const x = i * step;
      const y = (h - barH) / 2;

      const tSec = ratio * duration;
      const inFlag = tasks.find(
        (t) =>
          t.status !== "rejected" &&
          t.status !== "expired" &&
          tSec >= t.focusStart &&
          tSec <= t.focusEnd
      );

      if (ratio <= progressRatio) {
        ctx.fillStyle =
          inFlag?.status === "accepted" ? green : inFlag ? signal : ink;
      } else {
        ctx.globalAlpha = 0.42;
        ctx.fillStyle =
          inFlag?.status === "accepted" ? green : inFlag ? signal : mute;
      }

      ctx.fillRect(x, y, barW, barH);
      ctx.globalAlpha = 1;
    }

    if (hoverTime !== null && duration > 0) {
      const hx = (hoverTime / duration) * w;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = ink;
      ctx.fillRect(hx, 0, 1, h);
      ctx.globalAlpha = 1;
    }

    const px = progressRatio * w;
    ctx.fillStyle = signal;
    ctx.fillRect(px - 1, 0, 2, h);
  }, [peaks, currentTime, duration, hoverTime, tasks, themeTick]);

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

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const target = ratio * duration;
    if (audioRef.current) audioRef.current.currentTime = target;
    setCurrentTime(target);
    onTimeChange?.(target);
  };

  const ticks = useMemo(() => {
    const step = duration > 30 ? 5 : 3;
    const list: number[] = [];
    for (let t = 0; t <= duration; t += step) list.push(t);
    return list;
  }, [duration]);

  return (
    <div className="rounded-[14px] hairline bg-[var(--paper)] hero-elevation overflow-hidden">
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

      {/* Hardware Monitor */}
      <div className="bg-[var(--body)] text-[#eeeadf] px-5 pt-4 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                playing ? "bg-[var(--signal)] sikio-led" : "bg-[#6c6759]"
              }`}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#d5d0c3] truncate">
              {job.title} · {job.languageTag}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {hasHumanFixes && (
              <div
                role="group"
                aria-label="Caption source"
                className="inline-flex rounded-full bg-white/10 p-0.5 text-[11px]"
              >
                <button
                  type="button"
                  onClick={() => setCompareRawAi(false)}
                  className={`px-2.5 py-0.5 rounded-full font-medium cursor-pointer transition-colors ${
                    !compareRawAi ? "bg-[var(--green)] text-[#faf8f2]" : "text-[#b8b2a6]"
                  }`}
                >
                  Fixed
                </button>
                <button
                  type="button"
                  onClick={() => setCompareRawAi(true)}
                  className={`px-2.5 py-0.5 rounded-full font-medium cursor-pointer transition-colors ${
                    compareRawAi ? "bg-[var(--signal)] text-[#faf8f2]" : "text-[#b8b2a6]"
                  }`}
                >
                  Raw AI
                </button>
              </div>
            )}

            <span className="font-mono text-xs tabular-nums text-[#eeeadf]">
              {formatTimecode(currentTime)}
              <span className="text-[#8a8477]"> / {formatTimecode(duration)}</span>
            </span>
          </div>
        </div>

        <div
          aria-live="polite"
          className="min-h-[96px] flex items-center justify-center py-5 px-2"
        >
          {activeWords.length > 0 ? (
            <p className="text-center text-xl sm:text-[24px] leading-[1.35] font-semibold tracking-[-0.02em] max-w-2xl">
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
                    className={`inline-block mx-[3px] px-1.5 py-0.5 rounded-[6px] ${
                      isFixed
                        ? "bg-[var(--green-bg)] text-[#8ee3b8] underline decoration-[var(--green)] decoration-2 underline-offset-4"
                        : isUncertain
                        ? "bg-[var(--signal-bg)] text-[#ffc7b3] underline decoration-[var(--signal)] decoration-2 underline-offset-4"
                        : isSpeaking
                        ? "text-white"
                        : "text-[#c4bfb3]"
                    }`}
                  >
                    {displayWord}
                  </span>
                );
              })}
            </p>
          ) : (
            <p className="text-sm text-[#8a8477]">Press play to preview captions.</p>
          )}
        </div>
      </div>

      {/* Decoded Acoustic Timeline */}
      <div className="p-4 sm:p-5 space-y-3 bg-[var(--paper)]">
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
          {hoverTime !== null && (
            <span
              style={{
                left: `${Math.min(88, (hoverTime / Math.max(duration, 1)) * 100)}%`,
              }}
              className="absolute top-0 px-1.5 rounded-[4px] bg-[var(--ink)] text-[var(--paper)] font-mono text-[10px] tabular-nums"
            >
              {formatTimecode(hoverTime)}
            </span>
          )}
        </div>

        <div
          role="slider"
          aria-label="Audio timeline"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          onClick={handleScrub}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            setHoverTime(ratio * duration);
          }}
          onMouseLeave={() => setHoverTime(null)}
          onKeyDown={(e) => {
            if (e.key === " ") {
              e.preventDefault();
              togglePlay();
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              jumpToFlag(1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              jumpToFlag(-1);
            }
          }}
          className="relative h-[74px] w-full rounded-[8px] hairline bg-[var(--panel)] cursor-pointer overflow-hidden"
        >
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        {/* Transport Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="min-h-[44px] sm:min-h-[38px] inline-flex items-center gap-2 px-4 rounded-[8px] text-sm font-semibold bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              {playing ? (
                <>
                  <Pause className="w-4 h-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" /> Play
                </>
              )}
            </button>

            <button
              type="button"
              aria-label="Restart"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  setCurrentTime(0);
                }
              }}
              className="min-h-[44px] min-w-[44px] sm:min-h-[38px] sm:min-w-[38px] inline-flex items-center justify-center rounded-[8px] hairline bg-[var(--paper)] text-[var(--ink-2)] hover:bg-[var(--hover)] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {sortedTasks.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => jumpToFlag(-1)}
                  className="min-h-[44px] sm:min-h-[38px] inline-flex items-center gap-1 px-3 rounded-[8px] text-xs font-medium hairline bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer"
                >
                  <SkipBack className="w-3.5 h-3.5" /> Prev flag
                </button>
                <button
                  type="button"
                  onClick={() => jumpToFlag(1)}
                  className="min-h-[44px] sm:min-h-[38px] inline-flex items-center gap-1 px-3 rounded-[8px] text-xs font-medium hairline bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer"
                >
                  Next flag <SkipForward className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const next = playbackRate === 1 ? 0.8 : 1;
              setPlaybackRate(next);
              if (audioRef.current) audioRef.current.playbackRate = next;
            }}
            className={`min-h-[44px] sm:min-h-[38px] px-3 rounded-full font-mono text-xs font-medium hairline cursor-pointer transition-colors ${
              playbackRate === 0.8
                ? "bg-[var(--signal-bg)] text-[var(--signal-ink)]"
                : "bg-[var(--paper)] text-[var(--mute)] hover:text-[var(--ink)]"
            }`}
          >
            {playbackRate === 0.8 ? "0.8x slow" : "1.0x"}
          </button>
        </div>

        {audioError && (
          <p className="text-xs text-[var(--red)]">{audioError}</p>
        )}
      </div>
    </div>
  );
}
