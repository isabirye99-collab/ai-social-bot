"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AlumniRow = {
  id: string;
  alumni_id: string;
  full_name: string;
  program: string | null;
  graduation_year: number | null;
  phone: string | null;
  work_email: string | null;
  employment_status: string | null;
  verification_status: string;
  missing_fields: string[] | null;
};

const brand = "#106053";
const accent = "#8dc642";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e4ebe6", borderRadius: 14, padding: 18, boxShadow: "0 4px 16px rgba(20,54,39,.035)" };

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' && quoted && source[i + 1] === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

const clean = (value: unknown) => String(value ?? "").trim();
const yes = (value: unknown) => ["yes", "y", "true", "1"].includes(clean(value).toLowerCase());

export default function AlumniPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<AlumniRow[]>([]);
  const [total, setTotal] = useState(0);
  const [needsReview, setNeedsReview] = useState(0);
  const [verified, setVerified] = useState(0);
  const [employed, setEmployed] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [all, review, good, work] = await Promise.all([
        supabase.from("alumni").select("id", { count: "exact", head: true }),
        supabase.from("alumni").select("id", { count: "exact", head: true }).in("verification_status", ["needs_review", "contact_required", "in_progress"]),
        supabase.from("alumni").select("id", { count: "exact", head: true }).eq("verification_status", "verified"),
        supabase.from("alumni").select("id", { count: "exact", head: true }).ilike("employment_status", "employed"),
      ]);
      if (all.error) throw all.error;
      setTotal(all.count || 0); setNeedsReview(review.count || 0); setVerified(good.count || 0); setEmployed(work.count || 0);
      let query = supabase.from("alumni").select("id,alumni_id,full_name,program,graduation_year,phone,work_email,employment_status,verification_status,missing_fields").order("full_name").limit(100);
      if (search.trim()) query = query.or("full_name.ilike.%"+search.trim()+"%,alumni_id.ilike.%"+search.trim()+"%,work_email.ilike.%"+search.trim()+"%");
      if (status !== "all") query = query.eq("verification_status", status);
      const result = await query;
      if (result.error) throw result.error;
      setRows((result.data || []) as AlumniRow[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load alumni records."); }
    finally { setLoading(false); }
  }, [search, status]);

  useEffect(() => { void load(); }, [load]);

  async function verifyAlumnus(alumnus: AlumniRow) {
    if (alumnus.missing_fields?.length) return;
    setError(""); setProgress("");
    const now = new Date().toISOString();
    const { error: verifyError } = await supabase.from("alumni").update({
      verification_status: "verified", last_verified_at: now, updated_at: now
    }).eq("id", alumnus.id);
    if (verifyError) setError(verifyError.message);
    else { setProgress(alumnus.full_name + " has been marked as verified."); await load(); }
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(""); setProgress("");
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Please export the Master Alumni Database worksheet as a CSV file first."); return; }
    setImporting(true);
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) throw new Error("The CSV file has no alumni rows.");
      const headers = parsed[0].map((h) => clean(h).replace(/^\uFEFF/, "").toLowerCase());
      const index = (name: string) => headers.indexOf(name.toLowerCase());
      const get = (r: string[], name: string) => index(name) < 0 ? "" : clean(r[index(name)]);
      const records = parsed.slice(1).map((r, i) => {
        const fullName = get(r, "Full Name");
        if (!fullName) return null;
        const missing: string[] = [];
        const yearRaw = get(r, "Graduation Year");
        const yearMatch = yearRaw.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? Number(yearMatch[0]) : Number(yearRaw);
        const phoneValue = get(r, "Phone");
        const whatsappValue = get(r, "WhatsApp");
        if (!phoneValue && !whatsappValue) missing.push("phone");
        if (!get(r, "Work Email")) missing.push("work_email");
        if (!get(r, "Student No")) missing.push("student_no");
        if (!get(r, "Program")) missing.push("program");
        if (!Number.isFinite(year) || year <= 1900) missing.push("graduation_year");
        if (!get(r, "Faculty")) missing.push("faculty");
        if (!get(r, "City")) missing.push("city");
        if (!get(r, "LinkedIn")) missing.push("linkedin");
        if (!get(r, "Employment Status")) missing.push("employment_status");
        if (!get(r, "Employer")) missing.push("employer");
        if (!get(r, "Job Title")) missing.push("job_title");
        if (!get(r, "Industry")) missing.push("industry");
        const scoreRaw = get(r, "Engagement Score");
        const score = scoreRaw ? Number(scoreRaw) : Number.NaN;
        return {
          alumni_id: get(r, "Alumni ID") || "CIU-ALM-" + String(i + 1).padStart(5, "0"),
          student_no: get(r, "Student No") || null,
          full_name: fullName,
          gender: get(r, "Gender") || null,
          work_email: get(r, "Work Email") || null,
          phone: phoneValue || null,
          whatsapp: whatsappValue || null,
          linkedin: get(r, "LinkedIn") || null,
          city: get(r, "City") || null,
          nationality: get(r, "Nationality") || null,
          program: get(r, "Program") || null,
          faculty: get(r, "Faculty") || null,
          graduation_year: Number.isFinite(year) && year > 1900 ? year : null,
          employment_status: get(r, "Employment Status") || null,
          employer: get(r, "Employer") || null,
          job_title: get(r, "Job Title") || null,
          industry: get(r, "Industry") || null,
          mentor: yes(get(r, "Mentor")),
          volunteer: yes(get(r, "Volunteer")),
          business_owner: yes(get(r, "Business Owner")),
          membership_status: get(r, "Membership Status") || null,
          whatsapp_group: yes(get(r, "WhatsApp Group")),
          linkedin_follower: yes(get(r, "LinkedIn Follower")),
          engagement_score: Number.isFinite(score) ? score : null,
          verification_status: (!phoneValue && !whatsappValue && !get(r, "Work Email")) ? "contact_required" : "needs_review",
          missing_fields: missing,
          source_import: file.name,
        };
      }).filter(Boolean) as Record<string, unknown>[];
      if (!records.length) throw new Error("No valid alumni names were found in the CSV.");
      const batchSize = 200;
      let insertedCount = 0;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { data: inserted, error: insertError } = await supabase.from("alumni")
          .upsert(batch, { onConflict: "alumni_id", ignoreDuplicates: true }).select("id");
        if (insertError) throw insertError;
        insertedCount += inserted?.length || 0;
        setProgress("Processed " + Math.min(i + batch.length, records.length).toLocaleString() + " of " + records.length.toLocaleString() + " records · " + insertedCount.toLocaleString() + " new records added…");
      }
      const skippedCount = records.length - insertedCount;
      setProgress("Import completed: " + insertedCount.toLocaleString() + " new alumni records added; " + skippedCount.toLocaleString() + " existing Alumni IDs skipped. Incomplete profiles have been flagged for review.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "The import could not be completed."); }
    finally { setImporting(false); event.target.value = ""; }
  }

  const metric = (label: string, value: number, hint: string) => (
    <div style={card}><div style={{ color: "#66766e", fontSize: 12, fontWeight: 700 }}>{label}</div><div style={{ color: "#173d34", fontSize: 30, fontWeight: 800, marginTop: 7 }}>{value.toLocaleString()}</div><div style={{ color: "#84928b", fontSize: 11, marginTop: 4 }}>{hint}</div></div>
  );

  return <div style={{ padding: "28px clamp(16px,3vw,34px) 44px", color: "#173d34" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
      <div><div style={{ color: brand, fontSize: 11, fontWeight: 800, letterSpacing: 1.5 }}>RELATIONSHIP MANAGEMENT</div><h1 style={{ margin: "7px 0 5px", fontSize: 28, fontWeight: 800 }}>Alumni</h1><p style={{ margin: 0, color: "#718078", fontSize: 13 }}>Manage graduate records, verify profiles and strengthen lifelong connections with CIU.</p></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Link href="/alumni/events" style={{ display: "inline-flex", alignItems: "center", padding: "10px 12px", border: "1px solid #d9e4dd", borderRadius: 8, color: brand, background: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 750 }}>Events & Attendance</Link>
        <Link href="/alumni/mentorship" style={{ display: "inline-flex", alignItems: "center", padding: "10px 12px", border: "1px solid #d9e4dd", borderRadius: 8, color: brand, background: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 750 }}>Mentorship</Link>
        <Link href="/alumni/referrals" style={{ display: "inline-flex", alignItems: "center", padding: "10px 12px", border: "1px solid #d9e4dd", borderRadius: 8, color: brand, background: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 750 }}>Referrals</Link>
        <Link href="/alumni/communications" style={{ display: "inline-flex", alignItems: "center", padding: "10px 12px", border: "1px solid #d9e4dd", borderRadius: 8, color: brand, background: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 750 }}>Communications</Link>
        <Link href="/alumni/reviews" style={{ display: "inline-flex", alignItems: "center", padding: "10px 12px", border: "1px solid #d9e4dd", borderRadius: 8, color: brand, background: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 750 }}>Profile Reviews</Link>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 15px", borderRadius: 9, background: brand, color: "#fff", fontSize: 13, fontWeight: 700, cursor: importing ? "wait" : "pointer", opacity: importing ? .65 : 1 }}>
          {importing ? "Importing…" : "Import alumni CSV"}
          <input type="file" accept=".csv,text/csv" onChange={importCsv} disabled={importing} style={{ display: "none" }} />
        </label>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 13, marginBottom: 20 }}>
      {metric("Total Alumni", total, "Graduate records in the database")}
      {metric("Profiles Requiring Review", needsReview, "Incomplete or unverified profiles")}
      {metric("Verified Profiles", verified, "Confirmed by the Alumni Office")}
      {metric("Marked Employed", employed, "Employment status recorded")}
    </div>
    {progress && <div style={{ ...card, marginBottom: 14, borderColor: "#c9e2d3", color: brand, fontSize: 13 }}>{progress}</div>}
    {error && <div role="alert" style={{ ...card, marginBottom: 14, borderColor: "#f4c7c7", color: "#a32828", fontSize: 13 }}>{error}</div>}
    <section style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div><h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Alumni Directory</h2><p style={{ margin: "4px 0 0", fontSize: 12, color: "#829088" }}>Showing up to 100 matching records. Search by name, Alumni ID or email.</p></div>
        <button onClick={() => void load()} style={{ border: "1px solid #d9e4dd", background: "#fff", color: brand, borderRadius: 8, padding: "9px 13px", fontWeight: 700, cursor: "pointer" }}>Refresh</button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search alumni…" style={{ flex: "1 1 240px", minWidth: 180, border: "1px solid #dce5df", borderRadius: 8, padding: "10px 12px", color: "#173d34" }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ border: "1px solid #dce5df", borderRadius: 8, padding: "10px 12px", color: "#173d34", background: "#fff" }}>
          <option value="all">All verification statuses</option><option value="needs_review">Needs review</option><option value="contact_required">Contact required</option><option value="in_progress">In progress</option><option value="verified">Verified</option>
        </select>
      </div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780, fontSize: 12 }}>
        <thead><tr style={{ background: "#f4f8f5", textAlign: "left", color: "#61736a" }}>{["Alumni","Programme","Graduation","Contact","Employment","Profile status","Action"].map((h) => <th key={h} style={{ padding: 12, fontWeight: 800 }}>{h}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#819087" }}>Loading alumni records…</td></tr> : rows.length === 0 ? <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#819087" }}>No matching alumni records found.</td></tr> : rows.map((a) => <tr key={a.id} style={{ borderTop: "1px solid #edf1ee" }}>
          <td style={{ padding: 12 }}><div style={{ fontWeight: 800, color: "#203d33" }}>{a.full_name}</div><div style={{ color: "#87958d", marginTop: 3 }}>{a.alumni_id}</div></td>
          <td style={{ padding: 12 }}>{a.program || "—"}</td><td style={{ padding: 12 }}>{a.graduation_year || "—"}</td>
          <td style={{ padding: 12 }}><div>{a.phone || "No phone"}</div><div style={{ color: "#87958d", marginTop: 3 }}>{a.work_email || "No email"}</div></td>
          <td style={{ padding: 12 }}>{a.employment_status || "Not updated"}</td>
          <td style={{ padding: 12 }}><span style={{ display: "inline-block", padding: "5px 8px", borderRadius: 20, fontWeight: 700, fontSize: 10, color: a.verification_status === "verified" ? "#17643f" : "#855b0a", background: a.verification_status === "verified" ? "#e7f5ec" : "#fff4d9" }}>{a.verification_status.replaceAll("_", " ")}</span>{a.missing_fields?.length ? <div style={{ color: "#9b6b1a", fontSize: 10, marginTop: 4 }}>{a.missing_fields.length} missing fields</div> : null}</td>
          <td style={{ padding: 12 }}>{a.verification_status === "verified" ? <span style={{ color: "#17643f", fontWeight: 750 }}>Verified</span> : a.missing_fields?.length ? <span style={{ color: "#9b6b1a" }}>Complete missing fields</span> : <button onClick={() => void verifyAlumnus(a)} style={{ border: 0, borderRadius: 7, padding: "7px 10px", background: "#106053", color: "#fff", fontSize: 11, fontWeight: 750, cursor: "pointer" }}>Mark verified</button>}</td>
        </tr>)}</tbody>
      </table></div>
      <div style={{ color: "#84928b", fontSize: 11, marginTop: 12 }}>Database total: {total.toLocaleString()} alumni records.</div>
    </section>
    <div style={{ marginTop: 14, color: "#7c8982", fontSize: 11 }}>Import tip: export the “Master Alumni Database” worksheet from your workbook as CSV (UTF-8), then upload it here. The import keeps all records and skips duplicate Alumni IDs.</div>
  </div>;
}
