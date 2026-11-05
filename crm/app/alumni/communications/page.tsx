"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Communication = { id: string; channel: string; subject: string | null; message_summary: string | null; audience: string | null; delivery_status: string | null; sent_at: string; alumni: { full_name: string; alumni_id: string } | null };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e4ebe6", borderRadius: 14, padding: 18, boxShadow: "0 4px 16px rgba(20,54,39,.035)" };
const field: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, height: 40, padding: "0 10px", border: "1px solid #dce5df", borderRadius: 8, background: "#fff", color: "#173d34" };
const primary: React.CSSProperties = { border: 0, borderRadius: 8, padding: "9px 13px", background: "#106053", color: "#fff", fontWeight: 750, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #d9e4dd", borderRadius: 8, padding: "8px 11px", background: "#fff", color: "#106053", fontWeight: 700, cursor: "pointer" };

export default function AlumniCommunicationsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ channel: "Email", subject: "", message_summary: "", audience: "All alumni", delivery_status: "sent" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("alumni_communications")
      .select("id,channel,subject,message_summary,audience,delivery_status,sent_at,alumni(full_name,alumni_id)")
      .order("sent_at", { ascending: false }).limit(300);
    if (queryError) setError(queryError.message);
    else setItems((data || []) as unknown as Communication[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: saveError } = await supabase.from("alumni_communications").insert({
      channel: form.channel, subject: form.subject || null, message_summary: form.message_summary || null,
      audience: form.audience, delivery_status: form.delivery_status, sent_by: user?.id || null
    });
    if (saveError) setError(saveError.message);
    else { setNotice("Communication activity logged."); setShowForm(false); setForm({ channel: "Email", subject: "", message_summary: "", audience: "All alumni", delivery_status: "sent" }); await load(); }
    setSaving(false);
  }

  return <main style={{ padding: "28px clamp(16px,3vw,34px) 48px", color: "#173d34" }}>
    <Link href="/alumni" style={{ color: "#106053", fontSize: 12, fontWeight: 750, textDecoration: "none" }}>← Alumni directory</Link>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", margin: "14px 0 20px" }}>
      <div><div style={{ color: "#106053", fontSize: 11, fontWeight: 800, letterSpacing: 1.4 }}>ALUMNI ENGAGEMENT</div><h1 style={{ margin: "6px 0", fontSize: 28, fontWeight: 850 }}>Alumni Communications</h1><p style={{ margin: 0, color: "#718078", fontSize: 13 }}>Keep a record of alumni outreach across email, SMS, WhatsApp and other channels.</p></div>
      <button style={primary} onClick={() => setShowForm(v => !v)}>+ Log communication</button>
    </div>
    <div style={{ ...card, marginBottom: 14, background: "#f7faf8", color: "#718078", fontSize: 12 }}>This page records outreach activity; it does not send messages. Use the Marketing module's approved channel integrations to dispatch campaigns.</div>
    {notice && <div style={{ ...card, marginBottom: 12, color: "#17643f", background: "#eff9f1" }}>{notice}</div>}
    {error && <div role="alert" style={{ ...card, marginBottom: 12, color: "#a32828", borderColor: "#f2cccc" }}>{error}</div>}
    {showForm && <form onSubmit={save} style={{ ...card, marginBottom: 14 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 850 }}>Log an alumni communication</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Channel<select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} style={field}>{["Email","SMS","WhatsApp","Phone","Event","Other"].map(x => <option key={x}>{x}</option>)}</select></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Audience<input value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} placeholder="All alumni, Class of 2020, Nursing alumni…" style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Subject / campaign<input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Delivery status<select value={form.delivery_status} onChange={e => setForm({ ...form, delivery_status: e.target.value })} style={field}>{["planned","sent","delivered","failed","logged"].map(x => <option key={x}>{x}</option>)}</select></label>
        <label style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700 }}>Message summary<textarea rows={3} value={form.message_summary} onChange={e => setForm({ ...form, message_summary: e.target.value })} style={{ ...field, height: "auto", padding: 10 }} /></label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}><button disabled={saving} style={primary}>{saving ? "Saving…" : "Save communication log"}</button></div>
    </form>}
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><h2 style={{ margin: 0, fontSize: 17, fontWeight: 850 }}>Communication history</h2><button style={secondary} onClick={() => void load()}>Refresh</button></div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 800, borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: "#f4f8f5", textAlign: "left", color: "#61736a" }}>{["Date","Channel","Subject","Audience","Delivery","Summary"].map(x => <th key={x} style={{ padding: 11 }}>{x}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }}>Loading communications…</td></tr> : items.length === 0 ? <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#819087" }}>No alumni communications have been logged yet.</td></tr> : items.map(item => <tr key={item.id} style={{ borderTop: "1px solid #edf1ee" }}>
          <td style={{ padding: 11 }}>{new Date(item.sent_at).toLocaleString()}</td><td style={{ padding: 11 }}>{item.channel}</td><td style={{ padding: 11, fontWeight: 750 }}>{item.subject || "—"}</td><td style={{ padding: 11 }}>{item.audience || "—"}</td><td style={{ padding: 11, textTransform: "capitalize" }}>{item.delivery_status || "—"}</td><td style={{ padding: 11 }}>{item.message_summary || "—"}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </main>;
}
