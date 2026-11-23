"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { X, ExternalLink, Plus, ArrowRight } from "lucide-react";
import { useWallet } from "./WalletContext";
import { AEVUM_CONFIG, shortAddr } from "@/lib/aevum";
import { SikioMark } from "./SikioMark";
import { ThemeToggle } from "./ThemeToggle";
import { buttonClass } from "./ui";

interface NavMeta {
  openEar: number;
  waitingApprove: number;
  batchId: number;
  availableBudget: number | null;
}

const APP_ITEMS = [
  { href: "/studio", label: "Studio" },
  { href: "/ear", label: "Ear" },
  { href: "/approve", label: "Approve" },
  { href: "/receipts", label: "Receipts" },
];

const MARKETING_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#agencies", label: "For agencies" },
  { href: "/#editors", label: "For editors" },
  { href: "/receipts", label: "Receipts" },
];

function AppTabs({
  id,
  pathname,
  badgeFor,
  fill = false,
}: {
  id: string;
  pathname: string;
  badgeFor: (href: string) => number;
  fill?: boolean;
}) {
  return (
    <div
      className={`${
        fill ? "grid grid-cols-4 w-full" : "flex"
      } items-center gap-0.5 sm:gap-1 p-1 rounded-full border-2 border-[var(--outline)] bg-[var(--paper)]`}
    >
      {APP_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const badge = badgeFor(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative ${
              fill ? "min-h-[44px] px-1.5 justify-center text-[13px] gap-1" : "min-h-[40px] px-4 text-[14px] gap-1.5"
            } inline-flex items-center rounded-full font-bold transition-colors ${
              active ? "text-white" : "text-[var(--ink)] hover:bg-[var(--hover)]"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`nav-pill-${id}`}
                className="absolute inset-0 rounded-full bg-[#111]"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative">{item.label}</span>
            {badge > 0 && (
              <span className="relative min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full border-2 border-[#111] bg-[var(--yellow)] text-[#111] font-mono text-[11px] font-bold tabular-nums">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
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

  // The header gains its ink outline once the page scrolls
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 8));

  useEffect(() => {
    if (isLanding) return;
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
            typeof json.availableBudgetTusd8 === "number" ? json.availableBudgetTusd8 : null,
        });
      } catch {
        // transient poll error
      }
    };
    syncCounts();
    const onSync = () => syncCounts();
    window.addEventListener("sikio:state-updated", onSync);
    return () => {
      active = false;
      window.removeEventListener("sikio:state-updated", onSync);
    };
  }, [pathname, isLanding]);

  const badgeFor = (href: string) =>
    href === "/ear" ? meta.openEar : href === "/approve" ? meta.waitingApprove : 0;

  return (
    <header
      style={{ backgroundColor: "var(--header-bg)" }}
      className={`sticky top-0 z-40 backdrop-blur-md transition-[border-color] duration-300 border-b-2 ${
        scrolled ? "border-[var(--outline)]" : "border-transparent"
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-7 h-[68px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0 min-h-[44px]" aria-label="Sikio home">
            <motion.span
              whileHover={{ rotate: -12, scale: 1.08 }}
              transition={{ type: "spring", stiffness: 400, damping: 12 }}
              className="inline-flex"
            >
              <SikioMark className="w-8 h-8" />
            </motion.span>
            <span className="font-display text-[22px] leading-none text-[var(--ink)]">sikio</span>
          </Link>

          {isLanding ? (
            <nav aria-label="Site" className="hidden lg:flex items-center gap-1">
              {MARKETING_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="min-h-[44px] px-3 inline-flex items-center rounded-full text-[15px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)]"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          ) : (
            <nav aria-label="App" className="hidden md:block">
              <AppTabs id="desk" pathname={pathname} badgeFor={badgeFor} />
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isLanding ? (
            <Link href="/studio" className={buttonClass("primary", "md")}>
              <span className="hidden sm:inline">Open the demo</span>
              <span className="sm:hidden">Demo</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              {meta.availableBudget !== null && (
                <Link
                  href="/receipts"
                  title="Budget left in this batch"
                  className="hidden xl:inline-flex items-center gap-2 min-h-[40px] px-3 rounded-full border-2 border-[var(--outline)] bg-[var(--mint)] text-[#111] font-mono text-[12px] font-bold tabular-nums"
                >
                  <span className="w-2 h-2 rounded-full bg-[#111] sikio-led" />
                  {meta.availableBudget.toFixed(2)} tUSD8 left
                </Link>
              )}

              {address ? (
                <div className="flex items-center gap-1.5">
                  {!isAevum ? (
                    <button type="button" onClick={switchToAevum} className={buttonClass("primary", "sm")}>
                      Switch to 44005
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={addTusd8ToWallet}
                        title="Watch tUSD8 in your wallet"
                        className={buttonClass("secondary", "sm", "hidden sm:inline-flex font-mono tabular-nums")}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {tusd8Balance ?? "0.00"} tUSD8
                      </button>
                      <button
                        type="button"
                        onClick={() => setLiveEscrowMode(!liveEscrowMode)}
                        aria-pressed={liveEscrowMode}
                        title="Sign real transactions on chain 44005"
                        className={buttonClass(liveEscrowMode ? "pay" : "secondary", "sm", "hidden sm:inline-flex font-mono")}
                      >
                        {liveEscrowMode ? "Live tx" : "Sandbox"}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={disconnect}
                    title="Disconnect wallet"
                    className={buttonClass("secondary", "sm", "font-mono")}
                  >
                    {shortAddr(address)}
                  </button>
                </div>
              ) : (
                <button type="button" disabled={connecting} onClick={connectWallet} className={buttonClass("dark", "sm")}>
                  {connecting ? "Connecting" : "Connect"}
                </button>
              )}
            </>
          )}
          <ThemeToggle />
        </div>
      </div>

      {error && (
        <div role="status" aria-live="polite" className="border-t-2 border-[var(--outline)] bg-[var(--peach)] text-[13px] text-[#111]">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-7 py-2 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
              <span className="font-bold">{error}</span>
              <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                Get MetaMask <ExternalLink className="w-3 h-3" />
              </a>
              <a href={AEVUM_CONFIG.faucetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                tUSD8 faucet <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss wallet notice"
              className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-full hover:bg-black/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!isLanding && (
        <nav aria-label="App mobile" className="md:hidden px-3 pb-3">
          <AppTabs id="mobile" pathname={pathname} badgeFor={badgeFor} fill />
        </nav>
      )}
    </header>
  );
}
