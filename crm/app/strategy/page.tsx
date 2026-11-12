"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Plan = {
  id: string;
  strategy_year: number;
  title: string;
  status: string;
  summary: string | null;
  updated_at: string;
};


const sections = [
  ["General Strategy", "Annual objectives, KPIs and accountable owners"],
  ["Intake Plans", "February, April, August and November targets"],
  ["Activities", "Delivery plans, owners, evidence and outcomes"],
  ["Budget Planning", "Annual budget, cycle allocations and commitments"],
  ["Performance & Outcomes", "Recruitment and objective progress"],
  ["Weekly Reports & Meetings", "Staff reports, minutes and assigned actions"],
  ["Risks & Corrective Actions", "Risk register, mitigations and deadlines"],
  ["Approvals Centre", "Pending decisions and approval history"],
  ["Management Reports", "Executive summaries and approved report history"],
];

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StrategyPlanningPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [objectiveCount, setObjectiveCount] = useState(0);
  const [activityCount, setActivityCount] = useState(0);
  const [intakeCount, setIntakeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const supabase = useMemo(() => createClient(), []);
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: planError } = await supabase
      .from("strategy_plans")
      .select("id,strategy_year,title,status,summary,updated_at")
      .order("strategy_year", { ascending: false });

    if (planError) {
      setError("Strategy data is not available yet. Confirm that the approved Strategy & Planning migration has been applied and your account has module access.");
      setPlans([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Plan[];
    setPlans(rows);
    if (rows.length) {
      const ids = rows.map((p) => p.id);
      const [objectives, activities, intakes] = await Promise.all([
        supabase.from("strategy_objectives").select("id", { count: "exact", head: true }).in("plan_id", ids),
        supabase.from("strategy_activities").select("id", { count: "exact", head: true }).in("plan_id", ids),
        supabase.from("strategy_intake_plans").select("id", { count: "exact", head: true }).in("plan_id", ids),
      ]);
      setObjectiveCount(objectives.count ?? 0);
      setActivityCount(activities.count ?? 0);
      setIntakeCount(intakes.count ?? 0);
    } else {
      setObjectiveCount(0);
      setActivityCount(0);
      setIntakeCount(0);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function createAnnualPlan() {
    setSaving(true);
    setError("");
    setNotice("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError("Please sign in again to create an annual strategy.");
      setSaving(false);
      return;
    }
    const { error: insertError } = await supabase.from("strategy_plans").insert({
      strategy_year: currentYear,
      title: `${currentYear} Annual Marketing Strategy`,
      status: "draft",
      prepared_by: auth.user.id,
    });
    if (insertError) {
      setError(insertError.code === "23505"
        ? `A strategy plan for ${currentYear} already exists.`
        : insertError.message);
      setSaving(false);
      return;
    }
    setNotice(`The ${currentYear} draft strategy has been created.`);
    await load();
    setSaving(false);
  }

  const currentPlan = plans.find((p) => p.strategy_year === currentYear);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">CIU CRM · Strategy & Planning</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Strategy Overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Plan annual objectives, coordinate recruitment cycles, track delivery and prepare management decisions.</p>
        </div>
        <button onClick={createAnnualPlan} disabled={saving || Boolean(currentPlan)} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Creating…" : currentPlan ? `${currentYear} plan exists` : `Create ${currentYear} strategy`}
        </button>
      </header>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Annual plans", String(plans.length), "Plans across all years"],
          ["Objectives", String(objectiveCount), "Linked to annual plans"],
          ["Activities", String(activityCount), "Delivery register records"],
          ["Intake targets", String(intakeCount), "Programme-level targets"],
        ].map(([label, value, caption]) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{loading ? "—" : value}</p>
            <p className="mt-1 text-xs text-slate-500">{caption}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.85fr)]">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Annual strategy register</h2>
              <p className="mt-0.5 text-xs text-slate-500">January–December planning years</p>
            </div>
            <button onClick={() => void load()} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Refresh</button>
          </div>
          {loading ? <p className="px-5 py-8 text-sm text-slate-500">Loading strategy records…</p> : plans.length === 0 ? (
            <div className="px-5 py-9 text-center">
              <p className="text-sm font-medium text-slate-800">No annual strategies yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Create the current-year draft to begin adding objectives and programme-level intake targets.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {plans.map((plan) => (
                <article key={plan.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <p className="font-semibold text-slate-900">{plan.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{plan.summary || "No summary added yet"}</p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${plan.status === "approved" ? "bg-emerald-100 text-emerald-800" : plan.status === "pending_approval" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{statusLabel(plan.status)}</span>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-900">Recruitment planning cycles</h2>
          <p className="mt-1 text-xs text-slate-500">Two budget cycles, four separately tracked intakes.</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">February cycle</p>
              <p className="mt-1 text-xs text-slate-600">February and April intakes</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">August cycle</p>
              <p className="mt-1 text-xs text-slate-600">August and November intakes</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Intake targets are stored separately by programme and intake month. Budget allocation remains grouped by the two main cycles.</p>
        </aside>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Planning workspaces</h2>
          <p className="mt-1 text-xs text-slate-500">The module will be delivered in stages. Additional registers will appear as their workflows are implemented.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map(([title, description], index) => (
            <article key={title} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-800">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                  <span className="mt-2 inline-block text-[11px] font-medium text-slate-400">Implementation staged</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
