"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Objective = { id: string; plan_id: string; title: string; description: string | null; target_value: number | null; actual_value: number | null; unit: string | null; status: string; due_date: string | null };
type StrategyActivity = { id: string; plan_id: string; title: string; description: string | null; activity_type: string | null; starts_on: string | null; ends_on: string | null; status: string; budget_amount: number; owner_id: string | null };
type BudgetRecord = { id: string; plan_id: string; proposed_amount: number; approved_amount: number | null; status: string; notes: string | null };
type WeeklyReport = { id: string; plan_id: string | null; reporting_start: string; reporting_end: string; staff_id: string; completed_work: string; recruitment_outcomes: Record<string, unknown>; challenges: string | null; next_week_plan: string | null; status: string; submitted_at: string | null; reviewer_comments: string | null };
type StrategyRisk = { id: string; plan_id: string; title: string; description: string | null; priority: string; status: string; corrective_action: string | null; due_date: string | null; programme: string | null; owner_id: string | null };
type IntakeTarget = { id: string; plan_id: string; intake_month: number; cycle: string; programme: string; intake_strategy: string | null; target_applications: number; target_admissions: number; target_registrations: number; achieved_registrations: number };

type ManagementReportHistory = { id: string; plan_id: string | null; report_type: string; reporting_start: string | null; reporting_end: string | null; version: number; status: string; snapshot: Record<string, unknown>; created_at: string; approved_by?: string | null; approved_at?: string | null; sent_by?: string | null; sent_at?: string | null; provider_status?: string | null; provider_message_id?: string | null; recipients?: unknown[]; };
type ApprovalDecisionHistory = { id: string; request_id: string; previous_status: string; decision: string; reviewer_id: string | null; reviewer_comment: string | null; decided_at: string; };
type StrategyProfileName = { id: string; full_name: string };
type CycleAllocation = { id: string; plan_id: string; cycle: string; proposed_amount: number; approved_amount: number | null; status: string; notes: string | null; };
type StrategyMeeting = { id: string; plan_id: string | null; meeting_at: string; title: string; minutes: string; decisions: unknown[]; };
type MeetingAction = { id: string; meeting_id: string; action: string; owner_id: string | null; due_date: string | null; status: string; notes: string | null; };

type ApprovalRequest = { id: string; request_type: string; entity_type: string; entity_id: string | null; title: string; reason: string; status: string; submitted_at: string; submitted_by: string | null; decision_comment: string | null; };

type Plan = {
  id: string;
  strategy_year: number;
  title: string;
  status: string;
  summary: string | null;
  strategy_period: string | null;
  updated_at: string;
};

type RecruitmentActuals = { leads: number; applications: number; admitted: number; enrolled: number; };
type FrameworkEntry = { id: string; plan_id: string; strategic_pillar: string; objectives: string; key_activities: string; channels_tools: string; kpis_targets: string; sort_order: number };
type IntakeStrategyEntry = { id: string; intake_plan_id: string; source_framework_entry_id: string | null; strategic_pillar: string; objectives: string; key_activities: string; channels_tools: string; kpis_targets: string };


const sections = [
  ["General Strategy", "Annual objectives, KPIs and accountable owners", "strategy-objectives"],
  ["Intake Strategies", "Recruitment approach, intake targets and achieved enrolments", "intake-plans"],
  ["Activities", "Delivery plans, owners, evidence and outcomes", "strategy-activities"],
  ["Budget Planning", "Annual budget, cycle allocations and commitments", "strategy-budget"],
  ["Performance & Outcomes", "Recruitment and objective progress", "annual-strategy-register"],
  ["Weekly Reports & Meetings", "Staff reports, minutes and assigned actions", "weekly-reports"],
  ["Risks & Corrective Actions", "Risk register, mitigations and deadlines", "strategy-risks"],
  ["Approvals Centre", "Pending decisions and approval history", "strategy-approvals"],
  ["Management Reports", "Executive summaries and approved report history", "strategy-management-reports"],
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
  const [frameworkEntries, setFrameworkEntries] = useState<FrameworkEntry[]>([]);
  const [intakeStrategyEntries, setIntakeStrategyEntries] = useState<IntakeStrategyEntry[]>([]);
  const [planTitleDraft, setPlanTitleDraft] = useState("");
  const [strategyPeriodDraft, setStrategyPeriodDraft] = useState("FY 2026");
  const [frameworkDraft, setFrameworkDraft] = useState({ strategic_pillar: "", objectives: "", key_activities: "", channels_tools: "", kpis_targets: "" });
  const [intakeDraft, setIntakeDraft] = useState({ strategic_pillar: "", objectives: "", key_activities: "", channels_tools: "", kpis_targets: "" });
  const [intakeTargets, setIntakeTargets] = useState<IntakeTarget[]>([]);
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [cycleAllocations, setCycleAllocations] = useState<CycleAllocation[]>([]);
  const [reportHistory, setReportHistory] = useState<ManagementReportHistory[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalDecisionHistory[]>([]);
  const [strategyProfileNames, setStrategyProfileNames] = useState<Record<string, string>>({});
  const [strategyStaff, setStrategyStaff] = useState<StrategyProfileName[]>([]);
  const [allocationCycle, setAllocationCycle] = useState("february");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [allocationNotes, setAllocationNotes] = useState("");
  const [risks, setRisks] = useState<StrategyRisk[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [weeklyReviewComments, setWeeklyReviewComments] = useState<Record<string, string>>({});
  const [weeklyReviewBusy, setWeeklyReviewBusy] = useState<string | null>(null);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [decisionComments, setDecisionComments] = useState<Record<string, string>>({});
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<StrategyMeeting[]>([]);
  const [meetingActions, setMeetingActions] = useState<MeetingAction[]>([]);
  const [meetingTitle, setMeetingTitle] = useState("Monday Marketing Management Meeting");
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingMinutes, setMeetingMinutes] = useState("");
  const [actionDrafts, setActionDrafts] = useState<Record<string, { action: string; due_date: string; owner_id: string }>>({});
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
  const [riskOwnerId, setRiskOwnerId] = useState("");
  const [activities, setActivities] = useState<StrategyActivity[]>([]);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDescription, setActivityDescription] = useState("");
  const [activityType, setActivityType] = useState("Outreach");
  const [activityStart, setActivityStart] = useState("");
  const [activityEnd, setActivityEnd] = useState("");
  const [activityBudget, setActivityBudget] = useState("0");
  const [activityOwnerId, setActivityOwnerId] = useState("");
  const [objectiveTitle, setObjectiveTitle] = useState("");
  const [objectiveDescription, setObjectiveDescription] = useState("");
  const [objectiveTarget, setObjectiveTarget] = useState("");
  const [objectiveUnit, setObjectiveUnit] = useState("%");
  const [intakeMonth, setIntakeMonth] = useState("2");
  const [programme, setProgramme] = useState("");
  const [targetApplications, setTargetApplications] = useState("0");
  const [targetAdmissions, setTargetAdmissions] = useState("0");
  const [targetRegistrations, setTargetRegistrations] = useState("0");
  const [achievedRegistrations, setAchievedRegistrations] = useState("0");
  const [intakeStrategy, setIntakeStrategy] = useState("");
  const [achievedDrafts, setAchievedDrafts] = useState<Record<string, string>>({});
  const [recruitmentActuals, setRecruitmentActuals] = useState<RecruitmentActuals>({ leads: 0, applications: 0, admitted: 0, enrolled: 0 });
  const [actualsAvailable, setActualsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attentionFilter, setAttentionFilter] = useState<"all" | "activities" | "risks" | "actions">("all");
  const [activeWorkspace, setActiveWorkspace] = useState<"general" | "intakes" | "activities" | "budget" | "performance" | "weekly" | "risks" | "approvals" | "reports">("general");

  const supabase = useMemo(() => createClient(), []);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: planError } = await supabase
      .from("strategy_plans")
      .select("id,strategy_year,title,status,summary,strategy_period,updated_at")
      .order("strategy_year", { ascending: false });

    if (planError) {
      setError("Strategy data is not available yet. Confirm that the approved Strategy & Planning migration has been applied and your account has module access.");
      setPlans([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Plan[];
    setPlans(rows);
    const yearStart = `${currentYear}-01-01T00:00:00.000Z`;
    const nextYearStart = `${currentYear + 1}-01-01T00:00:00.000Z`;
    const [leadActuals, admissionActuals] = await Promise.all([
      supabase.from("leads").select("id,created_at").gte("created_at", yearStart).lt("created_at", nextYearStart),
      supabase.from("admissions").select("id,stage,created_at").gte("created_at", yearStart).lt("created_at", nextYearStart),
    ]);
    if (!leadActuals.error && !admissionActuals.error) {
      setActualsAvailable(true);
      const actualAdmissions = admissionActuals.data ?? [];
      const stages = actualAdmissions.map((item) => String(item.stage || "").trim().toLowerCase());
      setRecruitmentActuals({
        leads: (leadActuals.data ?? []).length,
        applications: stages.filter((stage) => ["application started", "application submitted", "admitted", "acceptance paid", "enrolled"].includes(stage)).length,
        admitted: stages.filter((stage) => ["admitted", "acceptance paid", "enrolled"].includes(stage)).length,
        enrolled: stages.filter((stage) => stage === "enrolled").length,
      });
    }
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
      const [objectiveRows, intakeRows, activityRows, budgetRows, riskRows, reportRows, approvalRows, meetingRows, allocationRows, historyRows] = await Promise.all([
        supabase.from("strategy_objectives").select("id,plan_id,title,description,target_value,actual_value,unit,status,due_date").in("plan_id", ids).order("sort_order"),
        supabase.from("strategy_intake_plans").select("id,plan_id,intake_month,cycle,programme,intake_strategy,target_applications,target_admissions,target_registrations,achieved_registrations").in("plan_id", ids).eq("programme", "All programmes").order("intake_month"),
        supabase.from("strategy_activities").select("id,plan_id,title,description,activity_type,starts_on,ends_on,status,budget_amount,owner_id").in("plan_id", ids).order("starts_on"),
        supabase.from("strategy_annual_budgets").select("id,plan_id,proposed_amount,approved_amount,status,notes").in("plan_id", ids),
        supabase.from("strategy_risks").select("id,plan_id,title,description,priority,status,corrective_action,due_date,programme,owner_id").in("plan_id", ids).order("created_at", { ascending: false }),
        supabase.from("strategy_weekly_reports").select("id,plan_id,reporting_start,reporting_end,staff_id,completed_work,recruitment_outcomes,challenges,next_week_plan,status,submitted_at,reviewer_comments").order("reporting_start", { ascending: false }).limit(100),
        supabase.from("strategy_approval_requests").select("id,request_type,entity_type,entity_id,title,reason,status,submitted_at,submitted_by,decision_comment").order("submitted_at", { ascending: false }).limit(100),
        supabase.from("strategy_meetings").select("id,plan_id,meeting_at,title,minutes,decisions").order("meeting_at", { ascending: false }).limit(50),
        supabase.from("strategy_cycle_allocations").select("id,plan_id,cycle,proposed_amount,approved_amount,status,notes").in("plan_id", ids).order("cycle"),
        supabase.from("strategy_report_history").select("id,plan_id,report_type,reporting_start,reporting_end,version,status,snapshot,created_at,approved_by,approved_at,sent_by,sent_at,provider_status,provider_message_id,recipients").in("plan_id", ids).order("created_at", { ascending: false }).limit(50),
      ]);
      const failed = objectiveRows.error || intakeRows.error || activityRows.error || budgetRows.error || riskRows.error || reportRows.error || approvalRows.error || meetingRows.error || allocationRows.error || historyRows.error;
      if (failed) { setError(`Unable to load all strategy registers: ${failed.message}`); setLoading(false); return; }
      setObjectives((objectiveRows.data ?? []) as Objective[]);
      const { data: frameworkRows, error: frameworkError } = await supabase.from("strategy_framework_entries").select("id,plan_id,strategic_pillar,objectives,key_activities,channels_tools,kpis_targets,sort_order").in("plan_id", ids).order("sort_order");
      if (frameworkError) setError("Could not load strategy framework: " + frameworkError.message);
      setFrameworkEntries((frameworkRows ?? []) as FrameworkEntry[]);
      const intakeIds = (intakeRows.data ?? []).map((row) => row.id);
      if (intakeIds.length) {
        const { data: intakeStrategyRows, error: intakeStrategyError } = await supabase.from("strategy_intake_strategy_entries").select("id,intake_plan_id,source_framework_entry_id,strategic_pillar,objectives,key_activities,channels_tools,kpis_targets").in("intake_plan_id", intakeIds);
        if (intakeStrategyError) setError("Could not load intake strategies: " + intakeStrategyError.message);
        setIntakeStrategyEntries((intakeStrategyRows ?? []) as IntakeStrategyEntry[]);
      } else setIntakeStrategyEntries([]);
      setIntakeTargets((intakeRows.data ?? []) as IntakeTarget[]);
      setActivities((activityRows.data ?? []) as StrategyActivity[]);
      setBudgets((budgetRows.data ?? []) as BudgetRecord[]);
      setCycleAllocations((allocationRows.data ?? []) as CycleAllocation[]);
      setReportHistory((historyRows.data ?? []) as ManagementReportHistory[]);
      const { data: decisions, error: decisionsError } = await supabase.from("strategy_approval_decision_history").select("id,request_id,previous_status,decision,reviewer_id,reviewer_comment,decided_at").order("decided_at", { ascending: false }).limit(200);
      if (decisionsError) { setError("Could not load approval decision history: " + decisionsError.message); }
      setApprovalHistory((decisions ?? []) as ApprovalDecisionHistory[]);
      const profileIds = Array.from(new Set([...(decisions ?? []).map((item) => item.reviewer_id), ...(historyRows.data ?? []).flatMap((item) => [item.approved_by, item.sent_by])].filter((id): id is string => Boolean(id))));
      if (profileIds.length) {
        const { data: profileRows, error: profileError } = await supabase.from("profiles").select("id,full_name").in("id", profileIds);
        if (profileError) setError("Could not load reviewer names: " + profileError.message);
        else setStrategyProfileNames(Object.fromEntries((profileRows ?? []).map((profile) => [profile.id, profile.full_name])));
      } else setStrategyProfileNames({});
      const { data: staffRows, error: staffError } = await supabase.from("profiles").select("id,full_name").order("full_name");
      if (!staffError) {
        const staff = (staffRows ?? []) as StrategyProfileName[];
        setStrategyStaff(staff);
        setStrategyProfileNames((previous) => ({ ...previous, ...Object.fromEntries(staff.map((profile) => [profile.id, profile.full_name])) }));
      }
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

  async function reviewWeeklyReport(report: WeeklyReport, decision: "approved" | "returned_for_revision") {
    const comment = (weeklyReviewComments[report.id] || "").trim();
    if (decision === "returned_for_revision" && !comment) {
      setError("Add a review comment before returning a weekly report for revision.");
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Please sign in again before reviewing a weekly report."); return; }
    setWeeklyReviewBusy(report.id); setError(""); setNotice("");
    const { data: updated, error: reviewError } = await supabase
      .from("strategy_weekly_reports")
      .update({
        status: decision,
        reviewed_by: auth.user.id,
        reviewed_at: new Date().toISOString(),
        reviewer_comments: comment || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", report.id)
      .in("status", ["submitted", "reviewed", "returned_for_revision"])
      .select("id")
      .maybeSingle();
    if (reviewError || !updated) {
      setError(reviewError ? "Could not review weekly report: " + reviewError.message : "The report is no longer awaiting review, or your account is not authorised.");
      setWeeklyReviewBusy(null);
      return;
    }
    const { data, error: reloadError } = await supabase.from("strategy_weekly_reports")
      .select("id,plan_id,reporting_start,reporting_end,staff_id,completed_work,recruitment_outcomes,challenges,next_week_plan,status,submitted_at,reviewer_comments")
      .order("reporting_start", { ascending: false }).limit(100);
    if (reloadError) setError("Review saved, but the report list could not refresh: " + reloadError.message);
    else {
      setWeeklyReports((data ?? []) as WeeklyReport[]);
      setNotice(decision === "approved" ? "Weekly report approved." : "Weekly report returned for revision.");
    }
    setWeeklyReviewBusy(null);
  }

  async function decideApproval(request: ApprovalRequest, decision: "approved" | "returned_for_revision" | "rejected") {
    const comment = (decisionComments[request.id] || "").trim();
    if (decision !== "approved" && !comment) { setError("Add a decision comment when returning or rejecting a request."); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Please sign in again before recording a decision."); return; }
    setDecisionBusy(request.id); setError(""); setNotice("");
    const { data: decidedRow, error: decisionError } = await supabase.from("strategy_approval_requests").update({
      status: decision, decided_by: auth.user.id, decided_at: new Date().toISOString(),
      decision_comment: comment || null, updated_at: new Date().toISOString()
    }).eq("id", request.id).eq("status", "pending").select("id").maybeSingle();
    if (decisionError || !decidedRow) { setError(decisionError ? "Could not record decision: " + decisionError.message : "This request is no longer pending or your account is not authorised to decide it."); setDecisionBusy(null); return; }
    const { data, error: reloadError } = await supabase.from("strategy_approval_requests")
      .select("id,request_type,entity_type,entity_id,title,reason,status,submitted_at,submitted_by,decision_comment")
      .order("submitted_at", { ascending: false }).limit(100);
    if (reloadError) setError("Decision saved, but queue refresh failed: " + reloadError.message);
    else { setApprovalRequests((data ?? []) as ApprovalRequest[]); setNotice("Decision recorded."); }
    setDecisionBusy(null);
  }

  async function saveManagementReport() {
    const plan = plans.find((p) => p.strategy_year === currentYear) ?? plans[0];
    if (!plan) { setError("Create an annual strategy plan before saving a management report."); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Please sign in again before saving a report."); return; }
    setSaving(true); setError(""); setNotice("");
    const { data: versions, error: versionError } = await supabase.from("strategy_report_history").select("version").eq("report_type", "strategy_management_summary").eq("plan_id", plan.id).order("version", { ascending: false }).limit(1);
    if (versionError) { setError("Could not check report versions: " + versionError.message); setSaving(false); return; }
    const planObjectives = objectives.filter((o) => o.plan_id === plan.id);
    const planIntakes = intakeTargets.filter((item) => item.plan_id === plan.id);
    const planActivities = activities.filter((item) => item.plan_id === plan.id);
    const planBudgets = budgets.filter((item) => item.plan_id === plan.id);
    const planAllocations = cycleAllocations.filter((item) => item.plan_id === plan.id);
    const planRisks = risks.filter((item) => item.plan_id === plan.id);
    const planWeeklyReports = weeklyReports.filter((item) => item.plan_id === plan.id);
    const completedActivities = planActivities.filter((a) => a.status === "completed").length;
    const delayedActivities = planActivities.filter((a) => a.status === "delayed").length;
    const overdueActivities = planActivities.filter((a) => a.status !== "completed" && Boolean(a.ends_on) && String(a.ends_on) < new Date().toISOString().slice(0, 10)).length;
    const unresolvedRisks = planRisks.filter((r) => r.status !== "resolved").length;
    const criticalRisks = planRisks.filter((r) => r.priority === "critical" && r.status !== "resolved").length;
    const overdueRisks = planRisks.filter((r) => r.status !== "resolved" && Boolean(r.due_date) && String(r.due_date) < new Date().toISOString().slice(0, 10)).length;
    const openMeetingActions = meetingActions.filter((a) => a.status !== "completed" && a.status !== "cancelled" && meetings.some((m) => m.id === a.meeting_id && m.plan_id === plan.id)).length;
    const overdueMeetingActions = meetingActions.filter((a) => a.status !== "completed" && a.status !== "cancelled" && Boolean(a.due_date) && String(a.due_date) < new Date().toISOString().slice(0, 10) && meetings.some((m) => m.id === a.meeting_id && m.plan_id === plan.id)).length;
    const unassignedActivities = planActivities.filter((activity) => activity.status !== "completed" && !activity.owner_id).length;
    const unassignedRisks = planRisks.filter((risk) => risk.status !== "resolved" && !risk.owner_id).length;
    const unassignedMeetingActions = meetingActions.filter((action) => action.status !== "completed" && action.status !== "cancelled" && !action.owner_id && meetings.some((meeting) => meeting.id === action.meeting_id && meeting.plan_id === plan.id)).length;
    const proposedBudget = planBudgets.reduce((sum, budget) => sum + Number(budget.proposed_amount || 0), 0);
    const approvedBudget = planBudgets.reduce((sum, budget) => sum + Number(budget.approved_amount || 0), 0);
    const snapshot = {
      strategy_year: plan.strategy_year, strategy_title: plan.title, generated_at: new Date().toISOString(),
      executive_summary: {
        status: criticalRisks > 0 || overdueRisks > 0 || overdueMeetingActions > 0 || overdueActivities > 0 || delayedActivities > 0 ? "needs_attention" : "no_flagged_critical_risks_overdue_actions_or_delayed_activities",
        status_note: criticalRisks > 0 || overdueRisks > 0 || overdueMeetingActions > 0 || overdueActivities > 0 || delayedActivities > 0 ? "Review critical risks, overdue risk actions, overdue meeting actions, overdue scheduled activities and delayed activities before approving this report. Also assign owners to outstanding items where possible." : "No critical unresolved risks, overdue risk actions, overdue meeting actions, overdue scheduled activities or delayed activities were flagged in the saved records. Check the unassigned-item counts before treating the plan as fully accountable; this is not a substitute for reviewing target attainment.",
        activity_completion_percent: planActivities.length > 0 ? Math.round(completedActivities / planActivities.length * 1000) / 10 : null,
        budget_approval_percent: proposedBudget > 0 ? Math.round(approvedBudget / proposedBudget * 1000) / 10 : null,
        delayed_activities: delayedActivities,
        overdue_activities: overdueActivities,
        critical_risks: criticalRisks,
        overdue_risks: overdueRisks,
        overdue_actions: overdueMeetingActions,
        unassigned_activities: unassignedActivities,
        unassigned_risks: unassignedRisks,
        unassigned_meeting_actions: unassignedMeetingActions,
        unassigned_total: unassignedActivities + unassignedRisks + unassignedMeetingActions,
      },
      objectives: { total: planObjectives.length, achieved: planObjectives.filter((o) => o.status === "achieved").length, at_risk: planObjectives.filter((o) => o.status === "at_risk" || o.status === "behind").length },
      recruitment_targets: planIntakes.reduce((acc, item) => ({ applications: acc.applications + item.target_applications, admissions: acc.admissions + item.target_admissions, registrations: acc.registrations + item.target_registrations }), { applications: 0, admissions: 0, registrations: 0 }),
      live_recruitment_performance: {
        reporting_year: currentYear,
        strategy_year_matches_reporting_year: plan.strategy_year === currentYear,
        data_available: actualsAvailable,
        actuals: actualsAvailable && plan.strategy_year === currentYear ? {
          leads: recruitmentActuals.leads,
          applications: recruitmentActuals.applications,
          admitted: recruitmentActuals.admitted,
          enrolled: recruitmentActuals.enrolled,
        } : null,
        comparison: actualsAvailable && plan.strategy_year === currentYear ? {
          applications: { target: planIntakes.reduce((sum, item) => sum + item.target_applications, 0), actual: recruitmentActuals.applications, variance: recruitmentActuals.applications - planIntakes.reduce((sum, item) => sum + item.target_applications, 0) },
          admissions: { target: planIntakes.reduce((sum, item) => sum + item.target_admissions, 0), actual: recruitmentActuals.admitted, variance: recruitmentActuals.admitted - planIntakes.reduce((sum, item) => sum + item.target_admissions, 0) },
          registrations: { target: planIntakes.reduce((sum, item) => sum + item.target_registrations, 0), actual: recruitmentActuals.enrolled, variance: recruitmentActuals.enrolled - planIntakes.reduce((sum, item) => sum + item.target_registrations, 0) },
        } : null,
        note: !actualsAvailable ? "Live recruitment queries were unavailable when this snapshot was generated; actuals were not recorded." : plan.strategy_year !== currentYear ? "Current-year actuals were not compared with a different strategy year." : "Actuals reflect CRM records created during the reporting calendar year.",
      },
      conversion_metrics: actualsAvailable && plan.strategy_year === currentYear ? {
        lead_to_application_percent: recruitmentActuals.leads > 0 ? Math.round(recruitmentActuals.applications / recruitmentActuals.leads * 1000) / 10 : null,
        application_to_enrolment_percent: recruitmentActuals.applications > 0 ? Math.round(recruitmentActuals.enrolled / recruitmentActuals.applications * 1000) / 10 : null,
        calculation_note: "Based on CRM records created during the reporting calendar year; stage-based counts are operational indicators, not a cohort conversion analysis.",
      } : { available: false, note: "Conversion indicators require current-year live recruitment data and a matching strategy year." },
      activities: {
        total: planActivities.length,
        completed: completedActivities,
        in_progress: planActivities.filter((a) => a.status === "in_progress" || a.status === "in progress").length,
        delayed: delayedActivities,
        not_started: planActivities.filter((a) => a.status === "planned" || a.status === "not_started").length,
        planned_budget_ugx: planActivities.reduce((sum, activity) => sum + Number(activity.budget_amount || 0), 0),
      },
      budget_summary: {
        records: planBudgets.length,
        proposed_ugx: proposedBudget,
        approved_ugx: approvedBudget,
        awaiting_approval: planBudgets.filter((budget) => !["approved", "rejected"].includes(String(budget.status || "").toLowerCase())).length,
      },
      budgets: planBudgets.map((b) => ({ proposed: b.proposed_amount, approved: b.approved_amount, status: b.status })),
      cycle_allocations: planAllocations.map((a) => ({ cycle: a.cycle, proposed: a.proposed_amount, approved: a.approved_amount, status: a.status })),
      risks: { total: planRisks.length, critical: criticalRisks, unresolved: unresolvedRisks },
      weekly_reports: { total: planWeeklyReports.length, submitted: planWeeklyReports.filter((r) => r.status === "submitted").length, approved: planWeeklyReports.filter((r) => r.status === "approved").length },
      approvals: { pending: approvalRequests.filter((r) => r.status === "pending" && r.entity_id === plan.id).length, approved: approvalRequests.filter((r) => r.status === "approved" && r.entity_id === plan.id).length, rejected: approvalRequests.filter((r) => r.status === "rejected" && r.entity_id === plan.id).length },
      meetings: meetings.filter((m) => m.plan_id === plan.id).length,
      meeting_actions: {
        open: openMeetingActions,
        overdue: overdueMeetingActions,
      },
      open_actions: openMeetingActions,
    };
    const { error: saveError } = await supabase.from("strategy_report_history").insert({
      plan_id: plan.id, report_type: "strategy_management_summary", reporting_start: null, reporting_end: new Date().toISOString().slice(0,10),
      version: Number(versions?.[0]?.version ?? 0) + 1, status: "draft", snapshot, recipients: []
    });
    if (saveError) setError("Could not save report snapshot: " + saveError.message);
    else { setNotice("Management report snapshot saved as a new version."); await load(); }
    setSaving(false);
  }

  async function transitionManagementReport(report: ManagementReportHistory, nextStatus: "reviewed" | "approved" | "sent") {
    const allowed: Record<string, string[]> = { draft: ["reviewed"], reviewed: ["approved"], approved: ["sent"] };
    if (!allowed[report.status]?.includes(nextStatus)) { setError("This report cannot move to that status from its current state."); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Please sign in again before updating a report."); return; }
    setSaving(true); setError(""); setNotice("");
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "approved") { patch.approved_by = auth.user.id; patch.approved_at = now; }
    if (nextStatus === "sent") { patch.sent_by = auth.user.id; patch.sent_at = now; patch.provider_status = "manually_confirmed"; }
    const { data: updated, error: updateError } = await supabase.from("strategy_report_history").update(patch).eq("id", report.id).eq("status", report.status).select("id").maybeSingle();
    if (updateError || !updated) {
      setError(updateError ? "Could not update report: " + updateError.message : "The report changed or your account is not authorised to make this transition.");
    } else {
      setNotice(nextStatus === "sent" ? "Delivery confirmation recorded. This is a manual confirmation, not an email-provider receipt." : "Report status updated to " + statusLabel(nextStatus) + ".");
      await load();
    }
    setSaving(false);
  }

  async function saveCycleAllocation() {
    const plan = plans.find((p) => p.strategy_year === currentYear) ?? plans[0];
    const amount = Number(allocationAmount);
    if (!plan) { setError("Create or select an annual strategy plan before allocating a recruitment-cycle budget."); return; }
    if (!allocationAmount.trim() || !Number.isFinite(amount) || amount < 0) { setError("Enter a valid non-negative allocation amount in UGX."); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Please sign in again before saving an allocation."); return; }
    setSaving(true); setError(""); setNotice("");
    const { data: existingAllocation, error: existingError } = await supabase.from("strategy_cycle_allocations").select("id,status").eq("plan_id", plan.id).eq("cycle", allocationCycle).maybeSingle();
    if (existingError) { setError("Could not check the existing allocation: " + existingError.message); setSaving(false); return; }
    if (existingAllocation && ["approved", "submitted", "pending_approval"].includes(existingAllocation.status)) { setError("This cycle allocation is already submitted or approved. Create an approval/revision request instead of overwriting its status."); setSaving(false); return; }
    const { error: saveError } = await supabase.from("strategy_cycle_allocations").upsert({
      plan_id: plan.id, cycle: allocationCycle, proposed_amount: amount, notes: allocationNotes.trim() || null,
      submitted_by: auth.user.id, status: "draft", updated_at: new Date().toISOString()
    }, { onConflict: "plan_id,cycle" });
    if (saveError) setError("Could not save cycle allocation: " + saveError.message);
    else { setAllocationAmount(""); setAllocationNotes(""); setNotice("Recruitment-cycle allocation saved."); await load(); }
    setSaving(false);
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
      meeting_id: meetingId, action: draft.action.trim(), due_date: draft.due_date || null, owner_id: draft.owner_id || null, status: "pending"
    });
    if (saveError) { setError("Could not add meeting action: " + saveError.message); return; }
    setActionDrafts((prev) => ({ ...prev, [meetingId]: { action: "", due_date: "", owner_id: "" } }));
    const { data } = await supabase.from("strategy_meeting_actions").select("id,meeting_id,action,owner_id,due_date,status,notes").order("due_date", { ascending: true }).limit(200);
    setMeetingActions((data ?? []) as MeetingAction[]); setNotice("Meeting action added.");
  }

  async function updateMeetingActionOwner(action: MeetingAction, ownerId: string) {
    setSaving(true); setError(""); setNotice("");
    const { error: saveError } = await supabase.from("strategy_meeting_actions").update({ owner_id: ownerId || null, updated_at: new Date().toISOString() }).eq("id", action.id);
    if (saveError) setError("Could not assign meeting action owner: " + saveError.message);
    else { setMeetingActions((previous) => previous.map((item) => item.id === action.id ? { ...item, owner_id: ownerId || null } : item)); setNotice(ownerId ? "Meeting action owner assigned." : "Meeting action owner cleared."); }
    setSaving(false);
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

  async function updateRiskStatus(risk: StrategyRisk, status: "open" | "resolved") {
    setSaving(true); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("strategy_risks").update({ status }).eq("id", risk.id);
    if (updateError) setError("Could not update risk status: " + updateError.message);
    else { setNotice(status === "resolved" ? "Risk marked as resolved." : "Risk reopened for follow-up."); await load(); }
    setSaving(false);
  }

  async function addRisk() {
    if (!currentPlan || !riskTitle.trim()) return;
    setSaving(true); setError(""); setNotice("");
    const { data: auth } = await supabase.auth.getUser();
    const { error: saveError } = await supabase.from("strategy_risks").insert({ plan_id: currentPlan.id, title: riskTitle.trim(), description: riskDescription.trim() || null, priority: riskPriority, corrective_action: riskAction.trim() || null, due_date: riskDueDate || null, programme: riskProgramme.trim() || null, owner_id: riskOwnerId || null, raised_by: auth.user?.id ?? null });
    if (saveError) setError(saveError.message);
    else { setRiskTitle(""); setRiskDescription(""); setRiskAction(""); setRiskDueDate(""); setRiskProgramme(""); setRiskOwnerId(""); setNotice(riskPriority === "critical" ? "Critical risk recorded. Escalate it to management immediately." : "Risk added to the register."); await load(); }
    setSaving(false);
  }

  async function savePlanDetails() {
    if (!currentPlan || !planTitleDraft.trim() || !strategyPeriodDraft.trim()) { setError("Enter a plan name and strategy period."); return; }
    setSaving(true); setError(""); setNotice("");
    const { error: saveError } = await supabase.from("strategy_plans").update({ title: planTitleDraft.trim(), strategy_period: strategyPeriodDraft.trim(), updated_at: new Date().toISOString() }).eq("id", currentPlan.id);
    if (saveError) setError("Could not save plan details: " + saveError.message);
    else { setNotice("Plan details saved."); await load(); }
    setSaving(false);
  }

  async function addFrameworkEntry() {
    if (!currentPlan) return;
    if (![frameworkDraft.strategic_pillar, frameworkDraft.objectives, frameworkDraft.key_activities, frameworkDraft.channels_tools, frameworkDraft.kpis_targets].some((value) => value.trim())) { setError("Enter at least one field."); return; }
    setSaving(true); setError(""); setNotice("");
    const { error: saveError } = await supabase.from("strategy_framework_entries").insert({ plan_id: currentPlan.id, ...frameworkDraft, sort_order: frameworkEntries.filter((entry) => entry.plan_id === currentPlan.id).length });
    if (saveError) setError("Could not add framework row: " + saveError.message);
    else { setFrameworkDraft({ strategic_pillar: "", objectives: "", key_activities: "", channels_tools: "", kpis_targets: "" }); setNotice("Framework row added."); await load(); }
    setSaving(false);
  }

  async function deleteFrameworkEntry(entry: FrameworkEntry) {
    if (!window.confirm("Delete this general strategy row? Existing intake copies will remain unchanged.")) return;
    setSaving(true); setError(""); setNotice("");
    const { error: deleteError } = await supabase.from("strategy_framework_entries").delete().eq("id", entry.id);
    if (deleteError) setError("Could not delete framework row: " + deleteError.message);
    else { setNotice("Framework row deleted."); await load(); }
    setSaving(false);
  }

  async function ensureIntakePlan() {
    if (!currentPlan) throw new Error("Select an annual strategy plan first.");
    const month = Number(intakeMonth);
    const existing = intakeTargets.find((target) => target.plan_id === currentPlan.id && target.intake_month === month && target.programme === "All programmes");
    if (existing) return existing.id;
    const cycle = month === 2 || month === 4 ? "february" : "august";
    const { data, error: insertError } = await supabase.from("strategy_intake_plans").insert({
      plan_id: currentPlan.id, intake_month: month, cycle, programme: "All programmes",
      intake_strategy: null, target_applications: 0, target_admissions: 0, target_registrations: 0, achieved_registrations: 0,
    }).select("id").single();
    if (insertError || !data) throw new Error(insertError?.message || "Could not prepare intake.");
    return data.id as string;
  }

  async function copyGeneralStrategiesToIntake() {
    setSaving(true); setError(""); setNotice("");
    try {
      const intakePlanId = await ensureIntakePlan();
      const { data: existing, error: existingError } = await supabase.from("strategy_intake_strategy_entries").select("source_framework_entry_id").eq("intake_plan_id", intakePlanId);
      if (existingError) throw new Error(existingError.message);
      const alreadyCopied = new Set((existing ?? []).map((row) => row.source_framework_entry_id).filter((id): id is string => Boolean(id)));
      const toCopy = frameworkEntries.filter((entry) => entry.plan_id === currentPlan?.id && !alreadyCopied.has(entry.id)).map((entry) => ({
        intake_plan_id: intakePlanId, source_framework_entry_id: entry.id, strategic_pillar: entry.strategic_pillar, objectives: entry.objectives,
        key_activities: entry.key_activities, channels_tools: entry.channels_tools, kpis_targets: entry.kpis_targets,
      }));
      if (toCopy.length) {
        const { error: insertError } = await supabase.from("strategy_intake_strategy_entries").insert(toCopy);
        if (insertError) throw new Error(insertError.message);
      }
      setNotice(toCopy.length ? `Copied ${toCopy.length} general strategy row(s) to this intake.` : "All general strategy rows are already copied to this intake.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not copy strategies to intake."); }
    setSaving(false);
  }

  async function addIntakeStrategyEntry() {
    setSaving(true); setError(""); setNotice("");
    try {
      const intakePlanId = await ensureIntakePlan();
      const { error: insertError } = await supabase.from("strategy_intake_strategy_entries").insert({ intake_plan_id: intakePlanId, source_framework_entry_id: null, ...intakeDraft });
      if (insertError) throw new Error(insertError.message);
      setIntakeDraft({ strategic_pillar: "", objectives: "", key_activities: "", channels_tools: "", kpis_targets: "" });
      setNotice("Intake-specific strategy added."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add intake strategy."); }
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

  async function updateActivityStatus(activity: StrategyActivity, status: "planned" | "in_progress" | "completed" | "delayed") {
    setSaving(true); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("strategy_activities").update({ status }).eq("id", activity.id);
    if (updateError) setError("Could not update activity status: " + updateError.message);
    else { setNotice(`Activity “${activity.title}” marked ${statusLabel(status).toLowerCase()}.`); await load(); }
    setSaving(false);
  }

  async function updateActivityOwner(activity: StrategyActivity, ownerId: string) {
    setSaving(true); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("strategy_activities").update({ owner_id: ownerId || null }).eq("id", activity.id);
    if (updateError) setError("Could not assign activity owner: " + updateError.message);
    else { setNotice(ownerId ? `Owner assigned to “${activity.title}”.` : `Owner cleared for “${activity.title}”.`); await load(); }
    setSaving(false);
  }

  async function updateRiskOwner(risk: StrategyRisk, ownerId: string) {
    setSaving(true); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("strategy_risks").update({ owner_id: ownerId || null }).eq("id", risk.id);
    if (updateError) setError("Could not assign risk owner: " + updateError.message);
    else { setNotice(ownerId ? `Owner assigned to risk “${risk.title}”.` : `Owner cleared for risk “${risk.title}”.`); await load(); }
    setSaving(false);
  }

  async function addActivity() {
    if (!currentPlan) { setError("Create or select an annual strategy plan before adding activities."); return; }
    if (!activityTitle.trim()) { setError("Enter an activity title."); return; }
    const parsedActivityBudget = Number(activityBudget);
    if (!activityBudget.trim() || !Number.isFinite(parsedActivityBudget) || parsedActivityBudget < 0) { setError("Enter a valid non-negative activity budget."); return; }
    if (activityStart && activityEnd && activityEnd < activityStart) { setError("Activity end date cannot be before its start date."); return; }
    setSaving(true); setError(""); setNotice("");
    const { data: auth } = await supabase.auth.getUser();
    const { error: saveError } = await supabase.from("strategy_activities").insert({
      plan_id: currentPlan.id, title: activityTitle.trim(), description: activityDescription.trim() || null,
      activity_type: activityType, starts_on: activityStart || null, ends_on: activityEnd || null,
      budget_amount: parsedActivityBudget, owner_id: activityOwnerId || null, created_by: auth.user?.id ?? null,
    });
    if (saveError) setError(saveError.message);
    else { setActivityTitle(""); setActivityDescription(""); setActivityStart(""); setActivityEnd(""); setActivityBudget("0"); setActivityOwnerId(""); setNotice("Activity added to the register."); await load(); }
    setSaving(false);
  }

  async function addIntakeTarget() {
    if (!currentPlan) { setError("Create or select an annual strategy plan before saving intake targets."); return; }
    const targets = [Number(targetApplications), Number(targetAdmissions), Number(targetRegistrations), Number(achievedRegistrations || 0)];
    if ([targetApplications, targetAdmissions, targetRegistrations, achievedRegistrations].some((v) => !v.trim()) || targets.some((v) => !Number.isFinite(v) || v < 0 || !Number.isInteger(v))) {
      setError("Enter whole-number, non-negative values for application, admission, enrolment targets and students enrolled.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const month = Number(intakeMonth);
      const cycle = month === 2 || month === 4 ? "february" : "august";
      const { error: saveError } = await supabase.from("strategy_intake_plans").upsert({
        plan_id: currentPlan.id,
        intake_month: month,
        cycle,
        programme: "All programmes",
        intake_strategy: intakeStrategy.trim() || null,
        achieved_registrations: targets[3],
        target_applications: targets[0],
        target_admissions: targets[1],
        target_registrations: targets[2],
      }, { onConflict: "plan_id,intake_month,programme" });
      if (saveError) {
        setError("Could not save intake targets: " + saveError.message);
      } else {
        setNotice("All-programme intake strategy and targets saved.");
        setIntakeStrategy(""); setTargetApplications("0"); setTargetAdmissions("0"); setTargetRegistrations("0"); setAchievedRegistrations("0");
        await load();
      }
    } catch (cause) {
      setError(cause instanceof Error ? "Could not reach the strategy database while saving intake targets: " + cause.message : "Could not reach the strategy database while saving intake targets. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function updateIntakeAchieved(target: IntakeTarget) {
    const raw = achievedDrafts[target.id] ?? String(target.achieved_registrations ?? 0);
    const value = Number(raw);
    if (!raw.trim() || !Number.isInteger(value) || value < 0) {
      setError("Students enrolled must be a whole number of zero or more.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const { error: saveError } = await supabase.from("strategy_intake_plans")
        .update({ achieved_registrations: value, updated_at: new Date().toISOString() })
        .eq("id", target.id);
      if (saveError) setError("Could not update enrolled students: " + saveError.message);
      else {
        setNotice("Actual enrolled-student number updated.");
        setAchievedDrafts((previous) => ({ ...previous, [target.id]: String(value) }));
        await load();
      }
    } catch (cause) {
      setError(cause instanceof Error ? "Could not reach the strategy database: " + cause.message : "Could not reach the strategy database. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
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
  useEffect(() => { if (currentPlan) { setPlanTitleDraft(currentPlan.title); setStrategyPeriodDraft(currentPlan.strategy_period || `FY ${currentPlan.strategy_year}`); } }, [currentPlan?.id, currentPlan?.title, currentPlan?.strategy_period, currentPlan?.strategy_year]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const attentionActivities = activities.filter((activity) => activity.plan_id === currentPlan?.id && activity.status !== "completed" && (activity.status === "delayed" || Boolean(activity.ends_on && activity.ends_on < todayKey))).sort((a, b) => (a.ends_on || "9999-12-31").localeCompare(b.ends_on || "9999-12-31"));
  const attentionRisks = risks.filter((risk) => risk.plan_id === currentPlan?.id && risk.status !== "resolved" && (risk.priority === "critical" || Boolean(risk.due_date && risk.due_date < todayKey))).sort((a, b) => (a.priority === "critical" ? 0 : 1) - (b.priority === "critical" ? 0 : 1) || (a.due_date || "9999-12-31").localeCompare(b.due_date || "9999-12-31"));
  const attentionActions = meetingActions.filter((action) => action.status !== "completed" && action.status !== "cancelled" && Boolean(action.due_date && action.due_date < todayKey) && meetings.some((meeting) => meeting.id === action.meeting_id && meeting.plan_id === currentPlan?.id)).sort((a, b) => (a.due_date || "9999-12-31").localeCompare(b.due_date || "9999-12-31"));
  const attentionTotal = attentionActivities.length + attentionRisks.length + attentionActions.length;
  const unassignedOwnerTotal = activities.filter((activity) => activity.plan_id === currentPlan?.id && activity.status !== "completed" && !activity.owner_id).length + risks.filter((risk) => risk.plan_id === currentPlan?.id && risk.status !== "resolved" && !risk.owner_id).length + meetingActions.filter((action) => action.status !== "completed" && action.status !== "cancelled" && !action.owner_id && meetings.some((meeting) => meeting.id === action.meeting_id && meeting.plan_id === currentPlan?.id)).length;
  const visibleAttentionTotal = (attentionFilter === "all" || attentionFilter === "activities" ? attentionActivities.length : 0) + (attentionFilter === "all" || attentionFilter === "risks" ? attentionRisks.length : 0) + (attentionFilter === "all" || attentionFilter === "actions" ? attentionActions.length : 0);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">CIU CRM · Strategy & Planning</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Strategy Overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Plan annual objectives, coordinate recruitment cycles, track delivery and prepare management decisions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={createAnnualPlan} disabled={saving || Boolean(currentPlan)} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Saving…" : currentPlan ? `${currentYear} plan exists` : `Create ${currentYear} strategy`}
          </button>
        </div>
      </header>

      <section aria-labelledby="planning-workspaces-heading" className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/60 p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div><h2 id="planning-workspaces-heading" className="text-base font-semibold text-slate-900">Planning workspaces</h2><p className="mt-1 text-xs text-slate-600">Choose an area to open only the register you need. Your data and workflows stay in place.</p></div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-100">9 workspaces</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map(([title, description], index) => {
            const keys = ["general", "intakes", "activities", "budget", "performance", "weekly", "risks", "approvals", "reports"] as const;
            const key = keys[index];
            const selected = activeWorkspace === key;
            return <button key={title} type="button" aria-pressed={selected} onClick={() => { setActiveWorkspace(key); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`group flex min-h-[88px] items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${selected ? "border-emerald-700 bg-emerald-800 text-white shadow-sm" : "border-slate-200 bg-white text-slate-900 hover:border-emerald-300"}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold ${selected ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-800 group-hover:bg-emerald-100"}`}>{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className={`mt-1 block text-xs leading-5 ${selected ? "text-emerald-50" : "text-slate-500"}`}>{description}</span><span className={`mt-2 block text-[11px] font-semibold ${selected ? "text-white" : "text-emerald-800"}`}>{selected ? "Currently open ✓" : "Open workspace →"}</span></span>
            </button>;
          })}
        </div>
      </section>
      {currentPlan && (
        <section aria-label="Attention required" className={`overflow-hidden rounded-xl border ${attentionTotal ? "border-amber-200 bg-amber-50/40" : "border-emerald-200 bg-emerald-50/30"} shadow-sm transition-all duration-200`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/70 px-4 py-3 sm:px-5">
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold text-slate-900">Attention required</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${attentionTotal ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>{attentionTotal} item{attentionTotal === 1 ? "" : "s"}</span></div><p className="mt-1 text-xs text-slate-600">Prioritised follow-up for overdue strategic delivery, critical risks and late management actions.</p><p className="mt-1 text-xs text-amber-800">{unassignedOwnerTotal} outstanding item{unassignedOwnerTotal === 1 ? "" : "s"} without an accountable owner.</p></div>
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh queue"}</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/70 px-4 py-3 sm:px-5" role="group" aria-label="Filter attention items">
          {([{ value: "all", label: `All items (${attentionTotal})` }, { value: "activities", label: `Activities (${attentionActivities.length})` }, { value: "risks", label: `Risks (${attentionRisks.length})` }, { value: "actions", label: `Meeting actions (${attentionActions.length})` }] as const).map((filter) => <button key={filter.value} type="button" onClick={() => setAttentionFilter(filter.value)} aria-pressed={attentionFilter === filter.value} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${attentionFilter === filter.value ? "border-emerald-800 bg-emerald-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800"}`}>{filter.label}</button>)}
        </div>
        {visibleAttentionTotal === 0 ? <div className="flex items-center gap-3 px-4 py-4 sm:px-5"><span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-800">✓</span><div><p className="text-sm font-medium text-slate-800">{attentionTotal === 0 ? "No flagged items for this strategy year" : "No items in this filter"}</p><p className="mt-1 text-xs text-slate-600">Completed items are excluded. Keep dates and risk/action statuses up to date.</p></div></div> : <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3 sm:p-4">
          {(attentionFilter === "all" || attentionFilter === "activities") && attentionActivities.map((activity) => <a key={`activity-${activity.id}`} href="#strategy-activities" className="group rounded-lg border border-amber-200 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-sm"><div className="flex items-start justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-amber-800">{activity.status === "delayed" ? "Marked delayed" : "Activity overdue"}</span><span className="text-xs text-emerald-800 transition-transform group-hover:translate-x-0.5">Review →</span></div><p className="mt-1 text-sm font-semibold text-slate-900">{activity.title}</p>{activity.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{activity.description}</p>}<p className="mt-2 text-xs text-slate-500">{activity.ends_on ? `Due ${new Date(activity.ends_on + "T00:00:00").toLocaleDateString()}` : "Delivery date needs review"} · {statusLabel(activity.status)}</p><p className="mt-1 text-[10px] text-slate-400">Strategic activity · Owner: {activity.owner_id ? (strategyProfileNames[activity.owner_id] || "Assigned staff member") : "Unassigned"}</p></a>)}
          {(attentionFilter === "all" || attentionFilter === "risks") && attentionRisks.map((risk) => <a key={`risk-${risk.id}`} href="#strategy-risks" className="group rounded-lg border border-amber-200 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-sm"><div className="flex items-start justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-amber-800">{risk.priority === "critical" ? "Critical risk" : "Risk action overdue"}</span><span className="text-xs text-emerald-800 transition-transform group-hover:translate-x-0.5">Review →</span></div><p className="mt-1 text-sm font-semibold text-slate-900">{risk.title}</p>{risk.corrective_action && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">Action: {risk.corrective_action}</p>}<p className="mt-2 text-xs text-slate-500">{risk.due_date ? `Due ${new Date(risk.due_date + "T00:00:00").toLocaleDateString()}` : "No deadline recorded"} · {statusLabel(risk.status)}</p><p className="mt-1 text-[10px] text-slate-400">Priority: {statusLabel(risk.priority)} · Owner: {risk.owner_id ? (strategyProfileNames[risk.owner_id] || "Assigned staff member") : "Unassigned"}</p></a>)}
          {(attentionFilter === "all" || attentionFilter === "actions") && attentionActions.map((action) => <a key={`action-${action.id}`} href="#meeting-actions" className="group rounded-lg border border-amber-200 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-sm"><div className="flex items-start justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Meeting action overdue</span><span className="text-xs text-emerald-800 transition-transform group-hover:translate-x-0.5">Review →</span></div><p className="mt-1 text-sm font-semibold text-slate-900">{action.action}</p>{action.notes && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{action.notes}</p>}<p className="mt-2 text-xs text-slate-500">Due {action.due_date ? new Date(action.due_date + "T00:00:00").toLocaleDateString() : "date not recorded"}</p><p className="mt-1 text-[10px] text-slate-400">Meeting action · {statusLabel(action.status)} · Owner: {action.owner_id ? (strategyProfileNames[action.owner_id] || "Assigned staff member") : "Unassigned"}</p></a>)}
        </div>}
        </section>
      )}


      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Annual plans", String(plans.length), "Plans across all years"],
          ["Strategy rows", String(objectiveCount), "General framework rows"],
          ["Activities", String(activityCount), "Delivery register records"],
          ["Intake strategies", String(intakeCount), "Intake workspaces"],
        ].map(([label, value, caption]) => {
          const destination = label === "Annual plans" ? "performance" : label === "Objectives" ? "general" : label === "Activities" ? "activities" : "intakes";
          return (
            <button type="button" key={label} onClick={() => setActiveWorkspace(destination as typeof activeWorkspace)} className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2">
              <p className="text-sm font-medium text-slate-600">{label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 transition-colors group-hover:text-emerald-800">{loading ? "—" : value}</p>
              <p className="mt-1 text-xs text-slate-500">{caption}</p>
              <p className="mt-3 text-[11px] font-semibold text-emerald-800">View details →</p>
            </button>
          );
        })}
      </section>

      <section id="strategy-team-responsibilities" hidden={activeWorkspace !== "general"} className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900">Marketing team responsibilities</h2>
          <p className="mt-1 text-xs text-slate-500">Working ownership map for planning and coordination. These role labels do not grant CRM permissions or create staff accounts.</p>
        </div>
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { name: "Nicholas", role: "Marketing Manager", detail: "Owns marketing strategy, campaign priorities, performance reviews, coordination and management reporting." },
            { name: "Arnold", role: "Website & Graphics", detail: "Owns website updates, design and graphics, brochures, digital collateral and creative support for campaigns." },
            { name: "Vivian", role: "Alumni & Partnerships", detail: "Coordinates alumni engagement, institutional partnerships, scholarship-organisation follow-ups and related activities." },
            { name: "Meshack", role: "Outreach & Enquiries", detail: "Coordinates school activations and outreach, and supports responses to WhatsApp and phone enquiries." },
            { name: "Monica", role: "Call Centre & Enrollment", detail: "Planned new team member responsible for call-centre operations and enrollment follow-up; account/onboarding is pending." },
          ].map((member) => (
            <article key={member.name} className="bg-white p-4 transition-colors duration-200 hover:bg-emerald-50/50">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{member.name}</h3>
                {member.name === "Monica" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Planned</span>}
              </div>
              <p className="mt-1 text-xs font-medium text-emerald-800">{member.role}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{member.detail}</p>
            </article>
          ))}
        </div>
      </section>

      {currentPlan && (
        <section hidden={activeWorkspace !== "general" && activeWorkspace !== "intakes"} className="grid gap-5">
          <div id="strategy-objectives" hidden={activeWorkspace !== "general"} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">General Strategy Framework</h2><p className="mt-1 text-xs text-slate-500">Enter the approved plan structure. Financial amounts belong in Budget Planning, not in this framework.</p></div>
            <form onSubmit={(event) => { event.preventDefault(); void savePlanDetails(); }} className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-slate-700">Plan<input required value={planTitleDraft} onChange={(e) => setPlanTitleDraft(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Annual Marketing Strategy" /></label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">Strategy period<input required value={strategyPeriodDraft} onChange={(e) => setStrategyPeriodDraft(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="e.g. January–December 2026 or FY 2026/27" /></label>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2"><p className="text-xs text-slate-500">Budget: managed separately in the <button type="button" onClick={() => setActiveWorkspace("budget")} className="font-semibold text-emerald-800 underline underline-offset-2">Budget Planning</button> workspace.</p><button disabled={saving} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save plan details"}</button></div>
            </form>
            <form onSubmit={(event) => { event.preventDefault(); void addFrameworkEntry(); }} className="grid gap-3 border-b border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Add strategic framework row</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="grid gap-1 text-xs font-medium text-slate-700">Strategic Pillar<textarea value={frameworkDraft.strategic_pillar} onChange={(e) => setFrameworkDraft({ ...frameworkDraft, strategic_pillar: e.target.value })} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Strategic pillar" /></label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">Objectives<textarea value={frameworkDraft.objectives} onChange={(e) => setFrameworkDraft({ ...frameworkDraft, objectives: e.target.value })} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Objectives" /></label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">Key Activities<textarea value={frameworkDraft.key_activities} onChange={(e) => setFrameworkDraft({ ...frameworkDraft, key_activities: e.target.value })} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Key activities" /></label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">Channels/Tools<textarea value={frameworkDraft.channels_tools} onChange={(e) => setFrameworkDraft({ ...frameworkDraft, channels_tools: e.target.value })} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Channels and tools" /></label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">KPIs/Targets<textarea value={frameworkDraft.kpis_targets} onChange={(e) => setFrameworkDraft({ ...frameworkDraft, kpis_targets: e.target.value })} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="KPIs and targets (optional until set)" /></label>
              </div>
              <button disabled={saving} className="w-fit rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Add framework row"}</button>
            </form>
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600"><tr>{["Strategic Pillar","Objectives","Key Activities","Channels/Tools","KPIs/Targets",""].map((h) => <th key={h} className="border-b border-slate-200 px-3 py-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{frameworkEntries.filter((entry) => entry.plan_id === currentPlan.id).map((entry) => <tr key={entry.id} className="align-top hover:bg-slate-50/70"><td className="max-w-[190px] whitespace-pre-wrap px-3 py-3 font-semibold text-slate-900">{entry.strategic_pillar || "—"}</td><td className="max-w-[220px] whitespace-pre-wrap px-3 py-3 text-slate-700">{entry.objectives || "—"}</td><td className="max-w-[260px] whitespace-pre-wrap px-3 py-3 text-slate-700">{entry.key_activities || "—"}</td><td className="max-w-[200px] whitespace-pre-wrap px-3 py-3 text-slate-700">{entry.channels_tools || "—"}</td><td className="max-w-[180px] whitespace-pre-wrap px-3 py-3 text-slate-700">{entry.kpis_targets || "—"}</td><td className="px-3 py-3"><button type="button" onClick={() => void deleteFrameworkEntry(entry)} className="font-semibold text-rose-700 hover:underline">Delete</button></td></tr>)}</tbody>
              </table>
              {frameworkEntries.filter((entry) => entry.plan_id === currentPlan.id).length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No strategic pillars added yet. Use the form above to build the plan row by row.</p>}
            </div>
          </div>
          <div id="intake-plans" hidden={activeWorkspace !== "intakes"} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Intake Strategies</h2><p className="mt-1 text-xs text-slate-500">Select an intake, copy relevant rows from the General Strategy Framework, then add intake-specific strategies. Recruitment figures are managed separately.</p></div>
            <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="grid gap-1 text-xs font-medium text-slate-700">Intake<select value={intakeMonth} onChange={(e) => setIntakeMonth(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="2">February</option><option value="4">April</option><option value="8">August</option><option value="11">November</option></select></label>
              <button type="button" onClick={() => void copyGeneralStrategiesToIntake()} disabled={saving || frameworkEntries.filter((entry) => entry.plan_id === currentPlan.id).length === 0} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Working…" : "Copy general strategies to intake"}</button>
            </div>
            {(() => { const target = intakeTargets.find((item) => item.plan_id === currentPlan.id && item.intake_month === Number(intakeMonth)); const entries = intakeStrategyEntries.filter((entry) => entry.intake_plan_id === target?.id); return <><div className="divide-y divide-slate-100">{entries.map((entry) => <article key={entry.id} className="grid gap-2 p-4 md:grid-cols-5"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Strategic Pillar</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">{entry.strategic_pillar || "—"}</p>{entry.source_framework_entry_id && <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">Copied from general strategy</span>}</div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Objectives</p><p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{entry.objectives || "—"}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Key Activities</p><p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{entry.key_activities || "—"}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Channels/Tools</p><p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{entry.channels_tools || "—"}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">KPIs/Targets</p><p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{entry.kpis_targets || "—"}</p></div></article>)}{entries.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">No strategies attached to this intake yet. Copy the general framework above or add an intake-specific strategy below.</p>}</div>
            <form onSubmit={(event) => { event.preventDefault(); void addIntakeStrategyEntry(); }} className="grid gap-3 border-t border-slate-200 bg-slate-50/60 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Add intake-specific strategy</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="grid gap-1 text-xs font-medium text-slate-700">Strategic Pillar<textarea value={intakeDraft.strategic_pillar} onChange={(e) => setIntakeDraft({ ...intakeDraft, strategic_pillar: e.target.value })} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">Objectives<textarea value={intakeDraft.objectives} onChange={(e) => setIntakeDraft({ ...intakeDraft, objectives: e.target.value })} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">Key Activities<textarea value={intakeDraft.key_activities} onChange={(e) => setIntakeDraft({ ...intakeDraft, key_activities: e.target.value })} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">Channels/Tools<textarea value={intakeDraft.channels_tools} onChange={(e) => setIntakeDraft({ ...intakeDraft, channels_tools: e.target.value })} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">KPIs/Targets<textarea value={intakeDraft.kpis_targets} onChange={(e) => setIntakeDraft({ ...intakeDraft, kpis_targets: e.target.value })} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
              </div><button disabled={saving} className="w-fit rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Add intake strategy"}</button>
            </form></>; })()}
          </div>
        </section>
      )}

      <section id="strategy-live-performance" hidden={activeWorkspace !== "performance"} className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Live Recruitment Performance · {currentYear}</h2>
            <p className="mt-1 text-xs text-slate-500">Actuals are calculated from CRM lead and admission records created during the calendar year. No duplicate data entry is required.</p>
          </div>
          <a href="/reports" className="rounded-lg border border-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50">Open Reports →</a>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          {[
            { label: "Leads recorded", value: recruitmentActuals.leads, target: null },
            { label: "Applications", value: recruitmentActuals.applications, target: intakeTargets.filter((item) => item.plan_id === currentPlan?.id).reduce((sum, item) => sum + item.target_applications, 0) },
            { label: "Admitted", value: recruitmentActuals.admitted, target: intakeTargets.filter((item) => item.plan_id === currentPlan?.id).reduce((sum, item) => sum + item.target_admissions, 0) },
            { label: "Enrolled", value: recruitmentActuals.enrolled, target: intakeTargets.filter((item) => item.plan_id === currentPlan?.id).reduce((sum, item) => sum + item.target_registrations, 0) },
          ].map((metric) => (
            <article key={metric.label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white hover:shadow-sm">
              <p className="text-xs font-medium text-slate-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{loading || !actualsAvailable ? "—" : metric.value.toLocaleString()}</p>
              {metric.target !== null && <p className="mt-1 text-xs text-slate-500">Plan target: {metric.target.toLocaleString()}</p>}
              {metric.target !== null && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-700 transition-all duration-500" style={{ width: `${metric.target > 0 ? Math.min(100, metric.value / metric.target * 100) : 0}%` }} /></div>}
            </article>
          ))}
        </div>
        {!loading && !actualsAvailable && <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">Live actuals could not be loaded from the CRM records available to this account. Values are hidden rather than incorrectly reported as zero.</p>}
        {currentPlan && currentPlan.strategy_year !== currentYear && <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">The selected strategy is for {currentPlan.strategy_year}; live actuals above are for {currentYear}. Targets are shown for the selected plan, so compare only when the years match.</p>}
      </section>

      <section id="annual-strategy-register" hidden={activeWorkspace !== "performance"} className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.85fr)]">
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
                <article key={plan.id} className={`flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${currentPlan?.id === plan.id ? "bg-emerald-50/50" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{plan.title}</p>
                    <p className="mt-1 text-xs text-slate-500">Strategy period: {plan.strategy_period || `FY ${plan.strategy_year}`}</p>
                    <p className="mt-1 text-xs text-slate-500">{frameworkEntries.filter((entry) => entry.plan_id === plan.id).length} strategic rows · {activities.filter((a) => a.plan_id === plan.id).length} activity records · {intakeStrategyEntries.filter((entry) => intakeTargets.some((target) => target.plan_id === plan.id && target.id === entry.intake_plan_id)).length} intake strategy rows</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${plan.status === "approved" ? "bg-emerald-100 text-emerald-800" : plan.status === "pending_approval" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{statusLabel(plan.status)}</span><button type="button" onClick={() => { setCurrentYear(plan.strategy_year); window.setTimeout(() => document.getElementById("strategy-objectives")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }} className="rounded-lg border border-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">{currentPlan?.id === plan.id ? "Selected" : "View plan"}</button></div>
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
        <section id="strategy-activities" hidden={activeWorkspace !== "activities"} className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Activity register</h2><p className="mt-1 text-xs text-slate-500">Plan strategic activities, delivery dates and budget estimates. Operational follow-up tasks remain in the Call Centre Tasks module.</p></div>
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 md:grid-cols-3"><article className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Call centre</p><p className="mt-1 text-sm font-medium text-slate-900">Lead follow-up & conversion</p><p className="mt-1 text-xs leading-5 text-slate-600">Use Call Centre Tasks for day-to-day inquiry calls, WhatsApp responses and applicant follow-ups. This register is for the strategic campaign or workstream plan, not individual call tasks.</p></article><article className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Alumni</p><p className="mt-1 text-sm font-medium text-slate-900">Engagement & referrals</p><p className="mt-1 text-xs leading-5 text-slate-600">Plan alumni events, graduate stories and referral campaigns here. Manage alumni profiles and engagement records in the Alumni module; Vivian coordinates this workstream.</p></article><article className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Partnerships</p><p className="mt-1 text-sm font-medium text-slate-900">Partner pipeline & activation</p><p className="mt-1 text-xs leading-5 text-slate-600">Track partner outreach, scholarship organisations, employer/community links, next actions and outcomes. Vivian coordinates follow-up.</p></article></div>
          <form onSubmit={(event) => { event.preventDefault(); void addActivity(); }} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-1 text-xs font-medium text-slate-700">Activity title<input required value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="e.g. Secondary school activation" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Activity type<select value={activityType} onChange={(e) => setActivityType(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option>Call centre</option><option>Lead conversion</option><option>Alumni engagement</option><option>Partnerships</option><option>Outreach</option><option>Community outreach</option><option>Digital marketing</option><option>Referral marketing</option><option>Event</option><option>School visit</option><option>Follow-up</option><option>Other</option></select></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Estimated budget (UGX)<input type="number" min="0" value={activityBudget} onChange={(e) => setActivityBudget(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Accountable owner<select value={activityOwnerId} onChange={(e) => setActivityOwnerId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">Unassigned</option>{strategyStaff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Start date<input type="date" value={activityStart} onChange={(e) => setActivityStart(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">End date<input type="date" value={activityEnd} onChange={(e) => setActivityEnd(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700 md:col-span-2 xl:col-span-1">Description<textarea value={activityDescription} onChange={(e) => setActivityDescription(e.target.value)} rows={1} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <div><button disabled={saving} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Add activity"}</button></div>
          </form>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-4"><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Activities</p><p className="mt-1 text-xl font-semibold text-slate-900">{activities.filter((a) => a.plan_id === currentPlan.id).length}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Completed</p><p className="mt-1 text-xl font-semibold text-emerald-700">{activities.filter((a) => a.plan_id === currentPlan.id && a.status === "completed").length}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Delayed</p><p className="mt-1 text-xl font-semibold text-rose-700">{activities.filter((a) => a.plan_id === currentPlan.id && a.status === "delayed").length}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Planned budget</p><p className="mt-1 text-lg font-semibold text-slate-900">UGX {activities.filter((a) => a.plan_id === currentPlan.id).reduce((n, a) => n + Number(a.budget_amount || 0), 0).toLocaleString("en-UG")}</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Activity</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Dates</th><th className="px-4 py-3 text-right font-medium">Budget (UGX)</th><th className="px-4 py-3 font-medium">Accountable owner</th><th className="px-4 py-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{activities.filter((a) => a.plan_id === currentPlan.id).map((a) => <tr key={a.id}><td className="px-4 py-3"><p className="font-medium text-slate-900">{a.title}</p>{a.description && <p className="mt-1 max-w-sm text-xs text-slate-500">{a.description}</p>}</td><td className="px-4 py-3 text-slate-600">{a.activity_type || "—"}</td><td className="px-4 py-3 text-xs text-slate-600">{a.starts_on || "Not set"} – {a.ends_on || "Not set"}</td><td className="px-4 py-3 text-right tabular-nums">{Number(a.budget_amount || 0).toLocaleString("en-UG")}</td><td className="px-4 py-3"><select aria-label={`Assign owner for ${a.title}`} value={a.owner_id || ""} disabled={saving} onChange={(e) => void updateActivityOwner(a, e.target.value)} className="min-w-40 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:opacity-50"><option value="">Unassigned</option>{strategyStaff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></td><td className="px-4 py-3"><div className="grid min-w-36 gap-2"><span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ${a.status === "completed" ? "bg-emerald-50 text-emerald-800" : a.status === "delayed" ? "bg-rose-50 text-rose-800" : a.status === "in_progress" || a.status === "in progress" ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-700"}`}>{statusLabel(a.status)}</span><select aria-label={`Update status for ${a.title}`} value={a.status === "in progress" ? "in_progress" : a.status} disabled={saving} onChange={(e) => void updateActivityStatus(a, e.target.value as "planned" | "in_progress" | "completed" | "delayed")} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:opacity-50"><option value="planned">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="delayed">Delayed</option></select></div></td></tr>)}</tbody></table>{activities.filter((a) => a.plan_id === currentPlan.id).length === 0 && <p className="px-4 py-5 text-xs text-slate-500">No activities recorded yet.</p>}</div>
        </section>
      )}


      {currentPlan && (
        <section hidden={activeWorkspace !== "budget" && activeWorkspace !== "risks"} className="grid gap-5 xl:grid-cols-2">
        <div hidden={activeWorkspace !== "budget"} className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Annual budget planning</h2><p className="mt-1 text-xs text-slate-500">Track approved allocations, proposed budgets and actual expenditure separately.</p></div><div className="mx-4 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-950"><p className="font-semibold">Approved 2026 budget · UGX 300,000,000</p><p className="mt-1">Source: uploaded general strategy document. Approved for charter branding and CRM implementation. This is the approved budget allocation, not a statement of actual expenditure; record actual spending separately.</p></div>
          <form onSubmit={(e) => { e.preventDefault(); void submitBudget(); }} className="grid gap-3 p-4">
            <label className="grid gap-1 text-xs font-medium text-slate-700">Proposed annual budget (UGX)<input required type="number" min="0" step="1000" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Notes / assumptions<textarea value={budgetNotes} onChange={(e) => setBudgetNotes(e.target.value)} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <button disabled={saving} className="w-fit rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Submit for approval"}</button>
          </form>
          <div className="divide-y divide-slate-100">{budgets.filter((b) => b.plan_id === currentPlan.id).map((b) => <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-semibold text-slate-900">UGX {Number(b.proposed_amount).toLocaleString("en-UG")}</p><p className="mt-1 text-xs text-slate-500">{b.notes || "No notes"}{b.approved_amount != null ? ` · Approved: UGX ${Number(b.approved_amount).toLocaleString("en-UG")}` : ""}</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">{statusLabel(b.status)}</span></div>)}{budgets.filter((b) => b.plan_id === currentPlan.id).length === 0 && <p className="px-4 py-4 text-xs text-slate-500">No annual budget submitted.</p>}</div>
        </div>
        <div id="strategy-risks" hidden={activeWorkspace !== "risks"} className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Risks & corrective actions</h2><p className="mt-1 text-xs text-slate-500">Record risk mitigation and due dates. Critical risks require immediate management escalation.</p></div>
          <form onSubmit={(e) => { e.preventDefault(); void addRisk(); }} className="grid gap-3 p-4">
            <label className="grid gap-1 text-xs font-medium text-slate-700">Risk title<input required value={riskTitle} onChange={(e) => setRiskTitle(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Description<textarea value={riskDescription} onChange={(e) => setRiskDescription(e.target.value)} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-xs font-medium text-slate-700">Priority<select value={riskPriority} onChange={(e) => setRiskPriority(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className="grid gap-1 text-xs font-medium text-slate-700">Action due date<input type="date" value={riskDueDate} onChange={(e) => setRiskDueDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label></div>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Corrective action<textarea value={riskAction} onChange={(e) => setRiskAction(e.target.value)} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Programme (optional)<input value={riskProgramme} onChange={(e) => setRiskProgramme(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Accountable owner<select value={riskOwnerId} onChange={(e) => setRiskOwnerId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">Unassigned</option>{strategyStaff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
            <button disabled={saving} className="w-fit rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Record risk"}</button>
          </form>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-4"><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Active risks</p><p className="mt-1 text-xl font-semibold text-slate-900">{risks.filter((r) => r.plan_id === currentPlan.id && r.status !== "resolved").length}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Critical risks</p><p className="mt-1 text-xl font-semibold text-rose-700">{risks.filter((r) => r.plan_id === currentPlan.id && r.priority === "critical" && r.status !== "resolved").length}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Past due</p><p className="mt-1 text-xl font-semibold text-amber-700">{risks.filter((r) => r.plan_id === currentPlan.id && r.status !== "resolved" && r.due_date && r.due_date < new Date().toISOString().slice(0, 10)).length}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Mitigation coverage</p><p className="mt-1 text-xl font-semibold text-slate-900">{risks.filter((r) => r.plan_id === currentPlan.id && r.status !== "resolved" && Boolean(r.corrective_action?.trim())).length}/{risks.filter((r) => r.plan_id === currentPlan.id && r.status !== "resolved").length}</p></div></div><div className="divide-y divide-slate-100">{risks.filter((r) => r.plan_id === currentPlan.id).map((r) => <div key={r.id} className="px-4 py-3 transition-colors hover:bg-slate-50"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{r.title}</p><span className={`rounded-full px-2 py-1 text-xs font-semibold ${r.priority === "critical" ? "bg-red-100 text-red-800" : r.priority === "high" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{statusLabel(r.priority)}</span></div>{r.corrective_action && <p className="mt-1 text-xs text-slate-600">Action: {r.corrective_action}</p>}<p className="mt-1 text-xs text-slate-500">Due: {r.due_date || "Not set"} · {statusLabel(r.status)}{r.programme ? ` · ${r.programme}` : ""}</p>{r.description && <p className="mt-1 text-xs text-slate-500">{r.description}</p>}<div className="mt-2 flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-xs text-slate-600">Owner<select aria-label={`Assign owner for risk ${r.title}`} value={r.owner_id || ""} disabled={saving} onChange={(e) => void updateRiskOwner(r, e.target.value)} className="max-w-48 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:opacity-50"><option value="">Unassigned</option>{strategyStaff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>{r.status === "resolved" ? <button type="button" disabled={saving} onClick={() => void updateRiskStatus(r, "open")} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50 disabled:opacity-50">Reopen risk</button> : <button type="button" disabled={saving} onClick={() => void updateRiskStatus(r, "resolved")} className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 disabled:opacity-50">Mark resolved</button>}<a href="#strategy-management-reports" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100">Review in management report ↗</a></div></div>)}{risks.filter((r) => r.plan_id === currentPlan.id).length === 0 && <p className="px-4 py-4 text-xs text-slate-500">No risks recorded.</p>}</div>
        </div>
        </section>
      )}


      <section id="weekly-reports" hidden={activeWorkspace !== "weekly"} className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
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
        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-4"><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Reports listed</p><p className="mt-1 text-xl font-semibold text-slate-900">{weeklyReports.length}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Awaiting review</p><p className="mt-1 text-xl font-semibold text-amber-700">{weeklyReports.filter((r) => ["submitted","reviewed"].includes(r.status)).length}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Approved</p><p className="mt-1 text-xl font-semibold text-emerald-700">{weeklyReports.filter((r) => r.status === "approved").length}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Returned</p><p className="mt-1 text-xl font-semibold text-rose-700">{weeklyReports.filter((r) => r.status === "returned_for_revision").length}</p></div></div><div className="overflow-x-auto border-t border-slate-200"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Period</th><th className="px-4 py-3 font-medium">Work summary</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Submitted</th><th className="px-4 py-3 font-medium">Review notes</th><th className="px-4 py-3 font-medium">Management review</th></tr></thead><tbody className="divide-y divide-slate-100">{weeklyReports.map((r) => <tr key={r.id} className="transition-colors hover:bg-slate-50"><td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">{r.reporting_start} – {r.reporting_end}</td><td className="px-4 py-3"><p className="max-w-md whitespace-pre-wrap text-sm text-slate-800">{r.completed_work}</p></td><td className="px-4 py-3 text-xs">{statusLabel(r.status)}</td><td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</td><td className="px-4 py-3 text-xs text-slate-600">{r.reviewer_comments || "—"}</td><td className="min-w-64 px-4 py-3"><textarea value={weeklyReviewComments[r.id] ?? ""} onChange={(e) => setWeeklyReviewComments((prev) => ({...prev, [r.id]: e.target.value}))} placeholder="Review comment (required to return)" rows={2} className="mb-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs" disabled={weeklyReviewBusy === r.id || r.status === "approved"} /><div className="flex flex-wrap gap-2"><button type="button" disabled={weeklyReviewBusy === r.id || !["submitted","reviewed","returned_for_revision"].includes(r.status)} onClick={() => void reviewWeeklyReport(r, "approved")} className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{weeklyReviewBusy === r.id ? "Saving…" : "Approve"}</button><button type="button" disabled={weeklyReviewBusy === r.id || !["submitted","reviewed","returned_for_revision"].includes(r.status)} onClick={() => void reviewWeeklyReport(r, "returned_for_revision")} className="rounded-md border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-40">Return for revision</button></div></td></tr>)}</tbody></table>{weeklyReports.length === 0 && <p className="px-4 py-5 text-xs text-slate-500">No weekly reports available to this account.</p>}</div>
      </section>

      <section id="meeting-actions" hidden={activeWorkspace !== "weekly"} className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Monday Meetings & Action Tracker</h2><p className="mt-1 text-xs text-slate-500">Schedule management meetings, record minutes and track decisions through to completion.</p></div>
        <form onSubmit={(e) => { e.preventDefault(); void createMeeting(); }} className="grid gap-3 p-4 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-slate-700">Meeting title<input value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} required className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">Date and time<input type="datetime-local" value={meetingAt} onChange={(e) => setMeetingAt(e.target.value)} required className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-700 md:col-span-2">Minutes / key decisions<textarea value={meetingMinutes} onChange={(e) => setMeetingMinutes(e.target.value)} rows={3} placeholder="Agenda outcomes, decisions, attendance and follow-up notes" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
          <button disabled={saving} className="w-fit rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Schedule meeting"}</button>
        </form>
        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-3"><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Meetings recorded</p><p className="mt-1 text-xl font-semibold text-slate-900">{meetings.length}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Open actions</p><p className="mt-1 text-xl font-semibold text-amber-700">{meetingActions.filter((a) => !["completed","cancelled"].includes(a.status)).length}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Completed actions</p><p className="mt-1 text-xl font-semibold text-emerald-700">{meetingActions.filter((a) => a.status === "completed").length}</p></div></div><div className="divide-y divide-slate-100">
          {meetings.map((meeting) => <article key={meeting.id} className="p-4 transition-colors hover:bg-slate-50">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold text-slate-900">{meeting.title}</h3><p className="mt-1 text-xs text-slate-500">{new Date(meeting.meeting_at).toLocaleString()}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{meetingActions.filter((a) => a.meeting_id === meeting.id && a.status === "completed").length}/{meetingActions.filter((a) => a.meeting_id === meeting.id).length} actions complete</span></div>
            {meeting.minutes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{meeting.minutes}</p>}
            <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_minmax(150px,190px)_auto]">
              <input value={actionDrafts[meeting.id]?.action || ""} onChange={(e) => setActionDrafts((prev) => ({ ...prev, [meeting.id]: { action: e.target.value, due_date: prev[meeting.id]?.due_date || "", owner_id: prev[meeting.id]?.owner_id || "" } }))} placeholder="Action to follow up" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="date" aria-label="Action due date" value={actionDrafts[meeting.id]?.due_date || ""} onChange={(e) => setActionDrafts((prev) => ({ ...prev, [meeting.id]: { action: prev[meeting.id]?.action || "", due_date: e.target.value, owner_id: prev[meeting.id]?.owner_id || "" } }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select aria-label="Accountable owner for new meeting action" value={actionDrafts[meeting.id]?.owner_id || ""} onChange={(e) => setActionDrafts((prev) => ({ ...prev, [meeting.id]: { action: prev[meeting.id]?.action || "", due_date: prev[meeting.id]?.due_date || "", owner_id: e.target.value } }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Unassigned owner</option>{strategyStaff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select>
              <button type="button" onClick={() => void addMeetingAction(meeting.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Add action</button>
            </div>
            <div className="mt-3 space-y-2">{meetingActions.filter((a) => a.meeting_id === meeting.id).map((action) => <div key={action.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"><div><p className="text-sm text-slate-800">{action.action}</p><p className="mt-1 text-xs text-slate-500">Due {action.due_date || "not set"} · {statusLabel(action.status)} · Owner: {action.owner_id ? (strategyProfileNames[action.owner_id] || "Assigned staff member") : "Unassigned"}</p></div><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-1.5 text-xs text-slate-500">Owner<select aria-label={`Assign owner for meeting action ${action.action}`} value={action.owner_id || ""} disabled={saving} onChange={(e) => void updateMeetingActionOwner(action, e.target.value)} className="max-w-44 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:opacity-50"><option value="">Unassigned</option>{strategyStaff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>{action.status !== "completed" && <div className="flex gap-2">{action.status === "pending" && <button type="button" onClick={() => void updateMeetingAction(action, "in_progress")} className="rounded-md border px-2 py-1 text-xs">Start</button>}<button type="button" onClick={() => void updateMeetingAction(action, "completed")} className="rounded-md bg-emerald-800 px-2 py-1 text-xs font-semibold text-white">Complete</button></div>}</div></div>)}</div>
          </article>)}
          {meetings.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">No meetings recorded yet. Schedule the next Monday management meeting above.</p>}
        </div>
      </section>

      <section id="strategy-budget" hidden={activeWorkspace !== "budget"} className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Recruitment Cycle Budget Allocations</h2><p className="mt-1 text-xs text-slate-500">Plan allocations for February/April and August/November recruitment cycles. Currency: UGX.</p></div>
        <form onSubmit={(e) => { e.preventDefault(); void saveCycleAllocation(); }} className="grid gap-3 p-4 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-slate-700">Recruitment cycle<select value={allocationCycle} onChange={(e) => setAllocationCycle(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="february">February + April</option><option value="august">August + November</option></select></label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">Proposed allocation (UGX)<input type="number" min="0" step="1000" required value={allocationAmount} onChange={(e) => setAllocationAmount(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-700 md:col-span-2">Allocation notes<textarea value={allocationNotes} onChange={(e) => setAllocationNotes(e.target.value)} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Programmes covered, planned activities and justification" /></label>
          <button disabled={saving} className="w-fit rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save allocation</button>
        </form>
        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-4"><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Proposed total</p><p className="mt-1 text-lg font-semibold text-slate-900">UGX {cycleAllocations.filter((a) => a.plan_id === (plans.find((p) => p.strategy_year === currentYear)?.id ?? plans[0]?.id)).reduce((n, a) => n + Number(a.proposed_amount || 0), 0).toLocaleString("en-UG")}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Approved total</p><p className="mt-1 text-lg font-semibold text-emerald-700">UGX {cycleAllocations.filter((a) => a.plan_id === (plans.find((p) => p.strategy_year === currentYear)?.id ?? plans[0]?.id)).reduce((n, a) => n + Number(a.approved_amount || 0), 0).toLocaleString("en-UG")}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Cycles allocated</p><p className="mt-1 text-xl font-semibold text-slate-900">{cycleAllocations.filter((a) => a.plan_id === (plans.find((p) => p.strategy_year === currentYear)?.id ?? plans[0]?.id)).length}</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Annual budget proposals</p><p className="mt-1 text-xl font-semibold text-slate-900">{budgets.filter((b) => b.plan_id === (plans.find((p) => p.strategy_year === currentYear)?.id ?? plans[0]?.id)).length}</p></div></div><div className="grid gap-3 p-4 sm:grid-cols-2">{["february","august"].map((cycle) => { const a = cycleAllocations.find((x) => x.cycle === cycle && x.plan_id === (plans.find((p) => p.strategy_year === currentYear)?.id ?? plans[0]?.id)); return <article key={cycle} className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{cycle === "february" ? "February + April" : "August + November"}</p><p className="mt-2 text-xl font-semibold text-slate-900">UGX {Number(a?.approved_amount ?? a?.proposed_amount ?? 0).toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Proposed: UGX {Number(a?.proposed_amount ?? 0).toLocaleString()} · {statusLabel(a?.status ?? "not allocated")}</p>{a?.notes && <p className="mt-2 text-sm text-slate-600">{a.notes}</p>}</article>; })}</div>
      </section>

      <section id="strategy-management-reports" hidden={activeWorkspace !== "reports"} className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-semibold text-slate-900">Management Reports</h2><p className="mt-1 text-xs text-slate-500">Capture a dated snapshot of strategy delivery, recruitment targets, budgets, risks, approvals and actions. Saved versions remain in report history.</p></div><button type="button" disabled={saving || plans.length === 0} onClick={() => void saveManagementReport()} className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save report snapshot"}</button></div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <a href="#strategy-objectives" className="group rounded-xl bg-slate-50 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-sm"><p className="text-xs text-slate-500">Objectives achieved</p><p className="mt-1 text-xl font-semibold">{objectives.filter((o) => o.plan_id === currentPlan?.id && o.status === "achieved").length} / {objectives.filter((o) => o.plan_id === currentPlan?.id).length}</p><p className="mt-1 text-[11px] font-semibold text-emerald-800">View objectives →</p></a>
          <a href="#intake-plans" className="group rounded-xl bg-slate-50 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-sm"><p className="text-xs text-slate-500">Recruitment targets</p><p className="mt-1 text-xl font-semibold">{intakeTargets.filter((x) => x.plan_id === currentPlan?.id).reduce((n, x) => n + x.target_applications, 0).toLocaleString()}</p><p className="text-xs text-slate-500">Applications planned</p><p className="mt-1 text-[11px] font-semibold text-emerald-800">View intakes →</p></a>
          <a href="#intake-plans" className="group rounded-xl bg-slate-50 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-sm"><p className="text-xs text-slate-500">Live lead-to-application</p><p className="mt-1 text-xl font-semibold">{actualsAvailable && currentPlan?.strategy_year === currentYear ? (recruitmentActuals.leads > 0 ? `${Math.round(recruitmentActuals.applications / recruitmentActuals.leads * 1000) / 10}%` : "0%") : "—"}</p><p className="text-xs text-slate-500">{actualsAvailable && currentPlan?.strategy_year === currentYear ? `${recruitmentActuals.applications.toLocaleString()} application-stage records / ${recruitmentActuals.leads.toLocaleString()} leads` : "Current-year data unavailable or plan year differs"}</p><p className="mt-1 text-[11px] font-semibold text-emerald-800">View recruitment targets →</p></a>
          <a href="#strategy-risks" className="group rounded-xl bg-slate-50 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-sm"><p className="text-xs text-slate-500">Unresolved risks</p><p className="mt-1 text-xl font-semibold">{risks.filter((r) => r.plan_id === currentPlan?.id && r.status !== "resolved").length}</p><p className="text-xs text-slate-500">{risks.filter((r) => r.plan_id === currentPlan?.id && r.priority === "critical" && r.status !== "resolved").length} critical</p><p className="mt-1 text-[11px] font-semibold text-emerald-800">Review risks →</p></a>
          <a href="#meeting-actions" className="group rounded-xl bg-slate-50 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-sm"><p className="text-xs text-slate-500">Open meeting actions</p><p className="mt-1 text-xl font-semibold">{meetingActions.filter((a) => a.status !== "completed" && a.status !== "cancelled" && meetings.some((m) => m.id === a.meeting_id && m.plan_id === currentPlan?.id)).length}</p><p className="mt-1 text-[11px] font-semibold text-emerald-800">View actions →</p></a>
        </div>
        <div className="border-t border-slate-100"><div className="px-4 py-3"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved report versions</h3></div>
          {reportHistory.map((report) => <div key={report.id} className="border-t border-slate-100 px-4 py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-800">{statusLabel(report.report_type)} · Version {report.version}</p><p className="mt-1 text-xs text-slate-500">Created {new Date(report.created_at).toLocaleString()} · {statusLabel(report.status)}</p>{report.approved_at && <p className="mt-1 text-xs text-slate-500">Approved {new Date(report.approved_at).toLocaleString()} · Reviewer {report.approved_by ? (strategyProfileNames[report.approved_by] || report.approved_by) : "unavailable"}</p>}{report.sent_at && <p className="mt-1 text-xs text-slate-500">Delivery confirmation {new Date(report.sent_at).toLocaleString()} · {report.provider_status || "recorded"}</p>}{(() => { const summary = report.snapshot.executive_summary && typeof report.snapshot.executive_summary === "object" ? report.snapshot.executive_summary as Record<string, unknown> : null; if (!summary) return null; return <div className="mt-2 flex flex-wrap gap-2 text-xs"><span className={`rounded-full px-2 py-1 font-semibold ${summary.status === "needs_attention" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{summary.status === "needs_attention" ? "Needs attention" : "No flagged critical issues"}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Activity completion: {summary.activity_completion_percent == null ? "—" : `${summary.activity_completion_percent}%`}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Budget approval: {summary.budget_approval_percent == null ? "—" : `${summary.budget_approval_percent}%`}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Marked delayed: {String(summary.delayed_activities ?? 0)}</span><span className={`rounded-full px-2 py-1 ${Number(summary.overdue_activities ?? 0) > 0 ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"}`}>Overdue scheduled activities: {String(summary.overdue_activities ?? 0)}</span><span className={`rounded-full px-2 py-1 ${Number(summary.overdue_risks ?? 0) > 0 ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"}`}>Overdue risk actions: {String(summary.overdue_risks ?? 0)}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Overdue meeting actions: {String(summary.overdue_actions ?? 0)}</span><p className="basis-full text-xs text-slate-500">{String(summary.status_note ?? "")}</p></div>; })()}</div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { const snapshot = JSON.stringify(report.snapshot, null, 2); const blob = new Blob([snapshot], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "ciu-strategy-report-v" + report.version + ".json"; link.click(); URL.revokeObjectURL(url); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Export JSON</button><button type="button" onClick={() => { const snapshot = report.snapshot; const recruitment = (snapshot.live_recruitment_performance && typeof snapshot.live_recruitment_performance === "object" ? snapshot.live_recruitment_performance : {}) as Record<string, unknown>; const actuals = (recruitment.actuals && typeof recruitment.actuals === "object" ? recruitment.actuals : {}) as Record<string, unknown>; const comparison = (recruitment.comparison && typeof recruitment.comparison === "object" ? recruitment.comparison : {}) as Record<string, unknown>; const applicationComparison = (comparison.applications && typeof comparison.applications === "object" ? comparison.applications : {}) as Record<string, unknown>; const admissionComparison = (comparison.admissions && typeof comparison.admissions === "object" ? comparison.admissions : {}) as Record<string, unknown>; const registrationComparison = (comparison.registrations && typeof comparison.registrations === "object" ? comparison.registrations : {}) as Record<string, unknown>; const budgets = (snapshot.budget_summary && typeof snapshot.budget_summary === "object" ? snapshot.budget_summary : {}) as Record<string, unknown>; const activities = (snapshot.activities && typeof snapshot.activities === "object" ? snapshot.activities : {}) as Record<string, unknown>; const risks = (snapshot.risks && typeof snapshot.risks === "object" ? snapshot.risks : {}) as Record<string, unknown>; const actions = (snapshot.meeting_actions && typeof snapshot.meeting_actions === "object" ? snapshot.meeting_actions : {}) as Record<string, unknown>; const rows: unknown[][] = [["CIU Strategy Management Report", "Value"], ["Strategy year", snapshot.strategy_year ?? ""], ["Strategy title", snapshot.strategy_title ?? ""], ["Executive status", (snapshot.executive_summary && typeof snapshot.executive_summary === "object" ? (snapshot.executive_summary as Record<string, unknown>).status : null) ?? "Unavailable"], ["Activity completion (%)", (snapshot.executive_summary && typeof snapshot.executive_summary === "object" ? (snapshot.executive_summary as Record<string, unknown>).activity_completion_percent : null) ?? "Unavailable"], ["Budget approval (%)", (snapshot.executive_summary && typeof snapshot.executive_summary === "object" ? (snapshot.executive_summary as Record<string, unknown>).budget_approval_percent : null) ?? "Unavailable"], ["Delayed activities", (snapshot.executive_summary && typeof snapshot.executive_summary === "object" ? (snapshot.executive_summary as Record<string, unknown>).delayed_activities : null) ?? 0], ["Overdue scheduled activities", (snapshot.executive_summary && typeof snapshot.executive_summary === "object" ? (snapshot.executive_summary as Record<string, unknown>).overdue_activities : null) ?? 0], ["Overdue risk actions", (snapshot.executive_summary && typeof snapshot.executive_summary === "object" ? (snapshot.executive_summary as Record<string, unknown>).overdue_risks : null) ?? 0], ["Overdue actions", (snapshot.executive_summary && typeof snapshot.executive_summary === "object" ? (snapshot.executive_summary as Record<string, unknown>).overdue_actions : null) ?? 0], ["Unassigned activities", (snapshot.executive_summary && typeof snapshot.executive_summary === "object" ? (snapshot.executive_summary as Record<string, unknown>).unassigned_activities : null) ?? 0], ["Unassigned risks", (snapshot.executive_summary && typeof snapshot.executive_summary === "object" ? (snapshot.executive_summary as Record<string, unknown>).unassigned_risks : null) ?? 0], ["Unassigned meeting actions", (snapshot.executive_summary && typeof snapshot.executive_summary === "object" ? (snapshot.executive_summary as Record<string, unknown>).unassigned_meeting_actions : null) ?? 0], ["Total unassigned outstanding items", (snapshot.executive_summary && typeof snapshot.executive_summary === "object" ? (snapshot.executive_summary as Record<string, unknown>).unassigned_total : null) ?? 0], ["Recruitment reporting year", recruitment.reporting_year ?? ""], ["Recruitment data available", recruitment.data_available ?? ""], ["Leads actual", actuals.leads ?? "Unavailable"], ["Applications actual", actuals.applications ?? "Unavailable"], ["Admitted actual", actuals.admitted ?? "Unavailable"], ["Enrolled actual", actuals.enrolled ?? "Unavailable"], ["Applications target", applicationComparison.target ?? "Unavailable"], ["Applications variance", applicationComparison.variance ?? "Unavailable"], ["Admissions target", admissionComparison.target ?? "Unavailable"], ["Admissions variance", admissionComparison.variance ?? "Unavailable"], ["Registrations target", registrationComparison.target ?? "Unavailable"], ["Registrations variance", registrationComparison.variance ?? "Unavailable"], ["Lead-to-application rate (%)", (snapshot.conversion_metrics && typeof snapshot.conversion_metrics === "object" ? (snapshot.conversion_metrics as Record<string, unknown>).lead_to_application_percent : null) ?? "Unavailable"], ["Application-to-enrolment rate (%)", (snapshot.conversion_metrics && typeof snapshot.conversion_metrics === "object" ? (snapshot.conversion_metrics as Record<string, unknown>).application_to_enrolment_percent : null) ?? "Unavailable"], ["Activities total", activities.total ?? 0], ["Activities completed", activities.completed ?? 0], ["Activities delayed", activities.delayed ?? 0], ["Activity planned budget (UGX)", activities.planned_budget_ugx ?? 0], ["Budget proposals", budgets.records ?? 0], ["Budget proposed (UGX)", budgets.proposed_ugx ?? 0], ["Budget approved (UGX)", budgets.approved_ugx ?? 0], ["Budget awaiting approval", budgets.awaiting_approval ?? 0], ["Unresolved risks", risks.unresolved ?? 0], ["Critical risks", risks.critical ?? 0], ["Open meeting actions", actions.open ?? snapshot.open_actions ?? 0], ["Overdue meeting actions", actions.overdue ?? 0], ["Generated at", snapshot.generated_at ?? ""]]; const quote = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"'; const csv = "\uFEFF" + rows.map((row) => row.map(quote).join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })); const link = document.createElement("a"); link.href = url; link.download = "ciu-strategy-report-v" + report.version + ".csv"; link.click(); URL.revokeObjectURL(url); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Export CSV</button>{report.status === "draft" && <button type="button" disabled={saving} onClick={() => void transitionManagementReport(report, "reviewed")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Mark reviewed</button>}{report.status === "reviewed" && <button type="button" disabled={saving} onClick={() => void transitionManagementReport(report, "approved")} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve report</button>}{report.status === "approved" && <button type="button" disabled={saving} onClick={() => void transitionManagementReport(report, "sent")} className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-50">Confirm delivery</button>}</div></div></div>)}
          {reportHistory.length === 0 && <p className="px-4 pb-4 text-sm text-slate-500">No saved report snapshots yet.</p>}
        </div>
      </section>

      <section id="strategy-approvals" hidden={activeWorkspace !== "approvals"} className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
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
        <div className="border-t border-slate-200"><div className="px-4 py-3"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Decision history</h3><p className="mt-1 text-xs text-slate-500">Append-only record of decisions, reviewer identifiers and timestamps.</p></div>
          {approvalHistory.map((item) => <article key={item.id} className="grid gap-1 border-t border-slate-100 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]"><div><p className="text-sm font-medium text-slate-800">{statusLabel(item.decision)} · {new Date(item.decided_at).toLocaleString()}</p><p className="mt-1 break-all text-xs text-slate-500">Request {item.request_id} · Reviewer {item.reviewer_id ? (strategyProfileNames[item.reviewer_id] || item.reviewer_id) : "unavailable"}</p><p className="mt-1 text-xs text-slate-500">Previous status: {statusLabel(item.previous_status)}</p></div><p className="whitespace-pre-wrap text-sm text-slate-600">{item.reviewer_comment || "No decision comment recorded."}</p></article>)}
          {approvalHistory.length === 0 && <p className="px-4 pb-4 text-sm text-slate-500">No decision history available yet.</p>}
        </div>
      </section>

    </main>
  );
}
