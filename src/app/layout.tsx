import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Betlihem – Tippsíða",
  description: "Tippsíða fyrir ýmsar keppnir og mót",
  keywords: ["tipp", "betlihem", "keppnir", "mót", "íslensk tippsíða", "fótbolti", "handbolti"],
  authors: [{ name: "Betlihem" }],
  creator: "Betlihem",
  publisher: "Betlihem",
  metadataBase: new URL("https://betlihemc.om"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Betlihem – Tippsíða",
    description: "Tippsíða fyrir ýmsar keppnir og mót",
    url: "https://betlihemc.om",
    siteName: "Betlihem",
    locale: "is_IS",
    type: "website",
    images: [
      {
        url: "/Bet-logo-0126.png",
        width: 1200,
        height: 630,
        alt: "Betlihem logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Betlihem – Tippsíða",
    description: "Tippsíða fyrir ýmsar keppnir og mót",
    images: ["/Bet-logo-0126.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Betlihem",
  },
  icons: {
    icon: [
      { url: "/BET-appicon-dark-0126.svg?v=3", type: "image/svg+xml" },
      { url: "/BET-appicon-dark-0126.png?v=3", type: "image/png" },
    ],
    apple: [
      { url: "/BET-appicon-dark-0126.svg?v=3", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Betlihem",
    description: "Tippsíða fyrir ýmsar keppnir og mót",
    url: "https://betlihemc.om",
    inLanguage: "is",
  };

  return (
    <html lang="is" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme') || 'dark';
                  document.documentElement.classList.add(theme);
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Betlihem" />
        <link rel="apple-touch-icon" href="/BET-appicon-dark-0126.svg?v=3" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeToggle />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
