import type { Metadata } from "next";
import { Hanken_Grotesk, Fragment_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/WalletContext";
import { TopNav } from "@/components/TopNav";
import { AEVUM_CONFIG, explorerAddressUrl, shortAddr } from "@/lib/aevum";
import Link from "next/link";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const fragmentMono = Fragment_Mono({
  subsets: ["latin"],
  variable: "--font-fragment-mono",
  display: "swap",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: {
    default: "Sikio · AI captions for African voices on QDay Aevum",
    template: "%s · Sikio",
  },
  description:
    "AI captions for African voices. Hire a native speaker for uncertain seconds and pay once in tUSD8 on QDay Aevum.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  openGraph: {
    title: "Sikio · AI captions for African voices",
    description:
      "Pay for the human ear only where AI hesitates, settled once in tUSD8 on QDay Aevum.",
    type: "website",
  },
};

const THEME_INIT_SCRIPT = `
(function(){
  try {
    var saved = localStorage.getItem('sikio-theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${hanken.variable} ${fragmentMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)]">
        <WalletProvider>
          <TopNav />
          <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-7 py-6 sm:py-8">
            {children}
          </main>
          <footer className="hairline-t bg-[var(--paper)] mt-16">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-7 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[var(--mute)]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-extrabold tracking-[-0.02em] text-[var(--ink)]">
                  Sikio
                </span>
                <span className="font-mono tabular-nums">Aevum testnet · 44005</span>
                <a
                  href={explorerAddressUrl(AEVUM_CONFIG.reviewEscrowAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono hover:text-[var(--ink)] underline-offset-2 hover:underline"
                >
                  Escrow {shortAddr(AEVUM_CONFIG.reviewEscrowAddress)}
                </a>
                <span className="font-mono">tUSD8</span>
              </div>
              <div className="flex items-center gap-5">
                <Link href="/legal/terms" className="hover:text-[var(--ink)] py-1">
                  Terms
                </Link>
                <Link href="/legal/privacy" className="hover:text-[var(--ink)] py-1">
                  Privacy
                </Link>
                <a
                  href="https://explorer-test.qday.info"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--ink)] py-1"
                >
                  Explorer
                </a>
                <a
                  href="https://faucet.qday.info/en"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--ink)] py-1"
                >
                  Faucet
                </a>
              </div>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
