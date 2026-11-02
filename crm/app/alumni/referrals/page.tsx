"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Referral = {
  id: string;
  alumni_id: string;
  referred_student_name: string;
  referred_student_phone: string | null;
  referred_student_email: string | null;
  program: string | null;
  intake: string | null;
  enrollment_status: string;
  incentive_status: string | null;
  notes: string | null;
  created_at: string;
  alumni: { full_name: string; alumni_id: string } | null;
};

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e4ebe6", borderRadius: 14, padding: 18, boxShadow: "0 4px 16px rgba(20,54,39,.035)" };
const field: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, height: 40, padding: "0 10px", border: "1px solid #dce5df", borderRadius: 8, background: "#fff", color: "#173d34" };
const primary: React.CSSProperties = { border: 0, borderRadius: 8, padding: "9px 13px", background: "#106053", color: "#fff", fontWeight: 750, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #d9e4dd", borderRadius: 8, padding: "8px 11px", background: "#fff", color: "#106053", fontWeight: 700, cursor: "pointer" };

export default function AlumniReferralsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ alumni_id: "", referred_student_name: "", referred_student_phone: "", referred_student_email: "", program: "", intake: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("alumni_referrals")
      .select("id,alumni_id,referred_student_name,referred_student_phone,referred_student_email,program,intake,enrollment_status,incentive_status,notes,created_at,alumni(full_name,alumni_id)")
      .order("created_at", { ascending: false }).limit(500);
    if (queryError) setError(queryError.message);
    else setItems((data || []) as unknown as Referral[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    const { error: saveError } = await supabase.from("alumni_referrals").insert({
      alumni_id: form.alumni_id.trim(), referred_student_name: form.referred_student_name.trim(),
      referred_student_phone: form.referred_student_phone || null, referred_student_email: form.referred_student_email || null,
      program: form.program || null, intake: form.intake || null, notes: form.notes || null,
      enrollment_status: "referred", incentive_status: "pending"
    });
    if (saveError) setError(saveError.message);
    else {
      setNotice("Referral recorded successfully."); setShowForm(false);
      setForm({ alumni_id: "", referred_student_name: "", referred_student_phone: "", referred_student_email: "", program: "", intake: "", notes: "" });
      await load();
    }
    setSaving(false);
  }

  async function update(item: Referral, key: "enrollment_status" | "incentive_status", value: string) {
    setError(""); setNotice("");
    const { error: updateError } = await supabase.from("alumni_referrals").update({ [key]: value }).eq("id", item.id);
    if (updateError) setError(updateError.message);
    else { setNotice("Referral updated."); await load(); }
  }

  const referred = items.length;
  const enrolled = items.filter(x => x.enrollment_status === "enrolled").length;
  const pending = items.filter(x => ["referred", "contacted", "applied", "admitted"].includes(x.enrollment_status)).length;
  const incentives = items.filter(x => x.incentive_status === "pending").length;

  return <main style={{ padding: "28px clamp(16px,3vw,34px) 48px", color: "#173d34" }}>
    <Link href="/alumni" style={{ color: "#106053", fontSize: 12, fontWeight: 750, textDecoration: "none" }}>← Alumni directory</Link>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", margin: "14px 0 20px" }}>
      <div><div style={{ color: "#106053", fontSize: 11, fontWeight: 800, letterSpacing: 1.4 }}>ALUMNI AMBASSADORS</div><h1 style={{ margin: "6px 0", fontSize: 28, fontWeight: 850 }}>Alumni Referrals</h1><p style={{ margin: 0, color: "#718078", fontSize: 13 }}>Track graduate referrals, admissions progress and recruitment incentives.</p></div>
      <button style={primary} onClick={() => setShowForm(v => !v)}>+ Record referral</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 16 }}>
      {[["Total referrals", referred], ["Enrolled", enrolled], ["In progress", pending], ["Incentives pending", incentives]].map(([label, value]) => <div key={String(label)} style={card}><div style={{ fontSize: 12, color: "#718078", fontWeight: 700 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 850, marginTop: 6 }}>{value}</div></div>)}
    </div>
    {notice && <div style={{ ...card, marginBottom: 12, color: "#17643f", background: "#eff9f1" }}>{notice}</div>}
    {error && <div role="alert" style={{ ...card, marginBottom: 12, color: "#a32828", borderColor: "#f2cccc" }}>{error}</div>}
    {showForm && <form onSubmit={save} style={{ ...card, marginBottom: 14 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 850 }}>Record an alumni referral</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Referring Alumni Record ID *<input required value={form.alumni_id} onChange={e => setForm({ ...form, alumni_id: e.target.value })} placeholder="Paste alumni record UUID" style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Prospective student name *<input required value={form.referred_student_name} onChange={e => setForm({ ...form, referred_student_name: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Phone<input value={form.referred_student_phone} onChange={e => setForm({ ...form, referred_student_phone: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Email<input type="email" value={form.referred_student_email} onChange={e => setForm({ ...form, referred_student_email: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Programme of interest<input value={form.program} onChange={e => setForm({ ...form, program: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Intake<input value={form.intake} onChange={e => setForm({ ...form, intake: e.target.value })} placeholder="e.g. February 2027" style={field} /></label>
        <label style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700 }}>Notes<textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...field, height: "auto", padding: 10 }} /></label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}><button disabled={saving} style={primary}>{saving ? "Saving…" : "Save referral"}</button></div>
    </form>}
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div><h2 style={{ margin: 0, fontSize: 17, fontWeight: 850 }}>Referral register</h2><p style={{ margin: "4px 0 0", color: "#819087", fontSize: 12 }}>Update admission progress and incentive status as the referral moves forward.</p></div><button style={secondary} onClick={() => void load()}>Refresh</button></div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: "#f4f8f5", textAlign: "left", color: "#61736a" }}>{["Prospective student", "Referred by", "Programme / intake", "Contact", "Admission progress", "Incentive"].map(x => <th key={x} style={{ padding: 11 }}>{x}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }}>Loading referrals…</td></tr> : items.length === 0 ? <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#819087" }}>No alumni referrals have been recorded yet.</td></tr> : items.map(item => <tr key={item.id} style={{ borderTop: "1px solid #edf1ee" }}>
          <td style={{ padding: 11, fontWeight: 800 }}>{item.referred_student_name}<div style={{ color: "#819087", fontWeight: 400, marginTop: 3 }}>{new Date(item.created_at).toLocaleDateString()}</div></td>
          <td style={{ padding: 11 }}>{item.alumni?.full_name || "Alumni"}<div style={{ color: "#819087" }}>{item.alumni?.alumni_id || ""}</div></td>
          <td style={{ padding: 11 }}>{item.program || "—"}<div style={{ color: "#819087" }}>{item.intake || ""}</div></td>
          <td style={{ padding: 11 }}>{item.referred_student_phone || "—"}<div style={{ color: "#819087" }}>{item.referred_student_email || ""}</div></td>
          <td style={{ padding: 11 }}><select aria-label="Admission progress" value={item.enrollment_status} onChange={e => void update(item, "enrollment_status", e.target.value)} style={field}>{["referred","contacted","applied","admitted","enrolled","not_converted"].map(x => <option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}</select></td>
          <td style={{ padding: 11 }}><select aria-label="Incentive status" value={item.incentive_status || "not_eligible"} onChange={e => void update(item, "incentive_status", e.target.value)} style={field}>{["not_eligible","pending","approved","paid","waived"].map(x => <option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}</select></td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </main>;
}
