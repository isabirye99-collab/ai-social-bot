"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Review = {
  id: string;
  alumni_id: string;
  proposed_changes: Record<string, unknown>;
  review_status: string;
  review_notes: string | null;
  created_at: string;
  alumni: { full_name: string; alumni_id: string; work_email: string | null } | null;
};

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e4ebe6", borderRadius: 14, padding: 18 };
const button: React.CSSProperties = { border: 0, borderRadius: 8, padding: "9px 12px", background: "#106053", color: "#fff", fontWeight: 750, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #d9e4dd", borderRadius: 8, padding: "9px 12px", background: "#fff", color: "#106053", fontWeight: 750, cursor: "pointer" };

export default function AlumniReviewsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase
      .from("alumni_profile_updates")
      .select("id,alumni_id,proposed_changes,review_status,review_notes,created_at,alumni(full_name,alumni_id,work_email)")
      .order("created_at", { ascending: false }).limit(300);
    if (queryError) setError(queryError.message);
    else setRows((data || []) as unknown as Review[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function review(row: Review, decision: "approved" | "rejected") {
    setBusy(row.id); setError(""); setNotice("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Your session has expired. Sign in again."); setBusy(""); return; }
    if (decision === "approved") {
      const allowed = new Set(["gender","student_no","program","faculty","graduation_year","work_email","phone","whatsapp","linkedin","city","nationality","employment_status","employer","job_title","industry","profile_bio","career_interests","allow_email","allow_sms","allow_whatsapp"]);
      const changes = Object.fromEntries(Object.entries(row.proposed_changes || {}).filter(([key]) => allowed.has(key)));
      if (!Object.keys(changes).length) { setError("This request contains no supported profile fields."); setBusy(""); return; }
      const { error: updateError } = await supabase.from("alumni").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", row.alumni_id);
      if (updateError) { setError(updateError.message); setBusy(""); return; }
    }
    const { error: reviewError } = await supabase.from("alumni_profile_updates").update({
      review_status: decision,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: notes[row.id]?.trim() || null
    }).eq("id", row.id).eq("review_status", "pending");
    if (reviewError) setError(reviewError.message);
    else { setNotice(decision === "approved" ? "Profile update approved and applied." : "Profile update rejected."); await load(); }
    setBusy("");
  }

  return <main style={{ padding: "28px clamp(16px,3vw,34px) 48px", color: "#173d34" }}>
    <Link href="/alumni" style={{ color: "#106053", fontSize: 12, fontWeight: 750, textDecoration: "none" }}>← Alumni directory</Link>
    <header style={{ margin: "14px 0 20px" }}><div style={{ fontSize: 11, color: "#106053", fontWeight: 850, letterSpacing: 1.3 }}>ALUMNI DATA QUALITY</div><h1 style={{ fontSize: 28, fontWeight: 850, margin: "6px 0" }}>Profile Update Reviews</h1><p style={{ fontSize: 13, color: "#718078", margin: 0 }}>Review alumni-submitted changes before applying them to the official directory.</p></header>
    {notice && <div style={{ ...card, color: "#17643f", background: "#eff9f1", marginBottom: 12 }}>{notice}</div>}
    {error && <div role="alert" style={{ ...card, color: "#a32828", borderColor: "#f2cccc", marginBottom: 12 }}>{error}</div>}
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 14 }}><h2 style={{ fontSize: 17, fontWeight: 850, margin: 0 }}>Submitted changes</h2><button style={secondary} onClick={() => void load()}>Refresh</button></div>
      {loading ? <p>Loading submissions…</p> : rows.length === 0 ? <p style={{ color: "#819087", padding: 18, textAlign: "center" }}>No profile update submissions were found.</p> : <div style={{ display: "grid", gap: 12 }}>
        {rows.map(row => <article key={row.id} style={{ border: "1px solid #e7eee9", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><strong>{row.alumni?.full_name || "Alumnus record"}</strong><div style={{ color: "#718078", fontSize: 11, marginTop: 3 }}>{row.alumni?.alumni_id || row.alumni_id} · {row.alumni?.work_email || "No email"} · {new Date(row.created_at).toLocaleString()}</div></div><span style={{ fontSize: 11, fontWeight: 800, textTransform: "capitalize" }}>{row.review_status.replaceAll("_", " ")}</span></div>
          <div style={{ display: "grid", gap: 6, margin: "12px 0" }}>{Object.entries(row.proposed_changes || {}).map(([key, value]) => <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(130px,.7fr) minmax(0,1.3fr)", gap: 10, borderTop: "1px solid #edf1ee", paddingTop: 7, fontSize: 12 }}><strong style={{ textTransform: "capitalize" }}>{key.replaceAll("_", " ")}</strong><span style={{ overflowWrap: "anywhere" }}>{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "—")}</span></div>)}</div>
          {row.review_status === "pending" && <><label style={{ display: "block", fontSize: 11, fontWeight: 750 }}>Review notes<textarea value={notes[row.id] || ""} onChange={e => setNotes(old => ({ ...old, [row.id]: e.target.value }))} rows={2} style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, border: "1px solid #dce5df", borderRadius: 8, padding: 9 }} /></label><div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10, flexWrap: "wrap" }}><button disabled={busy === row.id} style={{ ...secondary, color: "#a32828" }} onClick={() => void review(row, "rejected")}>Reject</button><button disabled={busy === row.id} style={button} onClick={() => void review(row, "approved")}>{busy === row.id ? "Saving…" : "Approve & apply"}</button></div></>}
        </article>)}
      </div>}
    </section>
  </main>;
}
