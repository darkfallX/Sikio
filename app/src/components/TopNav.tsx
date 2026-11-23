"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ExternalLink, Plus } from "lucide-react";
import { useWallet } from "./WalletContext";
import { AEVUM_CONFIG, shortAddr } from "@/lib/aevum";
import { SikioMark } from "./SikioMark";
import { ThemeToggle } from "./ThemeToggle";

interface NavMeta {
  openEar: number;
  waitingApprove: number;
  batchId: number;
  availableBudget: number | null;
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
    liveEscrowMode,
    setLiveEscrowMode,
    tusd8Balance,
    connecting,
    error,
    clearError,
    connectWallet,
    switchToAevum,
    addTusd8ToWallet,
    disconnect,
  } = useWallet();

  const [meta, setMeta] = useState<NavMeta>({
    openEar: 0,
    waitingApprove: 0,
    batchId: 1,
    availableBudget: null,
  });

  useEffect(() => {
    let active = true;
    const syncCounts = async () => {
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          tasks?: { status: string }[];
          batch?: { batchId: number };
          availableBudgetTusd8?: number;
        };
        if (!active || !json.tasks) return;
        setMeta({
          openEar: json.tasks.filter((t) => t.status === "offered").length,
          waitingApprove: json.tasks.filter((t) => t.status === "submitted").length,
          batchId: json.batch?.batchId ?? 1,
          availableBudget:
            typeof json.availableBudgetTusd8 === "number"
              ? json.availableBudgetTusd8
              : null,
        });
      } catch {
        // Ignore transient poll error
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
    if (href === "/ear") return meta.openEar;
    if (href === "/approve") return meta.waitingApprove;
    return 0;
  };

  return (
    <header
      style={{ backgroundColor: "var(--header-bg)" }}
      className="sticky top-0 z-30 hairline-b backdrop-blur-md"
    >
      <div className="max-w-[1240px] mx-auto px-4 sm:px-7 h-15 flex items-center justify-between gap-3">
        <div className="flex items-center gap-7 min-w-0">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group min-h-[44px]">
            <SikioMark className="w-6 h-6 text-[var(--ink)] transition-transform duration-200 group-hover:scale-105" />
            <span className="text-[21px] font-extrabold tracking-[-0.03em] text-[var(--ink)] leading-none">
              Sikio<span className="text-[var(--signal)]">.</span>
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
                  className={`relative inline-flex items-center gap-1.5 px-3 py-2 text-[14px] font-medium transition-colors ${
                    active
                      ? "text-[var(--ink)] font-semibold"
                      : "text-[var(--mute)] hover:text-[var(--ink)]"
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
                  <span
                    aria-hidden="true"
                    className={`absolute left-3 right-3 bottom-0.5 h-[2px] bg-[var(--ink)] transition-transform duration-300 origin-left ${
                      active ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {meta.availableBudget !== null && (
            <Link
              href="/receipts"
              className="hidden lg:inline-flex items-center gap-2 h-9 px-3 rounded-[8px] hairline bg-[var(--paper)]/70 font-mono text-[11px] text-[var(--ink-2)] hover:text-[var(--ink)] tabular-nums"
              title="Active session cap"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
              <span>
                Batch #{meta.batchId} · {meta.availableBudget.toFixed(2)} tUSD8
              </span>
            </Link>
          )}

          {address ? (
            <div className="flex items-center gap-1.5">
              {!isAevum ? (
                <button
                  type="button"
                  onClick={switchToAevum}
                  className="min-h-[44px] sm:min-h-[36px] px-3 rounded-[8px] text-xs font-semibold bg-[var(--signal-bg)] text-[var(--signal-ink)] cursor-pointer"
                >
                  Switch to 44005
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={addTusd8ToWallet}
                    title="Watch tUSD8 in wallet"
                    className="hidden sm:inline-flex items-center gap-1 h-9 px-2.5 rounded-[8px] hairline bg-[var(--paper)] font-mono text-[11px] font-medium text-[var(--green)] hover:bg-[var(--hover)] tabular-nums cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    {tusd8Balance ?? "0.00"} tUSD8
                  </button>
                  <button
                    type="button"
                    onClick={() => setLiveEscrowMode(!liveEscrowMode)}
                    title="Toggle live Chain 44005 signing"
                    className={`hidden sm:inline-flex items-center gap-1.5 h-9 px-2.5 rounded-[8px] font-mono text-[11px] font-medium hairline cursor-pointer transition-colors ${
                      liveEscrowMode
                        ? "bg-[var(--green-bg)] text-[var(--green)]"
                        : "bg-[var(--paper)] text-[var(--mute)]"
                    }`}
                  >
                    {liveEscrowMode ? "Live tx" : "Sandbox"}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={disconnect}
                title="Disconnect wallet"
                className="min-h-[44px] sm:min-h-[36px] px-3 rounded-[8px] font-mono text-xs hairline bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer"
              >
                {shortAddr(address)}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={connecting}
              onClick={connectWallet}
              className="min-h-[44px] sm:min-h-[36px] px-3.5 rounded-[8px] text-xs font-semibold bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>

      {/* Wallet feedback toast/notice bar (Fixes silent dead Connect button) */}
      {error && (
        <div
          role="status"
          aria-live="polite"
          className="hairline-t bg-[var(--paper)] text-xs text-[var(--ink)]"
        >
          <div className="max-w-[1240px] mx-auto px-4 sm:px-7 py-2 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
              <span className="font-medium text-[var(--signal-ink)]">{error}</span>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono underline underline-offset-2 text-[var(--ink)] hover:text-[var(--signal)]"
              >
                Get MetaMask <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={AEVUM_CONFIG.faucetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono underline underline-offset-2 text-[var(--ink)] hover:text-[var(--signal)]"
              >
                tUSD8 Faucet <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss wallet notice"
              className="min-h-[36px] min-w-[36px] shrink-0 inline-flex items-center justify-center rounded-[6px] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--hover)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile navigation bar: 44px touch targets */}
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
