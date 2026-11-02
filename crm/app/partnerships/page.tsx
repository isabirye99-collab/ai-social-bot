"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Partnership = {
  id: string; name: string; category: string | null; status: string;
  primary_contact_name: string | null; primary_contact_email: string | null;
  start_date: string | null; end_date: string | null; next_action: string | null;
  next_action_date: string | null; estimated_value: number | null; currency: string;
};

const brand = "#106053";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e4ebe6", borderRadius: 14, padding: 18, boxShadow: "0 4px 16px rgba(20,54,39,.035)" };

export default function PartnershipsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Partnership[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const [pipeline, setPipeline] = useState(0);
  const [expiring, setExpiring] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", category: "Academic", status: "prospect", primary_contact_name: "", primary_contact_email: "", strategic_objective: "", next_action: "", next_action_date: "", start_date: "", end_date: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const today = new Date();
      const soon = new Date(); soon.setDate(today.getDate() + 90);
      const [all, live, prospects, ending, list] = await Promise.all([
        supabase.from("partnerships").select("id", { count: "exact", head: true }),
        supabase.from("partnerships").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("partnerships").select("id", { count: "exact", head: true }).in("status", ["prospect", "engaging", "negotiation"]),
        supabase.from("partnerships").select("id", { count: "exact", head: true }).gte("end_date", today.toISOString().slice(0,10)).lte("end_date", soon.toISOString().slice(0,10)),
        supabase.from("partnerships").select("id,name,category,status,primary_contact_name,primary_contact_email,start_date,end_date,next_action,next_action_date,estimated_value,currency").order("updated_at", { ascending: false }).limit(100),
      ]);
      if (list.error) throw list.error;
      setTotal(all.count || 0); setActive(live.count || 0); setPipeline(prospects.count || 0); setExpiring(ending.count || 0); setRows((list.data || []) as Partnership[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load partnerships."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const { error: saveError } = await supabase.from("partnerships").insert({
        name: form.name.trim(), category: form.category, status: form.status,
        primary_contact_name: form.primary_contact_name || null,
        primary_contact_email: form.primary_contact_email || null,
        strategic_objective: form.strategic_objective || null,
        next_action: form.next_action || null, next_action_date: form.next_action_date || null,
        start_date: form.start_date || null, end_date: form.end_date || null,
      });
      if (saveError) throw saveError;
      setShowForm(false);
      setForm({ name: "", category: "Academic", status: "prospect", primary_contact_name: "", primary_contact_email: "", strategic_objective: "", next_action: "", next_action_date: "", start_date: "", end_date: "" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save partnership."); }
    finally { setSaving(false); }
  }

  const metric = (label: string, value: number, hint: string) => <div style={card}><div style={{ color: "#66766e", fontSize: 12, fontWeight: 700 }}>{label}</div><div style={{ color: "#173d34", fontSize: 30, fontWeight: 800, marginTop: 7 }}>{value.toLocaleString()}</div><div style={{ color: "#84928b", fontSize: 11, marginTop: 4 }}>{hint}</div></div>;

  return <div style={{ padding: "28px clamp(16px,3vw,34px) 44px", color: "#173d34" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
      <div><div style={{ color: brand, fontSize: 11, fontWeight: 800, letterSpacing: 1.5 }}>STRATEGIC RELATIONSHIPS</div><h1 style={{ margin: "7px 0 5px", fontSize: 28, fontWeight: 800 }}>Partnerships</h1><p style={{ margin: 0, color: "#718078", fontSize: 13 }}>Manage institutional relationships, agreements, activities and partnership outcomes.</p></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="/partnerships/agreements" style={{ display: "inline-flex", alignItems: "center", padding: "10px 12px", border: "1px solid #d9e4dd", borderRadius: 8, color: brand, background: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 750 }}>Agreements & Activities</Link>
        <button onClick={() => setShowForm((v) => !v)} style={{ border: 0, background: brand, color: "#fff", borderRadius: 9, padding: "11px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ New Partnership</button>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 13, marginBottom: 20 }}>
      {metric("All Partnerships", total, "All registered relationships")}{metric("Active Partnerships", active, "Currently operational")}{metric("Pipeline", pipeline, "Prospects and negotiations")}{metric("Renewal Watch", expiring, "Ending within 90 days")}
    </div>
    {error && <div role="alert" style={{ ...card, borderColor: "#f4c7c7", color: "#a32828", marginBottom: 14 }}>{error}</div>}
    {showForm && <form onSubmit={save} style={{ ...card, marginBottom: 18 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 800 }}>Create partnership record</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Organisation / Partner name *<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={field}/></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={field}>{["Academic","Government","Healthcare","Corporate","NGO / Development","International","Professional Association","Media","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={field}>{["prospect","engaging","negotiation","active","on_hold","expired","closed"].map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Primary contact<input value={form.primary_contact_name} onChange={e=>setForm({...form,primary_contact_name:e.target.value})} style={field}/></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Contact email<input type="email" value={form.primary_contact_email} onChange={e=>setForm({...form,primary_contact_email:e.target.value})} style={field}/></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Start date<input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} style={field}/></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>End / renewal date<input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})} style={field}/></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Next action date<input type="date" value={form.next_action_date} onChange={e=>setForm({...form,next_action_date:e.target.value})} style={field}/></label>
        <label style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700 }}>Strategic objective<textarea value={form.strategic_objective} onChange={e=>setForm({...form,strategic_objective:e.target.value})} rows={2} style={{...field,height:"auto",padding:10}}/></label>
        <label style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700 }}>Next action<textarea value={form.next_action} onChange={e=>setForm({...form,next_action:e.target.value})} rows={2} style={{...field,height:"auto",padding:10}}/></label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 15 }}><button type="button" onClick={()=>setShowForm(false)} style={secondary}>Cancel</button><button disabled={saving} type="submit" style={primary}>{saving?"Saving…":"Save Partnership"}</button></div>
    </form>}
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div><h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Partnership Register</h2><p style={{ margin: "4px 0 0", color: "#829088", fontSize: 12 }}>Central register of CIU's institutional relationships.</p></div><button onClick={()=>void load()} style={secondary}>Refresh</button></div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 780, borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: "#f4f8f5", textAlign: "left", color: "#61736a" }}>{["Partner","Category","Status","Contact","Next action","Agreement period"].map(x=><th key={x} style={{ padding: 12 }}>{x}</th>)}</tr></thead>
        <tbody>{loading?<tr><td colSpan={6} style={{ padding: 24, textAlign: "center" }}>Loading partnerships…</td></tr>:rows.length===0?<tr><td colSpan={6} style={{ padding: 28, textAlign: "center", color: "#819087" }}>No partnership records yet. Add your first organisation above.</td></tr>:rows.map(x=><tr key={x.id} style={{ borderTop: "1px solid #edf1ee" }}>
          <td style={{ padding: 12, fontWeight: 800 }}><Link href={`/partnerships/${x.id}`} style={{ color: "#106053", textDecoration: "none" }}>{x.name}</Link><div style={{ fontSize: 10, color: "#87958d", marginTop: 3 }}>View relationship →</div></td><td style={{ padding: 12 }}>{x.category||"—"}</td><td style={{ padding: 12 }}><span style={{ background:x.status==="active"?"#e6f5eb":"#fff4d9",color:x.status==="active"?"#17643f":"#855b0a",padding:"5px 8px",borderRadius:18,fontWeight:700 }}>{x.status.replaceAll("_"," ")}</span></td><td style={{ padding: 12 }}>{x.primary_contact_name||"—"}<div style={{ color:"#87958d",marginTop:3 }}>{x.primary_contact_email||""}</div></td><td style={{ padding: 12 }}>{x.next_action||"—"}<div style={{ color:"#87958d",marginTop:3 }}>{x.next_action_date||""}</div></td><td style={{ padding: 12 }}>{x.start_date||"—"} to {x.end_date||"—"}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </div>;
}

const field: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, height: 40, padding: "0 10px", border: "1px solid #dce5df", borderRadius: 8, background: "#fff", color: "#173d34", fontWeight: 400 };
const primary: React.CSSProperties = { border: 0, borderRadius: 8, padding: "10px 15px", background: "#106053", color: "#fff", fontWeight: 700, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #d9e4dd", borderRadius: 8, padding: "9px 13px", background: "#fff", color: "#106053", fontWeight: 700, cursor: "pointer" };
