// Renders a StreetdocMD legal document (from @/lib/legal) in full: every
// section and every block kind. Never retype or abridge legal text — always
// render the generated document object. No hooks, so it works in server and
// client components alike.
import type { LegalBlock, LegalDocument } from "@/lib/legal";

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <>
      {/* Phones: one card per row, each cell labelled with its column header. */}
      <div className="sm:hidden space-y-2">
        {rows.map((row, r) => (
          <dl key={r} className="rounded-lg border border-line divide-y divide-line bg-white">
            {row.map((cell, c) => (
              <div key={c} className="px-3 py-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{headers[c] ?? ""}</dt>
                <dd className="mt-0.5 text-ink">{cell}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
      {/* Wider screens: a real table, scrolling sideways if it still doesn't fit. */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead className="bg-page">
            <tr>
              {headers.map((h, i) => (
                <th key={i} scope="col" className="px-3 py-2 font-semibold text-ink border-b border-line align-bottom min-w-[8rem]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, r) => (
              <tr key={r} className="align-top">
                {row.map((cell, c) => (
                  <td key={c} className={`px-3 py-2 text-ink ${c === 0 ? "font-medium" : ""}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function LegalBlockView({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "p":
      return <p>{block.text}</p>;
    case "clause":
      return (
        <p className="flex gap-3">
          <span className="w-10 shrink-0 font-semibold text-ink tabular-nums">{block.num}</span>
          <span className="min-w-0 flex-1">{block.text}</span>
        </p>
      );
    case "bullets":
      return (
        <ul className="list-disc pl-5 space-y-1.5 marker:text-muted">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
    case "table":
      return <Table headers={block.headers} rows={block.rows} />;
    case "callout":
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          {block.title && <p className="font-semibold">{block.title}</p>}
          <p className={block.title ? "mt-1" : ""}>{block.text}</p>
        </div>
      );
    default:
      return null;
  }
}

export default function LegalDocumentView({ doc, showHeading = true }: { doc: LegalDocument; showHeading?: boolean }) {
  return (
    <article className="text-sm leading-relaxed text-ink break-words">
      {showHeading && (
        <header className="pb-5 mb-5 border-b border-line">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">{doc.versionLabel}</p>
          <h2 className="mt-1 text-lg sm:text-ds-xl font-bold text-navy">{doc.title}</h2>
          <p className="mt-1 text-muted">{doc.subtitle}</p>
          {doc.partyLine && <p className="mt-2 text-xs text-muted">{doc.partyLine}</p>}
        </header>
      )}

      <div className="space-y-3">
        {doc.intro.map((b, i) => <LegalBlockView key={i} block={b} />)}
      </div>

      {doc.sections.map((s) => (
        <section key={s.id} id={`${doc.slug}-${s.id}`} className="mt-7 scroll-mt-4">
          <h3 className="text-base font-semibold text-ink mb-3">{s.title}</h3>
          <div className="space-y-3">
            {s.blocks.map((b, i) => <LegalBlockView key={i} block={b} />)}
          </div>
        </section>
      ))}
    </article>
  );
}
