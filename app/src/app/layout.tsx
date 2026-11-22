import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/WalletContext";
import { TopNav } from "@/components/TopNav";
import { AEVUM_CONFIG, explorerAddressUrl, shortAddr } from "@/lib/aevum";
import Link from "next/link";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Sikio — AI Captions for African Voices on QDay Aevum",
    template: "%s · Sikio",
  },
  description:
    "AI captions for African voices. When ASR is uncertain, Sikio hires a native speaker for those few seconds and pays them once in tUSD8 on QDay Aevum.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  openGraph: {
    title: "Sikio — AI Captions for African Voices",
    description:
      "Upload a clip. Get publishable subtitles. Pay for the human ear only where the AI needed it, settled in tUSD8 on QDay Aevum.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col bg-[#F4F1EA] text-[#141311]">
        <WalletProvider>
          <TopNav />
          <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {children}
          </main>
          <footer className="border-t border-[#DDD7CA] bg-[#FBF9F4] mt-16">
            <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#5C574E]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold text-[#141311]">Sikio</span>
                <span>QDay Aevum Testnet (Chain 44005)</span>
                <a
                  href={explorerAddressUrl(AEVUM_CONFIG.reviewEscrowAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono hover:text-[#141311] underline-offset-2 hover:underline"
                >
                  ReviewEscrow {shortAddr(AEVUM_CONFIG.reviewEscrowAddress)}
                </a>
                <span className="font-mono">tUSD8 · 0x4565…3483</span>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href="/legal/terms"
                  className="hover:text-[#141311] underline-offset-2 hover:underline"
                >
                  Terms
                </Link>
                <Link
                  href="/legal/privacy"
                  className="hover:text-[#141311] underline-offset-2 hover:underline"
                >
                  Privacy
                </Link>
                <a
                  href="https://explorer-test.qday.info"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#141311] underline-offset-2 hover:underline"
                >
                  Explorer
                </a>
                <a
                  href="https://faucet.qday.info/en"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#141311] underline-offset-2 hover:underline"
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
