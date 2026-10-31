import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import "./globals.css";
import ThemeScript from "@/components/theme/ThemeScript";
import { DialogProvider } from "@/components/ds";

// Avenir is the brand font (see packages/design/tokens.ts). Nunito Sans, the closest
// free match, is the fallback for devices without it: --font-fallback feeds the stack.
const nunito = Nunito_Sans({ subsets: ["latin"], variable: "--font-fallback", display: "swap", adjustFontFallback: false });

export const metadata: Metadata = {
  title: "StreetdocMD Provider",
  description: "Manage your home healthcare visits",
};

// Browser bar colour: the app opens in light mode unless the user picks otherwise
export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} theme-provider`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}