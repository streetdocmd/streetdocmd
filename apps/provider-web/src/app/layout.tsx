import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter for the design system: --font-inter feeds the Tailwind font stack and tokens.css
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "StreetdocMD Provider",
  description: "Manage your home healthcare visits",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} theme-provider`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}