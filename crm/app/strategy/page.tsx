"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Objective = { id: string; plan_id: string; title: string; description: string | null; target_value: number | null; actual_value: number | null; unit: string | null; status: string; due_date: string | null };
type IntakeTarget = { id: string; plan_id: string; intake_month: number; cycle: string; programme: string; target_applications: number; target_admissions: number; target_registrations: number };

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
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [intakeTargets, setIntakeTargets] = useState<IntakeTarget[]>([]);
  const [objectiveTitle, setObjectiveTitle] = useState("");
  const [objectiveDescription, setObjectiveDescription] = useState("");
  const [objectiveTarget, setObjectiveTarget] = useState("");
  const [objectiveUnit, setObjectiveUnit] = useState("%");
  const [intakeMonth, setIntakeMonth] = useState("2");
  const [programme, setProgramme] = useState("");
  const [targetApplications, setTargetApplications] = useState("0");
  const [targetAdmissions, setTargetAdmissions] = useState("0");
  const [targetRegistrations, setTargetRegistrations] = useState("0");
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
      const [objectiveRows, intakeRows] = await Promise.all([
        supabase.from("strategy_objectives").select("id,plan_id,title,description,target_value,actual_value,unit,status,due_date").in("plan_id", ids).order("sort_order"),
        supabase.from("strategy_intake_plans").select("id,plan_id,intake_month,cycle,programme,target_applications,target_admissions,target_registrations").in("plan_id", ids).order("intake_month"),
      ]);
      if (objectiveRows.error) throw objectiveRows.error;
      if (intakeRows.error) throw intakeRows.error;
      setObjectives((objectiveRows.data ?? []) as Objective[]);
      setIntakeTargets((intakeRows.data ?? []) as IntakeTarget[]);
    } else {
      setObjectiveCount(0);
      setActivityCount(0);
      setIntakeCount(0);
      setObjectives([]);
      setIntakeTargets([]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function addObjective() {
    if (!currentPlan || !objectiveTitle.trim()) return;
    setSaving(true); setError(""); setNotice("");
    const { error: saveError } = await supabase.from("strategy_objectives").insert({
      plan_id: currentPlan.id, title: objectiveTitle.trim(), description: objectiveDescription.trim() || null,
      target_value: objectiveTarget.trim() ? Number(objectiveTarget) : null, unit: objectiveUnit,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });
    if (saveError) setError(saveError.message);
    else { setObjectiveTitle(""); setObjectiveDescription(""); setObjectiveTarget(""); setNotice("Objective added."); await load(); }
    setSaving(false);
  }

  async function addIntakeTarget() {
    if (!currentPlan || !programme.trim()) return;
    setSaving(true); setError(""); setNotice("");
    const { error: saveError } = await supabase.from("strategy_intake_plans").upsert({
      plan_id: currentPlan.id, intake_month: Number(intakeMonth), programme: programme.trim(),
      target_applications: Math.max(0, Number(targetApplications) || 0),
      target_admissions: Math.max(0, Number(targetAdmissions) || 0),
      target_registrations: Math.max(0, Number(targetRegistrations) || 0),
    }, { onConflict: "plan_id,intake_month,programme" });
    if (saveError) setError(saveError.message);
    else { setNotice("Intake targets saved."); setProgramme(""); setTargetApplications("0"); setTargetAdmissions("0"); setTargetRegistrations("0"); await load(); }
    setSaving(false);
  }

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


      {currentPlan && (
        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Annual objectives</h2><p className="mt-1 text-xs text-slate-500">Create measurable objectives for {currentYear}.</p></div>
            <form onSubmit={(event) => { event.preventDefault(); void addObjective(); }} className="grid gap-3 p-4">
              <label className="grid gap-1 text-xs font-medium text-slate-700">Objective title<input required value={objectiveTitle} onChange={(e) => setObjectiveTitle(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="e.g. Increase qualified applications" /></label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">Description<textarea value={objectiveDescription} onChange={(e) => setObjectiveDescription(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" rows={2} /></label>
              <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-xs font-medium text-slate-700">Target value<input type="number" step="any" value={objectiveTarget} onChange={(e) => setObjectiveTarget(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Optional" /></label><label className="grid gap-1 text-xs font-medium text-slate-700">Unit<select value={objectiveUnit} onChange={(e) => setObjectiveUnit(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="%">Percent</option><option value="applications">Applications</option><option value="registrations">Registrations</option><option value="UGX">UGX</option><option value="activities">Activities</option></select></label></div>
              <button disabled={saving} className="w-fit rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Add objective"}</button>
            </form>
            <div className="divide-y divide-slate-100">{objectives.filter((o) => o.plan_id === currentPlan.id).map((o) => <div key={o.id} className="px-4 py-3"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-slate-900">{o.title}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{statusLabel(o.status)}</span></div>{o.description && <p className="mt-1 text-xs text-slate-500">{o.description}</p>}{o.target_value != null && <p className="mt-1 text-xs text-slate-600">Target: {o.target_value.toLocaleString()} {o.unit || ""}</p>}</div>)}{objectives.filter((o) => o.plan_id === currentPlan.id).length === 0 && <p className="px-4 py-4 text-xs text-slate-500">No objectives recorded yet.</p>}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Programme intake targets</h2><p className="mt-1 text-xs text-slate-500">Each intake remains separately tracked.</p></div>
            <form onSubmit={(event) => { event.preventDefault(); void addIntakeTarget(); }} className="grid gap-3 p-4">
              <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-xs font-medium text-slate-700">Intake<select value={intakeMonth} onChange={(e) => setIntakeMonth(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="2">February</option><option value="4">April</option><option value="8">August</option><option value="11">November</option></select></label><label className="grid gap-1 text-xs font-medium text-slate-700">Programme<input required value={programme} onChange={(e) => setProgramme(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Programme name" /></label></div>
              <div className="grid grid-cols-3 gap-2"><label className="grid gap-1 text-xs font-medium text-slate-700">Applications<input type="number" min="0" value={targetApplications} onChange={(e) => setTargetApplications(e.target.value)} className="min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm font-normal" /></label><label className="grid gap-1 text-xs font-medium text-slate-700">Admissions<input type="number" min="0" value={targetAdmissions} onChange={(e) => setTargetAdmissions(e.target.value)} className="min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm font-normal" /></label><label className="grid gap-1 text-xs font-medium text-slate-700">Registrations<input type="number" min="0" value={targetRegistrations} onChange={(e) => setTargetRegistrations(e.target.value)} className="min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm font-normal" /></label></div>
              <button disabled={saving} className="w-fit rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save intake targets"}</button>
            </form>
            <div className="divide-y divide-slate-100">{intakeTargets.filter((t) => t.plan_id === currentPlan.id).map((t) => <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-medium text-slate-900">{new Date(2000, t.intake_month - 1, 1).toLocaleString("en", { month: "long" })} · {t.programme}</p><p className="mt-1 text-xs text-slate-500">{t.cycle === "february" ? "February cycle" : "August cycle"}</p></div><div className="text-right text-xs text-slate-600"><p>Apps {t.target_applications}</p><p>Admissions {t.target_admissions}</p><p>Registrations {t.target_registrations}</p></div></div>)}{intakeTargets.filter((t) => t.plan_id === currentPlan.id).length === 0 && <p className="px-4 py-4 text-xs text-slate-500">No intake targets recorded yet.</p>}</div>
          </div>
        </section>
      )}

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
