"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

const MAX_ROWS = 2000;

const TEMPLATE_CSV =
  "drug_name,generic_name,formulation,strength,price,stock_quantity,prescription_required\r\n" +
  "Paracetamol,Paracetamol,Tablet,500mg,500,200,no\r\n" +
  "Amoxicillin,Amoxicillin,Capsule,500mg,2500,50,yes\r\n";

const ALIASES: Record<string, string[]> = {
  drug_name: ["drug_name", "name", "drug", "product", "product_name", "item", "item_name"],
  generic_name: ["generic_name", "generic", "active_ingredient"],
  formulation: ["formulation", "form", "dosage_form"],
  strength: ["strength", "dose"],
  price: ["price", "unit_price", "selling_price"],
  stock_quantity: ["stock_quantity", "stock", "quantity", "qty", "in_stock_qty"],
  prescription_required: ["prescription_required", "rx", "prescription", "rx_required"],
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQuotes = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(v => v.trim() !== "")) rows.push(row);
  return rows;
}

interface ParsedRow {
  line: number;
  drug_name: string;
  generic_name: string | null;
  formulation: string | null;
  strength: string | null;
  price: number;
  stock_quantity: number;
  // null = not stated in the file
  prescription_required: boolean | null;
  existingId: string | null;
  error: string | null;
}

const key = (name: string, strength: string | null, form: string | null) =>
  [name, strength ?? "", form ?? ""].map(v => v.trim().toLowerCase()).join("|");

export default function InventoryImport({
  partnerId, existing, onDone,
}: {
  partnerId: string;
  existing: { id: string; drug_name: string; strength: string | null; formulation: string | null }[];
  onDone: () => Promise<void> | void;
}) {
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileError, setFileError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ added: number; updated: number; failed: number } | null>(null);

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "inventory-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setRows(null); setResult(null); setFileError("");
    if (!file) return;

    const table = parseCsv(await file.text());
    if (table.length < 2) { setFileError("The file has no data rows. Use the template as a starting point."); return; }
    if (table.length - 1 > MAX_ROWS) { setFileError(`Too many rows (${table.length - 1}). Import up to ${MAX_ROWS} at a time.`); return; }

    const header = table[0].map(h => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
    const col: Record<string, number> = {};
    for (const [field, names] of Object.entries(ALIASES)) col[field] = header.findIndex(h => names.includes(h));
    if (col.drug_name < 0) { setFileError('Couldn\'t find a drug name column. Name the first column "drug_name".'); return; }
    if (col.price < 0 || col.stock_quantity < 0) { setFileError('The file needs "price" and "stock_quantity" columns.'); return; }

    const existingByKey = new Map(existing.map(d => [key(d.drug_name, d.strength, d.formulation), d.id]));
    const seen = new Set<string>();

    const parsed: ParsedRow[] = table.slice(1).map((r, i) => {
      const get = (f: string) => (col[f] >= 0 ? (r[col[f]] ?? "").trim() : "");
      const name = get("drug_name");
      const strength = get("strength") || null;
      const form = get("formulation") || null;
      const price = parseFloat(get("price").replace(/[₦,\s]/g, ""));
      const stockRaw = get("stock_quantity").replace(/,/g, "");
      const stock = Number(stockRaw);
      const rxRaw = get("prescription_required").toLowerCase();
      const rx = ["yes", "y", "true", "1"].includes(rxRaw) ? true : ["no", "n", "false", "0"].includes(rxRaw) ? false : null;

      let error: string | null = null;
      if (!name) error = "Missing drug name";
      else if (!Number.isFinite(price) || price < 0) error = "Invalid price";
      else if (stockRaw === "" || !Number.isInteger(stock) || stock < 0) error = "Stock must be a whole number ≥ 0";
      else if (rxRaw !== "" && rx === null) error = 'prescription_required must be yes or no';

      const k = key(name, strength, form);
      if (!error && seen.has(k)) error = "Duplicate of an earlier row in this file";
      seen.add(k);

      return {
        line: i + 2, drug_name: name, generic_name: get("generic_name") || null, formulation: form, strength,
        price: price || 0, stock_quantity: stock || 0, prescription_required: rx,
        existingId: existingByKey.get(k) ?? null, error,
      };
    });
    setRows(parsed);
  }

  const valid = rows?.filter(r => !r.error) ?? [];
  const toAdd = valid.filter(r => !r.existingId);
  const toUpdate = valid.filter(r => r.existingId);
  const errors = rows?.filter(r => r.error) ?? [];
  const assumedRx = toAdd.filter(r => r.prescription_required === null).length;

  async function runImport() {
    setImporting(true);
    const supabase = createClient();
    const now = new Date().toISOString();
    let added = 0, updated = 0, failed = 0;

    for (let i = 0; i < toAdd.length; i += 200) {
      const batch = toAdd.slice(i, i + 200).map(r => ({
        pharmacy_partner_id: partnerId,
        drug_name: r.drug_name, generic_name: r.generic_name, formulation: r.formulation, strength: r.strength,
        price: r.price, stock_quantity: r.stock_quantity, in_stock: r.stock_quantity > 0,
        // Not stated in the file → treated as prescription-only. Anything not
        // flagged is purchasable by patients without a prescription, so the
        // safe default for an unstated row is to require one.
        prescription_required: r.prescription_required ?? true,
        updated_at: now,
      }));
      const { error } = await supabase.from("drug_catalogue").insert(batch);
      if (error) failed += batch.length; else added += batch.length;
    }

    for (let i = 0; i < toUpdate.length; i += 10) {
      await Promise.all(toUpdate.slice(i, i + 10).map(async r => {
        const patch: Record<string, unknown> = {
          price: r.price, stock_quantity: r.stock_quantity, in_stock: r.stock_quantity > 0, updated_at: now,
        };
        if (r.prescription_required !== null) patch.prescription_required = r.prescription_required;
        const { error } = await supabase.from("drug_catalogue").update(patch).eq("id", r.existingId!);
        if (error) failed++; else updated++;
      }));
    }

    setResult({ added, updated, failed });
    setRows(null);
    setImporting(false);
    await onDone();
  }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <p className="font-semibold text-gray-900">Import your existing inventory</p>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload a CSV (export from Excel or Google Sheets). Drugs already in your inventory (same name, strength and
          formulation) have their price and stock updated; everything else is added.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:opacity-90 cursor-pointer">
          Choose CSV file
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>
        <button type="button" onClick={downloadTemplate} className="text-sm text-blue-600 hover:underline font-medium">
          Download template
        </button>
      </div>

      {fileError && <p className="text-sm text-red-600">{fileError}</p>}

      {result && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${result.failed ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-green-50 border-green-200 text-green-800"}`}>
          Done — {result.added} added, {result.updated} updated{result.failed ? `, ${result.failed} failed (you can retry the file; rows already saved will just update)` : ""}.
        </div>
      )}

      {rows && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap text-xs font-medium">
            <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700">{toAdd.length} new</span>
            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">{toUpdate.length} to update</span>
            {errors.length > 0 && <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700">{errors.length} with errors (skipped)</span>}
          </div>

          {assumedRx > 0 && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              {assumedRx} new row{assumedRx > 1 ? "s don't" : " doesn't"} say whether a prescription is required, so {assumedRx > 1 ? "they'll" : "it'll"} be
              saved as <strong>prescription required</strong> and hidden from patient self-service. Put <code>no</code> in the
              prescription_required column for over-the-counter items.
            </p>
          )}

          <div className="max-h-64 overflow-auto border border-gray-100 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-gray-500">
                  <th className="px-3 py-2">Row</th><th className="px-3 py-2">Drug</th><th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Stock</th><th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.slice(0, 200).map(r => (
                  <tr key={r.line} className={r.error ? "bg-red-50/50" : ""}>
                    <td className="px-3 py-1.5 text-gray-400">{r.line}</td>
                    <td className="px-3 py-1.5 text-gray-900">{r.drug_name || "—"}{r.strength ? ` ${r.strength}` : ""}</td>
                    <td className="px-3 py-1.5">{r.error ? "" : `₦${r.price.toLocaleString()}`}</td>
                    <td className="px-3 py-1.5">{r.error ? "" : r.stock_quantity}</td>
                    <td className="px-3 py-1.5">
                      {r.error ? <span className="text-red-600">{r.error}</span> : r.existingId ? <span className="text-blue-600">Update</span> : <span className="text-green-600">New</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && <p className="text-xs text-gray-400 px-3 py-2">Showing the first 200 of {rows.length} rows.</p>}
          </div>

          <button
            onClick={runImport}
            disabled={importing || valid.length === 0}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50"
          >
            {importing ? "Importing…" : `Import ${valid.length} row${valid.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}
