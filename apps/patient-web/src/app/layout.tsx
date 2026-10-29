import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeScript from "@/components/theme/ThemeScript";
import { DialogProvider } from "@/components/ds";
import WhatsAppConcierge from "@/components/WhatsAppConcierge";

// Inter for the design system: --font-inter feeds the Tailwind font stack and tokens.css
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "StreetdocMD — Home Healthcare",
  description: "On-demand healthcare at your doorstep",
};

// Browser bar colour: the app opens in light mode unless the user picks otherwise
export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={inter.className}>
        <DialogProvider>{children}</DialogProvider>
        <WhatsAppConcierge />
      </body>
    </html>
  );
}