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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on Escape, or when the viewport grows back to desktop
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const mq = window.matchMedia("(min-width: 1025px)");
    const onResize = () => mq.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onResize);
    };
  }, [open]);

  return (
    <header className={`nav ${scrolled ? "is-scrolled" : ""} ${open ? "is-open" : ""}`}>
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
      <div className="nav-actions">
        <Button href={LINKS.bookWeb} arrow>
          Book a visit
        </Button>
        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="nav-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
      <div id="nav-menu" className="nav-menu" hidden={!open}>
        {NAV_LINKS.map((l) => (
          <a key={l.label} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
        <Button href={LINKS.bookWeb} arrow>
          Book a visit
        </Button>
      </div>
    </header>
  );
}
