"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ArrowUp, Check, Pause, Play } from "lucide-react";
import { Blob, Coin, Orb, Sparkle, wavePath } from "@/components/art";
import { SikioMark } from "@/components/SikioMark";

/*
  The hero story. A phone plays one Sikio moment on a loop:
  the agent sends a 3 second voice note, says what it heard, the editor
  types the right word, and the payment lands once. Timing is deliberate:
  each beat gets room to read before the next one arrives.
*/

const BUBBLE = { type: "spring", stiffness: 380, damping: 26, mass: 0.8 } as const;
const BOUNCY = { type: "spring", stiffness: 420, damping: 14 } as const;

/* phase: 0 empty, 1 voice note plays, 2 agent asks, 3 editor types,
   4 editor sends, 5 paid once, 6 clearing for the next loop */
const SCHEDULE: [number, number][] = [
  [1, 700],
  [2, 3700],
  [3, 5000],
  [4, 6500],
  [5, 7500],
  [6, 11800],
  [0, 12400],
];
const FINAL = 5;
const ANSWER = "Paystack";

/* ---------------- Pointer parallax (desktop pointers only) ---------------- */

function usePointerParallax(enabled: boolean) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 80, damping: 18, mass: 0.7 });
  const sy = useSpring(y, { stiffness: 80, damping: 18, mass: 0.7 });

  useEffect(() => {
    if (!enabled) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      x.set((e.clientX / window.innerWidth) * 2 - 1);
      y.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, x, y]);

  return { sx, sy };
}

function Depth({
  sx,
  sy,
  d,
  className = "",
  children,
}: {
  sx: MotionValue<number>;
  sy: MotionValue<number>;
  d: number;
  className?: string;
  children: React.ReactNode;
}) {
  const x = useTransform(sx, (v) => v * d);
  const y = useTransform(sy, (v) => v * d);
  return (
    <motion.div aria-hidden="true" className={`absolute ${className}`} style={{ x, y }}>
      {children}
    </motion.div>
  );
}

/* ---------------- Voice note wave with a transform-only fill ---------------- */

function VoiceWave({ progress }: { progress: MotionValue<number> }) {
  const d = useMemo(() => wavePath(3.1, 200, 40), []);
  const outerX = useTransform(progress, (p) => `${(p - 1) * 100}%`);
  const innerX = useTransform(progress, (p) => `${(1 - p) * 100}%`);
  return (
    <div className="relative h-7 min-w-0 flex-1 overflow-hidden">
      <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d={d} fill="var(--ink)" opacity="0.22" />
      </svg>
      <motion.div className="absolute inset-0 overflow-hidden" style={{ x: outerX }}>
        <motion.div className="absolute inset-0" style={{ x: innerX }}>
          <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="h-full w-full">
            <path d={d} fill="var(--ink)" />
          </svg>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ---------------- Message shells ---------------- */

const enterIn = {
  initial: { opacity: 0, y: 16, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1, transition: BUBBLE },
  exit: { opacity: 0, y: -6, transition: { duration: 0.28 } },
};

function Bubble({
  side,
  className = "",
  children,
}: {
  side: "in" | "out";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      {...enterIn}
      style={{ transformOrigin: side === "in" ? "0% 100%" : "100% 100%" }}
      className={`max-w-[88%] rounded-[18px] border-2 border-[var(--outline)] px-3 py-2 text-[13.5px] leading-snug ${
        side === "in"
          ? "self-start rounded-bl-[6px] bg-[var(--paper)] text-[var(--ink)]"
          : "self-end rounded-br-[6px] bg-[var(--bubble-out)] text-[var(--bubble-out-ink)] font-bold"
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- The phone story ---------------- */

function PhoneStory({
  phase,
  typed,
  progress,
}: {
  phase: number;
  typed: string;
  progress: MotionValue<number>;
}) {
  const visible = phase > 0 && phase < 6;
  return (
    <div
      role="img"
      aria-label="A Sikio chat. The agent sends a 3 second voice note and says it heard Pay stark. The editor replies Paystack and is paid $0.10 once."
      className="relative w-[272px] sm:w-[300px] rounded-[40px] border-2 border-[var(--outline)] bg-[var(--paper)] p-2.5 shadow-[6px_6px_0_var(--outline)]"
    >
      <div aria-hidden="true" className="rounded-[30px] border-2 border-[var(--outline)] bg-[var(--panel)] overflow-hidden">
        {/* status bar and header */}
        <div className="flex items-center justify-center pt-2">
          <span className="h-[6px] w-16 rounded-full bg-[var(--outline)]" />
        </div>
        <div className="flex items-center gap-2.5 px-3.5 pt-2 pb-2.5 border-b-2 border-[var(--outline)] bg-[var(--paper)]">
          <SikioMark className="w-8 h-8 shrink-0" />
          <div className="min-w-0 leading-tight">
            <div className="text-[14px] font-bold text-[var(--ink)]">Sikio agent</div>
            <div className="font-mono text-[10.5px] text-[var(--mute)]">Lagos clip at 0:06</div>
          </div>
        </div>

        {/* thread */}
        <div className="flex h-[318px] sm:h-[332px] flex-col gap-2.5 px-3 py-3.5">
          <AnimatePresence>
            {visible && (
              <Bubble key="note" side="in" className="w-[214px] !px-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[var(--bg)]">
                    {phase === 1 ? (
                      <Pause className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                    ) : (
                      <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                    )}
                  </span>
                  <VoiceWave progress={progress} />
                  <span className="font-mono text-[10.5px] text-[var(--mute)] tabular-nums">0:03</span>
                </div>
              </Bubble>
            )}

            {visible && phase >= 2 && (
              <Bubble key="ask" side="in">
                I heard{" "}
                <span className="whitespace-nowrap rounded-[8px] border-2 border-[var(--outline)] bg-[var(--yellow)] px-1 font-bold text-[var(--on-pastel)]">
                  Pay stark
                </span>
                . What did they say?
              </Bubble>
            )}

            {visible && phase >= 4 && (
              <Bubble key="reply" side="out" className="text-[15px]">
                {ANSWER}
              </Bubble>
            )}

            {visible && phase >= 5 && (
              <motion.div
                key="paid"
                initial={{ opacity: 0, y: 18, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: BOUNCY }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.28 } }}
                style={{ transformOrigin: "0% 100%" }}
                className="self-start flex items-center gap-2.5 rounded-[18px] border-2 border-[var(--outline)] bg-[var(--mint)] py-2 pl-2 pr-3.5 text-[var(--on-pastel)] shadow-[3px_3px_0_var(--outline)]"
              >
                <motion.span
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0, transition: { ...BOUNCY, delay: 0.15 } }}
                  className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#111] bg-white"
                >
                  <Check className="h-4 w-4" strokeWidth={3.2} />
                </motion.span>
                <span className="leading-tight">
                  <span className="block font-mono text-[17px] font-bold tabular-nums">+$0.10</span>
                  <span className="block text-[12px] font-semibold">paid once</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* composer: the editor types here before sending */}
        <div className="flex items-center gap-2 border-t-2 border-[var(--outline)] bg-[var(--paper)] px-2.5 py-2.5">
          <div className="flex h-10 min-w-0 flex-1 items-center rounded-full border-2 border-[var(--outline)] bg-[var(--bg)] px-3.5 text-[13.5px]">
            {phase === 3 && typed ? (
              <span className="font-bold text-[var(--ink)]">
                {typed}
                <span className="ml-px inline-block h-[15px] w-[2px] translate-y-[2px] bg-[var(--ink)] sikio-led" />
              </span>
            ) : (
              <span className="text-[var(--mute)]">Type the word</span>
            )}
          </div>
          <motion.span
            animate={{ scale: phase === 3 && typed.length === ANSWER.length ? 1.12 : 1 }}
            transition={BOUNCY}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-[var(--outline)] ${
              phase === 3 && typed ? "bg-[var(--mint)] text-[#111]" : "bg-[var(--paper)] text-[var(--mute)]"
            }`}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={3} />
          </motion.span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Hero art: blob, phone, candy objects ---------------- */

export function HeroStory() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(rootRef, { amount: 0.35 });
  const [phase, setPhase] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [typed, setTyped] = useState("");
  const progress = useMotionValue(0);
  const { sx, sy } = usePointerParallax(!reduce);

  const tiltY = useTransform(sx, (v) => v * 7);
  const tiltX = useTransform(sy, (v) => v * -6);

  // The loop. Runs only while visible; reduced motion shows the final frame.
  useEffect(() => {
    if (reduce) {
      setPhase(FINAL);
      progress.set(1);
      return;
    }
    if (!inView) {
      setPhase(0);
      progress.set(0);
      return;
    }
    const timers = SCHEDULE.map(([p, t]) => window.setTimeout(() => setPhase(p), t));
    const last = SCHEDULE[SCHEDULE.length - 1][1];
    timers.push(window.setTimeout(() => setCycle((c) => c + 1), last + 250));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [inView, reduce, cycle, progress]);

  // Voice note playback fill
  useEffect(() => {
    if (reduce) return;
    if (phase === 0) progress.set(0);
    if (phase !== 1) return;
    const controls = animate(progress, 1, { duration: 2.4, delay: 0.5, ease: "linear" });
    return () => controls.stop();
  }, [phase, reduce, progress]);

  // The editor types the answer letter by letter
  useEffect(() => {
    if (phase !== 3 || reduce) {
      setTyped("");
      return;
    }
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setTyped(ANSWER.slice(0, n));
      if (n >= ANSWER.length) window.clearInterval(id);
    }, 105);
    return () => window.clearInterval(id);
  }, [phase, reduce]);

  const paid = phase === FINAL;

  return (
    <div ref={rootRef} className="relative mx-auto grid h-[455px] w-full max-w-[560px] place-items-center sm:h-[560px]">
      {/* backdrop blob, slowly turning */}
      <Depth sx={sx} sy={sy} d={-10} className="inset-0 grid place-items-center">
        <motion.div
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 80, ease: "linear", repeat: Infinity }}
          className="h-[360px] w-[360px] sm:h-[480px] sm:w-[480px]"
        >
          <Blob color="var(--sky)" className="h-full w-full" />
        </motion.div>
      </Depth>

      <Depth sx={sx} sy={sy} d={-22} className="left-[4%] top-[9%] sm:left-[2%]">
        <Sparkle size={34} color="var(--pink)" className="sikio-float" style={{ animationDelay: "-2s" }} />
      </Depth>
      <Depth sx={sx} sy={sy} d={26} className="left-[1%] bottom-[12%] sm:left-[3%]">
        <div className="sikio-float" style={{ animationDuration: "7s" }}>
          <Orb size={58} color="#b8efff" />
        </div>
      </Depth>
      <Depth sx={sx} sy={sy} d={16} className="right-[6%] bottom-[7%] sm:right-[4%]">
        <div className="sikio-float" style={{ animationDuration: "8s", animationDelay: "-3s" }}>
          <Orb size={38} color="#e2d4ff" />
        </div>
      </Depth>
      <Depth sx={sx} sy={sy} d={-18} className="right-[16%] bottom-[24%] hidden sm:block">
        <Sparkle size={24} color="var(--yellow)" className="sikio-float" style={{ animationDelay: "-4s" }} />
      </Depth>

      {/* phone, with a gentle 3D tilt toward the pointer */}
      <div className="relative" style={{ perspective: 1200 }}>
        <motion.div style={{ rotateX: tiltX, rotateY: tiltY }} className="-rotate-2">
          <PhoneStory phase={phase} typed={typed} progress={progress} />
        </motion.div>
      </div>

      {/* the coin: flips and bounces when the payment lands */}
      <Depth sx={sx} sy={sy} d={30} className="right-[-2%] top-[1%] origin-top-right scale-[0.78] sm:right-[2%] sm:top-[8%] sm:scale-100">
        <div className="relative sikio-float" style={{ ["--rot" as string]: "8deg", animationDuration: "6.5s" }}>
          <motion.div
            style={{ transformPerspective: 600 }}
            animate={
              paid && !reduce
                ? { rotateY: 360, y: [0, -34, 0], scale: [1, 1.14, 1] }
                : { rotateY: 0, y: 0, scale: 1 }
            }
            transition={
              paid && !reduce
                ? { duration: 0.95, ease: [0.22, 1, 0.36, 1], delay: 0.25 }
                : { duration: 0 }
            }
          >
            <Coin size={92} />
          </motion.div>
          <AnimatePresence>
            {paid && !reduce && (
              <motion.span
                key={`plus-${cycle}`}
                initial={{ opacity: 0, y: 6, scale: 0.8 }}
                animate={{ opacity: [0, 1, 1, 0], y: -58, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.45 }}
                className="absolute -left-4 top-0 rounded-full border-2 border-[#111] bg-[var(--mint)] px-2 py-0.5 font-mono text-[12px] font-bold text-[#111]"
              >
                +$0.10
              </motion.span>
            )}
          </AnimatePresence>
          {paid &&
            !reduce &&
            [
              { x: -30, y: 70, s: 18, delay: 0.5 },
              { x: 86, y: 52, s: 14, delay: 0.62 },
              { x: 74, y: -12, s: 12, delay: 0.74 },
            ].map((p, i) => (
              <motion.span
                key={`spark-${cycle}-${i}`}
                className="absolute left-0 top-0"
                style={{ x: p.x, y: p.y }}
                initial={{ scale: 0, rotate: -45, opacity: 0 }}
                animate={{ scale: [0, 1.2, 0], rotate: 45, opacity: [0, 1, 0] }}
                transition={{ duration: 1.1, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
              >
                <Sparkle size={p.s} color="var(--pink)" />
              </motion.span>
            ))}
        </div>
      </Depth>
    </div>
  );
}

/* The pink outlined highlight on "hear". Visible before hydration, then springs in. */
export function HearMark({ children }: { children: React.ReactNode }) {
  return (
    <motion.span
      initial={{ rotate: 9, scale: 0.72 }}
      animate={{ rotate: -3, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 11, delay: 0.45 }}
      className="relative mx-[0.04em] inline-block rounded-[0.22em] border-[3px] border-[var(--outline)] bg-[var(--pink)] px-[0.14em] pb-[0.04em] text-[var(--on-pastel)] shadow-[5px_5px_0_var(--outline)]"
    >
      {children}
    </motion.span>
  );
}
