"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Alumni = { id: string; full_name: string; alumni_id: string; program: string | null; mentor: boolean };
type Mentorship = { id: string; mentor_alumni_id: string; mentee_name: string | null; mentee_email: string | null; mentee_student_no: string | null; mentee_program: string | null; focus_area: string | null; status: string; started_at: string | null; ended_at: string | null; notes: string | null; alumni: { full_name: string; alumni_id: string } | null };

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e4ebe6", borderRadius: 14, padding: 18, boxShadow: "0 4px 16px rgba(20,54,39,.035)" };
const field: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, height: 40, padding: "0 10px", border: "1px solid #dce5df", borderRadius: 8, background: "#fff", color: "#173d34" };
const primary: React.CSSProperties = { border: 0, borderRadius: 8, padding: "9px 13px", background: "#106053", color: "#fff", fontWeight: 750, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #d9e4dd", borderRadius: 8, padding: "8px 11px", background: "#fff", color: "#106053", fontWeight: 700, cursor: "pointer" };

export default function AlumniMentorshipPage() {
  const supabase = createClient();
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [items, setItems] = useState<Mentorship[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ mentor_alumni_id: "", mentee_name: "", mentee_email: "", mentee_student_no: "", mentee_program: "", focus_area: "", started_at: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [people, pairs] = await Promise.all([
      supabase.from("alumni").select("id,full_name,alumni_id,program,mentor").order("full_name").limit(2000),
      supabase.from("alumni_mentorships").select("id,mentor_alumni_id,mentee_name,mentee_email,mentee_student_no,mentee_program,focus_area,status,started_at,ended_at,notes,alumni:alumni!alumni_mentorships_mentor_alumni_id_fkey(full_name,alumni_id)").order("created_at", { ascending: false }).limit(200)
    ]);
    if (people.error || pairs.error) setError((people.error || pairs.error)!.message);
    else { setAlumni((people.data || []) as Alumni[]); setItems((pairs.data || []) as unknown as Mentorship[]); }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    const { error: saveError } = await supabase.from("alumni_mentorships").insert({
      mentor_alumni_id: form.mentor_alumni_id, mentee_name: form.mentee_name.trim(),
      mentee_email: form.mentee_email || null, mentee_student_no: form.mentee_student_no || null,
      mentee_program: form.mentee_program || null, focus_area: form.focus_area || null,
      started_at: form.started_at || null, notes: form.notes || null, status: "pending"
    });
    if (saveError) setError(saveError.message);
    else { setNotice("Mentorship request recorded."); setShowForm(false); setForm({ mentor_alumni_id: "", mentee_name: "", mentee_email: "", mentee_student_no: "", mentee_program: "", focus_area: "", started_at: "", notes: "" }); await load(); }
    setSaving(false);
  }

  async function updateStatus(item: Mentorship, status: string) {
    const patch: Record<string, string | null> = { status };
    if (status === "active" && !item.started_at) patch.started_at = new Date().toISOString().slice(0,10);
    if (status === "completed") patch.ended_at = new Date().toISOString().slice(0,10);
    const { error: updateError } = await supabase.from("alumni_mentorships").update(patch).eq("id", item.id);
    if (updateError) setError(updateError.message); else { setNotice("Mentorship status updated."); await load(); }
  }

  return <main style={{ padding: "28px clamp(16px,3vw,34px) 48px", color: "#173d34" }}>
    <Link href="/alumni" style={{ color: "#106053", fontSize: 12, fontWeight: 750, textDecoration: "none" }}>← Alumni directory</Link>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", margin: "14px 0 20px" }}><div><div style={{ color: "#106053", fontSize: 11, fontWeight: 800, letterSpacing: 1.4 }}>CAREER DEVELOPMENT</div><h1 style={{ margin: "6px 0", fontSize: 28, fontWeight: 850 }}>Alumni Mentorship</h1><p style={{ margin: 0, color: "#718078", fontSize: 13 }}>Coordinate alumni mentors supporting CIU students and fellow graduates.</p></div><button style={primary} onClick={() => setShowForm(v => !v)}>+ Match a mentor</button></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 16 }}>{[["Mentors in directory", alumni.filter(a => a.mentor).length], ["Total matches", items.length], ["Active matches", items.filter(x => x.status === "active").length], ["Pending", items.filter(x => x.status === "pending").length]].map(([label,value]) => <div key={String(label)} style={card}><div style={{ fontSize: 12, color: "#718078", fontWeight: 700 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 850, marginTop: 6 }}>{value}</div></div>)}</div>
    {notice && <div style={{ ...card, marginBottom: 12, color: "#17643f", background: "#eff9f1" }}>{notice}</div>}{error && <div role="alert" style={{ ...card, marginBottom: 12, color: "#a32828", borderColor: "#f2cccc" }}>{error}</div>}
    {showForm && <form onSubmit={save} style={{ ...card, marginBottom: 14 }}><h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 850 }}>Create mentorship match</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
      <label style={{ fontSize: 12, fontWeight: 700 }}>Alumni mentor *<select required value={form.mentor_alumni_id} onChange={e => setForm({ ...form, mentor_alumni_id: e.target.value })} style={field}><option value="">Select mentor</option>{alumni.filter(a => a.mentor).map(a => <option key={a.id} value={a.id}>{a.full_name} · {a.alumni_id}</option>)}</select></label>
      <label style={{ fontSize: 12, fontWeight: 700 }}>Mentee name *<input required value={form.mentee_name} onChange={e => setForm({ ...form, mentee_name: e.target.value })} style={field} /></label>
      <label style={{ fontSize: 12, fontWeight: 700 }}>Mentee email<input type="email" value={form.mentee_email} onChange={e => setForm({ ...form, mentee_email: e.target.value })} style={field} /></label>
      <label style={{ fontSize: 12, fontWeight: 700 }}>Student number<input value={form.mentee_student_no} onChange={e => setForm({ ...form, mentee_student_no: e.target.value })} style={field} /></label>
      <label style={{ fontSize: 12, fontWeight: 700 }}>Programme<input value={form.mentee_program} onChange={e => setForm({ ...form, mentee_program: e.target.value })} style={field} /></label>
      <label style={{ fontSize: 12, fontWeight: 700 }}>Mentorship focus<input value={form.focus_area} onChange={e => setForm({ ...form, focus_area: e.target.value })} placeholder="Career guidance, research, leadership…" style={field} /></label>
      <label style={{ fontSize: 12, fontWeight: 700 }}>Start date<input type="date" value={form.started_at} onChange={e => setForm({ ...form, started_at: e.target.value })} style={field} /></label>
      <label style={{ fontSize: 12, fontWeight: 700, gridColumn: "1 / -1" }}>Notes<textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...field, height: "auto", padding: 10 }} /></label>
    </div><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}><button disabled={saving || alumni.filter(a => a.mentor).length === 0} style={primary}>{saving ? "Saving…" : "Save match"}</button></div></form>}
    <section style={card}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><h2 style={{ margin: 0, fontSize: 17, fontWeight: 850 }}>Mentorship register</h2><button style={secondary} onClick={() => void load()}>Refresh</button></div>{loading ? <p style={{ color: "#819087" }}>Loading mentorship records…</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 850, borderCollapse: "collapse", fontSize: 12 }}><thead><tr style={{ background: "#f4f8f5", textAlign: "left" }}>{["Mentor","Mentee","Focus","Start date","Status","Action"].map(x => <th key={x} style={{ padding: 11 }}>{x}</th>)}</tr></thead><tbody>{items.length === 0 ? <tr><td colSpan={6} style={{ padding: 22, textAlign: "center", color: "#819087" }}>No mentorship matches recorded yet. Mark alumni as mentors in the Alumni Directory before assigning them.</td></tr> : items.map(x => <tr key={x.id} style={{ borderTop: "1px solid #edf1ee" }}><td style={{ padding: 11, fontWeight: 800 }}>{x.alumni?.full_name || "Alumni"}<div style={{ color: "#819087" }}>{x.alumni?.alumni_id || ""}</div></td><td style={{ padding: 11 }}>{x.mentee_name || "—"}<div style={{ color: "#819087" }}>{x.mentee_program || x.mentee_student_no || ""}</div></td><td style={{ padding: 11 }}>{x.focus_area || "General"}</td><td style={{ padding: 11 }}>{x.started_at || "—"}</td><td style={{ padding: 11, textTransform: "capitalize" }}>{x.status}</td><td style={{ padding: 11 }}>{x.status === "pending" && <button style={primary} onClick={() => void updateStatus(x, "active")}>Activate</button>}{x.status === "active" && <button style={secondary} onClick={() => void updateStatus(x, "completed")}>Complete</button>}{x.status === "pending" && <button style={{ ...secondary, marginLeft: 5 }} onClick={() => void updateStatus(x, "declined")}>Decline</button>}</td></tr>)}</tbody></table></div>}</section>
  </main>;
}
