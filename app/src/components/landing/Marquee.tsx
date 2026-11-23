import React from "react";
import { Sparkle } from "@/components/art";

/*
  Two crossing tapes. The front tape carries the cities and the words the AI
  tends to miss; the back tape repeats the idea quietly in the other direction.
  Pauses on hover, stands still under reduced motion (globals.css).
*/

type Item = { text: string; word?: boolean };

const FRONT: Item[] = [
  { text: "Lagos" },
  { text: "Paystack", word: true },
  { text: "Nairobi" },
  { text: "matatu", word: true },
  { text: "Accra" },
  { text: "wahala", word: true },
  { text: "Kigali" },
  { text: "jollof", word: true },
  { text: "Johannesburg" },
  { text: "danfo", word: true },
  { text: "Yaba" },
  { text: "M-Pesa", word: true },
  { text: "Kumasi" },
  { text: "Naira", word: true },
];

const BACK = [
  "Needs an ear",
  "Heard",
  "Paid once",
  "Needs an ear",
  "Heard",
  "Paid once",
  "Needs an ear",
  "Heard",
  "Paid once",
];

function FrontRun() {
  return (
    <div className="flex shrink-0 items-center gap-6 pr-6 sm:gap-8 sm:pr-8">
      {FRONT.map((it, i) => (
        <React.Fragment key={`${it.text}-${i}`}>
          {it.word ? (
            <span className="rounded-full border-2 border-[#111] bg-[var(--yellow)] px-3.5 py-1 font-mono text-[17px] font-bold text-[#111] sm:text-[20px]">
              {it.text}
            </span>
          ) : (
            <span className="font-display text-[22px] text-[var(--ink)] sm:text-[28px]">{it.text}</span>
          )}
          <Sparkle size={18} color="var(--pink)" className="shrink-0" />
        </React.Fragment>
      ))}
    </div>
  );
}

function BackRun() {
  return (
    <div className="flex shrink-0 items-center gap-6 pr-6 sm:gap-10 sm:pr-10">
      {BACK.map((t, i) => (
        <span key={i} className="font-mono text-[14px] font-bold text-[#111] sm:text-[15px]">
          {t}
          <span className="ml-6 sm:ml-10">/</span>
        </span>
      ))}
    </div>
  );
}

export function Marquee() {
  return (
    <section aria-label="Places and words" className="relative overflow-hidden py-14 sm:py-20">
      <p className="sr-only">
        Built for voices from Lagos, Nairobi, Accra, Kigali and Johannesburg, and the words the AI tends to miss,
        like Paystack, matatu, wahala, jollof and danfo.
      </p>

      {/* back tape */}
      <div
        aria-hidden="true"
        className="absolute left-[-5%] top-1/2 w-[110%] -translate-y-1/2 rotate-[2.5deg] border-y-2 border-[#111] bg-[var(--mint)] py-2.5"
      >
        <div className="flex w-max sikio-marquee" style={{ animationDirection: "reverse", animationDuration: "40s" }}>
          <BackRun />
          <BackRun />
        </div>
      </div>

      {/* front tape */}
      <div
        aria-hidden="true"
        className="group relative left-[-5%] w-[110%] -rotate-[2deg] border-y-2 border-[var(--outline)] bg-[var(--paper)] py-4 shadow-[0_5px_0_var(--outline)]"
      >
        <div className="flex w-max items-center sikio-marquee group-hover:[animation-play-state:paused]" style={{ animationDuration: "46s" }}>
          <FrontRun />
          <FrontRun />
        </div>
      </div>
    </section>
  );
}
