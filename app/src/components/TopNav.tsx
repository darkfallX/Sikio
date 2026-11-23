"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "./WalletContext";
import { shortAddr } from "@/lib/aevum";
import { SikioMark } from "./SikioMark";
import { ThemeToggle } from "./ThemeToggle";

interface NavCounts {
  openEar: number;
  waitingApprove: number;
}

const NAV_ITEMS = [
  { href: "/", label: "Studio" },
  { href: "/ear", label: "Ear" },
  { href: "/approve", label: "Approve" },
  { href: "/receipts", label: "Receipts" },
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
        // Ignore transient sync error
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
    <header
      style={{ backgroundColor: "var(--header-bg)" }}
      className="sticky top-0 z-30 hairline-b backdrop-blur-md"
    >
      <div className="max-w-[1240px] mx-auto px-4 sm:px-7 h-15 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <SikioMark className="w-6 h-6 text-[var(--ink)]" />
            <span className="text-[18px] font-extrabold tracking-[-0.03em] text-[var(--ink)]">
              Sikio
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const badge = badgeFor(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[14px] font-medium transition-colors ${
                    active
                      ? "bg-[var(--ink)] text-[var(--paper)]"
                      : "text-[var(--ink-2)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
                  }`}
                >
                  <span>{item.label}</span>
                  {badge > 0 && (
                    <span
                      className={`px-1.5 py-[1px] rounded-full font-mono text-[10px] font-semibold tabular-nums ${
                        active
                          ? "bg-[var(--signal)] text-[#faf8f2]"
                          : "bg-[var(--signal-bg)] text-[var(--signal-ink)]"
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

        <div className="flex items-center gap-2 shrink-0">
          {address ? (
            <div className="flex items-center gap-2">
              {!isAevum ? (
                <button
                  type="button"
                  onClick={switchToAevum}
                  className="h-9 px-3 rounded-[8px] text-xs font-medium bg-[var(--signal-bg)] text-[var(--signal-ink)] cursor-pointer"
                >
                  Switch chain
                </button>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-full font-mono text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] tabular-nums">
                  {tusd8Balance ?? "0.00"} tUSD8
                </span>
              )}
              <button
                type="button"
                onClick={disconnect}
                title="Disconnect wallet"
                className="h-9 px-3 rounded-[8px] font-mono text-xs hairline bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer"
              >
                {shortAddr(address)}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={connecting}
              onClick={connectWallet}
              className="h-10 sm:h-9 px-3.5 rounded-[8px] text-xs font-semibold bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile navigation bar: 44px touch targets, fits cleanly at 375px */}
      <nav
        aria-label="Mobile"
        className="md:hidden hairline-t px-2 py-1 grid grid-cols-4 gap-1 bg-[var(--paper)]"
      >
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const badge = badgeFor(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`min-h-[44px] flex items-center justify-center gap-1 rounded-[8px] text-[13px] font-medium transition-colors ${
                active
                  ? "bg-[var(--ink)] text-[var(--paper)]"
                  : "text-[var(--ink-2)]"
              }`}
            >
              <span>{item.label}</span>
              {badge > 0 && (
                <span className="px-1.5 rounded-full bg-[var(--signal)] text-[#faf8f2] font-mono text-[10px] font-semibold tabular-nums">
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
