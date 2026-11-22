import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms of Use for Sikio on QDay Aevum Testnet.",
};

export default function TermsPage() {
  return (
    <article className="max-w-2xl mx-auto rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] p-6 sm:p-8 space-y-5 text-sm leading-relaxed text-[#141311]">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Terms of Use</h1>
      <p className="text-xs font-mono text-[#5C584F]">
        Effective: November 2026 · QDay Aevum Testnet Prototype
      </p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">1. Testnet-Only Prototype</h2>
        <p className="text-[#5C584F]">
          Sikio operates exclusively on the QDay Aevum Testnet (Chain ID 44005) using test tokens (tUSD8 and tQDAY) with no monetary value. No real funds or mainnet custody are supported in this release.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">2. What the Blockchain Proves</h2>
        <p className="text-[#5C584F]">
          The ReviewEscrow smart contract enforces batch spending limits, per-task fee caps, session expiry, trusted-editor allowlists, and exact-once settlement per taskId. The blockchain proves payment execution within an approved budget; it does not attest to linguistic accuracy. Agency approvers remain solely responsible for reviewing and approving subtitle text before publication.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">3. Self-Hosted Transcription Endpoint</h2>
        <p className="text-[#5C584F]">
          The /api/transcribe HTTP 402 (x402) transcription endpoint included in this application is operated by Sikio and labelled accordingly. Machine transcription may produce overconfident errors on regional accents, proper nouns, or code-switching.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">4. Open-Source License</h2>
        <p className="text-[#5C584F]">
          Sikio smart contracts and web application source code are distributed under the MIT License without warranty of any kind.
        </p>
      </section>
    </article>
  );
}
