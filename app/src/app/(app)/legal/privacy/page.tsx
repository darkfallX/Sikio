import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacy and excerpt-only audio handling for Sikio.",
};

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl mx-auto space-y-8 sm:space-y-10 sikio-rise">
      <div className="space-y-4">
        <h1 className="type-page text-[var(--ink)]">Privacy</h1>
        <p className="inline-flex items-center px-3.5 py-1 rounded-full border-2 border-[var(--outline)] pastel-yellow font-mono text-[12.5px] font-bold">
          Excerpt-only confidentiality · Sikio
        </p>
      </div>

      <div className="brut-lg bg-[var(--paper)] divide-y-2 divide-dashed divide-[var(--line)] text-[16px] leading-relaxed text-[var(--ink-2)] overflow-hidden">
        <section className="px-6 py-6 sm:px-9 sm:py-8 space-y-2">
          <h2 className="font-mono font-bold text-[18px] sm:text-[20px] tracking-[-0.04em] text-[var(--ink)]">Excerpt-only audio</h2>
          <p>
            /api/excerpt slices flagged WAV passages server-side to at most 12 seconds so editors never receive full client recordings.
          </p>
        </section>
        <section className="px-6 py-6 sm:px-9 sm:py-8 space-y-2">
          <h2 className="font-mono font-bold text-[18px] sm:text-[20px] tracking-[-0.04em] text-[var(--ink)]">Public chain records</h2>
          <p>
            Wallet addresses, task hashes, and tUSD8 payouts on QDay Aevum 44005 are public on the block explorer.
          </p>
        </section>
        <section className="px-6 py-6 sm:px-9 sm:py-8 space-y-2">
          <h2 className="font-mono font-bold text-[18px] sm:text-[20px] tracking-[-0.04em] text-[var(--ink)]">Uploaded files</h2>
          <p>
            Custom audio uploaded in Studio is decoded locally in your browser and can be cleared anytime via Reset.
          </p>
        </section>
      </div>
    </article>
  );
}
