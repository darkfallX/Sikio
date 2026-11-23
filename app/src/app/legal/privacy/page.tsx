import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacy and excerpt-only audio handling for Sikio.",
};

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="type-page text-[var(--ink)]">Privacy</h1>
        <p className="font-mono text-xs text-[var(--mute)]">
          Excerpt-only confidentiality · Sikio
        </p>
      </div>

      <div className="rounded-[14px] hairline bg-[var(--paper)] divide-y divide-[var(--line)] text-sm text-[var(--ink-2)]">
        <section className="p-6 space-y-1.5">
          <h2 className="font-semibold text-[var(--ink)]">Excerpt-only audio</h2>
          <p>
            /api/excerpt slices flagged WAV passages server-side to at most 12 seconds so editors never receive full client recordings.
          </p>
        </section>
        <section className="p-6 space-y-1.5">
          <h2 className="font-semibold text-[var(--ink)]">Public chain records</h2>
          <p>
            Wallet addresses, task hashes, and tUSD8 payouts on QDay Aevum 44005 are public on the block explorer.
          </p>
        </section>
        <section className="p-6 space-y-1.5">
          <h2 className="font-semibold text-[var(--ink)]">Uploaded files</h2>
          <p>
            Custom audio uploaded in Studio is decoded locally in your browser and can be cleared anytime via Reset.
          </p>
        </section>
      </div>
    </article>
  );
}
