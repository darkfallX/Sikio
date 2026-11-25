import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/WalletContext";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { MotionProvider } from "@/components/MotionProvider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Sikio · Captions that hear Africa",
    template: "%s · Sikio",
  },
  description:
    "A pay-per-task stablecoin settlement app on QDay Aevum. A native speaker is paid once in tUSD8 for the exact seconds they fix in African-voice captions.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  openGraph: {
    title: "Sikio · Captions that hear Africa",
    description:
      "A pay-per-task settlement app on QDay Aevum. A native speaker is paid once in tUSD8 for the exact seconds they fix.",
    type: "website",
  },
};

// Light first. Dark only when the visitor chose it with the toggle.
const THEME_INIT_SCRIPT = `
(function(){
  try {
    if (localStorage.getItem('sikio-theme') === 'dark') {
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
      className={`${spaceGrotesk.variable} ${spaceMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)]">
        <MotionProvider>
          <WalletProvider>
            <TopNav />
            <main className="flex-1 w-full">{children}</main>
            <SiteFooter />
          </WalletProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
