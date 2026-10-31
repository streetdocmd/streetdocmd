"use client";
import { useState } from "react";
import { Download, FileUp } from "lucide-react";
import { parseCsv } from "@/lib/csv";
import { formatNaira, ui } from "@/components/portal/ui";

const MAX_ROWS = 2000;

const TEMPLATE_CSV =
  "test_name,price,turnaround_hours,sample_type,home_collection,test_code,preparation\r\n" +
  "Full Blood Count,6500,24,Blood,yes,FBC,\r\n" +
  "Fasting Blood Sugar,3000,8,Blood,yes,FBS,Fast for 8 to 10 hours before the test\r\n" +
  "Urinalysis,2500,8,Urine,no,,\r\n";

const ALIASES: Record<string, string[]> = {
  test_name: ["test_name", "test", "name", "investigation", "investigation_name", "test_or_investigation"],
  price: ["price", "unit_price", "cost", "amount", "selling_price"],
  turnaround_hours: ["turnaround_hours", "turnaround", "tat", "hours", "result_time"],
  sample_type: ["sample_type", "sample", "specimen"],
  home_collection: ["home_collection", "home", "home_service", "collection"],
  test_code: ["test_code", "code"],
  preparation: ["preparation", "prep", "instructions"],
};

interface Row {
  line: number;
  test_name: string;
  price: number;
  turnaround_hours: number | null;
  sample_type: string | null;
  home_collection: boolean;
  test_code: string | null;
  preparation: string | null;
  error: string | null;
}

interface Check {
  name: string;
  exact: { id: string; test_name: string; onList: boolean } | null;
  suggestions: { id: string; test_name: string; matched: string }[];
}

// "24", "24 hours" or "2 days"
function hours(raw: string): number | null | "bad" {
  if (!raw) return null;
  const m = raw.toLowerCase().match(/^(\d+)\s*(h|hr|hrs|hour|hours|d|day|days)?$/);
  if (!m || Number(m[1]) <= 0) return "bad";
  return Number(m[1]) * (m[2]?.startsWith("d") ? 24 : 1);
}

const nameKey = (s: string) => s.trim().toLowerCase();

// Upload a test list. Exact names and known aliases link by themselves; a close
// name stops for a person to confirm, because similar names can be different
// tests (a malaria RDT isn't malaria microscopy), and nothing merges unconfirmed.
export default function TestImport({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [checks, setChecks] = useState<Record<string, Check>>({});
  // By name: a shared test's id, or "new"
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState<"checking" | "importing" | null>(null);
  const [result, setResult] = useState<{ added: number; updated: number; failed: number } | null>(null);

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "lab-tests-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setRows(null); setChecks({}); setAnswers({}); setResult(null); setFileError("");
    if (!file) return;

    const table = parseCsv(await file.text());
    if (table.length < 2) { setFileError("The file has no data rows. Use the template as a starting point."); return; }
    if (table.length - 1 > MAX_ROWS) { setFileError(`Too many rows (${table.length - 1}). Import up to ${MAX_ROWS} at a time.`); return; }

    const header = table[0].map(h => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
    const col: Record<string, number> = {};
    for (const [field, names] of Object.entries(ALIASES)) col[field] = header.findIndex(h => names.includes(h));
    if (col.test_name < 0) { setFileError('Couldn\'t find a test name column. Name the first column "test_name".'); return; }
    if (col.price < 0) { setFileError('The file needs a "price" column.'); return; }

    const seen = new Set<string>();
    const parsed: Row[] = table.slice(1).map((r, i) => {
      const get = (f: string) => (col[f] >= 0 ? (r[col[f]] ?? "").trim() : "");
      const name = get("test_name");
      const price = parseFloat(get("price").replace(/[₦,\s]/g, ""));
      const turnaround = hours(get("turnaround_hours"));
      const homeRaw = get("home_collection").toLowerCase();
      const home = ["yes", "y", "true", "1"].includes(homeRaw) ? true : ["no", "n", "false", "0"].includes(homeRaw) ? false : null;

      let error: string | null = null;
      if (!name) error = "Missing test name";
      else if (!Number.isFinite(price) || price <= 0) error = "Invalid price";
      else if (turnaround === "bad") error = "Turnaround must be in hours or days, like 24 or 2 days";
      else if (homeRaw !== "" && home === null) error = "home_collection must be yes or no";
      else if (seen.has(nameKey(name))) error = "Duplicate of an earlier row in this file";
      seen.add(nameKey(name));

      return {
        line: i + 2, test_name: name, price: price || 0, turnaround_hours: turnaround === "bad" ? null : turnaround,
        sample_type: get("sample_type") || null, home_collection: home ?? true,
        test_code: get("test_code") || null, preparation: get("preparation") || null, error,
      };
    });

    const names = parsed.filter(r => !r.error).map(r => r.test_name);
    setRows(parsed);
    if (!names.length) return;
    setBusy("checking");
    const res = await fetch("/api/lab-portal/catalogue/import", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ names }),
    }).catch(() => null);
    const json = res?.ok ? await res.json().catch(() => null) : null;
    setBusy(null);
    if (!json?.results) { setRows(null); setFileError("Couldn't check the test names. Check your connection and try again."); return; }
    setChecks(Object.fromEntries((json.results as Check[]).map(c => [nameKey(c.name), c])));
  }

  const valid = rows?.filter(r => !r.error) ?? [];
  const errors = rows?.filter(r => r.error) ?? [];
  const checkOf = (r: Row) => checks[nameKey(r.test_name)];
  const unanswered = valid.filter(r => { const c = checkOf(r); return c && !c.exact && c.suggestions.length > 0 && !answers[nameKey(r.test_name)]; });
  const ready = valid.length > 0 && Object.keys(checks).length > 0 && unanswered.length === 0;
  const ordered = rows ? [...unanswered, ...rows.filter(r => !unanswered.includes(r))] : [];

  async function runImport() {
    setBusy("importing");
    const payload = valid.map(r => {
      const answer = answers[nameKey(r.test_name)];
      return { ...r, same_as: answer && answer !== "new" ? answer : null };
    });
    const res = await fetch("/api/lab-portal/catalogue/import", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: payload }),
    }).catch(() => null);
    const json = res?.ok ? await res.json().catch(() => null) : null;
    setBusy(null);
    if (!json) { setFileError("Couldn't import the file. Check your connection and try again."); return; }
    setResult(json);
    setRows(null); setChecks({}); setAnswers({});
    onDone();
  }

  return (
    <div className={`${ui.card} space-y-4 p-5`}>
      <div>
        <p className="font-semibold text-ink">Import your test list</p>
        <p className="mt-0.5 text-sm text-muted">
          Upload a CSV (export from Excel or Google Sheets). Tests already on your list have their price and details
          updated; everything else is added and switched on.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className={`${ui.btnPrimary} cursor-pointer`}>
          <FileUp size={16} aria-hidden /> Choose CSV file
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>
        <button type="button" onClick={downloadTemplate} className={`${ui.btnLink} inline-flex items-center gap-1`}>
          <Download size={14} aria-hidden /> Download template
        </button>
      </div>

      {fileError && <p role="alert" className="text-sm text-red-600">{fileError}</p>}

      {result && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${result.failed ? "border-amber-200 bg-amber-50 text-amber-800" : "border-green-200 bg-green-50 text-green-800"}`}>
          Done: {result.added} added, {result.updated} updated{result.failed ? `, ${result.failed} failed (you can retry the file; rows already saved will just update)` : ""}.
        </div>
      )}

      {rows && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-green-700">{valid.length} ready</span>
            {unanswered.length > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">{unanswered.length} to confirm</span>}
            {errors.length > 0 && <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">{errors.length} with errors (skipped)</span>}
          </div>

          {unanswered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <span>Some names look like tests already on StreetdocMD. Confirm each one so doctors&apos; orders reach you.</span>
              <button type="button" className="font-bold underline" onClick={() =>
                setAnswers(a => ({ ...a, ...Object.fromEntries(unanswered.map(r => [nameKey(r.test_name), "new"])) }))}>
                Treat the rest as new tests
              </button>
            </div>
          )}

          <div className="max-h-80 overflow-auto rounded-lg border border-line">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-page">
                <tr className="text-left text-muted">
                  <th className="px-3 py-2">Row</th><th className="px-3 py-2">Test</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ordered.slice(0, 300).map(r => {
                  const c = checkOf(r);
                  const key = nameKey(r.test_name);
                  return (
                    <tr key={r.line} className={r.error ? "bg-red-50/50" : ""}>
                      <td className="px-3 py-1.5 text-muted">{r.line}</td>
                      <td className="px-3 py-1.5 text-ink">{r.test_name || "—"}</td>
                      <td className="px-3 py-1.5">{r.error ? "" : formatNaira(r.price)}</td>
                      <td className="px-3 py-1.5">
                        {r.error ? <span className="text-red-600">{r.error}</span>
                          : !c ? <span className="text-muted">{busy === "checking" ? "Checking…" : ""}</span>
                          : c.exact ? <span className={c.exact.onList ? "text-accent" : "text-green-600"}>{c.exact.onList ? "Update" : "New"} · {c.exact.test_name}</span>
                          : c.suggestions.length ? (
                            <select aria-label={`What is ${r.test_name}?`} className={`${ui.input} min-h-9 min-w-[104px] px-3 py-1 text-xs font-semibold`} value={answers[key] ?? ""}
                              onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))}>
                              <option value="">Confirm</option>
                              {c.suggestions.map(s => <option key={s.id} value={s.id}>Same as {s.test_name}{s.matched !== s.test_name ? ` (${s.matched})` : ""}</option>)}
                              <option value="new">No, it&apos;s a different test</option>
                            </select>
                          ) : <span className="text-green-600">New test</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {ordered.length > 300 && <p className="px-3 py-2 text-xs text-muted">Showing the first 300 of {ordered.length} rows.</p>}
          </div>

          <button onClick={runImport} disabled={!ready || !!busy} className={ui.btnPrimary}>
            {busy === "importing" ? "Importing…" : busy === "checking" ? "Checking names…" : unanswered.length ? `Confirm ${unanswered.length} more to import` : `Import ${valid.length} test${valid.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}
