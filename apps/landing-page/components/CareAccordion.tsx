"use client";

import { useState, type CSSProperties } from "react";

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

export default function CareAccordion({ items, defaultOpen = 3 }: { items: CareItem[]; defaultOpen?: number }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="acc">
      {items.map((item, i) => {
        const active = i === open;
        const style = {
          "--acc-bg": item.bg,
          "--acc-chip": item.chip,
          "--acc-text": item.text,
          "--d": `${i * 70}ms`,
        } as CSSProperties;

        return (
          <div key={item.title} className={`acc-panel ${active ? "is-open" : ""}`} style={style} data-reveal>
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
              <button type="button" className="acc-closed" aria-expanded={false} onClick={() => setOpen(i)}>
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
