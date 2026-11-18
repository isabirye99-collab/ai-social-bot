"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, ClipboardCheck, RefreshCw, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
type Partner = { id: string; name: string };
type Mou = { id: string; partnership_id: string; agreement_title: string; agreement_type: string; agreement_status: string; next_review_due: string | null };
type Review = {
  id: string; mou_id: string; review_period_start: string; review_period_end: string;
  review_due_date: string; reviewed_on: string | null; reviewer_id: string | null; review_status: string;
  overall_score: number | null; commitments_score: number | null; engagement_score: number | null;
  outcomes_score: number | null; scholarship_score: number | null; findings: string | null;
  challenges: string | null; evidence_url: string | null; renewal_recommendation: string | null; next_actions: string | null;
};
type ScoreForm = { commitments_score: string; engagement_score: string; outcomes_score: string; scholarship_score: string; findings: string; challenges: string; evidence_url: string; renewal_recommendation: string; next_actions: string };
const emptyForm: ScoreForm = { commitments_score:"", engagement_score:"", outcomes_score:"", scholarship_score:"", findings:"", challenges:"", evidence_url:"", renewal_recommendation:"not_yet_decided", next_actions:"" };
function dateLabel(v: string | null) { if (!v) return "—"; const d = new Date(v + (v.length === 10 ? "T00:00:00" : "")); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-UG",{day:"2-digit",month:"short",year:"numeric"}); }
function isPast(v: string) { return new Date(v+"T23:59:59").getTime() < Date.now(); }
function scoreValue(v: string) { if (!v.trim()) return null; const n=Number(v); return Number.isFinite(n) ? n : null; }

export default function PartnershipReviewsPage() {
  const [partners,setPartners]=useState<Partner[]>([]);
  const [mous,setMous]=useState<Mou[]>([]);
  const [reviews,setReviews]=useState<Review[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");
  const [statusFilter,setStatusFilter]=useState("open");
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<Review|null>(null);
  const [form,setForm]=useState<ScoreForm>(emptyForm);
  const [saving,setSaving]=useState(false);

  const load=useCallback(async()=>{
    setRefreshing(true);
    const [p,m,r]=await Promise.all([
      supabase.from("partnerships").select("id,name").order("name"),
      supabase.from("partnership_mous").select("id,partnership_id,agreement_title,agreement_type,agreement_status,next_review_due"),
      supabase.from("partnership_mou_reviews").select("id,mou_id,review_period_start,review_period_end,review_due_date,reviewed_on,reviewer_id,review_status,overall_score,commitments_score,engagement_score,outcomes_score,scholarship_score,findings,challenges,evidence_url,renewal_recommendation,next_actions").order("review_due_date",{ascending:true})
    ]);
    const problem=p.error||m.error||r.error;
    if(problem) setError(problem.message.includes("partnership_mou")?"The MOU database migrations may not yet be applied. Apply the Partnerships migrations, then refresh.":problem.message);
    else {setError("");setPartners((p.data||[]) as Partner[]);setMous((m.data||[]) as Mou[]);setReviews((r.data||[]) as Review[]);}
    setLoading(false);setRefreshing(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const partnerNames=useMemo(()=>new Map(partners.map(p=>[p.id,p.name])),[partners]);
  const mouMap=useMemo(()=>new Map(mous.map(m=>[m.id,m])),[mous]);
  const visible=useMemo(()=>reviews.filter(r=>{
    const m=mouMap.get(r.mou_id);
    const haystack=[partnerNames.get(m?.partnership_id||"")||"",m?.agreement_title||"",m?.agreement_type||"",r.review_status].join(" ").toLowerCase();
    const matches=!search.trim()||haystack.includes(search.trim().toLowerCase());
    const open=r.review_status!=="completed"&&r.review_status!=="cancelled";
    return matches&&(statusFilter==="all"||(statusFilter==="open"&&open)||(statusFilter==="overdue"&&open&&isPast(r.review_due_date))||(statusFilter==="completed"&&r.review_status==="completed"));
  }),[reviews,mouMap,partnerNames,search,statusFilter]);

  function openReview(review:Review) {
    setSelected(review);
    setForm({
      commitments_score:review.commitments_score==null?"":String(review.commitments_score),
      engagement_score:review.engagement_score==null?"":String(review.engagement_score),
      outcomes_score:review.outcomes_score==null?"":String(review.outcomes_score),
      scholarship_score:review.scholarship_score==null?"":String(review.scholarship_score),
      findings:review.findings||"",challenges:review.challenges||"",evidence_url:review.evidence_url||"",
      renewal_recommendation:review.renewal_recommendation||"not_yet_decided",next_actions:review.next_actions||""
    });
    setError("");
  }

  async function saveReview(complete:boolean) {
    if(!selected) return;
    const scores=[form.commitments_score,form.engagement_score,form.outcomes_score,form.scholarship_score].filter(v=>v.trim());
    if(scores.some(v=>!Number.isFinite(Number(v))||Number(v)<0||Number(v)>100)){setError("Scores must be numbers between 0 and 100.");return;}
    setSaving(true);setError("");
    try {
      const scoreList=[scoreValue(form.commitments_score),scoreValue(form.engagement_score),scoreValue(form.outcomes_score),scoreValue(form.scholarship_score)].filter((v):v is number=>v!==null);
      const overall=scoreList.length?Math.round(scoreList.reduce((a,b)=>a+b,0)/scoreList.length*100)/100:null;
      const payload={
        review_status:complete?"completed":"in_progress",
        reviewed_on:complete?new Date().toISOString().slice(0,10):selected.reviewed_on,
        commitments_score:scoreValue(form.commitments_score),
        engagement_score:scoreValue(form.engagement_score),
        outcomes_score:scoreValue(form.outcomes_score),
        scholarship_score:scoreValue(form.scholarship_score),
        overall_score:overall,
        findings:form.findings.trim()||null,
        challenges:form.challenges.trim()||null,
        evidence_url:form.evidence_url.trim()||null,
        renewal_recommendation:form.renewal_recommendation||"not_yet_decided",
        next_actions:form.next_actions.trim()||null
      };
      const {error:saveError}=await supabase.from("partnership_mou_reviews").update(payload).eq("id",selected.id);
      if(saveError) throw saveError;
      setSelected(null);
      await load();
    } catch(e) {setError(e instanceof Error?e.message:"Unable to save this review.");}
    finally {setSaving(false);}
  }

  const activeOpen=reviews.filter(r=>r.review_status!=="completed"&&r.review_status!=="cancelled").length;
  const overdueCount=reviews.filter(r=>r.review_status!=="completed"&&r.review_status!=="cancelled"&&isPast(r.review_due_date)).length;
  const completedCount=reviews.filter(r=>r.review_status==="completed").length;

  return <main className="min-h-screen bg-white px-4 py-6 text-slate-900 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><div className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><ClipboardCheck size={22}/></div><div><a href="/partnerships/mous" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"><ArrowLeft size={13}/> MOU Register</a><h1 className="text-2xl font-semibold tracking-tight">Quarterly MOU Reviews</h1><p className="mt-1 text-sm text-slate-500">Record performance, evidence, scores and renewal recommendations.</p></div></div><button type="button" onClick={()=>void load()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={15} className={refreshing?"animate-spin":""}/> Refresh</button></header>
    {error&&<div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle size={18} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
    <section className="grid gap-3 sm:grid-cols-3">{[{label:"Open reviews",value:activeOpen},{label:"Overdue reviews",value:overdueCount},{label:"Completed reviews",value:completedCount}].map(x=><div key={x.label} className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-medium text-slate-500">{x.label}</p><p className="mt-2 text-2xl font-semibold">{loading?"—":x.value.toLocaleString()}</p></div>)}</section>
    <section className="overflow-hidden rounded-xl border border-slate-200"><div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Review schedule</h2><p className="mt-1 text-sm text-slate-500">{visible.length.toLocaleString()} review(s)</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search partner or agreement..." className="h-10 rounded-lg border border-slate-300 px-3 text-sm sm:w-64"/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="open">Open reviews</option><option value="overdue">Overdue</option><option value="completed">Completed</option><option value="all">All reviews</option></select></div></div>
    {loading?<div className="p-12 text-center text-sm text-slate-500">Loading review schedule…</div>:visible.length===0?<div className="p-12 text-center"><ClipboardCheck size={28} className="mx-auto text-slate-400"/><h3 className="mt-3 font-semibold">No reviews in this view</h3><p className="mt-1 text-sm text-slate-500">Scheduled quarterly reviews will appear here for active MOUs.</p></div>:<div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3.5">Partner / MOU</th><th className="px-5 py-3.5">Type</th><th className="px-5 py-3.5">Review period</th><th className="px-5 py-3.5">Due date</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5">Score</th><th className="px-5 py-3.5">Action</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{visible.map(r=>{const m=mouMap.get(r.mou_id);const late=r.review_status!=="completed"&&r.review_status!=="cancelled"&&isPast(r.review_due_date);return <tr key={r.id} className="hover:bg-emerald-50/50"><td className="px-5 py-4"><div className="font-medium">{partnerNames.get(m?.partnership_id||"")||"Unknown partner"}</div><div className="mt-1 text-slate-600">{m?.agreement_title||"Agreement"}</div></td><td className="px-5 py-4 capitalize">{m?.agreement_type||"—"}</td><td className="px-5 py-4 text-slate-600">{dateLabel(r.review_period_start)} – {dateLabel(r.review_period_end)}</td><td className="px-5 py-4"><span className={late?"font-semibold text-rose-700":"text-slate-700"}>{dateLabel(r.review_due_date)}</span>{late&&<div className="mt-1 text-xs text-rose-700">Overdue</div>}</td><td className="px-5 py-4"><span className={"inline-flex rounded-full px-2.5 py-1 text-xs font-medium "+(r.review_status==="completed"?"bg-emerald-50 text-emerald-800":late?"bg-rose-50 text-rose-800":"bg-amber-50 text-amber-800")}>{r.review_status.replaceAll("_"," ")}</span></td><td className="px-5 py-4">{r.overall_score==null?"—":String(r.overall_score)+"/100"}</td><td className="px-5 py-4"><button type="button" onClick={()=>openReview(r)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">{r.review_status==="completed"?"View review":"Review MOU"}</button></td></tr>;})}</tbody></table></div>}</section>
    <p className="text-xs leading-5 text-slate-500">Academic reviews focus on agreed academic deliverables and participation. Marketing reviews focus on recruitment, engagement and outcomes; scholarship scoring is included where relevant to the MOU.</p>
  </div>
  {selected&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setSelected(null);}}><section role="dialog" aria-modal="true" aria-labelledby="review-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 id="review-title" className="font-semibold">{mouMap.get(selected.mou_id)?.agreement_title||"Quarterly review"}</h2><p className="mt-1 text-xs text-slate-500">{partnerNames.get(mouMap.get(selected.mou_id)?.partnership_id||"")||"Partner"} · Due {dateLabel(selected.review_due_date)}</p></div><button type="button" disabled={saving} onClick={()=>setSelected(null)} aria-label="Close review" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></header>
    <div className="space-y-5 p-5"><div><h3 className="text-sm font-semibold text-slate-800">Performance scorecard</h3><p className="mt-1 text-xs text-slate-500">Score each applicable area from 0 to 100. Leave scholarship score blank when not applicable.</p></div>
    <div className="grid gap-4 sm:grid-cols-2">{[{key:"commitments_score",label:"Commitments delivered"},{key:"engagement_score",label:"Partner engagement"},{key:"outcomes_score",label:mouMap.get(selected.mou_id)?.agreement_type==="academic"?"Academic outcomes":"Recruitment outcomes"},{key:"scholarship_score",label:"Scholarship delivery (if applicable)"}].map(x=><label key={x.key} className="block text-sm font-medium text-slate-700">{x.label}<input type="number" min="0" max="100" step="1" value={form[x.key as keyof ScoreForm] as string} onChange={e=>setForm({...form,[x.key]:e.target.value})} placeholder="0–100" disabled={selected.review_status==="completed"} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 disabled:bg-slate-50"/></label>)}</div>
    <label className="block text-sm font-medium text-slate-700">Findings and progress<textarea rows={3} value={form.findings} onChange={e=>setForm({...form,findings:e.target.value})} disabled={selected.review_status==="completed"} placeholder="Record agreed deliverables, results and evidence reviewed…" className="mt-1.5 w-full rounded-lg border border-slate-300 p-3 text-sm disabled:bg-slate-50"/></label>
    <label className="block text-sm font-medium text-slate-700">Challenges / outstanding commitments<textarea rows={2} value={form.challenges} onChange={e=>setForm({...form,challenges:e.target.value})} disabled={selected.review_status==="completed"} className="mt-1.5 w-full rounded-lg border border-slate-300 p-3 text-sm disabled:bg-slate-50"/></label>
    <label className="block text-sm font-medium text-slate-700">Evidence URL<input type="url" value={form.evidence_url} onChange={e=>setForm({...form,evidence_url:e.target.value})} disabled={selected.review_status==="completed"} placeholder="https://…" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 disabled:bg-slate-50"/></label>
    <label className="block text-sm font-medium text-slate-700">Renewal recommendation<select value={form.renewal_recommendation} onChange={e=>setForm({...form,renewal_recommendation:e.target.value})} disabled={selected.review_status==="completed"} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 disabled:bg-slate-50"><option value="not_yet_decided">Not yet decided</option><option value="renew">Renew</option><option value="renew_with_changes">Renew with changes</option><option value="improve">Improve before renewal</option><option value="suspend">Suspend</option><option value="discontinue">Discontinue</option></select></label>
    <label className="block text-sm font-medium text-slate-700">Next actions<textarea rows={2} value={form.next_actions} onChange={e=>setForm({...form,next_actions:e.target.value})} disabled={selected.review_status==="completed"} placeholder="Action, owner and target date…" className="mt-1.5 w-full rounded-lg border border-slate-300 p-3 text-sm disabled:bg-slate-50"/></label>
    {selected.review_status==="completed"&&<p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">This review is completed and read-only.</p>}
    <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" disabled={saving} onClick={()=>setSelected(null)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Close</button>{selected.review_status!=="completed"&&<><button type="button" disabled={saving} onClick={()=>void saveReview(false)} className="rounded-lg border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">{saving?"Saving…":"Save progress"}</button><button type="button" disabled={saving} onClick={()=>void saveReview(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#00695c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#00574f]">{saving?"Saving…":<><CheckCircle2 size={16}/> Complete review</>}</button></>}</footer></div></section></div>}
  </main>;
}
