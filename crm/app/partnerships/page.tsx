"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Handshake,
  RefreshCw,
  Search,
  Upload,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Partnership = {
  id: string;
  name: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  category: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type CsvRecord = {
  organization_name: string;
  contact_person: string;
  email: string;
  phone: string;
  partnership_type: string;
  status: string;
  notes: string;
};

const supabase = createClient();

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function getValue(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = row[normalizeHeader(name)];
    if (value?.trim()) return value.trim();
  }
  return "";
}

function normalizeStatus(value: string) {
  const key = value.trim().toLowerCase().replace(/[ -]+/g, "_");
  const allowed: Record<string, string> = { prospect: "prospect", prospective: "prospect", engaging: "engaging", engagement: "engaging", negotiation: "negotiation", negotiating: "negotiation", active: "active", on_hold: "on_hold", "on hold": "on_hold", hold: "on_hold", expired: "expired", closed: "closed", inactive: "closed" };
  return allowed[key] || "prospect";
}

function readableError(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return error instanceof Error ? error.message : "Unknown database error. Check your access and try again.";
}

function mapCsv(text: string): CsvRecord[] {
  const parsed = parseCsv(text);
  if (parsed.length < 2) return [];
  const headers = parsed[0].map(normalizeHeader);
  return parsed.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || "";
    });
    return {
      organization_name: getValue(row, ["Organization Name", "Organization", "Institution", "Partner", "Partner Organization", "Company Name", "Name"]),
      contact_person: getValue(row, ["Contact Person", "Contact Name", "Representative", "Focal Person"]),
      email: getValue(row, ["Email", "Email Address", "Contact Email"]),
      phone: getValue(row, ["Phone", "Telephone", "Phone Number", "Telephone Number", "Mobile", "Contact Number"]),
      partnership_type: getValue(row, ["Partnership Type", "Type", "Category", "Area of Collaboration"]),
      status: normalizeStatus(getValue(row, ["Status"]) || "prospect"),
      notes: getValue(row, ["Notes", "Description", "Comments", "Agreement Details"]),
    };
  });
}

function downloadTemplate() {
  const csv = "Organization Name,Contact Person,Email,Phone,Partnership Type,Status,Notes\nExample Institution,Jane Doe,jane@example.org,+256700000000,Academic,Active,Agreement details";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "ciu-partnerships-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-UG", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PartnershipsPage() {
  const [records, setRecords] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Partnership | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Partnership | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", primary_contact_name: "", primary_contact_email: "", primary_contact_phone: "", category: "", status: "prospect", notes: "" });
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<CsvRecord[]>([]);
  const [fileError, setFileError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadRecords = useCallback(async () => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from("partnerships")
      .select("id, name, primary_contact_name, primary_contact_email, primary_contact_phone, category, status, notes, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setFileError(error.message.includes("partnerships")
        ? "Unable to load the Partnerships register. Please check your access and refresh the page."
        : error.message);
      setRecords([]);
    } else {
      setFileError("");
      setRecords((data || []) as Partnership[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((item) =>
      [item.name, item.primary_contact_name, item.primary_contact_email, item.primary_contact_phone, item.category, item.status]
        .some((value) => (value || "").toLowerCase().includes(term)),
    );
  }, [records, search]);

  const resetImport = () => {
    setFileName("");
    setPreview([]);
    setImportResult("");
    setFileError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setFileError("");
    setImportResult("");
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileError("Please choose a .csv file. You can export an Excel sheet as CSV UTF-8.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError("The file is larger than 5 MB. Split it into smaller CSV files and try again.");
      return;
    }
    const parsed = mapCsv(await file.text());
    if (!parsed.length) {
      setFileError("No data rows were found. Include a header row and at least one partnership.");
      return;
    }
    const missing = parsed.filter((row) => !row.organization_name);
    if (missing.length) {
      setFileError(`${missing.length} row(s) have no Organization Name. Add that column or fill in the missing names before importing.`);
      return;
    }
    setFileName(file.name);
    setPreview(parsed);
  };

  const importCsv = async () => {
    if (!preview.length) return;
    setImporting(true);
    setFileError("");
    setImportResult("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const { data: existing, error: existingError } = await supabase
        .from("partnerships")
        .select("name, primary_contact_email");
      if (existingError) throw existingError;

      const known = new Set<string>();
      (existing || []).forEach((row: { name: string; primary_contact_email: string | null }) => {
        known.add(`name:${row.name.trim().toLowerCase()}`);
        if (row.primary_contact_email?.trim()) known.add(`email:${row.primary_contact_email.trim().toLowerCase()}`);
      });

      const unique: CsvRecord[] = [];
      let duplicates = 0;
      for (const row of preview) {
        const nameKey = `name:${row.organization_name.trim().toLowerCase()}`;
        const emailKey = row.email.trim() ? `email:${row.email.trim().toLowerCase()}` : "";
        if (known.has(nameKey) || (emailKey && known.has(emailKey))) {
          duplicates += 1;
          continue;
        }
        known.add(nameKey);
        if (emailKey) known.add(emailKey);
        unique.push(row);
      }

      let inserted = 0;
      for (let i = 0; i < unique.length; i += 100) {
        const batch = unique.slice(i, i + 100).map((row) => ({
          name: row.organization_name,
          primary_contact_name: row.contact_person || null,
          primary_contact_email: row.email || null,
          primary_contact_phone: row.phone || null,
          category: row.partnership_type || null,
          status: normalizeStatus(row.status || "prospect"),
          notes: row.notes || null,
          created_by: authData.user?.id || null,
        }));
        const { data, error } = await supabase.from("partnerships").insert(batch).select("id");
        if (error) throw error;
        inserted += data?.length || batch.length;
      }

      setImportResult(`Imported ${inserted} partnership(s). Skipped ${duplicates} duplicate(s).`);
      await loadRecords();
      setPreview([]);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      setFileError(`Import failed: ${readableError(error)}`);
    } finally {
      setImporting(false);
    }
  };

  const openRecord = (record: Partnership) => {
    setFileError(""); setImportResult(""); setEditingRecord(record);
    setContactForm({ name: record.name || "", primary_contact_name: record.primary_contact_name || "", primary_contact_email: record.primary_contact_email || "", primary_contact_phone: record.primary_contact_phone || "", category: record.category || "", status: normalizeStatus(record.status || "prospect"), notes: record.notes || "" });
    setShowAddContact(true);
  };

  const saveContact = async () => {
    if (!contactForm.name.trim()) { setFileError("Organization name is required."); return; }
    setSavingContact(true); setFileError(""); setImportResult("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const payload = {
        name: contactForm.name.trim(),
        primary_contact_name: contactForm.primary_contact_name.trim() || null,
        primary_contact_email: contactForm.primary_contact_email.trim() || null,
        primary_contact_phone: contactForm.primary_contact_phone.trim() || null,
        category: contactForm.category.trim() || null,
        status: normalizeStatus(contactForm.status),
        notes: contactForm.notes.trim() || null,
      };
      const result = editingRecord
        ? await supabase.from("partnerships").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingRecord.id)
        : await supabase.from("partnerships").insert({ ...payload, created_by: authData.user?.id || null });
      if (result.error) throw result.error;
      setShowAddContact(false);
      setEditingRecord(null);
      setContactForm({ name: "", primary_contact_name: "", primary_contact_email: "", primary_contact_phone: "", category: "", status: "prospect", notes: "" });
      await loadRecords();
    } catch (error) {
      setFileError(`Could not add contact: ${readableError(error)}`);
    } finally { setSavingContact(false); }
  };

  return (
    <div className="ciu-page ciu-partnerships-page min-h-screen bg-white px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="ciu-page-inner mx-auto max-w-7xl space-y-6">
        <header className="ciu-hero flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
              <Handshake size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Partnerships</h1>
              <p className="mt-1 text-sm text-slate-500">Manage institutional relationships and import partner records.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setFileError(""); setEditingRecord(null); setContactForm({ name: "", primary_contact_name: "", primary_contact_email: "", primary_contact_phone: "", category: "", status: "prospect", notes: "" }); setShowAddContact(true); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#00695c] bg-white px-4 text-sm font-semibold text-[#00695c] hover:bg-emerald-50"><Users size={16} /> Add Contact</button>
            <button type="button" onClick={downloadTemplate} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Download size={16} /> CSV template
            </button>
            <button type="button" onClick={() => { resetImport(); setShowImport(true); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#00695c] px-4 text-sm font-semibold text-white hover:bg-[#00574f]">
              <Upload size={16} /> Upload CSV
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500"><Users size={17} /> Total partnerships</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{records.length.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-sm font-medium text-slate-500">Active partnerships</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{records.filter((r) => ["active", "signed", "in progress"].includes((r.status || "").toLowerCase())).length.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-sm font-medium text-slate-500">Partnership categories</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{new Set(records.map((r) => r.category).filter(Boolean)).size.toLocaleString()}</div>
          </div>
        </div>

        {fileError && !showImport && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertCircle size={18} className="mt-0.5 shrink-0" /><p>{fileError}</p>
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Partnership register</h2>
              <p className="mt-1 text-sm text-slate-500">{filtered.length.toLocaleString()} record(s)</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search partnerships..." className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
              </div>
              <button type="button" aria-label="Refresh partnerships" onClick={() => void loadRecords()} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading partnerships…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><FileSpreadsheet size={22} /></div>
              <h3 className="mt-4 font-semibold text-slate-900">{search ? "No matching partnerships" : "No partnerships imported yet"}</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">{search ? "Try a different search term." : "Upload a CSV file to add partner organisations in one import."}</p>
              {!search && <button type="button" onClick={() => { resetImport(); setShowImport(true); }} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#00695c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#00574f]"><Upload size={16} /> Upload CSV</button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Organization</th><th className="px-5 py-3.5">Contact person</th><th className="px-5 py-3.5">Contact details</th><th className="px-5 py-3.5">Partnership type</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5">Added</th><th className="px-5 py-3.5">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((record) => (
                    <tr key={record.id} onClick={() => setSelectedRecord(record)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedRecord(record); } }} tabIndex={0} role="button" aria-label={"Open " + record.name + " partnership details"} className="cursor-pointer hover:bg-emerald-50/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-700">
                      <td className="px-5 py-4 font-medium text-slate-900">{record.name}<div className="mt-1 text-[11px] font-normal text-emerald-800">Open details →</div></td>
                      <td className="px-5 py-4 text-slate-700">{record.primary_contact_name || "—"}</td>
                      <td className="px-5 py-4"><div className="text-slate-700">{record.primary_contact_email || "—"}</div><div className="mt-1 text-xs text-slate-500">{record.primary_contact_phone || ""}</div></td>
                      <td className="px-5 py-4 text-slate-600">{record.category || "—"}</td>
                      <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${(record.status || "").toLowerCase() === "active" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{record.status || "Unspecified"}</span></td>
                      <td className="px-5 py-4 text-slate-500">{displayDate(record.created_at)}</td><td className="px-5 py-4"><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedRecord(record); }} className="rounded-lg border border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">View details</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>


      {selectedRecord && (
        <div className="fixed inset-0 z-[110] bg-slate-950/35 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRecord(null); }}>
          <aside role="dialog" aria-modal="true" aria-labelledby="partnership-details-title" className="ciu-partnership-drawer ml-auto flex h-[100dvh] w-full max-w-[560px] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
              <div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-emerald-800">Partnership profile</p><h2 id="partnership-details-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900">{selectedRecord.name}</h2><p className="mt-1 text-sm text-slate-500">Institutional relationship and contact information</p></div>
              <button type="button" aria-label="Close partnership details" onClick={() => setSelectedRecord(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19}/></button>
            </header>
            <div className="flex-1 space-y-5 p-6">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Current status</div><div className="mt-2"><span className="inline-flex rounded-full bg-white px-3 py-1.5 text-sm font-semibold capitalize text-emerald-900 ring-1 ring-emerald-200">{(selectedRecord.status || "unspecified").replaceAll("_", " ")}</span></div><p className="mt-3 text-xs text-slate-600">Added {displayDate(selectedRecord.created_at)}</p></div>
              <section className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-bold text-slate-900">Primary contact</h3><dl className="mt-3 space-y-3 text-sm"><div><dt className="text-xs text-slate-500">Contact person</dt><dd className="mt-1 font-medium text-slate-800">{selectedRecord.primary_contact_name || "Not provided"}</dd></div><div><dt className="text-xs text-slate-500">Email address</dt><dd className="mt-1 break-all font-medium text-slate-800">{selectedRecord.primary_contact_email ? <a className="text-emerald-800 underline" href={"mailto:" + selectedRecord.primary_contact_email}>{selectedRecord.primary_contact_email}</a> : "Not provided"}</dd></div><div><dt className="text-xs text-slate-500">Telephone</dt><dd className="mt-1 font-medium text-slate-800">{selectedRecord.primary_contact_phone ? <a className="text-emerald-800 underline" href={"tel:" + selectedRecord.primary_contact_phone}>{selectedRecord.primary_contact_phone}</a> : "Not provided"}</dd></div></dl></section>
              <section className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-bold text-slate-900">Partnership information</h3><dl className="mt-3 space-y-3 text-sm"><div><dt className="text-xs text-slate-500">Category / collaboration area</dt><dd className="mt-1 font-medium text-slate-800">{selectedRecord.category || "Not specified"}</dd></div><div><dt className="text-xs text-slate-500">Relationship notes</dt><dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-700">{selectedRecord.notes || "No notes have been recorded yet."}</dd></div></dl></section>
            </div>
            <footer className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-white p-5"><button type="button" onClick={() => { openRecord(selectedRecord); setSelectedRecord(null); }} className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#00695c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#00574f]">Edit partnership</button><button type="button" onClick={() => setSelectedRecord(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Close</button></footer>
          </aside>
        </div>
      )}
      {showAddContact && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingContact) setShowAddContact(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="add-partnership-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 id="add-partnership-title" className="font-semibold text-slate-900">{editingRecord ? "Partnership Profile" : "Add Contact"}</h2><p className="mt-1 text-sm text-slate-500">{editingRecord ? "Review or update this organisation and save your changes." : "Add a partner organisation and its primary contact."}</p></div><button type="button" aria-label="Close form" onClick={() => setShowAddContact(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Organization name *<input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="Partner organization" /></label>
              <label className="text-sm font-medium text-slate-700">Contact person<input value={contactForm.primary_contact_name} onChange={(e) => setContactForm({ ...contactForm, primary_contact_name: e.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="Full name" /></label>
              <label className="text-sm font-medium text-slate-700">Email<input type="email" value={contactForm.primary_contact_email} onChange={(e) => setContactForm({ ...contactForm, primary_contact_email: e.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="name@organization.org" /></label>
              <label className="text-sm font-medium text-slate-700">Telephone<input value={contactForm.primary_contact_phone} onChange={(e) => setContactForm({ ...contactForm, primary_contact_phone: e.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="+256..." /></label>
              <label className="text-sm font-medium text-slate-700">Partnership category<input value={contactForm.category} onChange={(e) => setContactForm({ ...contactForm, category: e.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="Academic, health, industry..." /></label>
              <label className="text-sm font-medium text-slate-700">Status<select value={contactForm.status} onChange={(e) => setContactForm({ ...contactForm, status: e.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"><option value="prospect">Prospect</option><option value="engaging">Engaging</option><option value="negotiation">Negotiation</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="expired">Expired</option><option value="closed">Closed</option></select></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Notes<textarea value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="Relationship details or follow-up notes" /></label>
              {fileError && <p className="text-sm text-red-700 sm:col-span-2">{fileError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4"><button type="button" disabled={savingContact} onClick={() => { setShowAddContact(false); setEditingRecord(null); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700">Cancel</button><button type="button" disabled={savingContact || !contactForm.name.trim()} onClick={() => void saveContact()} className="rounded-lg bg-[#00695c] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{savingContact ? "Saving…" : editingRecord ? "Save Changes" : "Save Contact"}</button></div>
          </section>
        </div>
      )}
      {showImport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !importing) setShowImport(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="partnership-import-title" className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div><h2 id="partnership-import-title" className="font-semibold text-slate-900">Import partnerships</h2><p className="mt-1 text-sm text-slate-500">Review the CSV records before saving them.</p></div>
              <button type="button" aria-label="Close import" disabled={importing} onClick={() => setShowImport(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="max-h-[calc(92vh-145px)] space-y-4 overflow-y-auto p-5 sm:p-6">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white text-emerald-800 shadow-sm"><Upload size={20} /></div>
                <p className="mt-3 text-sm font-semibold text-slate-800">{fileName || "Choose a CSV file to upload"}</p>
                <p className="mt-1 text-xs text-slate-500">CSV UTF-8 · Maximum 5 MB · Organization Name is required</p>
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => void handleFile(e.target.files?.[0])} className="mx-auto mt-4 block max-w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-semibold file:text-emerald-800 hover:file:bg-emerald-100" />
                <button type="button" onClick={downloadTemplate} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:underline"><Download size={15} /> Download CSV template</button>
              </div>
              {fileError && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={17} className="mt-0.5 shrink-0" /><span>{fileError}</span></div>}
              {importResult && <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 size={17} className="mt-0.5 shrink-0" /><span>{importResult}</span></div>}
              {preview.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3"><div className="font-medium text-slate-800">Import preview <span className="ml-1 text-sm font-normal text-slate-500">({preview.length} row(s))</span></div><span className="text-xs text-slate-500">Duplicates are checked during import</span></div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2.5">Organization</th><th className="px-3 py-2.5">Contact</th><th className="px-3 py-2.5">Email</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Status</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{preview.slice(0, 100).map((row, index) => <tr key={index}><td className="px-3 py-2.5 font-medium text-slate-800">{row.organization_name}</td><td className="px-3 py-2.5 text-slate-600">{row.contact_person || "—"}</td><td className="px-3 py-2.5 text-slate-600">{row.email || "—"}</td><td className="px-3 py-2.5 text-slate-600">{row.partnership_type || "—"}</td><td className="px-3 py-2.5 text-slate-600">{row.status}</td></tr>)}</tbody>
                    </table>
                  </div>
                  {preview.length > 100 && <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">Showing first 100 rows of {preview.length}.</p>}
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" disabled={importing} onClick={() => setShowImport(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
              <button type="button" disabled={importing || preview.length === 0} onClick={() => void importCsv()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00695c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#00574f] disabled:cursor-not-allowed disabled:opacity-50">{importing ? <><RefreshCw size={16} className="animate-spin" /> Importing…</> : <><Upload size={16} /> Import {preview.length.toLocaleString()} row(s)</>}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
