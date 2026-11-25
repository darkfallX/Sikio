import type { Metadata } from "next";
import React from "react";
import { ArrowRight, Coins, Ear, FileDown, Gauge, Power, ShieldCheck, Smartphone } from "lucide-react";
import { ButtonLink, Reveal } from "@/components/ui";
import { Coin, Orb, Sparkle } from "@/components/art";
import { HearMark, HeroStory } from "@/components/landing/HeroStory";
import { Marquee } from "@/components/landing/Marquee";
import { Steps } from "@/components/landing/Steps";
import { FixItDemo } from "@/components/landing/FixItDemo";
import { CostCompare } from "@/components/landing/CostCompare";
import { EditorPhone } from "@/components/landing/EditorPhone";
import { ProofStrip } from "@/components/landing/ProofStrip";

export const metadata: Metadata = {
  title: { absolute: "Sikio · Captions that hear Africa" },
  description:
    "A pay-per-task stablecoin settlement app on QDay Aevum. A native speaker is paid once in tUSD8 for the exact seconds they fix in African-voice captions.",
};

const WRAP = "mx-auto w-full max-w-[1280px] px-4 sm:px-7";

function Point({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3.5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[var(--outline)] bg-[var(--paper)] text-[var(--ink)] shadow-[2px_2px_0_var(--outline)]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[16px] font-semibold leading-snug text-[var(--ink)]">{children}</span>
    </li>
  );
}

function Eyebrow({ children, tone = "var(--yellow)" }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border-2 border-[#111] px-3 py-1 font-mono text-[12.5px] font-bold text-[#111]"
      style={{ background: tone }}
    >
      {children}
    </span>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className={`${WRAP} grid items-center gap-6 pb-6 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 lg:pb-16 lg:pt-16`}>
          <div className="relative z-10">
            <div className="sikio-rise" style={{ ["--i" as string]: 0 }}>
              <Eyebrow tone="var(--mint)">
                <span className="h-2 w-2 rounded-full bg-[#111] sikio-led" aria-hidden="true" />
                Paid once in tUSD8 on QDay Aevum
              </Eyebrow>
            </div>
            <h1 className="type-hero mt-6 sikio-rise" style={{ ["--i" as string]: 1 }}>
              Captions that <HearMark>hear</HearMark> Africa.
            </h1>
            <p
              className="mt-6 max-w-[42ch] text-[clamp(1.05rem,1.6vw,1.25rem)] leading-relaxed text-[var(--ink-2)] sikio-rise"
              style={{ ["--i" as string]: 2 }}
            >
              A pay-per-task settlement app on QDay Aevum. When the AI isn&apos;t sure of a word, a native speaker is paid once, in tUSD8, for the exact seconds they fix.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 sikio-rise" style={{ ["--i" as string]: 3 }}>
              <ButtonLink href="/studio" variant="primary" size="lg">
                Try the demo
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="#how" variant="secondary" size="lg">
                How it works
              </ButtonLink>
            </div>
            <p
              className="mt-8 font-mono text-[12.5px] font-bold text-[var(--mute)] sikio-rise"
              style={{ ["--i" as string]: 4 }}
            >
              Real clips from Lagos, Nairobi and Accra
            </p>
          </div>

          <HeroStory />
        </div>
      </section>

      {/* ---------- Marquee ---------- */}
      <Marquee />

      {/* ---------- How it works ---------- */}
      <section id="how" className="scroll-mt-24 py-20 sm:py-28">
        <div className={WRAP}>
          <Reveal className="mb-10 sm:mb-14">
            <h2 className="type-display max-w-[14ch]">Three steps. One fair payment.</h2>
          </Reveal>
          <Steps />
        </div>
      </section>

      {/* ---------- Fix it ---------- */}
      <section className="py-16 sm:py-24" aria-labelledby="fix-title">
        <div className={WRAP}>
          <div className="brut-lg bg-[var(--paper)] px-5 py-9 sm:px-12 sm:py-14">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="fix-title" className="type-label !text-[13px] !text-[var(--ink)]">
                What the AI heard vs what a Lagos ear heard
              </h2>
              <span className="font-mono text-[12px] text-[var(--mute)]">Lagos demo clip, 0:06 to 0:12</span>
            </div>
            <div className="mt-10 sm:mt-12">
              <FixItDemo />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- For agencies ---------- */}
      <section id="agencies" className="scroll-mt-24 py-20 sm:py-28">
        <div className={`${WRAP} grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20`}>
          <Reveal>
            <Eyebrow tone="var(--sky)">For agencies</Eyebrow>
            <h2 className="type-display mt-5 max-w-[16ch]">Pay for the human ear only where the AI hesitated.</h2>
            <ul className="mt-9 grid gap-4">
              <Point icon={Gauge}>A spending cap and a limit per word</Point>
              <Point icon={Power}>Stop the agent any time</Point>
              <Point icon={FileDown}>Export .srt and .vtt</Point>
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <CostCompare />
          </Reveal>
        </div>
      </section>

      {/* ---------- For editors ---------- */}
      <section id="editors" className="scroll-mt-24 overflow-hidden py-20 sm:py-28">
        <div className={`${WRAP} grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20`}>
          <div className="order-2 lg:order-1">
            <EditorPhone />
          </div>
          <Reveal className="order-1 lg:order-2">
            <Eyebrow tone="var(--peach)">For editors</Eyebrow>
            <h2 className="type-display mt-5 max-w-[15ch]">Know the words? Get paid to hear them.</h2>
            <ul className="mt-9 grid gap-4">
              <Point icon={Smartphone}>Answer on your phone</Point>
              <Point icon={Ear}>Hear 12 seconds at most</Point>
              <Point icon={Coins}>Paid per word</Point>
              <Point icon={ShieldCheck}>No crypto know-how needed</Point>
            </ul>
            <div className="mt-9">
              <ButtonLink href="/ear" variant="secondary" size="lg">
                See the editor screen
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Proof on chain ---------- */}
      <section className="py-20 sm:py-28" aria-labelledby="proof-title">
        <div className={`${WRAP} grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16`}>
          <Reveal>
            <Eyebrow tone="var(--mint)">Proof on chain</Eyebrow>
            <h2 id="proof-title" className="type-display mt-5 max-w-[14ch]">
              Real payments. Check them yourself.
            </h2>
            <p className="mt-5 max-w-[34ch] text-[16px] leading-relaxed text-[var(--ink-2)]">
              Confirmed on QDay Aevum testnet, chain 44005, in tUSD8.
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <ProofStrip />
          </Reveal>
        </div>
      </section>

      {/* ---------- Final call ---------- */}
      <section className="overflow-hidden pb-24 pt-8 sm:pb-32">
        <div className={WRAP}>
          <div className="relative overflow-hidden rounded-[36px] border-2 border-[var(--outline)] bg-[var(--pink)] px-6 py-16 text-[#111] shadow-[6px_6px_0_var(--outline)] sm:rounded-[44px] sm:px-14 sm:py-24">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -right-6 -top-6 lg:right-[7%] lg:top-[13%]">
                <div className="sikio-float" style={{ ["--rot" as string]: "12deg" }}>
                  <Coin size={96} />
                </div>
              </div>
              <div className="absolute right-[14%] top-1/2 hidden -translate-y-1/2 lg:block">
                <div className="relative h-[190px] w-[300px]">
                  <span className="absolute left-0 top-4 -rotate-6 rounded-[16px] border-2 border-[#111] bg-[var(--yellow)] px-4 py-1.5 font-display text-[34px] text-[#111] line-through decoration-[3px] opacity-90">
                    Pay stark
                  </span>
                  <span className="absolute bottom-6 right-0 rotate-[4deg] rounded-[16px] border-2 border-[#111] bg-[var(--mint)] px-5 py-2 font-display text-[40px] text-[#111] shadow-[5px_5px_0_#111]">
                    Paystack
                  </span>
                </div>
              </div>
              <div className="absolute -bottom-5 right-[22%] hidden sm:block">
                <div className="sikio-float" style={{ animationDelay: "-2s", animationDuration: "7s" }}>
                  <Orb size={64} color="#c6f4c1" />
                </div>
              </div>
              <Sparkle size={30} color="#fff27a" className="absolute right-[34%] top-[16%] hidden sm:block sikio-float" />
              <Sparkle size={22} color="#ffffff" className="absolute bottom-[18%] right-[8%] sikio-float" style={{ animationDelay: "-4s" }} />
            </div>
            <Reveal className="relative max-w-[640px]">
              <h2 className="font-display text-[clamp(2.6rem,7vw,5.2rem)] leading-[0.95] tracking-[-0.06em]">
                Hear it for yourself.
              </h2>
              <p className="mt-5 max-w-[34ch] text-[17px] leading-relaxed text-[#111]/80">
                Run the agent on a real clip, fix a word, pay once.
              </p>
              <div className="mt-9">
                <ButtonLink href="/studio" variant="dark" size="lg" className="!min-h-[60px] !px-8 !text-[17px]">
                  Open the demo
                  <ArrowRight className="h-5 w-5" />
                </ButtonLink>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
