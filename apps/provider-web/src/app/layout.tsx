import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StreetdocMD Provider",
  description: "Manage your home healthcare visits",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}