"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Gauge,
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
  const trackRef = useRef<HTMLDivElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(job.durationSeconds || 15);
  const [playbackRate, setPlaybackRate] = useState<0.8 | 1>(1);
  const [compareRawAi, setCompareRawAi] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);

  const hasHumanFixes = useMemo(
    () => job.words.some((w) => w.fixedByHuman),
    [job.words]
  );

  // Decode real acoustic amplitude peaks from the actual WAV/audio asset via Web Audio API
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
        const barCount = 132;
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
        // Fallback deterministic bars if custom browser blob cannot be decoded
        if (!cancelled) {
          const fallback = Array.from({ length: 132 }, (_, i) => {
            const v = ((i * 37 + job.clipId.length * 19) % 100) / 100;
            return Number((0.18 + v * 0.72).toFixed(2));
          });
          setPeaks(fallback);
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

  // Draw crisp retina waveform canvas whenever peaks, playhead, hover, or task statuses change
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

    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle center baseline rule
    ctx.fillStyle = "#DCD5C7";
    ctx.fillRect(0, h / 2 - 0.5, w, 1);

    // Highlight flagged / accepted spans directly behind waveform
    for (const t of tasks) {
      if (t.status === "rejected" || t.status === "expired") continue;
      const x1 = (t.focusStart / Math.max(duration, 1)) * w;
      const x2 = Math.max(
        x1 + 6,
        (t.focusEnd / Math.max(duration, 1)) * w
      );
      ctx.fillStyle =
        t.status === "accepted"
          ? "rgba(27, 107, 70, 0.16)"
          : "rgba(201, 74, 34, 0.16)";
      ctx.fillRect(x1, 0, x2 - x1, h);

      // Top tape bar accent
      ctx.fillStyle = t.status === "accepted" ? "#1B6B46" : "#C94A22";
      ctx.fillRect(x1, 0, x2 - x1, 3);
    }

    // Draw real acoustic bars
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
          inFlag?.status === "accepted"
            ? "#1B6B46"
            : inFlag
            ? "#C94A22"
            : "#141311";
      } else {
        ctx.fillStyle =
          inFlag?.status === "accepted"
            ? "#7BB89B"
            : inFlag
            ? "#DF957D"
            : "#ADA699";
      }

      ctx.fillRect(x, y, barW, barH);
    }

    // Hover needle
    if (hoverTime !== null && duration > 0) {
      const hx = (hoverTime / duration) * w;
      ctx.fillStyle = "rgba(20, 19, 17, 0.35)";
      ctx.fillRect(hx, 0, 1, h);
    }

    // Active playhead needle
    const px = progressRatio * w;
    ctx.fillStyle = "#C94A22";
    ctx.fillRect(px - 1, 0, 2, h);
  }, [peaks, currentTime, duration, hoverTime, tasks]);

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
        .catch(() =>
          setAudioError("Browser blocked audio autoplay; click play again.")
        );
    }
  };

  const jumpToFlag = (direction: -1 | 1) => {
    if (sortedTasks.length === 0) return;
    let target: ReviewTask | undefined;
    if (direction === 1) {
      target =
        sortedTasks.find((t) => t.focusStart > currentTime + 0.3) ||
        sortedTasks[0];
    } else {
      target =
        [...sortedTasks]
          .reverse()
          .find((t) => t.focusStart < currentTime - 0.5) ||
        sortedTasks[sortedTasks.length - 1];
    }
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
    if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
    setCurrentTime(target);
    onTimeChange?.(target);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverTime(ratio * duration);
  };

  // Timecode ruler ticks (every ~3 seconds)
  const ticks = useMemo(() => {
    const step = duration > 30 ? 5 : 3;
    const list: number[] = [];
    for (let t = 0; t <= duration; t += step) {
      list.push(t);
    }
    return list;
  }, [duration]);

  return (
    <div className="border border-[#DDD7CA] bg-[#FBF9F4] rounded-[6px] overflow-hidden">
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

      {/* Matte Obsidian Broadcast Caption Monitor */}
      <div className="bg-[#121110] text-[#FBF9F4] px-5 pt-4 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#292623]">
          <div className="flex items-center gap-2.5 text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                playing ? "bg-[#C94A22] sikio-led-live" : "bg-[#5C574E]"
              }`}
            />
            <span className="uppercase tracking-[0.06em] text-[#EAE4D8] font-medium">
              {job.title}
            </span>
            <span className="text-[#847D72]">{job.languageTag}</span>
          </div>

          <div className="flex items-center gap-3">
            {hasHumanFixes && (
              <div
                role="group"
                aria-label="Caption comparison mode"
                className="inline-flex rounded-[4px] border border-[#2F2C28] bg-[#1C1A18] p-[2px] text-[11px]"
              >
                <button
                  type="button"
                  onClick={() => setCompareRawAi(false)}
                  className={`px-2 py-0.5 rounded-[3px] font-medium transition-colors cursor-pointer ${
                    !compareRawAi
                      ? "bg-[#1B6B46] text-[#FBF9F4]"
                      : "text-[#9C9589] hover:text-[#FBF9F4]"
                  }`}
                >
                  Sikio Fixed
                </button>
                <button
                  type="button"
                  onClick={() => setCompareRawAi(true)}
                  className={`px-2 py-0.5 rounded-[3px] font-medium transition-colors cursor-pointer ${
                    compareRawAi
                      ? "bg-[#C94A22] text-[#FBF9F4]"
                      : "text-[#9C9589] hover:text-[#FBF9F4]"
                  }`}
                >
                  Raw AI
                </button>
              </div>
            )}

            <span className="font-mono text-xs tabular-nums text-[#FBF9F4] bg-[#1C1A18] border border-[#2F2C28] px-2 py-0.5 rounded-[4px]">
              {formatTimecode(currentTime)}{" "}
              <span className="text-[#787166]">/ {formatTimecode(duration)}</span>
            </span>
          </div>
        </div>

        {/* Live Synced Subtitle Stage */}
        <div className="min-h-[96px] flex items-center justify-center py-4 px-2">
          {activeWords.length > 0 ? (
            <p className="text-center text-xl sm:text-[23px] leading-[1.42] font-medium tracking-[-0.015em] max-w-2xl">
              {activeWords.map((w, idx) => {
                const isSpeaking =
                  currentTime >= w.start - 0.05 && currentTime <= w.end + 0.08;
                const displayWord = compareRawAi ? w.aiText : w.currentText;
                const isFixed = !compareRawAi && w.fixedByHuman;
                const isUncertain =
                  compareRawAi ? w.confidence < job.confidenceThreshold : w.flagged;

                return (
                  <span
                    key={`${w.index}-${idx}`}
                    className={`inline-block mx-[3px] px-1.5 py-0.5 rounded-[4px] transition-colors ${
                      isFixed
                        ? "bg-[#1B6B46]/35 text-[#AEE8C9] border-b-2 border-[#39B57C]"
                        : isUncertain
                        ? "bg-[#C94A22]/35 text-[#FFD3C4] border-b-2 border-[#C94A22]"
                        : isSpeaking
                        ? "text-[#FFFFFF]"
                        : "text-[#C6C0B4]"
                    }`}
                  >
                    {displayWord}
                  </span>
                );
              })}
            </p>
          ) : (
            <p className="text-sm text-[#787166]">
              Press play or click any acoustic peak below.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#24221F] text-[11px] text-[#8A8378]">
          <span className="font-mono truncate">{job.transcriptionEngine}</span>
          <div className="flex items-center gap-3.5">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[2px] bg-[#C94A22]" />
              Uncertain
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[2px] bg-[#39B57C]" />
              Human verified
            </span>
          </div>
        </div>
      </div>

      {/* Acoustic Timecode Ruler + Decoded Waveform Track */}
      <div className="px-4 pt-3 pb-4 space-y-2.5 bg-[#FBF9F4]">
        {/* Timecode ticks */}
        <div className="relative h-4 select-none">
          {ticks.map((t) => {
            const pct = (t / Math.max(duration, 1)) * 100;
            if (pct > 95 && t > 0) return null;
            return (
              <span
                key={t}
                style={{ left: `${pct}%` }}
                className="absolute top-0 text-[10px] font-mono text-[#847D72] tabular-nums"
              >
                {formatTimecode(t)}
              </span>
            );
          })}
          {hoverTime !== null && (
            <span
              style={{
                left: `${Math.min(92, (hoverTime / Math.max(duration, 1)) * 100)}%`,
              }}
              className="absolute top-0 px-1 rounded-[2px] bg-[#141311] text-[#FBF9F4] text-[10px] font-mono tabular-nums"
            >
              {formatTimecode(hoverTime)}
            </span>
          )}
        </div>

        {/* Real Decoded Canvas Track */}
        <div
          ref={trackRef}
          role="slider"
          aria-label="Audio waveform scrubber"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          onClick={handleScrub}
          onMouseMove={handleMouseMove}
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
          className="relative h-[76px] w-full rounded-[5px] bg-[#EFECE3] border border-[#DDD7CA] cursor-pointer overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
          />
        </div>

        {/* Tactile Transport Deck */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[5px] text-sm font-medium bg-[#141311] text-[#FBF9F4] hover:bg-[#2A2824] transition-colors cursor-pointer"
            >
              {playing ? (
                <>
                  <Pause className="w-4 h-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Play
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
              title="Restart clip"
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-[5px] text-xs font-medium text-[#5C574E] bg-[#EBE6DB] hover:text-[#141311] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {sortedTasks.length > 0 && (
              <div className="inline-flex items-center gap-1 ml-1 pl-2 border-l border-[#DDD7CA]">
                <button
                  type="button"
                  onClick={() => jumpToFlag(-1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[5px] text-xs font-medium text-[#141311] bg-[#EBE6DB] hover:bg-[#DDD7CA] transition-colors cursor-pointer"
                >
                  <SkipBack className="w-3.5 h-3.5" /> Prev Flag
                </button>
                <button
                  type="button"
                  onClick={() => jumpToFlag(1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[5px] text-xs font-medium text-[#141311] bg-[#EBE6DB] hover:bg-[#DDD7CA] transition-colors cursor-pointer"
                >
                  Next Flag <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const next = playbackRate === 1 ? 0.8 : 1;
              setPlaybackRate(next);
              if (audioRef.current) audioRef.current.playbackRate = next;
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] text-xs font-mono font-medium border transition-colors cursor-pointer ${
              playbackRate === 0.8
                ? "bg-[#FAEAE4] text-[#C94A22] border-[#E8C5B8]"
                : "bg-[#FBF9F4] text-[#5C574E] border-[#DDD7CA] hover:text-[#141311]"
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            {playbackRate === 0.8 ? "0.8× Slow" : "1.0× Speed"}
          </button>
        </div>

        {audioError && (
          <p className="text-xs text-[#C94A22]">{audioError}</p>
        )}
      </div>
    </div>
  );
}
