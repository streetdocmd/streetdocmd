"use client";

import { useEffect, useState } from "react";
import Button from "@/components/Button";
import { LINKS } from "@/lib/links";

const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Who It’s For", href: "/#who-its-for" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "#contact" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav ${scrolled ? "is-scrolled" : ""}`}>
      <a href="/" className="nav-logo" aria-label="StreetdocMD home">
        <img src="/images/logo.png" alt="StreetdocMD" width={200} height={80} />
      </a>
      <nav className="nav-links">
        {NAV_LINKS.map((l) => (
          <a key={l.label} href={l.href}>
            {l.label}
          </a>
        ))}
      </nav>
      <Button href={LINKS.bookWeb} arrow>
        Book a visit
      </Button>
    </header>
  );
}
