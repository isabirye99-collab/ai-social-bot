"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, FileCheck2, Handshake, RefreshCw, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Partner = { id: string; name: string };
type Mou = { id: string; partnership_id: string; agreement_title: string; agreement_reference: string | null; agreement_status: string; expiry_date: string | null; next_review_due: string | null };
type Review = { id: string; mou_id: string; review_due_date: string; review_status: string; review_period_start: string; review_period_end: string };
type Commitment = { id: string; mou_id: string; commitment_title: string; due_date: string | null; status: string; responsible_party: string; achieved_value: number; target_value: number | null };

const supabase = createClient();
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Kampala" });
function dateLabel(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value + "T00:00:00");
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleDateString("en-UG", { day: "2-digit", month: "short", year: "numeric" });
}
function daysUntil(value: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value + "T00:00:00").getTime() - new Date(today() + "T00:00:00").getTime()) / 86400000);
}
function statusLabel(value: string) { return value.replaceAll("_", " ").split(" ").map((word) => word ? word[0].toUpperCase() + word.slice(1) : "").join(" "); }

export default function PartnershipWorkPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [mous, setMous] = useState<Mou[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    const results = await Promise.all([
      supabase.from("partnerships").select("id,name").order("name"),
      supabase.from("partnership_mous").select("id,partnership_id,agreement_title,agreement_reference,agreement_status,expiry_date,next_review_due").order("expiry_date"),
      supabase.from("partnership_mou_reviews").select("id,mou_id,review_due_date,review_status,review_period_start,review_period_end").in("review_status", ["scheduled", "in_progress", "overdue"]),
      supabase.from("partnership_mou_commitments").select("id,mou_id,commitment_title,due_date,status,responsible_party,achieved_value,target_value").not("status", "in", "(completed,cancelled)").order("due_date"),
    ]);
    const issue = results.find((item) => item.error)?.error;
    if (issue) {
      setError("Some MOU work items could not be loaded. Check access to the MOU, review and commitment registers, then refresh.");
    } else {
      setError("");
      setPartners((results[0].data || []) as Partner[]);
      setMous((results[1].data || []) as Mou[]);
      setReviews((results[2].data || []) as Review[]);
      setCommitments((results[3].data || []) as Commitment[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const partnerNames = useMemo(() => new Map(partners.map((partner) => [partner.id, partner.name])), [partners]);
  const mouNames = useMemo(() => new Map(mous.map((mou) => [mou.id, { partner: partnerNames.get(mou.partnership_id) || "Partner not found", title: mou.agreement_title }])), [mous, partnerNames]);
  const activeMous = mous.filter((mou) => mou.agreement_status === "active");
  const expiring = activeMous.filter((mou) => { const days = daysUntil(mou.expiry_date); return days !== null && days >= 0 && days <= 90; });
  const expired = mous.filter((mou) => mou.expiry_date && daysUntil(mou.expiry_date)! < 0 && !["expired", "terminated"].includes(mou.agreement_status));
  const dueReviews = reviews.filter((review) => review.review_status !== "completed" && review.review_status !== "cancelled" && (review.review_due_date <= today() || review.review_status === "overdue"));
  const dueCommitments = commitments.filter((item) => ["at_risk", "not_met"].includes(item.status) || (item.due_date && item.due_date <= today()));
  const needsAttention = dueReviews.length + dueCommitments.length + expiring.length + expired.length;

  return <main className="min-h-screen bg-white px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3"><div className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><ClipboardList size={22}/></div><div><a href="/partnerships" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"><ArrowLeft size={13}/> Partnerships</a><h1 className="text-2xl font-semibold tracking-tight">MOU Daily Work Centre</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Start with the agreement: monitor expiry, complete mandatory quarterly reviews, follow up on commitments and keep a clear renewal pipeline.</p></div></div>
        <div className="flex flex-wrap gap-2"><a href="/partnerships/mous" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#00695c] px-4 text-sm font-semibold text-white hover:bg-[#00574f]"><FileCheck2 size={16}/> Open MOU Register</a><button type="button" onClick={() => void load()} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50" aria-label="Refresh MOU work centre"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""}/></button></div>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle size={18} className="mt-0.5 shrink-0"/><span>{error}</span></div>}

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-emerald-800">Today's priorities · {today()}</p><h2 className="mt-1 text-xl font-semibold text-slate-900">{loading ? "Checking agreement obligations…" : needsAttention ? needsAttention + " item(s) need attention" : "No overdue items identified"}</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Use these queues to decide what to follow up today. Items are calculated from the saved MOU, review and commitment records.</p></div><a href="/partnerships/mous/reviews" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-white px-4 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"><CalendarClock size={16}/> Review due items</a></div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active MOUs", value: activeMous.length, detail: "Agreements currently in force", href: "/partnerships/mous", icon: FileCheck2 },
          { label: "Expiring within 90 days", value: expiring.length, detail: "Start renewal conversations", href: "/partnerships/mous", icon: CalendarClock },
          { label: "Reviews due / overdue", value: dueReviews.length, detail: "Quarterly reviews are mandatory", href: "/partnerships/mous/reviews", icon: ClipboardList },
          { label: "Commitments to follow up", value: dueCommitments.length, detail: "Due, at risk or not met", href: "/partnerships/mous/commitments", icon: ShieldAlert },
        ].map((item) => <a key={item.label} href={item.href} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-slate-500">{item.label}</span><item.icon size={18} className="text-emerald-800"/></div><div className="mt-2 text-2xl font-semibold tracking-tight">{loading ? "—" : item.value.toLocaleString()}</div><p className="mt-1 text-xs text-slate-500">{item.detail}</p></a>)}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h2 className="font-semibold">Quarterly reviews to complete</h2><p className="mt-1 text-xs text-slate-500">Scheduled reviews due today or earlier</p></div><a href="/partnerships/mous/reviews" className="text-sm font-semibold text-emerald-800 hover:underline">Open reviews →</a></div>
          {loading ? <p className="p-5 text-sm text-slate-500">Loading reviews…</p> : dueReviews.length === 0 ? <div className="p-6 text-center"><CheckCircle2 className="mx-auto text-emerald-700" size={24}/><p className="mt-2 text-sm font-medium">No reviews currently due</p><p className="mt-1 text-xs text-slate-500">Keep upcoming quarterly review dates on the calendar.</p></div> : <div className="divide-y divide-slate-100">{dueReviews.slice(0, 8).map((review) => { const info = mouNames.get(review.mou_id); return <div key={review.id} className="flex items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{info?.partner || "Partner"} · {info?.title || "MOU"}</p><p className="mt-1 text-xs text-slate-500">Review period {dateLabel(review.review_period_start)} – {dateLabel(review.review_period_end)}</p><p className="mt-1 text-xs font-medium text-rose-700">Due {dateLabel(review.review_due_date)} · {statusLabel(review.review_status)}</p></div><a href="/partnerships/mous/reviews" className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Review</a></div>; })}</div>}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h2 className="font-semibold">Commitments needing follow-up</h2><p className="mt-1 text-xs text-slate-500">Overdue, at-risk or not met</p></div><a href="/partnerships/mous/commitments" className="text-sm font-semibold text-emerald-800 hover:underline">Open commitments →</a></div>
          {loading ? <p className="p-5 text-sm text-slate-500">Loading commitments…</p> : dueCommitments.length === 0 ? <div className="p-6 text-center"><CheckCircle2 className="mx-auto text-emerald-700" size={24}/><p className="mt-2 text-sm font-medium">No commitment follow-ups identified</p><p className="mt-1 text-xs text-slate-500">Update progress when work is completed.</p></div> : <div className="divide-y divide-slate-100">{dueCommitments.slice(0, 8).map((item) => { const info = mouNames.get(item.mou_id); const overdue = item.due_date && item.due_date < today() && item.status !== "completed"; return <div key={item.id} className="flex items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.commitment_title}</p><p className="mt-1 truncate text-xs text-slate-500">{info?.partner || "Partner"} · {info?.title || "MOU"}</p><p className={"mt-1 text-xs font-medium " + (overdue || ["at_risk", "not_met"].includes(item.status) ? "text-rose-700" : "text-slate-500")}>{item.due_date ? "Due " + dateLabel(item.due_date) : "No due date"} · {statusLabel(item.status)} · {statusLabel(item.responsible_party)} responsible</p></div><a href="/partnerships/mous/commitments" className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Update</a></div>; })}</div>}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h2 className="font-semibold">Renewal and expiry watch</h2><p className="mt-1 text-xs text-slate-500">Active MOUs expiring within 90 days or past expiry</p></div><a href="/partnerships/mous" className="text-sm font-semibold text-emerald-800 hover:underline">Open register →</a></div>
          {loading ? <p className="p-5 text-sm text-slate-500">Checking expiry dates…</p> : expiring.length + expired.length === 0 ? <div className="p-6 text-center"><CheckCircle2 className="mx-auto text-emerald-700" size={24}/><p className="mt-2 text-sm font-medium">No expiry alerts identified</p></div> : <div className="divide-y divide-slate-100">{[...expired, ...expiring].slice(0, 8).map((mou) => { const days = daysUntil(mou.expiry_date); return <div key={mou.id} className="flex items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{partnerNames.get(mou.partnership_id) || "Partner"} · {mou.agreement_title}</p><p className="mt-1 text-xs text-slate-500">{mou.agreement_reference ? "Ref " + mou.agreement_reference + " · " : ""}{statusLabel(mou.agreement_status)}</p><p className={"mt-1 text-xs font-medium " + (days !== null && days < 0 ? "text-rose-700" : "text-amber-700")}>{days !== null && days < 0 ? "Expired " + Math.abs(days) + " day(s) ago" : "Expires " + dateLabel(mou.expiry_date) + (days === 0 ? " (today)" : " · " + days + " days")}</p></div><a href="/partnerships/mous" className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Open MOU</a></div>; })}</div>}
        </div>

        <div className="rounded-xl border border-slate-200 p-5">
          <div className="flex items-start gap-3"><div className="rounded-lg bg-emerald-50 p-2 text-emerald-800"><Handshake size={20}/></div><div><h2 className="font-semibold">Partnership work shortcuts</h2><p className="mt-1 text-sm text-slate-500">Keep MOU management at the centre of daily operations.</p></div></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a href="/partnerships/mous" className="rounded-lg border border-slate-200 p-3 hover:border-emerald-300"><p className="text-sm font-semibold">MOU Register</p><p className="mt-1 text-xs text-slate-500">Create agreements and update dates/status.</p></a>
            <a href="/partnerships/mous/reviews" className="rounded-lg border border-slate-200 p-3 hover:border-emerald-300"><p className="text-sm font-semibold">Quarterly Reviews</p><p className="mt-1 text-xs text-slate-500">Complete the mandatory performance review.</p></a>
            <a href="/partnerships/mous/commitments" className="rounded-lg border border-slate-200 p-3 hover:border-emerald-300"><p className="text-sm font-semibold">Commitments</p><p className="mt-1 text-xs text-slate-500">Track delivery, ownership and evidence.</p></a>
            <a href="/partnerships/mous/performance" className="rounded-lg border border-slate-200 p-3 hover:border-emerald-300"><p className="text-sm font-semibold">Performance & Outcomes</p><p className="mt-1 text-xs text-slate-500">Review partner impact and scholarship outcomes.</p></a>
          </div>
        </div>
      </section>
      <p className="text-xs leading-5 text-slate-500">This work centre reads existing records only. It does not change partnership, MOU, review or commitment data unless you open the relevant register and save an update.</p>
    </div>
  </main>;
}
