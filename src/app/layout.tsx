import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Betlihem – Tippsíða",
  description: "Tippsíða fyrir ýmsar keppnir og mót",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Betlihem",
  },
  icons: {
    icon: [
      { url: "/BET-appicon-dark-0126.svg?v=2", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/BET-appicon-dark-0126.svg?v=2", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="is" className="dark" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Betlihem" />
        <link rel="apple-touch-icon" href="/BET-appicon-dark-0126.svg?v=2" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
