"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Upload, CheckCircle2, AlertTriangle, LoaderCircle } from "lucide-react";

type Row = Record<string, string>;
const parseCsv = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field.length === 0) quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
};
const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test((v || "").trim()) ? v.trim() : null;
const clean = (v: unknown) => String(v ?? "").trim() || null;

export default function ShortCoursesImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number; createdCourses: number; unmatched: string[] } | null>(null);

  const importFile = async (file?: File) => {
    if (!file) return;
    setError(""); setResult(null); setFileName(file.name); setBusy(true); setProgress("Reading CSV…");
    try {
      const text = await file.text();
      const matrix = parseCsv(text);
      if (matrix.length < 2) throw new Error("The CSV has no applicant rows.");
      const headers = matrix[0].map(h => h.trim().replace(/^\uFEFF/, ""));
      const records: Row[] = matrix.slice(1).filter(r => r.some(v => v.trim())).map(cells => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])));
      const required = ["source_sheet", "legacy_reference", "course_title", "first_name", "last_name", "phone"];
      const missing = required.filter(k => !headers.includes(k));
      if (missing.length) throw new Error("This CSV format is not supported. Missing columns: " + missing.join(", "));
      const supabase = createClient();
      setProgress("Loading course catalogue and checking existing imports…");
      const { data: courseData, error: courseError } = await supabase.from("short_courses").select("id,title");
      if (courseError) throw courseError;
      const courseMap = new Map<string, string>((courseData || []).map((c: {id:string;title:string}) => [c.title.trim().toLowerCase(), c.id]));
      const missingTitles = [...new Set(records.map(r => clean(r.course_title) || clean(r.raw_course) || "Historical short course application").filter((t): t is string => !!t && !courseMap.has(t.toLowerCase())) )];
      let createdCourses = 0;
      for (const title of missingTitles) {
        const { data, error: createError } = await supabase.from("short_courses").insert({
          title, category: "Historical import", description: "Historical course title created to preserve applicant records from the legacy spreadsheet.",
          status: "draft", public_visible: false, delivery_mode: "In person", currency: "UGX"
        }).select("id,title").single();
        if (createError) {
          const { data: refreshed, error: refreshError } = await supabase.from("short_courses").select("id,title").ilike("title", title).limit(1).maybeSingle();
          if (refreshError || !refreshed) throw createError;
          courseMap.set(title.toLowerCase(), refreshed.id);
        } else if (data) { courseMap.set(title.toLowerCase(), data.id); createdCourses++; }
      }
      const refs = [...new Set(records.map((r, i) => clean(r.legacy_reference) || (clean(r.source_sheet) + " row " + (i + 2))))];
      const existing = new Set<string>();
      for (let i = 0; i < refs.length; i += 200) {
        const { data, error: checkError } = await supabase.from("short_course_applications").select("legacy_reference").in("legacy_reference", refs.slice(i, i + 200));
        if (checkError) throw checkError;
        (data || []).forEach((x: {legacy_reference:string|null}) => { if (x.legacy_reference) existing.add(x.legacy_reference); });
      }
      const toInsert = records.map((r, i) => {
        const legacy_reference = clean(r.legacy_reference) || ((clean(r.source_sheet) || "Historical") + " row " + (i + 2));
        const title = clean(r.course_title) || clean(r.raw_course) || "Historical short course application";
        return { r, legacy_reference, course_id: courseMap.get(title.toLowerCase()) };
      }).filter(x => !existing.has(x.legacy_reference));
      let imported = 0;
      const skipped = records.length - toInsert.length;
      for (let i = 0; i < toInsert.length; i += 75) {
        setProgress(`Importing applicants ${Math.min(i + 75, toInsert.length)} of ${toInsert.length}…`);
        const batch = toInsert.slice(i, i + 75);
        const payload = batch.map(({r, legacy_reference, course_id}) => {
          if (!course_id) throw new Error("Could not map course for historical reference " + legacy_reference);
          const applicationDate = validDate(r.application_date);
          const submittedAt = clean(r.submitted_at);
          return {
            course_id, first_name: clean(r.first_name) || "Unknown", last_name: clean(r.last_name) || "Unknown",
            phone: clean(r.phone) || "Not provided", email: clean(r.email), date_of_birth: validDate(r.date_of_birth),
            gender: clean(r.gender), nationality: clean(r.nationality), highest_qualification: clean(r.highest_qualification),
            qualification_details: clean(r.qualification_details), source: clean(r.source), expected_outcome: clean(r.expected_outcome),
            application_status: "new", attendance_status: "not_started", source_sheet: clean(r.source_sheet),
            legacy_reference, application_date: applicationDate, source_application_date: applicationDate,
            submitted_at: submittedAt && !Number.isNaN(Date.parse(submittedAt)) ? new Date(submittedAt).toISOString() : new Date().toISOString(),
            application_fee_amount: 10000, payment_status: "not_submitted"
          };
        });
        const { error: insertError } = await supabase.from("short_course_applications").insert(payload);
        if (insertError) throw new Error("Import stopped after " + imported + " inserted rows. " + insertError.message + " You can safely retry the same CSV; rows already imported are checked by legacy reference.");
        imported += payload.length;
      }
      setResult({ imported, skipped, createdCourses, unmatched: missingTitles });
      setProgress("Import finished.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed. Please try again.");
    } finally { setBusy(false); }
  };

  const buttonStyle = { border: "1px solid #d3e3d9", background: "#fff", color: "#155b45", borderRadius: 9, padding: "10px 14px", fontWeight: 600 as const, cursor: "pointer" };
  return <main style={{ maxWidth: 1050, margin: "0 auto", padding: 24, color: "#173b2c" }}>
    <button onClick={() => window.location.href = "/shortcourses"} style={{ ...buttonStyle, display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20 }}><ArrowLeft size={16}/> Back to Short Courses</button>
    <header style={{ marginBottom: 22 }}>
      <div style={{ color: "#6b8979", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>CIU CRM · HISTORICAL DATA</div>
      <h1 style={{ fontSize: 28, fontWeight: 750, margin: "7px 0" }}>Import Short Course Applicants</h1>
      <p style={{ color: "#60796a", maxWidth: 760, lineHeight: 1.6 }}>Import the prepared historical CSV into the Applicants list. The importer preserves each source sheet and original reference, keeps application dates, and skips references already imported so you can safely retry.</p>
    </header>
    <section style={{ background: "#fff", border: "1px solid #dce9e1", borderRadius: 16, padding: 22, marginBottom: 18 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 0 }}>Select the historical CSV</h2>
      <p style={{ color: "#6b7f73", fontSize: 13 }}>Choose <strong>CIU_Short_Courses_Historical_Import.csv</strong>. This importer accepts CSV files with the prepared CIU historical-import columns.</p>
      <input ref={inputRef} type="file" accept=".csv,text/csv" disabled={busy} onChange={e => importFile(e.target.files?.[0])} style={{ display: "block", margin: "14px 0" }}/>
      {fileName && <p style={{ fontSize: 12, color: "#60796a" }}>Selected: {fileName}</p>}
      {busy && <p style={{ display: "flex", alignItems: "center", gap: 8, color: "#00695c" }}><LoaderCircle size={16}/> {progress}</p>}
      {!busy && progress && <p style={{ color: "#00695c" }}>{progress}</p>}
      {error && <div style={{ background: "#fff2f0", border: "1px solid #f4c7c2", padding: 12, borderRadius: 9, color: "#9f2f23", marginTop: 14 }}><AlertTriangle size={16} style={{ verticalAlign: "middle", marginRight: 6 }}/>{error}</div>}
      {result && <div style={{ background: "#f1faf4", border: "1px solid #c9e8d3", padding: 16, borderRadius: 12, marginTop: 14 }}>
        <h3 style={{ margin: "0 0 12px", color: "#176342", display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={18}/> Import summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
          {[["Imported",result.imported],["Skipped existing",result.skipped],["Hidden draft courses created",result.createdCourses]].map(([label,value]) => <div key={label} style={{ background: "#fff", padding: 12, borderRadius: 9 }}><div style={{ color: "#678272", fontSize: 12 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 750 }}>{value}</div></div>)}
        </div>
        {result.unmatched.length > 0 && <p style={{ fontSize: 12, color: "#60796a", marginBottom: 0 }}>Course titles not already in the catalogue were preserved as hidden draft courses: {result.unmatched.join("; ")}</p>}
        <button onClick={() => window.location.href = "/shortcourses"} style={{ ...buttonStyle, marginTop: 14, background: "#00695c", color: "#fff" }}>Open Applicants list</button>
      </div>}
    </section>
    <p style={{ color: "#7c8e83", fontSize: 12, lineHeight: 1.5 }}>Historical rows are added as new records with payment status “Not submitted”; no payment is assumed verified. Existing records and the course catalogue are not deleted or overwritten.</p>
  </main>;
}
