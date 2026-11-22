"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "./WalletContext";
import { shortAddr } from "@/lib/aevum";
import { SikioMark } from "./SikioMark";
import {
  AudioWaveform,
  Headphones,
  CheckSquare,
  ReceiptText,
} from "lucide-react";

interface NavCounts {
  openEar: number;
  waitingApprove: number;
}

const NAV_ITEMS = [
  { href: "/", label: "Studio", step: "01", icon: AudioWaveform },
  { href: "/ear", label: "Ear", step: "02", icon: Headphones },
  { href: "/approve", label: "Approve", step: "03", icon: CheckSquare },
  { href: "/receipts", label: "Receipts", step: "04", icon: ReceiptText },
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

  const [counts, setCounts] = useState<NavCounts>({
    openEar: 0,
    waitingApprove: 0,
  });

  useEffect(() => {
    let active = true;
    const syncCounts = async () => {
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          tasks?: { status: string }[];
        };
        if (!active || !json.tasks) return;
        setCounts({
          openEar: json.tasks.filter((t) => t.status === "offered").length,
          waitingApprove: json.tasks.filter((t) => t.status === "submitted").length,
        });
      } catch {
        // Silent nav count sync failure
      }
    };
    syncCounts();
    const onCustomSync = () => syncCounts();
    window.addEventListener("sikio:state-updated", onCustomSync);
    return () => {
      active = false;
      window.removeEventListener("sikio:state-updated", onCustomSync);
    };
  }, [pathname]);

  const badgeFor = (href: string): number => {
    if (href === "/ear") return counts.openEar;
    if (href === "/approve") return counts.waitingApprove;
    return 0;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#DDD7CA] bg-[#FBF9F4]">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0 group"
          >
            <SikioMark className="w-7 h-7 transition-transform duration-150 group-hover:scale-[1.03]" />
            <div className="flex items-baseline gap-2">
              <span className="text-[17px] font-semibold tracking-[-0.025em] text-[#141311]">
                Sikio
              </span>
              <span className="hidden lg:inline text-[11px] font-mono uppercase tracking-[0.06em] text-[#847D72]">
                Aevum · 44005
              </span>
            </div>
          </Link>

          <nav
            aria-label="Primary workflow"
            className="hidden md:flex items-center gap-1 border-l border-[#DDD7CA] pl-5"
          >
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              const badge = badgeFor(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-[#141311] text-[#FBF9F4]"
                      : "text-[#5C574E] hover:text-[#141311] hover:bg-[#EBE6DB]"
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] ${
                      active ? "text-[#C94A22]" : "text-[#847D72]"
                    }`}
                  >
                    {item.step}
                  </span>
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.9} />
                  <span>{item.label}</span>
                  {badge > 0 && (
                    <span
                      className={`ml-0.5 px-1.5 py-[1px] rounded-[3px] font-mono text-[10px] font-semibold tabular-nums ${
                        active
                          ? "bg-[#C94A22] text-[#FBF9F4]"
                          : "bg-[#FAEAE4] text-[#C94A22]"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
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
                  className="px-2.5 py-1.5 rounded-[5px] text-xs font-medium bg-[#FAEAE4] text-[#C94A22] border border-[#E8C5B8] hover:bg-[#F5DDD4] transition-colors cursor-pointer"
                >
                  Switch to Aevum
                </button>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-xs font-mono font-medium bg-[#E7F4ED] text-[#1B6B46] border border-[#C3E2D1] tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B46]" />
                  {tusd8Balance ?? "0.00"} tUSD8
                </span>
              )}
              <button
                type="button"
                onClick={disconnect}
                title="Disconnect wallet"
                className="px-2.5 py-1.5 rounded-[5px] text-xs font-mono text-[#141311] bg-[#EBE6DB] border border-[#DDD7CA] hover:border-[#C7BFB0] transition-colors cursor-pointer"
              >
                {shortAddr(address)}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                title="Live ReviewEscrow deployed on Aevum 44005 (0x36Cf...5E6b). Interactive browser flows run locally until wallet is connected."
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-[11px] font-mono text-[#5C574E] bg-[#EBE6DB] border border-[#DDD7CA]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B46]" />
                0x36Cf…5E6b
              </span>
              <button
                type="button"
                disabled={connecting}
                onClick={connectWallet}
                className="px-3 py-1.5 rounded-[5px] text-xs font-medium bg-[#141311] text-[#FBF9F4] hover:bg-[#2B2926] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {connecting ? "Connecting…" : "Connect Wallet"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom-thumb workflow strip */}
      <nav
        aria-label="Mobile workflow"
        className="md:hidden border-t border-[#DDD7CA] px-2 py-1.5 grid grid-cols-4 gap-1 bg-[#FBF9F4]"
      >
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const badge = badgeFor(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-[5px] text-[11px] font-medium ${
                active
                  ? "bg-[#141311] text-[#FBF9F4]"
                  : "text-[#5C574E]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.9} />
              <span>{item.label}</span>
              {badge > 0 && (
                <span className="absolute top-1 right-2 px-1 rounded-[3px] bg-[#C94A22] text-[#FBF9F4] font-mono text-[9px] font-semibold">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
