import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flip — the execution router for prediction agents",
  description:
    "Turn a view into a real prediction-market position. Flip builds and relays the order; you sign it with your own key and keep custody of your funds.",
  openGraph: {
    title: "Flip",
    description:
      "Your agent has a view. Flip makes it a position — non-custodial execution on Polymarket, priced against Kalshi, for a flat $0.02 routing fee.",
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
