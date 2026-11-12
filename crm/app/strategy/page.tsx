"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Objective = { id: string; plan_id: string; title: string; description: string | null; target_value: number | null; actual_value: number | null; unit: string | null; status: string; due_date: string | null };
type StrategyActivity = { id: string; plan_id: string; title: string; description: string | null; activity_type: string | null; starts_on: string | null; ends_on: string | null; status: string; budget_amount: number };
type BudgetRecord = { id: string; plan_id: string; proposed_amount: number; approved_amount: number | null; status: string; notes: string | null };
type WeeklyReport = { id: string; plan_id: string | null; reporting_start: string; reporting_end: string; staff_id: string; completed_work: string; recruitment_outcomes: Record<string, unknown>; challenges: string | null; next_week_plan: string | null; status: string; submitted_at: string | null; reviewer_comments: string | null };
type StrategyRisk = { id: string; plan_id: string; title: string; description: string | null; priority: string; status: string; corrective_action: string | null; due_date: string | null; programme: string | null };
type IntakeTarget = { id: string; plan_id: string; intake_month: number; cycle: string; programme: string; target_applications: number; target_admissions: number; target_registrations: number };

type StrategyMeeting = { id: string; plan_id: string | null; meeting_at: string; title: string; minutes: string; decisions: unknown[]; };
type MeetingAction = { id: string; meeting_id: string; action: string; owner_id: string | null; due_date: string | null; status: string; notes: string | null; };

type ApprovalRequest = { id: string; request_type: string; entity_type: string; entity_id: string | null; title: string; reason: string; status: string; submitted_at: string; submitted_by: string | null; decision_comment: string | null; };

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
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [risks, setRisks] = useState<StrategyRisk[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [decisionComments, setDecisionComments] = useState<Record<string, string>>({});
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<StrategyMeeting[]>([]);
  const [meetingActions, setMeetingActions] = useState<MeetingAction[]>([]);
  const [meetingTitle, setMeetingTitle] = useState("Monday Marketing Management Meeting");
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingMinutes, setMeetingMinutes] = useState("");
  const [actionDrafts, setActionDrafts] = useState<Record<string, { action: string; due_date: string }>>({});
  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");
  const [reportWork, setReportWork] = useState("");
  const [reportRecruitment, setReportRecruitment] = useState("");
  const [reportChallenges, setReportChallenges] = useState("");
  const [reportNextWeek, setReportNextWeek] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetNotes, setBudgetNotes] = useState("");
  const [riskTitle, setRiskTitle] = useState("");
  const [riskDescription, setRiskDescription] = useState("");
  const [riskPriority, setRiskPriority] = useState("medium");
  const [riskAction, setRiskAction] = useState("");
  const [riskDueDate, setRiskDueDate] = useState("");
  const [riskProgramme, setRiskProgramme] = useState("");
  const [activities, setActivities] = useState<StrategyActivity[]>([]);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDescription, setActivityDescription] = useState("");
  const [activityType, setActivityType] = useState("Outreach");
  const [activityStart, setActivityStart] = useState("");
  const [activityEnd, setActivityEnd] = useState("");
  const [activityBudget, setActivityBudget] = useState("0");
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
      const [objectiveRows, intakeRows, activityRows, budgetRows, riskRows, reportRows, approvalRows, meetingRows] = await Promise.all([
        supabase.from("strategy_objectives").select("id,plan_id,title,description,target_value,actual_value,unit,status,due_date").in("plan_id", ids).order("sort_order"),
        supabase.from("strategy_intake_plans").select("id,plan_id,intake_month,cycle,programme,target_applications,target_admissions,target_registrations").in("plan_id", ids).order("intake_month"),
        supabase.from("strategy_activities").select("id,plan_id,title,description,activity_type,starts_on,ends_on,status,budget_amount").in("plan_id", ids).order("starts_on"),
        supabase.from("strategy_annual_budgets").select("id,plan_id,proposed_amount,approved_amount,status,notes").in("plan_id", ids),
        supabase.from("strategy_risks").select("id,plan_id,title,description,priority,status,corrective_action,due_date,programme").in("plan_id", ids).order("created_at", { ascending: false }),
        supabase.from("strategy_weekly_reports").select("id,plan_id,reporting_start,reporting_end,staff_id,completed_work,recruitment_outcomes,challenges,next_week_plan,status,submitted_at,reviewer_comments").order("reporting_start", { ascending: false }).limit(100),
        supabase.from("strategy_approval_requests").select("id,request_type,entity_type,entity_id,title,reason,status,submitted_at,submitted_by,decision_comment").order("submitted_at", { ascending: false }).limit(100),
        supabase.from("strategy_meetings").select("id,plan_id,meeting_at,title,minutes,decisions").order("meeting_at", { ascending: false }).limit(50),
      ]);
      const failed = objectiveRows.error || intakeRows.error || activityRows.error || budgetRows.error || riskRows.error || reportRows.error || approvalRows.error || meetingRows.error;
      if (failed) { setError(`Unable to load all strategy registers: ${failed.message}`); setLoading(false); return; }
      setObjectives((objectiveRows.data ?? []) as Objective[]);
      setIntakeTargets((intakeRows.data ?? []) as IntakeTarget[]);
      setActivities((activityRows.data ?? []) as StrategyActivity[]);
      setBudgets((budgetRows.data ?? []) as BudgetRecord[]);
      setRisks((riskRows.data ?? []) as StrategyRisk[]);
      setWeeklyReports((reportRows.data ?? []) as WeeklyReport[]);
      setApprovalRequests((approvalRows.data ?? []) as ApprovalRequest[]);
      setMeetings((meetingRows.data ?? []) as StrategyMeeting[]);
      const { data: actions } = await supabase.from("strategy_meeting_actions").select("id,meeting_id,action,owner_id,due_date,status,notes").order("due_date", { ascending: true }).limit(200);
      setMeetingActions((actions ?? []) as MeetingAction[]);
    } else {
      setObjectiveCount(0);
      setActivityCount(0);
      setIntakeCount(0);
      setObjectives([]);
      setIntakeTargets([]);
      setActivities([]);
      setBudgets([]);
      setRisks([]);
      const { data: reportRows } = await supabase.from("strategy_weekly_reports").select("id,plan_id,reporting_start,reporting_end,staff_id,completed_work,recruitment_outcomes,challenges,next_week_plan,status,submitted_at,reviewer_comments").order("reporting_start", { ascending: false }).limit(100);
      setWeeklyReports((reportRows ?? []) as WeeklyReport[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function decideApproval(request: ApprovalRequest, decision: "approved" | "returned_for_revision" | "rejected") {
    const comment = (decisionComments[request.id] || "").trim();
    if (decision !== "approved" && !comment) { setError("Add a decision comment when returning or rejecting a request."); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Please sign in again before recording a decision."); return; }
    setDecisionBusy(request.id); setError(""); setNotice("");
    const { error: decisionError } = await supabase.from("strategy_approval_requests").update({
      status: decision, decided_by: auth.user.id, decided_at: new Date().toISOString(),
      decision_comment: comment || null, updated_at: new Date().toISOString()
    }).eq("id", request.id).eq("status", "pending");
    if (decisionError) { setError("Could not record decision: " + decisionError.message); setDecisionBusy(null); return; }
    const { data, error: reloadError } = await supabase.from("strategy_approval_requests")
      .select("id,request_type,entity_type,entity_id,title,reason,status,submitted_at,submitted_by,decision_comment")
      .order("submitted_at", { ascending: false }).limit(100);
    if (reloadError) setError("Decision saved, but queue refresh failed: " + reloadError.message);
    else { setApprovalRequests((data ?? []) as ApprovalRequest[]); setNotice("Decision recorded."); }
    setDecisionBusy(null);
  }

  async function createMeeting() {
    if (!meetingAt || !meetingTitle.trim()) { setError("Enter a meeting title and date/time."); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Please sign in again before creating a meeting."); return; }
    setSaving(true); setError(""); setNotice("");
    const { error: saveError } = await supabase.from("strategy_meetings").insert({
      plan_id: plans.find((p) => p.strategy_year === currentYear)?.id ?? null,
      meeting_at: new Date(meetingAt).toISOString(), title: meetingTitle.trim(), minutes: meetingMinutes.trim(), created_by: auth.user.id
    });
    if (saveError) setError("Could not create meeting: " + saveError.message);
    else { setMeetingTitle("Monday Marketing Management Meeting"); setMeetingMinutes(""); setNotice("Meeting created."); await load(); }
    setSaving(false);
  }

  async function addMeetingAction(meetingId: string) {
    const draft = actionDrafts[meetingId];
    if (!draft?.action.trim()) { setError("Enter the action before saving it."); return; }
    const { error: saveError } = await supabase.from("strategy_meeting_actions").insert({
      meeting_id: meetingId, action: draft.action.trim(), due_date: draft.due_date || null, status: "pending"
    });
    if (saveError) { setError("Could not add meeting action: " + saveError.message); return; }
    setActionDrafts((prev) => ({ ...prev, [meetingId]: { action: "", due_date: "" } }));
    const { data } = await supabase.from("strategy_meeting_actions").select("id,meeting_id,action,owner_id,due_date,status,notes").order("due_date", { ascending: true }).limit(200);
    setMeetingActions((data ?? []) as MeetingAction[]); setNotice("Meeting action added.");
  }

  async function updateMeetingAction(action: MeetingAction, status: "in_progress" | "completed") {
    const { error: saveError } = await supabase.from("strategy_meeting_actions").update({
      status, completed_at: status === "completed" ? new Date().toISOString() : null, updated_at: new Date().toISOString()
    }).eq("id", action.id);
    if (saveError) { setError("Could not update action: " + saveError.message); return; }
    setMeetingActions((prev) => prev.map((item) => item.id === action.id ? { ...item, status } : item));
    setNotice("Meeting action updated.");
  }

  async function submitWeeklyReport() {
    if (!reportStart || !reportEnd || reportEnd < reportStart || !reportWork.trim()) { setError("Enter a valid reporting period and describe the work completed."); return; }
    setSaving(true); setError(""); setNotice("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Please sign in again to submit your report."); setSaving(false); return; }
    let recruitment: Record<string, unknown> = {};
    if (reportRecruitment.trim()) {
      try { recruitment = JSON.parse(reportRecruitment); } catch { setError('Recruitment outcomes must be valid JSON, e.g. {"applications":12,"admissions":8,"registrations":5}.'); setSaving(false); return; }
      if (!recruitment || Array.isArray(recruitment) || typeof recruitment !== "object") { setError("Recruitment outcomes must be a JSON object."); setSaving(false); return; }
    }
    const { data: existing, error: lookupError } = await supabase.from("strategy_weekly_reports")
      .select("id,status").eq("staff_id", auth.user.id).eq("reporting_start", reportStart).eq("reporting_end", reportEnd).maybeSingle();
    if (lookupError) { setError(lookupError.message); setSaving(false); return; }
    if (existing?.status === "approved") { setError("This reporting period has an approved report and is locked. Contact the manager to arrange a controlled correction."); setSaving(false); return; }
    const payload = {
      plan_id: currentPlan?.id ?? null, reporting_start: reportStart, reporting_end: reportEnd, staff_id: auth.user.id,
      completed_work: reportWork.trim(), recruitment_outcomes: recruitment, challenges: reportChallenges.trim() || null,
      next_week_plan: reportNextWeek.trim() || null, status: "submitted", submitted_at: new Date().toISOString(),
    };
    const saveResult = existing
      ? await supabase.from("strategy_weekly_reports").update(payload).eq("id", existing.id)
      : await supabase.from("strategy_weekly_reports").insert(payload);
    if (saveResult.error) setError(saveResult.error.message);
    else { setReportWork(""); setReportRecruitment(""); setReportChallenges(""); setReportNextWeek(""); setNotice("Weekly report submitted for manager review."); await load(); }
    setSaving(false);
  }

  async function submitBudget() {
    if (!currentPlan || !budgetAmount.trim() || Number(budgetAmount) < 0) return;
    setSaving(true); setError(""); setNotice("");
    const { data: auth } = await supabase.auth.getUser();
    const { error: saveError } = await supabase.from("strategy_annual_budgets").insert({ plan_id: currentPlan.id, proposed_amount: Number(budgetAmount), status: "pending_approval", prepared_by: auth.user?.id ?? null, notes: budgetNotes.trim() || null });
    if (saveError) setError(saveError.code === "23505" ? "An annual budget record already exists for this plan. Management must review or return it before a replacement is submitted." : saveError.message);
    else { setBudgetAmount(""); setBudgetNotes(""); setNotice("Annual budget submitted for management approval."); await load(); }
    setSaving(false);
  }

  async function addRisk() {
    if (!currentPlan || !riskTitle.trim()) return;
    setSaving(true); setError(""); setNotice("");
    const { data: auth } = await supabase.auth.getUser();
    const { error: saveError } = await supabase.from("strategy_risks").insert({ plan_id: currentPlan.id, title: riskTitle.trim(), description: riskDescription.trim() || null, priority: riskPriority, corrective_action: riskAction.trim() || null, due_date: riskDueDate || null, programme: riskProgramme.trim() || null, raised_by: auth.user?.id ?? null });
    if (saveError) setError(saveError.message);
    else { setRiskTitle(""); setRiskDescription(""); setRiskAction(""); setRiskDueDate(""); setRiskProgramme(""); setNotice(riskPriority === "critical" ? "Critical risk recorded. Escalate it to management immediately." : "Risk added to the register."); await load(); }
    setSaving(false);
  }

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

  async function addActivity() {
    if (!currentPlan || !activityTitle.trim()) return;
    if (activityStart && activityEnd && activityEnd < activityStart) { setError("Activity end date cannot be before its start date."); return; }
    setSaving(true); setError(""); setNotice("");
    const { data: auth } = await supabase.auth.getUser();
    const { error: saveError } = await supabase.from("strategy_activities").insert({
      plan_id: currentPlan.id, title: activityTitle.trim(), description: activityDescription.trim() || null,
      activity_type: activityType, starts_on: activityStart || null, ends_on: activityEnd || null,
      budget_amount: Math.max(0, Number(activityBudget) || 0), created_by: auth.user?.id ?? null,
    });
    if (saveError) setError(saveError.message);
    else { setActivityTitle(""); setActivityDescription(""); setActivityStart(""); setActivityEnd(""); setActivityBudget("0"); setNotice("Activity added to the register."); await load(); }
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


      {currentPlan && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Activity register</h2><p className="mt-1 text-xs text-slate-500">Record planned delivery, dates and initial budget estimates.</p></div>
          <form onSubmit={(event) => { event.preventDefault(); void addActivity(); }} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-1 text-xs font-medium text-slate-700">Activity title<input required value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="e.g. Secondary school activation" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Activity type<select value={activityType} onChange={(e) => setActivityType(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option>Outreach</option><option>Digital marketing</option><option>Event</option><option>School visit</option><option>Alumni engagement</option><option>Follow-up</option><option>Other</option></select></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Estimated budget (UGX)<input type="number" min="0" value={activityBudget} onChange={(e) => setActivityBudget(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Start date<input type="date" value={activityStart} onChange={(e) => setActivityStart(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">End date<input type="date" value={activityEnd} onChange={(e) => setActivityEnd(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700 md:col-span-2 xl:col-span-1">Description<textarea value={activityDescription} onChange={(e) => setActivityDescription(e.target.value)} rows={1} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <div><button disabled={saving} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Add activity"}</button></div>
          </form>
          <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Activity</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Dates</th><th className="px-4 py-3 text-right font-medium">Budget (UGX)</th><th className="px-4 py-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{activities.filter((a) => a.plan_id === currentPlan.id).map((a) => <tr key={a.id}><td className="px-4 py-3"><p className="font-medium text-slate-900">{a.title}</p>{a.description && <p className="mt-1 max-w-sm text-xs text-slate-500">{a.description}</p>}</td><td className="px-4 py-3 text-slate-600">{a.activity_type || "—"}</td><td className="px-4 py-3 text-xs text-slate-600">{a.starts_on || "Not set"} – {a.ends_on || "Not set"}</td><td className="px-4 py-3 text-right tabular-nums">{Number(a.budget_amount || 0).toLocaleString("en-UG")}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{statusLabel(a.status)}</span></td></tr>)}</tbody></table>{activities.filter((a) => a.plan_id === currentPlan.id).length === 0 && <p className="px-4 py-5 text-xs text-slate-500">No activities recorded yet.</p>}</div>
        </section>
      )}


      {currentPlan && <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Annual budget planning</h2><p className="mt-1 text-xs text-slate-500">Submit a proposed annual budget for management approval. Submission does not approve funds.</p></div>
          <form onSubmit={(e) => { e.preventDefault(); void submitBudget(); }} className="grid gap-3 p-4">
            <label className="grid gap-1 text-xs font-medium text-slate-700">Proposed annual budget (UGX)<input required type="number" min="0" step="1000" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Notes / assumptions<textarea value={budgetNotes} onChange={(e) => setBudgetNotes(e.target.value)} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <button disabled={saving} className="w-fit rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Submit for approval"}</button>
          </form>
          <div className="divide-y divide-slate-100">{budgets.filter((b) => b.plan_id === currentPlan.id).map((b) => <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-semibold text-slate-900">UGX {Number(b.proposed_amount).toLocaleString("en-UG")}</p><p className="mt-1 text-xs text-slate-500">{b.notes || "No notes"}{b.approved_amount != null ? ` · Approved: UGX ${Number(b.approved_amount).toLocaleString("en-UG")}` : ""}</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">{statusLabel(b.status)}</span></div>)}{budgets.filter((b) => b.plan_id === currentPlan.id).length === 0 && <p className="px-4 py-4 text-xs text-slate-500">No annual budget submitted.</p>}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Risks & corrective actions</h2><p className="mt-1 text-xs text-slate-500">Record risk mitigation and due dates. Critical risks require immediate management escalation.</p></div>
          <form onSubmit={(e) => { e.preventDefault(); void addRisk(); }} className="grid gap-3 p-4">
            <label className="grid gap-1 text-xs font-medium text-slate-700">Risk title<input required value={riskTitle} onChange={(e) => setRiskTitle(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Description<textarea value={riskDescription} onChange={(e) => setRiskDescription(e.target.value)} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-xs font-medium text-slate-700">Priority<select value={riskPriority} onChange={(e) => setRiskPriority(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className="grid gap-1 text-xs font-medium text-slate-700">Action due date<input type="date" value={riskDueDate} onChange={(e) => setRiskDueDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label></div>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Corrective action<textarea value={riskAction} onChange={(e) => setRiskAction(e.target.value)} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Programme (optional)<input value={riskProgramme} onChange={(e) => setRiskProgramme(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <button disabled={saving} className="w-fit rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Record risk"}</button>
          </form>
          <div className="divide-y divide-slate-100">{risks.filter((r) => r.plan_id === currentPlan.id).map((r) => <div key={r.id} className="px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{r.title}</p><span className={`rounded-full px-2 py-1 text-xs font-semibold ${r.priority === "critical" ? "bg-red-100 text-red-800" : r.priority === "high" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{statusLabel(r.priority)}</span></div>{r.corrective_action && <p className="mt-1 text-xs text-slate-600">Action: {r.corrective_action}</p>}<p className="mt-1 text-xs text-slate-500">Due: {r.due_date || "Not set"} · {statusLabel(r.status)}{r.programme ? ` · ${r.programme}` : ""}</p></div>)}{risks.filter((r) => r.plan_id === currentPlan.id).length === 0 && <p className="px-4 py-4 text-xs text-slate-500">No risks recorded.</p>}</div>
        </div>
      </section>}


      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Weekly Reports & Meetings</h2><p className="mt-1 text-xs text-slate-500">Submit Monday–Friday work reports for manager review. PDF delivery and meeting minutes are a subsequent workflow stage.</p></div>
        <form onSubmit={(e) => { e.preventDefault(); void submitWeeklyReport(); }} className="grid gap-3 p-4 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-slate-700">Period start<input required type="date" value={reportStart} onChange={(e) => setReportStart(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">Period end<input required type="date" min={reportStart || undefined} value={reportEnd} onChange={(e) => setReportEnd(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-700 md:col-span-2">Work completed<textarea required value={reportWork} onChange={(e) => setReportWork(e.target.value)} rows={4} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Activities delivered, follow-ups, outreach and other work" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-700 md:col-span-2">Recruitment outcomes (optional JSON)<textarea value={reportRecruitment} onChange={(e) => setReportRecruitment(e.target.value)} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs font-normal" placeholder='{"applications":12,"admissions":8,"registrations":5}' /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">Challenges<textarea value={reportChallenges} onChange={(e) => setReportChallenges(e.target.value)} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">Plan for next week<textarea value={reportNextWeek} onChange={(e) => setReportNextWeek(e.target.value)} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
          <div><button disabled={saving} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Submit weekly report"}</button></div>
        </form>
        <div className="overflow-x-auto border-t border-slate-200"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Period</th><th className="px-4 py-3 font-medium">Work summary</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Submitted</th><th className="px-4 py-3 font-medium">Review notes</th></tr></thead><tbody className="divide-y divide-slate-100">{weeklyReports.map((r) => <tr key={r.id}><td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">{r.reporting_start} – {r.reporting_end}</td><td className="px-4 py-3"><p className="max-w-md whitespace-pre-wrap text-sm text-slate-800">{r.completed_work}</p></td><td className="px-4 py-3 text-xs">{statusLabel(r.status)}</td><td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</td><td className="px-4 py-3 text-xs text-slate-600">{r.reviewer_comments || "—"}</td></tr>)}</tbody></table>{weeklyReports.length === 0 && <p className="px-4 py-5 text-xs text-slate-500">No weekly reports available to this account.</p>}</div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div><h2 className="text-sm font-semibold text-slate-900">Approvals Centre</h2><p className="mt-1 text-xs text-slate-500">Review requests, record decisions and retain decision comments.</p></div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{approvalRequests.filter((r) => r.status === "pending").length} pending</span>
        </div>
        <div className="divide-y divide-slate-100">
          {approvalRequests.map((request) => <article key={request.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-900">{request.title}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px]">{statusLabel(request.status)}</span></div>
              <p className="mt-1 text-xs text-slate-500">{statusLabel(request.request_type)} · Submitted {new Date(request.submitted_at).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{request.reason}</p>
              {request.decision_comment && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><strong>Decision note:</strong> {request.decision_comment}</p>}</div>
            {request.status === "pending" ? <div className="grid content-start gap-2">
              <label className="grid gap-1 text-xs font-medium text-slate-700">Decision comment<textarea value={decisionComments[request.id] || ""} onChange={(e) => setDecisionComments((prev) => ({ ...prev, [request.id]: e.target.value }))} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Explain the decision or revisions required" /></label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={decisionBusy === request.id} onClick={() => void decideApproval(request, "approved")} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve</button>
                <button type="button" disabled={decisionBusy === request.id} onClick={() => void decideApproval(request, "returned_for_revision")} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50">Return for revision</button>
                <button type="button" disabled={decisionBusy === request.id} onClick={() => void decideApproval(request, "rejected")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Reject</button>
              </div></div> : <p className="self-start text-xs text-slate-500">Decision recorded.</p>}
          </article>)}
          {approvalRequests.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">No approval requests have been submitted yet.</p>}
        </div>
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
