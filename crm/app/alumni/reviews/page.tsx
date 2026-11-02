"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Review = {
  id: string; alumni_id: string; proposed_changes: Record<string, unknown>;
  review_status: string; created_at: string;
  alumni: { full_name: string; alumni_id: string; work_email: string | null } | null;
};

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e4ebe6", borderRadius: 14, padding: 18, boxShadow: "0 4px 16px rgba(20,54,39,.035)" };
const button: React.CSSProperties = { border: "1px solid #d9e4dd", borderRadius: 8, padding: "8px 12px", background: "#fff", color: "#106053", fontWeight: 750, cursor: "pointer" };

export default function AlumniProfileReviewsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("pending");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    let query = supabase.from("alumni_profile_updates")
      .select("id,alumni_id,proposed_changes,review_status,created_at,alumni(full_name,alumni_id,work_email)")
      .order("created_at", { ascending: false }).limit(150);
    if (filter !== "all") query = query.eq("review_status", filter);
    const { data, error: queryError } = await query;
    if (queryError) setError(queryError.message);
    else setItems((data || []) as unknown as Review[]);
    setLoading(false);
  }, [filter, supabase]);

  useEffect(() => { void load(); }, [load]);

  async function decide(item: Review, decision: "approved" | "rejected") {
    setBusy(item.id); setError(""); setNotice("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Your staff session has expired. Sign in again.");
      if (decision === "approved") {
        const allowed = ["work_email","phone","whatsapp","linkedin","city","employment_status","employer","job_title","industry","profile_bio","career_interests","allow_email","allow_sms","allow_whatsapp"];
        const changes = Object.fromEntries(Object.entries(item.proposed_changes || {}).filter(([key]) => allowed.includes(key)));
        if (Object.keys(changes).length === 0) throw new Error("This request has no supported profile changes.");
        const { data: current, error: currentError } = await supabase.from("alumni")
          .select("missing_fields,work_email,phone,whatsapp,student_no,program,graduation_year,faculty,city,linkedin,employment_status,employer,job_title,industry")
          .eq("id", item.alumni_id).single();
        if (currentError) throw currentError;
        const merged = { ...current, ...changes } as Record<string, unknown>;
        const missing = (current.missing_fields || []).filter((field: string) => {
          const value = merged[field];
          return value == null || String(value).trim() === "";
        });
        const hasContact = Boolean(merged.work_email || merged.phone || merged.whatsapp);
        const now = new Date().toISOString();
        const verificationStatus = missing.length === 0 ? "verified" : hasContact ? "needs_review" : "contact_required";
        const { error: applyError } = await supabase.from("alumni").update({
          ...changes, missing_fields: missing, verification_status: verificationStatus,
          last_verified_at: missing.length === 0 ? now : null, updated_at: now
        }).eq("id", item.alumni_id);
        if (applyError) throw applyError;
      }
      const { error: reviewError } = await supabase.from("alumni_profile_updates").update({
        review_status: decision, reviewed_by: authData.user.id, reviewed_at: new Date().toISOString()
      }).eq("id", item.id);
      if (reviewError) throw reviewError;
      setNotice(decision === "approved" ? "Profile changes approved and applied." : "Profile change request rejected.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to process this request."); }
    finally { setBusy(""); }
  }

  return <main style={{ padding: "28px clamp(16px,3vw,34px) 48px", color: "#173d34" }}>
    <Link href="/alumni" style={{ color: "#106053", fontSize: 12, fontWeight: 750, textDecoration: "none" }}>← Alumni directory</Link>
    <div style={{ marginTop: 14, marginBottom: 20 }}><div style={{ color: "#106053", fontSize: 11, fontWeight: 800, letterSpacing: 1.4 }}>DATA QUALITY & VERIFICATION</div><h1 style={{ margin: "6px 0", fontSize: 28, fontWeight: 850 }}>Profile Review Queue</h1><p style={{ margin: 0, color: "#718078", fontSize: 13 }}>Review alumni-submitted changes before updating the official CIU alumni register.</p></div>
    {notice && <div style={{ ...card, marginBottom: 12, color: "#17643f", background: "#eff9f1" }}>{notice}</div>}
    {error && <div role="alert" style={{ ...card, marginBottom: 12, color: "#a32828", borderColor: "#f2cccc" }}>{error}</div>}
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}><div><h2 style={{ margin: 0, fontSize: 17, fontWeight: 850 }}>Submitted profile changes</h2><p style={{ margin: "4px 0 0", fontSize: 12, color: "#819087" }}>{items.length} request(s) in this view</p></div><div style={{ display: "flex", gap: 8 }}><select value={filter} onChange={e => setFilter(e.target.value)} style={{ border: "1px solid #d9e4dd", borderRadius: 8, padding: "8px 10px", color: "#173d34", background: "#fff" }}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All requests</option></select><button style={button} onClick={() => void load()}>Refresh</button></div></div>
      {loading ? <p style={{ padding: 20, color: "#819087" }}>Loading review requests…</p> : items.length === 0 ? <p style={{ padding: 20, color: "#819087", textAlign: "center" }}>No profile change requests in this view.</p> : <div style={{ display: "grid", gap: 12 }}>{items.map(item => <article key={item.id} style={{ border: "1px solid #edf1ee", borderRadius: 11, padding: 15 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div><div style={{ fontWeight: 850 }}>{item.alumni?.full_name || "Alumni record"}</div><div style={{ color: "#819087", fontSize: 11, marginTop: 3 }}>{item.alumni?.alumni_id || item.alumni_id} · Submitted {new Date(item.created_at).toLocaleString()}</div></div><span style={{ fontSize: 11, fontWeight: 800, textTransform: "capitalize", color: item.review_status === "pending" ? "#855b0a" : "#17643f" }}>{item.review_status}</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 8, marginTop: 12 }}>{Object.entries(item.proposed_changes || {}).map(([key, value]) => <div key={key} style={{ background: "#f6f9f7", borderRadius: 8, padding: 10 }}><div style={{ color: "#718078", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{key.replaceAll("_", " ")}</div><div style={{ fontSize: 12, marginTop: 4, overflowWrap: "anywhere" }}>{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "—")}</div></div>)}</div>
        {item.review_status === "pending" && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 13 }}><button disabled={busy === item.id} style={{ ...button, color: "#a32828" }} onClick={() => void decide(item, "rejected")}>Reject</button><button disabled={busy === item.id} style={{ ...button, background: "#106053", color: "#fff" }} onClick={() => void decide(item, "approved")}>{busy === item.id ? "Processing…" : "Approve changes"}</button></div>}
      </article>)}</div>}
    </section>
  </main>;
}
