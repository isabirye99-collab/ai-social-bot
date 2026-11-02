"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Partner = { id: string; name: string };
type Agreement = { id: string; partnership_id: string; agreement_title: string; agreement_type: string; reference_number: string | null; signed_date: string | null; effective_date: string | null; expiry_date: string | null; renewal_notice_days: number; status: string; notes: string | null; partnerships: { name: string } | null };
type Activity = { id: string; partnership_id: string; activity_title: string; activity_type: string | null; planned_date: string | null; completed_date: string | null; target_beneficiaries: number | null; actual_beneficiaries: number | null; status: string; outcome: string | null; partnerships: { name: string } | null };

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e4ebe6", borderRadius: 14, padding: 18, boxShadow: "0 4px 16px rgba(20,54,39,.035)" };
const field: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, height: 40, padding: "0 10px", border: "1px solid #dce5df", borderRadius: 8, background: "#fff", color: "#173d34" };
const primary: React.CSSProperties = { border: 0, borderRadius: 8, padding: "9px 13px", background: "#106053", color: "#fff", fontWeight: 750, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #d9e4dd", borderRadius: 8, padding: "8px 11px", background: "#fff", color: "#106053", fontWeight: 700, cursor: "pointer" };

export default function PartnershipAgreementsPage() {
  const supabase = createClient();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tab, setTab] = useState<"agreements" | "activities">("agreements");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [agreement, setAgreement] = useState({ partnership_id: "", agreement_title: "", agreement_type: "MoU", reference_number: "", signed_date: "", effective_date: "", expiry_date: "", renewal_notice_days: "90", status: "draft", notes: "" });
  const [activity, setActivity] = useState({ partnership_id: "", activity_title: "", activity_type: "Implementation", planned_date: "", target_beneficiaries: "", status: "planned", outcome: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [p, a, x] = await Promise.all([
      supabase.from("partnerships").select("id,name").order("name"),
      supabase.from("partnership_agreements").select("id,partnership_id,agreement_title,agreement_type,reference_number,signed_date,effective_date,expiry_date,renewal_notice_days,status,notes,partnerships(name)").order("expiry_date", { ascending: true }),
      supabase.from("partnership_activities").select("id,partnership_id,activity_title,activity_type,planned_date,completed_date,target_beneficiaries,actual_beneficiaries,status,outcome,partnerships(name)").order("planned_date", { ascending: false })
    ]);
    const failure = p.error || a.error || x.error;
    if (failure) setError(failure.message);
    else { setPartners((p.data || []) as Partner[]); setAgreements((a.data || []) as unknown as Agreement[]); setActivities((x.data || []) as unknown as Activity[]); }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function saveAgreement(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    const { error: saveError } = await supabase.from("partnership_agreements").insert({
      partnership_id: agreement.partnership_id, agreement_title: agreement.agreement_title.trim(),
      agreement_type: agreement.agreement_type, reference_number: agreement.reference_number || null,
      signed_date: agreement.signed_date || null, effective_date: agreement.effective_date || null,
      expiry_date: agreement.expiry_date || null, renewal_notice_days: Number(agreement.renewal_notice_days) || 90,
      status: agreement.status, notes: agreement.notes || null
    });
    if (saveError) setError(saveError.message);
    else { setNotice("Agreement added to the register."); setShowForm(false); setAgreement({ partnership_id: "", agreement_title: "", agreement_type: "MoU", reference_number: "", signed_date: "", effective_date: "", expiry_date: "", renewal_notice_days: "90", status: "draft", notes: "" }); await load(); }
    setSaving(false);
  }

  async function saveActivity(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    const { error: saveError } = await supabase.from("partnership_activities").insert({
      partnership_id: activity.partnership_id, activity_title: activity.activity_title.trim(),
      activity_type: activity.activity_type, planned_date: activity.planned_date || null,
      target_beneficiaries: activity.target_beneficiaries ? Number(activity.target_beneficiaries) : null,
      status: activity.status, outcome: activity.outcome || null
    });
    if (saveError) setError(saveError.message);
    else { setNotice("Partnership activity added."); setShowForm(false); setActivity({ partnership_id: "", activity_title: "", activity_type: "Implementation", planned_date: "", target_beneficiaries: "", status: "planned", outcome: "" }); await load(); }
    setSaving(false);
  }

  async function updateAgreementStatus(id: string, status: string) {
    const { error: updateError } = await supabase.from("partnership_agreements").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) setError(updateError.message); else { setNotice("Agreement status updated."); await load(); }
  }
  async function completeActivity(item: Activity) {
    const { error: updateError } = await supabase.from("partnership_activities").update({ status: "completed", completed_date: new Date().toISOString().slice(0,10) }).eq("id", item.id);
    if (updateError) setError(updateError.message); else { setNotice("Activity marked as completed."); await load(); }
  }

  const soon = new Date(); soon.setDate(soon.getDate() + 90);
  const expiring = agreements.filter(a => a.expiry_date && new Date(a.expiry_date) >= new Date() && new Date(a.expiry_date) <= soon && a.status === "signed").length;

  return <main style={{ padding: "28px clamp(16px,3vw,34px) 48px", color: "#173d34" }}>
    <Link href="/partnerships" style={{ color: "#106053", fontSize: 12, fontWeight: 750, textDecoration: "none" }}>← Partnerships register</Link>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", margin: "14px 0 20px" }}><div><div style={{ color: "#106053", fontSize: 11, fontWeight: 800, letterSpacing: 1.4 }}>AGREEMENTS & DELIVERY</div><h1 style={{ margin: "6px 0", fontSize: 28, fontWeight: 850 }}>Agreements & Activities</h1><p style={{ margin: 0, color: "#718078", fontSize: 13 }}>Track MoUs, contract periods, renewal windows and delivery of partnership commitments.</p></div><button style={primary} onClick={() => setShowForm(v => !v)}>+ Add {tab === "agreements" ? "agreement" : "activity"}</button></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 16 }}>
      {[["Agreements", agreements.length], ["Signed", agreements.filter(a => a.status === "signed").length], ["Renewal watch", expiring], ["Activities", activities.length]].map(([label, value]) => <div key={String(label)} style={card}><div style={{ fontSize: 12, color: "#718078", fontWeight: 700 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 850, marginTop: 6 }}>{value}</div></div>)}
    </div>
    {notice && <div style={{ ...card, marginBottom: 12, color: "#17643f", background: "#eff9f1" }}>{notice}</div>}
    {error && <div role="alert" style={{ ...card, marginBottom: 12, color: "#a32828", borderColor: "#f2cccc" }}>{error}</div>}
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><button style={tab === "agreements" ? primary : secondary} onClick={() => { setTab("agreements"); setShowForm(false); }}>Agreements / MoUs</button><button style={tab === "activities" ? primary : secondary} onClick={() => { setTab("activities"); setShowForm(false); }}>Activities & outcomes</button></div>
    {showForm && <form onSubmit={tab === "agreements" ? saveAgreement : saveActivity} style={{ ...card, marginBottom: 14 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 850 }}>New {tab === "agreements" ? "agreement" : "partnership activity"}</h2>
      {tab === "agreements" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Partner *<select required value={agreement.partnership_id} onChange={e => setAgreement({ ...agreement, partnership_id: e.target.value })} style={field}><option value="">Select partner</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Agreement title *<input required value={agreement.agreement_title} onChange={e => setAgreement({ ...agreement, agreement_title: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Type<select value={agreement.agreement_type} onChange={e => setAgreement({ ...agreement, agreement_type: e.target.value })} style={field}>{["MoU","MoA","Service Agreement","Partnership Agreement","Contract","Other"].map(x => <option key={x}>{x}</option>)}</select></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Reference number<input value={agreement.reference_number} onChange={e => setAgreement({ ...agreement, reference_number: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Signed date<input type="date" value={agreement.signed_date} onChange={e => setAgreement({ ...agreement, signed_date: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Effective date<input type="date" value={agreement.effective_date} onChange={e => setAgreement({ ...agreement, effective_date: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Expiry date<input type="date" value={agreement.expiry_date} onChange={e => setAgreement({ ...agreement, expiry_date: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Renewal notice (days)<input type="number" min="1" value={agreement.renewal_notice_days} onChange={e => setAgreement({ ...agreement, renewal_notice_days: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Status<select value={agreement.status} onChange={e => setAgreement({ ...agreement, status: e.target.value })} style={field}>{["draft","under_review","signed","expired","terminated"].map(x => <option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></label>
        <label style={{ fontSize: 12, fontWeight: 700, gridColumn: "1 / -1" }}>Notes<textarea rows={2} value={agreement.notes} onChange={e => setAgreement({ ...agreement, notes: e.target.value })} style={{ ...field, height: "auto", padding: 10 }} /></label>
      </div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Partner *<select required value={activity.partnership_id} onChange={e => setActivity({ ...activity, partnership_id: e.target.value })} style={field}><option value="">Select partner</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Activity title *<input required value={activity.activity_title} onChange={e => setActivity({ ...activity, activity_title: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Activity type<input value={activity.activity_type} onChange={e => setActivity({ ...activity, activity_type: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Planned date<input type="date" value={activity.planned_date} onChange={e => setActivity({ ...activity, planned_date: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Target beneficiaries<input type="number" min="0" value={activity.target_beneficiaries} onChange={e => setActivity({ ...activity, target_beneficiaries: e.target.value })} style={field} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Status<select value={activity.status} onChange={e => setActivity({ ...activity, status: e.target.value })} style={field}>{["planned","in_progress","completed","cancelled"].map(x => <option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></label>
        <label style={{ fontSize: 12, fontWeight: 700, gridColumn: "1 / -1" }}>Expected outcome / notes<textarea rows={2} value={activity.outcome} onChange={e => setActivity({ ...activity, outcome: e.target.value })} style={{ ...field, height: "auto", padding: 10 }} /></label>
      </div>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}><button disabled={saving || partners.length === 0} style={primary}>{saving ? "Saving…" : "Save record"}</button></div>
    </form>}
    <section style={card}>
      {loading ? <p style={{ color: "#819087" }}>Loading partnership records…</p> : tab === "agreements" ? <><h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 850 }}>Agreement register</h2><div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 850, borderCollapse: "collapse", fontSize: 12 }}><thead><tr style={{ background: "#f4f8f5", textAlign: "left" }}>{["Partner / agreement","Type & reference","Effective period","Status","Action"].map(x => <th key={x} style={{ padding: 11 }}>{x}</th>)}</tr></thead><tbody>{agreements.length === 0 ? <tr><td colSpan={5} style={{ padding: 22, textAlign: "center", color: "#819087" }}>No agreements have been recorded yet.</td></tr> : agreements.map(a => <tr key={a.id} style={{ borderTop: "1px solid #edf1ee" }}><td style={{ padding: 11, fontWeight: 800 }}>{a.agreement_title}<div style={{ color: "#819087", marginTop: 3 }}>{a.partnerships?.name || "Partner"}</div></td><td style={{ padding: 11 }}>{a.agreement_type}<div style={{ color: "#819087" }}>{a.reference_number || "No reference"}</div></td><td style={{ padding: 11 }}>{a.effective_date || "—"} → {a.expiry_date || "No expiry"}</td><td style={{ padding: 11, textTransform: "capitalize" }}>{a.status.replaceAll("_"," ")}</td><td style={{ padding: 11 }}>{a.status !== "signed" && a.status !== "terminated" && <button style={primary} onClick={() => void updateAgreementStatus(a.id, "signed")}>Mark signed</button>}{a.status === "signed" && <button style={secondary} onClick={() => void updateAgreementStatus(a.id, "expired")}>Mark expired</button>}</td></tr>)}</tbody></table></div></> : <><h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 850 }}>Partnership activity tracker</h2><div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 850, borderCollapse: "collapse", fontSize: 12 }}><thead><tr style={{ background: "#f4f8f5", textAlign: "left" }}>{["Partner","Activity","Planned date","Beneficiaries","Status","Outcome / action"].map(x => <th key={x} style={{ padding: 11 }}>{x}</th>)}</tr></thead><tbody>{activities.length === 0 ? <tr><td colSpan={6} style={{ padding: 22, textAlign: "center", color: "#819087" }}>No partnership activities have been recorded yet.</td></tr> : activities.map(a => <tr key={a.id} style={{ borderTop: "1px solid #edf1ee" }}><td style={{ padding: 11 }}>{a.partnerships?.name || "Partner"}</td><td style={{ padding: 11, fontWeight: 800 }}>{a.activity_title}<div style={{ color: "#819087" }}>{a.activity_type || ""}</div></td><td style={{ padding: 11 }}>{a.planned_date || "—"}</td><td style={{ padding: 11 }}>{a.actual_beneficiaries ?? "—"} / {a.target_beneficiaries ?? "—"}</td><td style={{ padding: 11, textTransform: "capitalize" }}>{a.status.replaceAll("_"," ")}</td><td style={{ padding: 11 }}>{a.outcome || "—"}{a.status !== "completed" && a.status !== "cancelled" && <div style={{ marginTop: 6 }}><button style={secondary} onClick={() => void completeActivity(a)}>Mark completed</button></div>}</td></tr>)}</tbody></table></div></>}
    </section>
  </main>;
}
