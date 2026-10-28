import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter for the design system: --font-inter feeds the Tailwind font stack and tokens.css
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "StreetdocMD — Home Healthcare",
  description: "On-demand healthcare at your doorstep",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}