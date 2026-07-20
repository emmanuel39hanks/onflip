import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Newsreader } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Flip — one payment, one position, every prediction market",
  description:
    "The execution API for prediction agents. Combine live Polymarket and Kalshi markets into one position, funded by a single x402 payment on X Layer.",
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
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${newsreader.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
