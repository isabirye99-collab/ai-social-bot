"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, CalendarClock, ClockAlert, RefreshCw, ShieldAlert, Target, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Partner = { id: string; name: string };
type Mou = { id: string; partnership_id: string; agreement_title: string; agreement_type: string; agreement_status: string; expiry_date: string | null; next_review_due: string | null };
type Commitment = { id: string; mou_id: string; commitment_title: string; target_value: number | null; achieved_value: number; unit: string | null; due_date: string | null; status: string };
type Review = { id: string; mou_id: string; review_due_date: string; review_status: string };
type Allocation = { id: string; mou_id: string; allocation_name: string; number_of_awards: number; allocation_status: string };
type Recipient = { id: string; allocation_id: string; recipient_status: string; award_value: number | null };
const supabase = createClient();

function dateLabel(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value + "T00:00:00");
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleDateString("en-UG", { day: "2-digit", month: "short", year: "numeric" });
}
function isOverdue(value: string | null) {
  return Boolean(value && new Date(value + "T23:59:59").getTime() < Date.now());
}
function number(value: number) { return new Intl.NumberFormat("en-UG", { maximumFractionDigits: 1 }).format(value); }

export default function MouPerformancePage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [mous, setMous] = useState<Mou[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const load = useCallback(async () => {
    setRefreshing(true);
    const results = await Promise.all([
      supabase.from("partnerships").select("id,name").order("name"),
      supabase.from("partnership_mous").select("id,partnership_id,agreement_title,agreement_type,agreement_status,expiry_date,next_review_due"),
      supabase.from("partnership_mou_commitments").select("id,mou_id,commitment_title,target_value,achieved_value,unit,due_date,status"),
      supabase.from("partnership_mou_reviews").select("id,mou_id,review_due_date,review_status").in("review_status", ["scheduled", "in_progress", "overdue"]),
      supabase.from("partnership_scholarship_allocations").select("id,mou_id,allocation_name,number_of_awards,allocation_status"),
      supabase.from("partnership_scholarship_recipients").select("id,allocation_id,recipient_status,award_value"),
    ]);
    const issue = results.find(result => result.error)?.error;
    if (issue) {
      setError(issue.message.includes("partnership_mou") || issue.message.includes("partnership_scholarship")
        ? "Partnership performance data is not available yet. Confirm the MOU and scholarship migrations are applied in Supabase."
        : issue.message);
    } else {
      setError("");
      setPartners((results[0].data || []) as Partner[]);
      setMous((results[1].data || []) as Mou[]);
      setCommitments((results[2].data || []) as Commitment[]);
      setReviews((results[3].data || []) as Review[]);
      setAllocations((results[4].data || []) as Allocation[]);
      setRecipients((results[5].data || []) as Recipient[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const partnerNames = useMemo(() => new Map(partners.map(partner => [partner.id, partner.name])), [partners]);
  const mouById = useMemo(() => new Map(mous.map(mou => [mou.id, mou])), [mous]);
  const activeMous = mous.filter(mou => mou.agreement_status === "active");
  const dueReviews = reviews.filter(review => review.review_status !== "completed" && isOverdue(review.review_due_date));
  const overdueCommitments = commitments.filter(item => item.status !== "completed" && item.status !== "cancelled" && isOverdue(item.due_date));
  const expiringMous = activeMous.filter(mou => {
    if (!mou.expiry_date) return false;
    const days = Math.ceil((new Date(mou.expiry_date + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
    return days >= 0 && days <= 90;
  });
  const targetCommitments = commitments.filter(item => item.target_value !== null && Number(item.target_value) > 0);
  // Commitment units can differ, so never add unlike targets together.
  const metTargetCount = targetCommitments.filter(item => Number(item.achieved_value || 0) >= Number(item.target_value || 0)).length;
  const targetProgress = targetCommitments.length > 0 ? Math.round((metTargetCount / targetCommitments.length) * 100) : null;
  const approvedAwards = allocations.filter(item => ["approved", "open", "fully_allocated"].includes(item.allocation_status)).reduce((sum, item) => sum + Number(item.number_of_awards || 0), 0);
  const enrolledRecipients = recipients.filter(item => item.recipient_status === "enrolled" || item.recipient_status === "completed").length;

  const rows = useMemo(() => partners.map(partner => {
    const partnerMous = mous.filter(mou => mou.partnership_id === partner.id);
    const ids = new Set(partnerMous.map(mou => mou.id));
    const partnerCommitments = commitments.filter(item => ids.has(item.mou_id));
    const partnerTargets = partnerCommitments.filter(item => item.target_value !== null && Number(item.target_value) > 0);
    const metTargets = partnerTargets.filter(item => Number(item.achieved_value || 0) >= Number(item.target_value || 0)).length;
    const partnerAllocations = allocations.filter(item => ids.has(item.mou_id));
    const allocationIds = new Set(partnerAllocations.map(item => item.id));
    const partnerRecipients = recipients.filter(item => allocationIds.has(item.allocation_id));
    const partnerReviews = reviews.filter(item => ids.has(item.mou_id));
    const overdue = partnerReviews.filter(item => item.review_status !== "completed" && isOverdue(item.review_due_date)).length;
    const expiring = partnerMous.filter(mou => {
      if (mou.agreement_status !== "active" || !mou.expiry_date) return false;
      const days = Math.ceil((new Date(mou.expiry_date + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
      return days >= 0 && days <= 90;
    }).length;
    return { partner, partnerMous, partnerCommitments, targetCount: partnerTargets.length, metTargets, progress: partnerTargets.length > 0 ? Math.round(metTargets / partnerTargets.length * 100) : null, partnerAllocations, partnerRecipients, overdue, expiring };
  }).filter(row => {
    const term = search.trim().toLowerCase();
    const matched = !term || row.partner.name.toLowerCase().includes(term) || row.partnerMous.some(mou => mou.agreement_title.toLowerCase().includes(term));
    return matched && (typeFilter === "all" || row.partnerMous.some(mou => mou.agreement_type === typeFilter));
  }).sort((a, b) => a.partner.name.localeCompare(b.partner.name)), [partners, mous, commitments, reviews, allocations, recipients, search, typeFilter]);

  return <main className="min-h-screen bg-white px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3"><div className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><BarChart3 size={22}/></div><div><a href="/partnerships/mous" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"><ArrowLeft size={13}/> MOU Register</a><h1 className="text-2xl font-semibold tracking-tight">Partnership Performance</h1><p className="mt-1 text-sm text-slate-500">Monitor commitments, reviews, agreement renewals and scholarship outcomes.</p></div></div>
        <div className="flex flex-wrap gap-2"><a href="/partnerships/mous/commitments" className="inline-flex min-h-10 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">Commitments</a><a href="/partnerships/mous/scholarships" className="inline-flex min-h-10 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">Scholarships</a><a href="/partnerships/mous/reviews" className="inline-flex min-h-10 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">Quarterly Reviews</a><button type="button" onClick={() => void load()} aria-label="Refresh partnership performance" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""}/></button></div>
      </header>
      {error && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[{label:"Active MOUs",value:activeMous.length,detail:"Agreements currently in force",icon:<Users size={18}/>},{label:"Targets met",value:targetProgress === null ? "No targets" : targetProgress + "%",detail:targetProgress === null ? "Set targets on MOU commitments" : metTargetCount + " of " + targetCommitments.length + " commitments meeting target",icon:<Target size={18}/>} ,{label:"Reviews overdue",value:dueReviews.length,detail:"Require follow-up",icon:<ShieldAlert size={18}/>},{label:"Commitments overdue",value:overdueCommitments.length,detail:"Outstanding deliverables past due",icon:<ClockAlert size={18}/>},{label:"MOUs expiring in 90 days",value:expiringMous.length,detail:"Plan renewals early",icon:<CalendarClock size={18}/>}].map(card => <div key={card.label} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between text-sm font-medium text-slate-500"><span>{card.label}</span><span className="text-emerald-800">{card.icon}</span></div><p className="mt-3 text-2xl font-semibold">{loading ? "—" : card.value}</p><p className="mt-1 text-xs text-slate-500">{card.detail}</p></div>)}
      </section>
      <section className="rounded-xl border border-slate-200">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Partner scorecard</h2><p className="mt-1 text-sm text-slate-500">Performance is based on the targets and activities entered against each MOU.</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search partner or agreement" className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 sm:w-64"/><select value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="all">All MOU types</option><option value="academic">Academic</option><option value="marketing">Marketing</option><option value="other">Other</option></select></div></div>
        {loading ? <div className="p-12 text-center text-sm text-slate-500">Loading performance data…</div> : rows.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">No partner records match your filters.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Partner</th><th className="px-4 py-3">MOUs</th><th className="px-4 py-3">Commitments</th><th className="px-4 py-3">Target progress</th><th className="px-4 py-3">Scholarships</th><th className="px-4 py-3">Recipients enrolled/completed</th><th className="px-4 py-3">Reviews overdue</th><th className="px-4 py-3">Expiring</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{rows.map(row => <tr key={row.partner.id} className="hover:bg-emerald-50/40"><td className="px-4 py-4"><div className="font-semibold">{row.partner.name}</div><div className="mt-1 text-xs text-slate-500">{row.partnerMous.length} agreement(s)</div>{row.partnerMous.slice(0, 2).map(mou => <div key={mou.id} className="mt-1 max-w-xs truncate text-xs text-slate-500" title={mou.agreement_title}>{mou.agreement_title}</div>)}</td><td className="px-4 py-4"><span className="font-medium">{row.partnerMous.length}</span><div className="mt-1 text-xs text-slate-500">{row.partnerMous.filter(mou => mou.agreement_status === "active").length} active</div></td><td className="px-4 py-4"><div className="font-medium">{row.partnerCommitments.length}</div><div className="mt-1 text-xs text-slate-500">{row.partnerCommitments.filter(item => item.status === "completed").length} completed</div></td><td className="px-4 py-4">{row.progress === null ? <span className="text-xs text-slate-500">No targets set</span> : <><div className="flex items-center justify-between gap-3"><span className="font-medium">{row.progress}%</span><span className="text-xs text-slate-500">{row.metTargets} / {row.targetCount} targets met</span></div><div className="mt-2 h-2 w-40 overflow-hidden rounded-full bg-slate-100"><div className={"h-full rounded-full " + (row.progress >= 100 ? "bg-emerald-600" : row.progress >= 60 ? "bg-lime-500" : "bg-amber-500")} style={{width: Math.min(100, row.progress) + "%"}}/></div></>}</td><td className="px-4 py-4"><div className="font-medium">{row.partnerAllocations.reduce((sum, item) => sum + Number(item.number_of_awards || 0), 0)} planned awards</div><div className="mt-1 text-xs text-slate-500">{row.partnerRecipients.length} recipients recorded</div></td><td className="px-4 py-4">{row.partnerRecipients.filter(item => item.recipient_status === "enrolled" || item.recipient_status === "completed").length}</td><td className="px-4 py-4"><span className={row.overdue ? "font-semibold text-rose-700" : "text-slate-600"}>{row.overdue}</span></td><td className="px-4 py-4"><span className={row.expiring ? "font-semibold text-amber-700" : "text-slate-600"}>{row.expiring}</span></td></tr>)}</tbody></table></div>}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4"><h2 className="font-semibold">Upcoming expiry dates</h2><p className="mt-1 text-sm text-slate-500">Active agreements expiring within the next 90 days.</p>{expiringMous.length ? <div className="mt-3 divide-y divide-slate-100">{expiringMous.slice().sort((a,b)=>(a.expiry_date||"").localeCompare(b.expiry_date||"")).map(mou => <div key={mou.id} className="flex items-start justify-between gap-3 py-3"><div><div className="font-medium">{mou.agreement_title}</div><div className="mt-1 text-xs text-slate-500">{partnerNames.get(mou.partnership_id) || "Unknown partner"}</div></div><div className="shrink-0 text-right text-sm"><div>{dateLabel(mou.expiry_date)}</div><div className="mt-1 text-xs font-medium text-amber-700">Renewal planning</div></div></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No active MOUs are due to expire in the next 90 days.</p>}</div>
        <div className="rounded-xl border border-slate-200 p-4"><h2 className="font-semibold">Reviews requiring attention</h2><p className="mt-1 text-sm text-slate-500">Overdue scheduled reviews and their agreements.</p>{dueReviews.length ? <div className="mt-3 divide-y divide-slate-100">{dueReviews.slice().sort((a,b)=>a.review_due_date.localeCompare(b.review_due_date)).slice(0,8).map(review => {const mou=mouById.get(review.mou_id);return <div key={review.id} className="flex items-start justify-between gap-3 py-3"><div><div className="font-medium">{mou?.agreement_title || "MOU review"}</div><div className="mt-1 text-xs text-slate-500">{partnerNames.get(mou?.partnership_id || "") || "Unknown partner"}</div></div><div className="shrink-0 text-right text-sm"><div>{dateLabel(review.review_due_date)}</div><div className="mt-1 text-xs font-medium text-rose-700">Overdue</div></div></div>})}</div> : <p className="mt-4 text-sm text-slate-500">No overdue reviews are currently recorded.</p>}</div>
      </section>
      <p className="text-xs leading-5 text-slate-500">This dashboard summarizes recorded CRM data. Recruitment outcomes and scholarship utilisation are only as complete as the commitments and recipient records entered by staff.</p>
    </div>
  </main>;
}
