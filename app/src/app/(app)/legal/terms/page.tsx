import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for Sikio on QDay Aevum testnet.",
};

export default function TermsPage() {
  return (
    <article className="max-w-2xl mx-auto space-y-8 sm:space-y-10 sikio-rise">
      <div className="space-y-4">
        <h1 className="type-page text-[var(--ink)]">Terms</h1>
        <p className="inline-flex items-center px-3.5 py-1 rounded-full border-2 border-[var(--outline)] pastel-yellow font-mono text-[12.5px] font-bold">
          QDay Aevum testnet · Chain 44005
        </p>
      </div>

      <div className="brut-lg bg-[var(--paper)] divide-y-2 divide-dashed divide-[var(--line)] text-[16px] leading-relaxed text-[var(--ink-2)] overflow-hidden">
        <section className="px-6 py-6 sm:px-9 sm:py-8 space-y-2">
          <h2 className="font-mono font-bold text-[18px] sm:text-[20px] tracking-[-0.04em] text-[var(--ink)]">Testnet only</h2>
          <p>
            Sikio runs on QDay Aevum testnet using test tokens (tUSD8 and tQDAY) with no monetary value.
          </p>
        </section>
        <section className="px-6 py-6 sm:px-9 sm:py-8 space-y-2">
          <h2 className="font-mono font-bold text-[18px] sm:text-[20px] tracking-[-0.04em] text-[var(--ink)]">Payment vs accuracy</h2>
          <p>
            ReviewEscrow proves payment once inside an approved batch budget. Agency approvers verify linguistic correctness.
          </p>
        </section>
        <section className="px-6 py-6 sm:px-9 sm:py-8 space-y-2">
          <h2 className="font-mono font-bold text-[18px] sm:text-[20px] tracking-[-0.04em] text-[var(--ink)]">Self-hosted transcription</h2>
          <p>
            The /api/transcribe x402 endpoint is operated by Sikio and may mishear regional terms above the confidence floor.
          </p>
        </section>
      </div>
    </article>
  );
}
