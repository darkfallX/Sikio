"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "./WalletContext";
import { shortAddr } from "@/lib/aevum";
import { AudioWaveform, Headphones, CheckSquare, ReceiptText } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Studio", icon: AudioWaveform },
  { href: "/ear", label: "Ear", icon: Headphones },
  { href: "/approve", label: "Approve", icon: CheckSquare },
  { href: "/receipts", label: "Receipts", icon: ReceiptText },
];

export function TopNav() {
  const pathname = usePathname();
  const {
    address,
    isAevum,
    tusd8Balance,
    connecting,
    connectWallet,
    switchToAevum,
    disconnect,
  } = useWallet();

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2DDD2] bg-[#FCFBF8]">
      <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#161513] text-[#FCFBF8] text-sm font-semibold tracking-tight">
              S
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.02em] text-[#161513]">
              Sikio
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#EFECE4] text-[#161513]"
                      : "text-[#5C584F] hover:text-[#161513] hover:bg-[#F3F0E9]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.9} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {address ? (
            <div className="flex items-center gap-2">
              {!isAevum ? (
                <button
                  type="button"
                  onClick={switchToAevum}
                  className="px-2.5 py-1.5 rounded-[6px] text-xs font-medium bg-[#F9EAE4] text-[#C54B24] border border-[#EBC7BA] hover:bg-[#F4DCD3] transition-colors cursor-pointer"
                >
                  Switch to Aevum 44005
                </button>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium bg-[#E9F4EE] text-[#1D6B48] border border-[#C6E3D3] tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1D6B48]" />
                  Aevum 44005 · {tusd8Balance ?? "0.00"} tUSD8
                </span>
              )}
              <button
                type="button"
                onClick={disconnect}
                title="Disconnect wallet"
                className="px-2.5 py-1.5 rounded-[6px] text-xs font-mono text-[#161513] bg-[#EFECE4] border border-[#E2DDD2] hover:border-[#CFC8B8] transition-colors cursor-pointer"
              >
                {shortAddr(address)}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                title="Interactive Sandbox executes identical ReviewEscrow rules locally; connect an Aevum 44005 wallet for live on-chain tUSD8 tx."
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium bg-[#EFECE4] text-[#5C584F] border border-[#E2DDD2]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#C54B24]" />
                Aevum 44005 · Sandbox
              </span>
              <button
                type="button"
                disabled={connecting}
                onClick={connectWallet}
                className="px-3 py-1.5 rounded-[6px] text-xs font-medium bg-[#161513] text-[#FCFBF8] hover:bg-[#2E2C28] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {connecting ? "Connecting…" : "Connect Aevum"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile navigation strip */}
      <nav
        aria-label="Mobile Primary"
        className="md:hidden border-t border-[#E2DDD2] px-2 py-1.5 flex items-center justify-around bg-[#FCFBF8]"
      >
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs font-medium ${
                active ? "bg-[#EFECE4] text-[#161513]" : "text-[#5C584F]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.9} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
