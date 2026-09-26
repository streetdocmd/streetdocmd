"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export type CareItem = {
  title: string;
  description: string;
  points: string[];
  icon: string;
  /** colored check icon for this card */
  check: string;
  /** the in-home icon is a nested group in Figma and needs its inset wrapper */
  insetIcon?: boolean;
  bg: string;
  chip: string;
  text: string;
};

function ItemIcon({ item }: { item: CareItem }) {
  return (
    <span className="acc-chip">
      {item.insetIcon ? (
        <span className="icon-inset">
          <span className="icon-inset-group">
            <span className="icon-inset-img">
              <img src={item.icon} alt="" />
            </span>
          </span>
        </span>
      ) : (
        <img src={item.icon} alt="" width={20} height={20} />
      )}
    </span>
  );
}

// Matches the breakpoint where globals.css turns the accordion into a vertical stack
const DESKTOP = "(min-width: 1025px)";
// Short pause before a hovered card opens, so sweeping the pointer across the row doesn't open each one
const HOVER_DELAY = 90;
// Stacked layout (tablet/mobile): cards inside a band of the viewport are open. A card opens once its
// top rises above OPEN_EDGE, and closes once its bottom has scrolled off the top of the screen, i.e. after
// it has been read. Closing off-screen means browser scroll anchoring keeps what you're reading still.
const OPEN_EDGE = 0.8;
// How long a card takes to slide open or closed
const DRAWER_MS = 350;

export default function CareAccordion({ items, defaultOpen = 3 }: { items: CareItem[]; defaultOpen?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  // Desktop: one card, opened on hover. Stacked: every card currently in the band.
  const [stacked, setStacked] = useState(false);
  const [bandOpen, setBandOpen] = useState<number[]>([]);
  const bandRef = useRef<number[]>([]);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  // Panel heights just before a change, so the layout effect can animate from them
  const prevHeights = useRef<number[] | null>(null);
  const hoverTimer = useRef<number>();

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const sync = () => setStacked(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!stacked) return;
    // Without scroll anchoring (Safari), collapsing a card above the screen would yank the page up,
    // so there cards that scroll off the top stay open. They still close when scrolled back below.
    const anchoring = typeof CSS !== "undefined" && CSS.supports("overflow-anchor", "auto");
    let frame = 0;

    const update = () => {
      frame = 0;
      const openEdge = window.innerHeight * OPEN_EDGE;
      const next = panels.current.flatMap((el, i) => {
        if (!el) return [];
        const r = el.getBoundingClientRect();
        if (r.top > openEdge) return []; // not reached the band yet
        if (r.bottom < 0 && (anchoring || !bandRef.current.includes(i))) return []; // read and scrolled past
        return [i];
      });
      if (next.join() === bandRef.current.join()) return;
      prevHeights.current = panels.current.map((el) => el?.offsetHeight ?? 0);
      bandRef.current = next;
      setBandOpen(next);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [stacked]);

  // Drawer animation: after the DOM swaps open/closed content (before paint), slide each changed
  // panel from its old height to its new one. Never touches the scroll position.
  useLayoutEffect(() => {
    const before = prevHeights.current;
    prevHeights.current = null;
    if (!before) return;
    const animated: HTMLDivElement[] = [];
    panels.current.forEach((el, i) => {
      if (!el) return;
      const to = el.offsetHeight;
      if (to === before[i]) return;
      el.style.height = `${before[i]}px`;
      void el.offsetHeight; // commit the start height before transitioning
      el.style.transition = `height ${DRAWER_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      el.style.height = `${to}px`;
      animated.push(el);
    });
    const reset = () =>
      animated.forEach((el) => {
        el.style.height = "";
        el.style.transition = "";
      });
    const timer = window.setTimeout(reset, DRAWER_MS);
    return () => {
      window.clearTimeout(timer);
      reset();
    };
  }, [bandOpen]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const hoverOpen = (i: number) => {
    if (stacked) return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setOpen(i), HOVER_DELAY);
  };

  // Tapping a closed card while stacked scrolls it up into the band, which opens it
  const tapOpen = (i: number) => {
    if (!stacked) return setOpen(i);
    const el = panels.current[i];
    if (el) window.scrollBy({ top: el.getBoundingClientRect().top - window.innerHeight * 0.5, behavior: "smooth" });
  };

  return (
    <div className="acc" onMouseLeave={() => window.clearTimeout(hoverTimer.current)}>
      {items.map((item, i) => {
        const active = stacked ? bandOpen.includes(i) : i === open;
        const style = {
          "--acc-bg": item.bg,
          "--acc-chip": item.chip,
          "--acc-text": item.text,
          "--d": `${i * 70}ms`,
        } as CSSProperties;

        return (
          <div
            key={item.title}
            ref={(el) => {
              panels.current[i] = el;
            }}
            className={`acc-panel ${active ? "is-open" : ""}`}
            style={style}
            data-reveal
            onMouseEnter={() => hoverOpen(i)}
          >
            {active ? (
              <div className="acc-open">
                <div className="acc-open-head">
                  <div className="acc-open-row">
                    <ItemIcon item={item} />
                    <span className="acc-num">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="acc-open-title">{item.title}</h3>
                </div>
                <p className="acc-desc">{item.description}</p>
                <ul className="acc-points">
                  {item.points.map((p) => (
                    <li key={p}>
                      <span className="acc-check">
                        <img src={item.check} alt="" width={12} height={12} />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <button type="button" className="acc-closed" aria-expanded={false} onClick={() => tapOpen(i)}>
                <ItemIcon item={item} />
                <span className="acc-label">{item.title}</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
