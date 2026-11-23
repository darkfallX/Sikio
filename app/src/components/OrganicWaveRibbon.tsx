"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface WaveSpan {
  start: number;
  end: number;
  status: "flagged" | "submitted" | "accepted";
}

interface OrganicWaveRibbonProps {
  audioUrl?: string;
  seedKey: string;
  duration: number;
  currentTime: number;
  playing: boolean;
  spans?: WaveSpan[];
  height?: number;
  interactive?: boolean;
  ambientWave?: boolean;
  onScrub?: (sec: number) => void;
  onJumpToSpan?: (direction: -1 | 1) => void;
  onTogglePlay?: () => void;
}

interface PaletteCache {
  ink: string;
  mute: string;
  line: string;
  signal: string;
  signalBg: string;
  green: string;
  greenBg: string;
  amber: string;
  amberBg: string;
  paper: string;
}

const DEFAULT_PALETTE: PaletteCache = {
  ink: "#15201b",
  mute: "#5a6962",
  line: "#d2d9d4",
  signal: "#b45f06",
  signalBg: "#fbecd6",
  green: "#1d7a3e",
  greenBg: "#dcefe2",
  amber: "#2f62c9",
  amberBg: "#e3ebfa",
  paper: "#ffffff",
};

const SAMPLE_COUNT = 120;

function smoothEnvelope(raw: number[], passes = 4): number[] {
  let cur = [...raw];
  for (let p = 0; p < passes; p++) {
    const next = new Array<number>(cur.length);
    for (let i = 0; i < cur.length; i++) {
      const prev = cur[Math.max(0, i - 1)];
      const self = cur[i];
      const ahead = cur[Math.min(cur.length - 1, i + 1)];
      next[i] = 0.24 * prev + 0.52 * self + 0.24 * ahead;
    }
    cur = next;
  }
  return cur;
}

function buildFallbackEnvelope(seedKey: string): number[] {
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) % 997;
  }
  const phaseA = (hash % 37) * 0.17;
  const raw = Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const t = i / (SAMPLE_COUNT - 1);
    const edgeFade = Math.sin(Math.PI * t);
    const phrase =
      0.42 +
      0.32 * Math.sin(t * 13 + phaseA) +
      0.18 * Math.cos(t * 27 - phaseA * 0.7) +
      0.08 * Math.sin(t * 43 + phaseA * 1.3);
    return Math.max(0.14, Math.min(0.95, 0.2 + edgeFade * phrase * 0.8));
  });
  return smoothEnvelope(raw, 4);
}

function drawSmoothBezier(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  moveToFirst: boolean
) {
  if (pts.length === 0) return;
  if (moveToFirst) {
    ctx.moveTo(pts[0].x, pts[0].y);
  } else {
    ctx.lineTo(pts[0].x, pts[0].y);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

function readPaletteFromRoot(): PaletteCache {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  const cs = getComputedStyle(document.documentElement);
  return {
    ink: cs.getPropertyValue("--ink").trim() || DEFAULT_PALETTE.ink,
    mute: cs.getPropertyValue("--mute").trim() || DEFAULT_PALETTE.mute,
    line: cs.getPropertyValue("--line").trim() || DEFAULT_PALETTE.line,
    signal: cs.getPropertyValue("--signal").trim() || DEFAULT_PALETTE.signal,
    signalBg: cs.getPropertyValue("--signal-bg").trim() || DEFAULT_PALETTE.signalBg,
    green: cs.getPropertyValue("--green").trim() || DEFAULT_PALETTE.green,
    greenBg: cs.getPropertyValue("--green-bg").trim() || DEFAULT_PALETTE.greenBg,
    amber: cs.getPropertyValue("--heard").trim() || DEFAULT_PALETTE.amber,
    amberBg: cs.getPropertyValue("--heard-bg").trim() || DEFAULT_PALETTE.amberBg,
    paper: cs.getPropertyValue("--paper").trim() || DEFAULT_PALETTE.paper,
  };
}

export function OrganicWaveRibbon({
  audioUrl,
  seedKey,
  duration,
  currentTime,
  playing,
  spans = [],
  height = 76,
  interactive = true,
  ambientWave = false,
  onScrub,
  onJumpToSpan,
  onTogglePlay,
}: OrganicWaveRibbonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fallback = useMemo(() => buildFallbackEnvelope(seedKey), [seedKey]);
  const [envelope, setEnvelope] = useState<number[]>(fallback);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const phaseRef = useRef(0);
  const paletteRef = useRef<PaletteCache>(DEFAULT_PALETTE);
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({
    w: 0,
    h: 0,
    dpr: 1,
  });
  const drawStateRef = useRef({
    envelope,
    duration,
    currentTime,
    playing,
    spans,
    hoverTime,
    interactive,
  });

  drawStateRef.current = {
    envelope,
    duration,
    currentTime,
    playing,
    spans,
    hoverTime,
    interactive,
  };

  useEffect(() => {
    setEnvelope(fallback);
  }, [fallback]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const { w, h, dpr } = sizeRef.current;
    if (!canvas || w <= 0 || h <= 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const st = drawStateRef.current;
    if (st.envelope.length < 2) return;

    const pal = paletteRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const safeDur = Math.max(st.duration, 0.5);
    const mid = h / 2;
    const maxAmp = h * 0.34;
    const phase = phaseRef.current;

    // 1. Center acoustic datum rule
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    // 2. Soft span wash bands + crisp 2px proof markers along top
    for (const sp of st.spans) {
      const x1 = Math.max(0, (sp.start / safeDur) * w);
      const x2 = Math.min(w, Math.max(x1 + 8, (sp.end / safeDur) * w));
      ctx.fillStyle =
        sp.status === "accepted"
          ? pal.greenBg
          : sp.status === "submitted"
          ? pal.amberBg
          : pal.signalBg;
      ctx.fillRect(x1, 0, x2 - x1, h);

      ctx.fillStyle =
        sp.status === "accepted"
          ? pal.green
          : sp.status === "submitted"
          ? pal.amber
          : pal.signal;
      ctx.fillRect(x1, 0, x2 - x1, 2);
    }

    // 3. Build continuous wavy dual-contour Bezier coordinates
    const upperPts: { x: number; y: number }[] = [];
    const lowerPts: { x: number; y: number }[] = [];
    const threadPts: { x: number; y: number }[] = [];

    for (let i = 0; i < st.envelope.length; i++) {
      const tNorm = i / (st.envelope.length - 1);
      const x = tNorm * w;
      const e = st.envelope[i];

      const harmonicA = Math.sin(tNorm * 14.5 + phase) * 0.14;
      const harmonicB = Math.cos(tNorm * 23.0 - phase * 0.8) * 0.06;
      const waveFactorTop = Math.min(0.95, Math.max(0.11, e * (0.82 + harmonicA + harmonicB)));
      const waveFactorBot = Math.min(0.95, Math.max(0.11, e * (0.80 - harmonicA * 0.72 + harmonicB)));

      upperPts.push({ x, y: mid - waveFactorTop * maxAmp });
      lowerPts.push({ x, y: mid + waveFactorBot * maxAmp });
      threadPts.push({
        x,
        y: mid + Math.sin(tNorm * 26.0 + phase * 1.45) * e * maxAmp * 0.56,
      });
    }

    const paintRibbon = (strokeColor: string, fillAlpha: number, strokeAlpha: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, mid);
      drawSmoothBezier(ctx, upperPts, false);
      ctx.lineTo(w, mid);
      const reversedLower = [...lowerPts].reverse();
      drawSmoothBezier(ctx, reversedLower, false);
      ctx.closePath();
      ctx.globalAlpha = fillAlpha;
      ctx.fillStyle = strokeColor;
      ctx.fill();

      ctx.globalAlpha = strokeAlpha;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.65;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      drawSmoothBezier(ctx, upperPts, true);
      ctx.stroke();

      ctx.beginPath();
      drawSmoothBezier(ctx, lowerPts, true);
      ctx.stroke();

      ctx.globalAlpha = strokeAlpha * 0.48;
      ctx.lineWidth = 0.95;
      ctx.beginPath();
      drawSmoothBezier(ctx, threadPts, true);
      ctx.stroke();
      ctx.restore();
    };

    const progressRatio = Math.max(0, Math.min(1, st.currentTime / safeDur));
    const playX = progressRatio * w;

    // 4a. Unplayed base wave (calm muted sepia)
    ctx.save();
    ctx.beginPath();
    ctx.rect(playX, 0, Math.max(0, w - playX), h);
    ctx.clip();
    paintRibbon(pal.mute, 0.11, 0.58);
    ctx.restore();

    // 4b. Played base wave (rich espresso ink)
    if (playX > 0.5) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, playX, h);
      ctx.clip();
      paintRibbon(pal.ink, 0.2, 0.92);
      ctx.restore();
    }

    // 4c. Color-accented waves strictly inside flagged / submitted / accepted spans
    for (const sp of st.spans) {
      const x1 = Math.max(0, (sp.start / safeDur) * w);
      const x2 = Math.min(w, Math.max(x1 + 8, (sp.end / safeDur) * w));
      const spanColor =
        sp.status === "accepted"
          ? pal.green
          : sp.status === "submitted"
          ? pal.amber
          : pal.signal;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x1, 0, x2 - x1, h);
      ctx.clip();
      paintRibbon(spanColor, 0.26, 0.96);
      ctx.restore();
    }

    // 5. Subtle hover scrub cursor
    if (st.hoverTime !== null && st.interactive) {
      const hx = (st.hoverTime / safeDur) * w;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, h);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Precision playhead needle
    if (st.interactive && (st.currentTime > 0 || st.playing)) {
      ctx.save();
      ctx.strokeStyle = pal.signal;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, h);
      ctx.stroke();

      ctx.fillStyle = pal.signal;
      ctx.beginPath();
      ctx.arc(Math.min(w - 4, Math.max(4, playX)), 5, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.paper;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  // Decode real PCM RMS energy from audioUrl when available
  useEffect(() => {
    if (!audioUrl) return;
    let cancelled = false;
    const decodeRms = async () => {
      try {
        const res = await fetch(audioUrl);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const decoded = await ctx.decodeAudioData(buf.slice(0));
        const channel = decoded.getChannelData(0);
        const blockSize = Math.max(1, Math.floor(channel.length / SAMPLE_COUNT));
        const rmsList: number[] = [];
        let maxRms = 0.01;

        for (let i = 0; i < SAMPLE_COUNT; i++) {
          const start = i * blockSize;
          const end = Math.min(channel.length, start + blockSize);
          let sumSq = 0;
          let count = 0;
          for (let j = start; j < end; j += 4) {
            const s = channel[j];
            sumSq += s * s;
            count++;
          }
          const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
          if (rms > maxRms) maxRms = rms;
          rmsList.push(rms);
        }
        await ctx.close();

        const normalized = rmsList.map((v) =>
          Math.max(0.11, Math.min(1, 0.12 + Math.pow(v / maxRms, 0.68) * 0.88))
        );
        const smoothed = smoothEnvelope(normalized, 4);
        if (!cancelled) setEnvelope(smoothed);
      } catch {
        // Keep seeded fallback curve
      }
    };
    decodeRms();
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  // Cache theme palette on mount and theme change (zero per-frame getComputedStyle calls)
  useEffect(() => {
    const syncPalette = () => {
      paletteRef.current = readPaletteFromRoot();
      renderCanvas();
    };
    syncPalette();
    const obs = new MutationObserver(syncPalette);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, [renderCanvas]);

  // Measure and resize backing canvas ONLY when container dimensions or height change
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      const nextW = rect.width;
      const nextH = rect.height;
      const targetPixelW = Math.round(nextW * dpr);
      const targetPixelH = Math.round(nextH * dpr);
      if (canvas.width !== targetPixelW || canvas.height !== targetPixelH) {
        canvas.width = targetPixelW;
        canvas.height = targetPixelH;
      }
      sizeRef.current = { w: nextW, h: nextH, dpr };
      renderCanvas();
    };

    updateSize();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height, renderCanvas]);

  // Redraw whenever reactive state updates
  useEffect(() => {
    renderCanvas();
  }, [envelope, duration, currentTime, playing, spans, hoverTime, interactive, renderCanvas]);

  // Throttled direct-canvas harmonic wave loop (~24fps, zero React setState calls)
  useEffect(() => {
    if (!playing && !ambientWave) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let raf = 0;
    let lastDraw = performance.now();
    const minIntervalMs = 40;

    const tick = (now: number) => {
      const elapsed = now - lastDraw;
      if (elapsed >= minIntervalMs) {
        const dt = Math.min(0.08, elapsed / 1000);
        lastDraw = now;
        phaseRef.current += dt * (drawStateRef.current.playing ? 3.2 : 1.3);
        renderCanvas();
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, ambientWave, renderCanvas]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !onScrub) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onScrub(ratio * Math.max(duration, 0.5));
  };

  return (
    <div
      ref={containerRef}
      role={interactive ? "slider" : "img"}
      aria-label={interactive ? "Acoustic wave timeline" : "Audio wave preview"}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? Math.round(duration) : undefined}
      aria-valuenow={interactive ? Math.round(currentTime) : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={handleClick}
      onMouseMove={(e) => {
        if (!interactive) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        setHoverTime(ratio * Math.max(duration, 0.5));
      }}
      onMouseLeave={() => setHoverTime(null)}
      onKeyDown={(e) => {
        if (!interactive) return;
        if (e.key === " ") {
          e.preventDefault();
          onTogglePlay?.();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onJumpToSpan?.(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          onJumpToSpan?.(-1);
        }
      }}
      style={{ height }}
      className={`relative w-full overflow-hidden rounded-[8px] ${
        interactive ? "cursor-pointer" : ""
      }`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      {interactive && hoverTime !== null && (
        <span
          style={{
            left: `${Math.min(86, Math.max(2, (hoverTime / Math.max(duration, 0.5)) * 100))}%`,
          }}
          className="pointer-events-none absolute top-1.5 px-1.5 py-0.5 rounded-[4px] bg-[var(--ink)] text-[var(--paper)] font-mono text-[10px] tabular-nums"
        >
          {hoverTime.toFixed(1)}s
        </span>
      )}
    </div>
  );
}
