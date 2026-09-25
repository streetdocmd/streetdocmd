import type { Metadata } from "next";
import { Mulish, Nunito_Sans } from "next/font/google";
import ScrollReveal from "@/components/ScrollReveal";
import "./globals.css";

// Mulish is used in the design for the hero badge.
const mulish = Mulish({ subsets: ["latin"], weight: ["800"], variable: "--font-mulish" });
// Avenir is the design font. Devices that have Avenir (Apple devices) render it exactly;
// everyone else falls back to Nunito Sans, the closest free match.
const nunito = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "800", "900"],
  variable: "--font-fallback",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://streetdocmd.com"),
  title: "StreetdocMD — Healthcare at your convenience",
  description:
    "StreetdocMD connects you to independent, licensed doctors, nurses, and physiotherapists who come to you — with lab testing, pharmacy delivery, and hospital referral coordinated through the same visit.",
  openGraph: {
    title: "StreetdocMD — Healthcare at your convenience",
    description: "Verified doctors, nurses, and physiotherapists who come to you.",
    url: "https://streetdocmd.com",
    siteName: "StreetdocMD",
    locale: "en_NG",
    type: "website",
  },
  // og:image comes from app/opengraph-image.jpg; X falls back to it for the large card
  twitter: {
    card: "summary_large_image",
    title: "StreetdocMD — Healthcare at your convenience",
    description: "Verified doctors, nurses, and physiotherapists who come to you.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mulish.variable} ${nunito.variable}`} suppressHydrationWarning>
      <head>
        {/* Lets CSS hide scroll-reveal elements only when JS is running (no-JS visitors see everything). */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        {children}
        <ScrollReveal />
      </body>
    </html>
  );
}
