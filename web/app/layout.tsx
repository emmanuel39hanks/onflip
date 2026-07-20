import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flip — one payment, one position, every prediction market",
  description:
    "Flip is a paid API for agents: combine live Polymarket and Kalshi markets into a single position, funded by one USDT payment on X Layer via x402.",
  openGraph: {
    title: "Flip",
    description:
      "Combine live Polymarket and Kalshi markets into one position. Quote free, pay one 402, hold the ticket.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
