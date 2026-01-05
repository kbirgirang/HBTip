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
  title: "Í handbolta 2026 – Vinnustaðakeppni",
  description: "Spáðu í úrslit EM í handbolta 2026",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png" },
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeToggle />
        {children}
        <footer className="fixed bottom-0 left-0 right-0 text-center text-xs text-neutral-500 py-2 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm border-t border-neutral-200 dark:border-neutral-800">
          Kári Birgir
        </footer>
      </body>
    </html>
  );
}
