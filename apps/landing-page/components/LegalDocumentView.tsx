import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import { LEGAL_DOCUMENTS, LEGAL_PATHS, type LegalBlock, type LegalDocument } from "@/lib/legal";

// Renders one of the StreetdocMD legal documents verbatim from lib/legal (generated data).
// Never reword the text here — all wording comes from the document objects.

type Slug = LegalDocument["slug"];

/** Short names used for the "Other policies" row. */
const SHORT_NAMES: Record<Slug, string> = {
  "privacy-policy": "Privacy policy",
  "patient-terms": "Patient terms of service",
  "provider-agreement": "Provider terms of service",
  "facility-agreement": "Facility partner agreement",
};

export function legalMetadata(doc: LegalDocument, name: string, description: string): Metadata {
  const title = `${name} — StreetdocMD`;
  return {
    title,
    description,
    alternates: { canonical: LEGAL_PATHS[doc.slug] },
    openGraph: { title, description, url: LEGAL_PATHS[doc.slug], siteName: "StreetdocMD", type: "article" },
  };
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "p":
      return <p className="legal-p">{block.text}</p>;
    case "clause":
      return (
        <div className="legal-clause">
          <span className="legal-clause-num">{block.num}</span>
          <p className="legal-clause-text">{block.text}</p>
        </div>
      );
    case "bullets":
      return (
        <ul className="legal-bullets">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="legal-table-wrap" role="region" aria-label="Table" tabIndex={0}>
          <table className="legal-table">
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "callout":
      return (
        <aside className="legal-callout">
          {block.title && <p className="legal-callout-title">{block.title}</p>}
          <p className="legal-callout-text">{block.text}</p>
        </aside>
      );
  }
}

function TocList({ doc }: { doc: LegalDocument }) {
  return (
    <ol className="legal-toc-list">
      {doc.sections.map((s) => (
        <li key={s.id}>
          <a href={`#section-${s.id}`}>{s.title}</a>
        </li>
      ))}
    </ol>
  );
}

export default function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  const others = (Object.keys(LEGAL_DOCUMENTS) as Slug[]).filter((s) => s !== doc.slug);

  return (
    <>
      <Nav />
      <main className="legal">
        <header className="legal-hero">
          <div className="legal-hero-inner">
            <p className="legal-eyebrow">Legal</p>
            <h1 className="legal-title">{doc.title}</h1>
            <p className="legal-subtitle">{doc.subtitle}</p>
            <div className="legal-meta">
              <span className="legal-pill">{doc.versionLabel}</span>
              <span className="legal-updated">Last updated 2026</span>
            </div>
            {doc.partyLine && <p className="legal-party">{doc.partyLine}</p>}
          </div>
        </header>

        <div className="legal-layout">
          <aside className="legal-toc legal-toc-desktop" aria-label="Contents">
            <p className="legal-toc-heading">Contents</p>
            <TocList doc={doc} />
          </aside>

          <article className="legal-body">
            <details className="legal-toc legal-toc-mobile">
              <summary>Contents</summary>
              <TocList doc={doc} />
            </details>

            {doc.intro.length > 0 && (
              <div className="legal-intro">
                {doc.intro.map((b, i) => (
                  <Block key={i} block={b} />
                ))}
              </div>
            )}

            {doc.sections.map((s) => (
              <section key={s.id} id={`section-${s.id}`} className="legal-section">
                <h2 className="legal-h2">{s.title}</h2>
                {s.blocks.map((b, i) => (
                  <Block key={i} block={b} />
                ))}
              </section>
            ))}

            <nav className="legal-others" aria-label="Other policies">
              <p className="legal-others-heading">Other policies</p>
              <div className="legal-others-row">
                {others.map((slug) => (
                  <a key={slug} href={LEGAL_PATHS[slug]}>
                    {SHORT_NAMES[slug]}
                  </a>
                ))}
              </div>
            </nav>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
