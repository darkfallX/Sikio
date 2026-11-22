import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy and excerpt-only media confidentiality for Sikio.",
};

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl mx-auto rounded-[6px] border border-[#DDD7CA] bg-[#FBF9F4] p-6 sm:p-8 space-y-5 text-sm leading-relaxed text-[#141311]">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Privacy Policy</h1>
      <p className="text-xs font-mono text-[#5C584F]">
        Effective: November 2026 · Sikio
      </p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">1. Excerpt-Only Audio Confidentiality</h2>
        <p className="text-[#5C584F]">
          To protect client media confidentiality, Sikio slices flagged passages server-side (/api/excerpt) to a maximum 12-second window around uncertain words. Editors using the Ear interface never receive full agency audio or video files.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">2. Public Blockchain Data</h2>
        <p className="text-[#5C584F]">
          When operating in live Aevum Testnet mode, wallet addresses, batch caps, taskId hashes, excerpt hashes, correction hashes, and tUSD8 settlement amounts are recorded publicly on QDay Aevum (Chain ID 44005). Do not place confidential plaintext inside on-chain hashes or memos.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">3. Local State & Uploaded Media</h2>
        <p className="text-[#5C584F]">
          Custom audio uploaded in Studio is decoded locally in your browser for playback and duration detection. Demo state is stored locally in the application workspace and can be cleared anytime via Reset Batch.
        </p>
      </section>
    </article>
  );
}
