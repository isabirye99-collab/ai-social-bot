"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CalendarClock, FileCheck2, Plus, RefreshCw, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Partner = { id: string; name: string };
type Mou = { id: string; partnership_id: string; agreement_title: string; agreement_type: string; agreement_reference: string | null; signed_date: string | null; effective_date: string | null; expiry_date: string | null; agreement_status: string; next_review_due: string | null; created_at: string };
type Review = { id: string; mou_id: string; review_due_date: string; review_status: string };
const supabase = createClient();
const labels: Record<string,string> = { draft:"Draft", pending_signature:"Pending signature", active:"Active", suspended:"Suspended", expired:"Expired", terminated:"Terminated", renewal_in_progress:"Renewal in progress" };
const statusStyle: Record<string,string> = { active:"bg-emerald-50 text-emerald-800", pending_signature:"bg-amber-50 text-amber-800", suspended:"bg-orange-50 text-orange-800", expired:"bg-rose-50 text-rose-800", terminated:"bg-rose-50 text-rose-800", renewal_in_progress:"bg-sky-50 text-sky-800" };
function dateLabel(v:string|null) { if (!v) return "—"; const d = new Date(v + (v.length === 10 ? "T00:00:00" : "")); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-UG",{day:"2-digit",month:"short",year:"numeric"}); }
function daysUntil(v:string|null) { if (!v) return null; return Math.ceil((new Date(v+"T00:00:00").getTime()-new Date(new Date().toDateString()).getTime())/86400000); }

export default function PartnershipMousPage() {
  const [partners,setPartners] = useState<Partner[]>([]);
  const [mous,setMous] = useState<Mou[]>([]);
  const [reviews,setReviews] = useState<Review[]>([]);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [error,setError] = useState("");
  const [search,setSearch] = useState("");
  const [statusFilter,setStatusFilter] = useState("all");
  const [showForm,setShowForm] = useState(false);
  const [saving,setSaving] = useState(false);
  const [form,setForm] = useState({partnership_id:"",agreement_title:"",agreement_type:"academic",agreement_reference:"",signed_date:"",effective_date:"",expiry_date:"",agreement_status:"draft"});

  const load = useCallback(async () => {
    setRefreshing(true);
    const results = await Promise.all([
      supabase.from("partnerships").select("id,name").order("name"),
      supabase.from("partnership_mous").select("id,partnership_id,agreement_title,agreement_type,agreement_reference,signed_date,effective_date,expiry_date,agreement_status,next_review_due,created_at").order("created_at",{ascending:false}),
      supabase.from("partnership_mou_reviews").select("id,mou_id,review_due_date,review_status").in("review_status",["scheduled","in_progress","overdue"])
    ]);
    const issue = results[0].error || results[1].error || results[2].error;
    if (issue) setError(issue.message.includes("partnership_mou") ? "The MOU database migrations may not yet be applied. Apply the Partnerships migrations, then refresh." : issue.message);
    else { setError(""); setPartners((results[0].data||[]) as Partner[]); setMous((results[1].data||[]) as Mou[]); setReviews((results[2].data||[]) as Review[]); }
    setLoading(false); setRefreshing(false);
  },[]);
  useEffect(()=>{ void load(); },[load]);

  const names = useMemo(()=>new Map(partners.map(p=>[p.id,p.name])),[partners]);
  const filtered = useMemo(()=>mous.filter(m=>{
    const term=search.trim().toLowerCase();
    const matched=!term || [names.get(m.partnership_id)||"",m.agreement_title,m.agreement_reference||"",m.agreement_type,m.agreement_status].some(v=>v.toLowerCase().includes(term));
    return matched && (statusFilter==="all" || m.agreement_status===statusFilter);
  }),[mous,names,search,statusFilter]);
  const active = mous.filter(m=>m.agreement_status==="active").length;
  const expiring = mous.filter(m=>{const d=daysUntil(m.expiry_date);return m.agreement_status==="active"&&d!==null&&d>=0&&d<=90;}).length;
  const overdue = reviews.filter(r=>r.review_status==="overdue" || new Date(r.review_due_date+"T23:59:59")<new Date()).length;

  async function saveMou(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(!form.partnership_id || !form.agreement_title.trim()){setError("Choose a partner and enter an agreement title.");return;}
    if(form.effective_date && form.expiry_date && form.expiry_date<form.effective_date){setError("Expiry date cannot be earlier than the effective date.");return;}
    setSaving(true);setError("");
    try {
      const auth=await supabase.auth.getUser(); if(auth.error) throw auth.error;
      const {error:insertError}=await supabase.from("partnership_mous").insert({
        partnership_id:form.partnership_id,agreement_title:form.agreement_title.trim(),agreement_type:form.agreement_type,
        agreement_reference:form.agreement_reference.trim()||null,signed_date:form.signed_date||null,
        effective_date:form.effective_date||null,expiry_date:form.expiry_date||null,
        agreement_status:form.agreement_status,created_by:auth.data.user?.id||null
      });
      if(insertError) throw insertError;
      setShowForm(false);setForm({partnership_id:"",agreement_title:"",agreement_type:"academic",agreement_reference:"",signed_date:"",effective_date:"",expiry_date:"",agreement_status:"draft"});
      await load();
    } catch(err) {setError(err instanceof Error?err.message:"Unable to save the MOU.");}
    finally {setSaving(false);}
  }

  return <main className="min-h-screen bg-white px-4 py-6 text-slate-900 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3"><div className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><FileCheck2 size={22}/></div><div><a href="/partnerships" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"><ArrowLeft size={13}/> Partnerships</a><h1 className="text-2xl font-semibold tracking-tight">MOU Register</h1><p className="mt-1 text-sm text-slate-500">Track agreements, expiry dates and quarterly reviews.</p></div></div>
      <div className="flex flex-wrap gap-2"><a href="/partnerships/mous/commitments" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">Commitments</a><a href="/partnerships/mous/scholarships" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">Scholarships</a><a href="/partnerships/mous/reviews" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">Quarterly Reviews</a><button type="button" onClick={()=>{setError("");setShowForm(true);}} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#00695c] px-4 text-sm font-semibold text-white hover:bg-[#00574f]"><Plus size={16}/> Add MOU</button><button type="button" onClick={()=>void load()} aria-label="Refresh MOU register" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"><RefreshCw size={16} className={refreshing?"animate-spin":""}/></button></div>
    </header>
    {error&&<div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle size={18} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:"Total MOUs",value:mous.length,detail:"All agreement records"},{label:"Active MOUs",value:active,detail:"Currently in force"},{label:"Expiring in 90 days",value:expiring,detail:"Review renewal plans"},{label:"Reviews due / overdue",value:overdue,detail:"Scheduled follow-up"}].map(x=><div key={x.label} className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-medium text-slate-500">{x.label}</p><p className="mt-2 text-2xl font-semibold">{loading?"—":x.value.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">{x.detail}</p></div>)}</section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Agreement register</h2><p className="mt-1 text-sm text-slate-500">{filtered.length.toLocaleString()} agreement(s)</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search partner or MOU..." className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 sm:w-64"/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="all">All statuses</option>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div></div>
      {loading?<div className="p-12 text-center text-sm text-slate-500">Loading MOU register…</div>:filtered.length===0?<div className="p-12 text-center"><CalendarClock className="mx-auto text-slate-400" size={28}/><h3 className="mt-3 font-semibold">No MOUs found</h3><p className="mt-1 text-sm text-slate-500">Add an agreement to begin tracking its lifecycle.</p></div>:<div className="overflow-x-auto"><table className="w-full min-w-[1000px] border-collapse text-left"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3.5">Partner / agreement</th><th className="px-5 py-3.5">Type</th><th className="px-5 py-3.5">Signed</th><th className="px-5 py-3.5">Effective</th><th className="px-5 py-3.5">Expiry</th><th className="px-5 py-3.5">Next review</th><th className="px-5 py-3.5">Status</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{filtered.map(m=>{const d=daysUntil(m.expiry_date);const review=reviews.filter(r=>r.mou_id===m.id).sort((a,b)=>a.review_due_date.localeCompare(b.review_due_date))[0];return <tr key={m.id} className="hover:bg-emerald-50/50"><td className="px-5 py-4"><div className="font-medium">{names.get(m.partnership_id)||"Unknown partner"}</div><div className="mt-1 text-slate-600">{m.agreement_title}</div>{m.agreement_reference&&<div className="mt-1 text-xs text-slate-400">Ref: {m.agreement_reference}</div>}</td><td className="px-5 py-4 capitalize text-slate-700">{m.agreement_type}</td><td className="px-5 py-4 text-slate-600">{dateLabel(m.signed_date)}</td><td className="px-5 py-4 text-slate-600">{dateLabel(m.effective_date)}</td><td className="px-5 py-4"><div>{dateLabel(m.expiry_date)}</div>{d!==null&&d>=0&&d<=90&&m.agreement_status==="active"&&<div className="mt-1 text-xs font-medium text-amber-700">{d===0?"Expires today":String(d)+" days left"}</div>}{d!==null&&d<0&&<div className="mt-1 text-xs font-medium text-rose-700">Expiry passed</div>}</td><td className="px-5 py-4"><div>{dateLabel(m.next_review_due)}</div>{review&&<div className="mt-1 text-xs text-slate-500">{review.review_status.replaceAll("_"," ")}</div>}</td><td className="px-5 py-4"><span className={"inline-flex rounded-full px-2.5 py-1 text-xs font-medium "+(statusStyle[m.agreement_status]||"bg-slate-100 text-slate-700")}>{labels[m.agreement_status]||m.agreement_status}</span></td></tr>;})}</tbody></table></div>}
    </section>
    <p className="text-xs leading-5 text-slate-500">Active MOUs receive an automatically scheduled quarterly review. Review completion and detailed scorecards are the next implementation stage.</p>
  </div>
  {showForm&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setShowForm(false);}}><section role="dialog" aria-modal="true" aria-labelledby="add-mou-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 id="add-mou-title" className="font-semibold">Add memorandum of understanding</h2><p className="mt-1 text-xs text-slate-500">Record the agreement and key lifecycle dates.</p></div><button type="button" disabled={saving} onClick={()=>setShowForm(false)} aria-label="Close form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></header>
  <form onSubmit={saveMou} className="space-y-4 p-5"><label className="block text-sm font-medium text-slate-700">Partner organization<select required value={form.partnership_id} onChange={e=>setForm({...form,partnership_id:e.target.value})} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="">Select a partner</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  <label className="block text-sm font-medium text-slate-700">Agreement title<input required value={form.agreement_title} onChange={e=>setForm({...form,agreement_title:e.target.value})} placeholder="e.g. Student Recruitment and Scholarship MOU" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3"/></label>
  <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Agreement type<select value={form.agreement_type} onChange={e=>setForm({...form,agreement_type:e.target.value})} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="academic">Academic</option><option value="marketing">Marketing</option><option value="other">Other</option></select></label><label className="block text-sm font-medium text-slate-700">Reference number<input value={form.agreement_reference} onChange={e=>setForm({...form,agreement_reference:e.target.value})} placeholder="Optional" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3"/></label></div>
  <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Date signed<input type="date" value={form.signed_date} onChange={e=>setForm({...form,signed_date:e.target.value})} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3"/></label><label className="block text-sm font-medium text-slate-700">Effective date<input type="date" value={form.effective_date} onChange={e=>setForm({...form,effective_date:e.target.value})} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3"/></label></div>
  <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Expiry date<input type="date" min={form.effective_date||undefined} value={form.expiry_date} onChange={e=>setForm({...form,expiry_date:e.target.value})} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3"/></label><label className="block text-sm font-medium text-slate-700">Agreement status<select value={form.agreement_status} onChange={e=>setForm({...form,agreement_status:e.target.value})} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="draft">Draft</option><option value="pending_signature">Pending signature</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="renewal_in_progress">Renewal in progress</option><option value="expired">Expired</option><option value="terminated">Terminated</option></select></label></div>
  {form.agreement_status==="active"&&<p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">A quarterly review will be scheduled automatically for this active MOU.</p>}
  <footer className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" disabled={saving} onClick={()=>setShowForm(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" disabled={saving||partners.length===0} className="rounded-lg bg-[#00695c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#00574f] disabled:opacity-50">{saving?"Saving…":"Save MOU"}</button></footer></form></section></div>}
  </main>;
}
