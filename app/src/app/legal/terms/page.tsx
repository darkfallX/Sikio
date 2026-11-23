import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for Sikio on QDay Aevum testnet.",
};

export default function TermsPage() {
  return (
    <article className="max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="type-page text-[var(--ink)]">Terms</h1>
        <p className="font-mono text-xs text-[var(--mute)]">
          QDay Aevum testnet · Chain 44005
        </p>
      </div>

      <div className="rounded-[14px] hairline bg-[var(--paper)] divide-y divide-[var(--line)] text-sm text-[var(--ink-2)]">
        <section className="p-6 space-y-1.5">
          <h2 className="font-semibold text-[var(--ink)]">Testnet only</h2>
          <p>
            Sikio runs on QDay Aevum testnet using test tokens (tUSD8 and tQDAY) with no monetary value.
          </p>
        </section>
        <section className="p-6 space-y-1.5">
          <h2 className="font-semibold text-[var(--ink)]">Payment vs accuracy</h2>
          <p>
            ReviewEscrow proves payment once inside an approved batch budget. Agency approvers verify linguistic correctness.
          </p>
        </section>
        <section className="p-6 space-y-1.5">
          <h2 className="font-semibold text-[var(--ink)]">Self-hosted transcription</h2>
          <p>
            The /api/transcribe x402 endpoint is operated by Sikio and may mishear regional terms above the confidence floor.
          </p>
        </section>
      </div>
    </article>
  );
}
