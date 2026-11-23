import React from "react";
import Link from "next/link";
import { AEVUM_CONFIG, explorerAddressUrl, shortAddr } from "@/lib/aevum";
import { SikioMark } from "./SikioMark";

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-[var(--outline)] bg-[var(--paper)]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-7 py-8 grid gap-6 sm:grid-cols-[1fr_auto] items-end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <SikioMark className="w-7 h-7" />
            <span className="font-display text-[20px] leading-none">sikio</span>
          </div>
          <p className="text-[14px] text-[var(--mute)] max-w-md">
            Captions that hear Africa. Built for the Aevum Builder Challenge on QDay Aevum testnet.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-[var(--mute)]">
            <span>Chain 44005</span>
            <a
              href={explorerAddressUrl(AEVUM_CONFIG.reviewEscrowAddress)}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--ink)] underline-offset-2 hover:underline min-h-[44px] sm:min-h-0 inline-flex items-center"
            >
              Escrow {shortAddr(AEVUM_CONFIG.reviewEscrowAddress)}
            </a>
            <span>tUSD8</span>
          </div>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[14px] font-medium">
          {[
            { href: "/legal/terms", label: "Terms", ext: false },
            { href: "/legal/privacy", label: "Privacy", ext: false },
            { href: "https://explorer-test.qday.info", label: "Explorer", ext: true },
            { href: "https://faucet.qday.info/en", label: "Faucet", ext: true },
          ].map((l) =>
            l.ext ? (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="min-h-[44px] px-3 inline-flex items-center rounded-full hover:bg-[var(--hover)]">
                {l.label}
              </a>
            ) : (
              <Link key={l.label} href={l.href} className="min-h-[44px] px-3 inline-flex items-center rounded-full hover:bg-[var(--hover)]">
                {l.label}
              </Link>
            )
          )}
        </nav>
      </div>
    </footer>
  );
}
