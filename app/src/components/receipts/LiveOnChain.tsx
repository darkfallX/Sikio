"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { PaymentReceipt } from "@/lib/types";
import { explorerAddressUrl, explorerTxUrl, shortAddr, shortHash } from "@/lib/aevum";
import { SPRING } from "@/components/motion-kit";
import { ReceiptBadge, describeReceipt } from "./ReceiptRow";

/*
  Real, confirmed chain 44005 transactions only (verifiedOnChainProofs).
  These are the only hashes on this page that link to the explorer by default.
*/
export function LiveOnChain({
  proofs,
  escrowAddress,
  tokenAddress,
}: {
  proofs: PaymentReceipt[];
  escrowAddress: string | null;
  tokenAddress: string;
}) {
  return (
    <section aria-labelledby="live-h" className="brut-lg pastel-mint p-4 sm:p-8 grid gap-5 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 border-[#111] bg-white text-[#111] font-mono text-[12px] font-bold">
            <span className="w-2 h-2 rounded-full bg-[#2fa84f] sikio-led" aria-hidden="true" />
            Chain 44005
          </span>
          <h2 id="live-h" className="type-section text-[#111]">
            Live on QDay Aevum
          </h2>
          <p className="text-[15px] text-[#111]/75 max-w-[52ch]">
            Real testnet transactions from Nov 22, 2026. The chain proves each payout happened once. The approver checks the words.
          </p>
        </div>
      </div>

      {proofs.length === 0 ? (
        <p className="rounded-[18px] border-2 border-dashed border-[#111]/40 px-5 py-5 text-[14px] text-[#111]/75">
          No confirmed live transactions are recorded yet.
        </p>
      ) : (
        <ul className="grid gap-3">
          {proofs.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, x: -14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ ...SPRING.soft, delay: i * 0.07 }}
              className="brut-sm min-w-0 bg-[var(--paper)] text-[var(--ink)] px-4 sm:px-5 py-4 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[110px_minmax(0,1fr)_110px_auto] items-center gap-x-4 gap-y-2"
            >
              <div>
                <ReceiptBadge kind={p.kind} />
              </div>
              <div className="md:order-3 text-right font-mono font-bold text-[15px] tabular-nums whitespace-nowrap">
                {p.amountTusd8.toFixed(2)}
                <span className="ml-1 text-[11px] text-[var(--mute)]">tUSD8</span>
              </div>
              <div className="col-span-2 md:col-span-1 md:order-2 min-w-0">
                <div className="font-bold text-[15px] leading-snug">{describeReceipt(p)}</div>
                <div className="text-[13px] text-[var(--mute)] leading-snug mt-0.5 break-words">{p.note}</div>
              </div>
              <a
                href={explorerTxUrl(p.txHash)}
                target="_blank"
                rel="noreferrer"
                className="col-span-2 md:col-span-1 md:order-4 justify-self-start md:justify-self-end inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-full border-2 border-[var(--outline)] pastel-mint font-mono text-[12.5px] font-bold press"
                style={{ boxShadow: "2px 2px 0 var(--outline)" }}
              >
                {shortHash(p.txHash)}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </motion.li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AddressCard
          label="ReviewEscrow contract"
          sub="Holds the batch and pays each task once"
          address={escrowAddress}
          copyable
        />
        <AddressCard label="tUSD8 token" sub="Test dollars, 6 decimals" address={tokenAddress} />
      </div>
    </section>
  );
}

function AddressCard({
  label,
  sub,
  address,
  copyable = false,
}: {
  label: string;
  sub: string;
  address: string | null;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    if (!address) return;
    let result: "ok" | "fail" = "ok";
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      result = "fail";
    }
    setCopied(result);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1700);
  };

  return (
    <div className="rounded-[18px] border-2 border-[#111] bg-white text-[#111] px-4 sm:px-5 py-4 flex items-center gap-3 min-w-0">
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[12px] font-bold text-[#111]/65">{label}</div>
        {address ? (
          <a
            href={explorerAddressUrl(address)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 min-h-[44px] md:min-h-[32px] font-mono text-[15px] font-bold underline underline-offset-4 decoration-2 hover:decoration-[#2fa84f]"
          >
            {shortAddr(address)}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <div className="font-mono text-[15px] font-bold">Not deployed</div>
        )}
        <div className="text-[12.5px] text-[#111]/65">{sub}</div>
      </div>
      {copyable && address && (
        <button
          type="button"
          onClick={copy}
          aria-label={copied === "ok" ? "Address copied" : "Copy contract address"}
          className="relative shrink-0 w-11 h-11 rounded-full border-2 border-[#111] bg-white text-[#111] grid place-items-center cursor-pointer hover:bg-[#c6f4c1] transition-colors"
          style={{ boxShadow: "2px 2px 0 #111" }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied === "ok" ? (
              <motion.span
                key="ok"
                initial={{ scale: 0.3, rotate: -40, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={SPRING.bouncy}
              >
                <Check className="w-4 h-4" strokeWidth={3} />
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={SPRING.snappy}
              >
                <Copy className="w-4 h-4" />
              </motion.span>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {copied && (
              <motion.span
                role="status"
                initial={{ opacity: 0, y: 6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4 }}
                transition={SPRING.snappy}
                className="absolute -top-9 right-0 whitespace-nowrap px-2.5 py-1 rounded-full border-2 border-[#111] bg-[#111] text-white font-mono text-[11px] font-bold"
              >
                {copied === "ok" ? "Copied" : "Copy failed"}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      )}
    </div>
  );
}
