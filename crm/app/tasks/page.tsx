"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useIntakeSelection } from "@/lib/use-intake-selection";

const supabase = createClient();

type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

type TaskType =
  | "call"
  | "email"
  | "whatsapp"
  | "meeting"
  | "note"
  | "proposal"
  | "other";

type Task = {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  lead_id: string | null;
  opportunity_id: string | null;
  assigned_to: string | null;
  due_at: string | null;
  status: string;
  priority?: "high" | "medium" | "low" | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  intake_year?: number | null;
  intake_month?: number | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
};

type DailyInteraction = {
  id: string;
  lead_id: string | null;
  channel: string | null;
  response: string | null;
  outcome: string | null;
  assigned_to: string | null;
  contacted_at: string | null;
  created_by: string | null;
  task_id: string | null;
};

type ContactReviewHistory = {
  id: string;
  lead_id: string;
  trigger_interaction_id: string;
  decision: "retain" | "reassign" | "other_action";
  notes: string;
  new_assigned_to: string | null;
  decided_by: string;
  decided_at: string;
};

type WorkingCalendarDay = {
  calendar_date: string;
  title: string;
  day_type: "public_holiday" | "ciu_closure" | "working_day";
  is_active: boolean;
  notes: string | null;
};

type AbsenceRequest = {
  id: string;
  salesperson_id: string;
  absence_date: string;
  day_fraction: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
};

type AbsenceDecisionHistory = {
  id: string;
  request_id: string;
  salesperson_id: string;
  absence_date: string;
  previous_status: "pending" | "approved" | "rejected";
  new_status: "approved" | "rejected";
  decision_notes: string | null;
  decided_by: string;
  decided_at: string;
};

type ContactReportSnapshot = {
  id: string;
  report_date: string;
  salesperson_id: string;
  revision: number;
  report_data: Record<string, unknown>;
  finalized_at: string;
  finalized_by: string | null;
  finalization_source: "manual" | "automated";
  supersedes_id: string | null;
  correction_reason: string | null;
};

type Lead = {
  id: string;
  name: string | null;
  ciu_number: string | null;
  phone: string | null;
  email: string | null;
  product_service: string | null;
  status: string | null;
  assigned_to: string | null;
  feedback: string | null;
  follow_up_status: string | null;
  next_follow_up_at: string | null;
  intake_year?: number | null;
  intake_month?: number | null;
};

type Opportunity = {
  id: string;
  lead_id: string | null;
  title: string | null;
  value: number | null;
  probability: number | null;
  stage_id: string | null;
  status: string | null;
  assigned_to: string | null;
};

type PipelineStage = {
  id: string;
  name: string;
  position: number | null;
  probability: number | null;
  is_won?: boolean | null;
  is_lost?: boolean | null;
};

type TaskForm = {
  title: string;
  description: string;
  task_type: TaskType;
  lead_id: string;
  opportunity_id: string;
  assigned_to: string;
  due_at: string;
  status: TaskStatus;
  priority: "high" | "medium" | "low";
};

const TASK_TYPES: TaskType[] = [
  "call",
  "whatsapp",
  "email",
  "meeting",
  "note",
  "proposal",
  "other",
];

function taskTypeLabel(type: string): string {
  switch (type.toLowerCase()) {
    case "call": return "Call";
    case "whatsapp": return "WhatsApp";
    case "email": return "Email";
    case "meeting": return "Meeting";
    case "note": return "Note";
    case "proposal": return "Proposal";
    default: return "Other";
  }
}

const TASK_PRIORITIES = ["high", "medium", "low"] as const;
type TaskPriority = (typeof TASK_PRIORITIES)[number];

const TASK_STATUSES: TaskStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];

const OUTCOMES = [
  "Interested",
  "Applied",
  "Application Submitted",
  "Admitted",
  "Paid Application Fee",
  "Acceptance Fee Paid",
  "Paid Acceptance Fee",
  "Enrolled",
  "Follow up later",
  "Not interested",
  "Financial issues",
  "Lost Leads",
  "No Answer",
  "Unreachable",
  "Wrong Number",
  "Dropped",
];

const PIPELINE_WAITING_OUTCOMES = [
  "Interested",
  "Applied",
  "Application Submitted",
  "Admitted",
  "Paid Application Fee",
  "Acceptance Fee Paid",
  "Paid Acceptance Fee",
];

const EMPTY_FORM: TaskForm = {
  title: "",
  description: "",
  task_type: "call",
  lead_id: "",
  opportunity_id: "",
  assigned_to: "",
  due_at: "",
  status: "pending",
  priority: "medium",
};

function isMissingOptionalTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    /relation .* does not exist|could not find the table .* in the schema cache/i.test(candidate.message || "")
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-UG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString("en-UG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();

  const localDate = new Date(
    date.getTime() - offset * 60 * 1000
  );

  return localDate.toISOString().slice(0, 16);
}

function getInitials(name: string | null) {
  if (!name) return "ST";

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return initials || "ST";
}

function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Pending";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function taskTypeIcon(type: string) {
  switch (type.toLowerCase()) {
    case "call": return "☎";
    case "whatsapp": return "◉";
    case "email": return "✉";
    case "meeting": return "◫";
    case "note": return "▤";
    case "proposal": return "▱";
    default: return "✓";
  }
}

function isToday(value: string | null) {
  if (!value) return false;

  const date = new Date(value);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isOverdue(task: Task) {
  if (
    !task.due_at ||
    task.status === "completed" ||
    task.status === "cancelled"
  ) {
    return false;
  }

  return new Date(task.due_at).getTime() < Date.now();
}

function isActiveTask(task: Task) {
  return (
    task.status !== "completed" &&
    task.status !== "cancelled"
  );
}

function isClosedLead(lead: Lead | null | undefined) {
  if (!lead) return false;
  const status = (lead.status || "").trim().toLowerCase().replace(/[ _-]+/g, " ");
  const outcome = (lead.follow_up_status || "").trim().toLowerCase().replace(/[ _-]+/g, " ");
  return (
    ["unqualified", "lost", "dropped", "ineffective", "ineffective data", "closed"].includes(status) ||
    ["not interested", "lost leads", "wrong number", "dropped", "enrolled"].includes(outcome)
  );
}

function isInterestedLead(lead: Lead | null | undefined) {
  if (!lead) return false;
  const status = (lead.status || "").trim().toLowerCase();
  const outcome = (lead.follow_up_status || "").trim().toLowerCase();
  return status === "qualified" || status === "interested" || outcome === "interested";
}

function isDeadlineExemptLead(lead: Lead | null | undefined) {
  if (!lead) return false;
  const normalize = (value: string | null | undefined) =>
    (value || "").trim().toLowerCase().replace(/[ _-]+/g, " ");
  const status = normalize(lead.status);
  const outcome = normalize(lead.follow_up_status);
  return (
    ["applied", "enrolled", "paid acceptance fee", "acceptance fee paid", "lost leads", "lost"].includes(status) ||
    ["applied", "enrolled", "paid acceptance fee", "acceptance fee paid", "lost leads", "lost"].includes(outcome)
  );
}

function defaultTaskDeadline(lead: Lead | null | undefined) {
  if (isDeadlineExemptLead(lead)) return "";
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);
  deadline.setSeconds(0, 0);
  return toDateTimeLocal(deadline.toISOString());
}

function getPriority(task: Task) {
  if (isOverdue(task)) return 1;
  if (isToday(task.due_at)) return 2;
  if (task.status === "in_progress") return 3;
  if (task.status === "pending") return 4;
  return 5;
}

export default function TasksPage() {
  const actionMenuItemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "10px",
    border: "none",
    background: "#ffffff",
    color: "#374151",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "12px",
    borderRadius: "6px",
  };
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [opportunities, setOpportunities] = useState<
    Opportunity[]
  >([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [dailyInteractions, setDailyInteractions] = useState<DailyInteraction[]>([]);
  const [contactReviewHistory, setContactReviewHistory] = useState<ContactReviewHistory[]>([]);
  const [workingCalendar, setWorkingCalendar] = useState<WorkingCalendarDay[]>([]);
  const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([]);
  const [absenceDecisionHistory, setAbsenceDecisionHistory] = useState<AbsenceDecisionHistory[]>([]);
  const [contactReportSnapshots, setContactReportSnapshots] = useState<ContactReportSnapshot[]>([]);
  const [calendarDate, setCalendarDate] = useState("");
  const [calendarTitle, setCalendarTitle] = useState("");
  const [calendarType, setCalendarType] = useState<WorkingCalendarDay["day_type"]>("public_holiday");
  const [calendarNotes, setCalendarNotes] = useState("");
  const [absenceDate, setAbsenceDate] = useState("");
  const [absenceFraction, setAbsenceFraction] = useState("1");
  const [absenceReason, setAbsenceReason] = useState("");
  const [savingGovernance, setSavingGovernance] = useState(false);
  const [savingReviewLeadId, setSavingReviewLeadId] = useState<string | null>(null);
  const [reviewClock, setReviewClock] = useState(() => Date.now());

  const [currentUserId, setCurrentUserId] =
    useState("");
  const [currentRole, setCurrentRole] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [quickTaskFilter, setQuickTaskFilter] = useState("open");
  const [typeFilter, setTypeFilter] =
    useState("all");
  const [assignedFilter, setAssignedFilter] =
    useState("all");
  const [selectedIntake, setSelectedIntake] = useIntakeSelection();
  const [leadAssignmentSearch, setLeadAssignmentSearch] = useState("");
  const [leadAssignmentFilter, setLeadAssignmentFilter] = useState("unassigned");
  const [savingLeadAssignmentId, setSavingLeadAssignmentId] = useState<string | null>(null);
  const [autoAssigningLeads, setAutoAssigningLeads] = useState(false);

  const [showTaskModal, setShowTaskModal] =
    useState(false);

  const [editingTask, setEditingTask] =
    useState<Task | null>(null);

  const [selectedTask, setSelectedTask] =
    useState<Task | null>(null);
const [openActionsTaskId, setOpenActionsTaskId] =
    useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [form, setForm] =
    useState<TaskForm>(EMPTY_FORM);
  const [walkInMode, setWalkInMode] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInProgramme, setWalkInProgramme] = useState("");
  const [walkInNotes, setWalkInNotes] = useState("");

  const [outcomeTask, setOutcomeTask] =
    useState<Task | null>(null);

  const [selectedOutcome, setSelectedOutcome] =
    useState("");

  const [outcomeNotes, setOutcomeNotes] =
    useState("");

  const [outcomeDate, setOutcomeDate] =
    useState("");
const tableScrollRef = useRef<HTMLDivElement | null>(null);
const tableBottomScrollRef = useRef<HTMLDivElement | null>(null);
const [tableScrollWidth, setTableScrollWidth] = useState(0);
useEffect(() => {
  const table = tableScrollRef.current;
  if (!table) return;

  const updateWidth = () => {
    setTableScrollWidth(table.scrollWidth);
  };

  updateWidth();

  const observer = new ResizeObserver(updateWidth);
  observer.observe(table);

  const innerTable = table.querySelector("table");
  if (innerTable) observer.observe(innerTable);

  return () => observer.disconnect();
}, [loading, tasks.length]);
  
const isSalesperson =
    currentRole === "salesperson";

  const isAdmin =
    currentRole === "admin" ||
    currentRole === "super_admin";

  // Team-wide contact performance and exception reviews are management-only.
  // Other non-salesperson roles (e.g. marketing, finance, viewer) must not
  // inherit access merely because they are not salespeople.
  const canViewTeamContactPerformance =
    currentRole === "super_admin" ||
    currentRole === "admin" ||
    currentRole === "manager";

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error(
          "No authenticated user found."
        );
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id,full_name,role,is_active"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        throw new Error(
          "Your CRM profile could not be found."
        );
      }

      const role = profile.role || "";

      setCurrentUserId(user.id);
      setCurrentRole(role);

      let tasksQuery = supabase
        .from("tasks")
        .select(
          "id,title,description,task_type,lead_id,opportunity_id,assigned_to,due_at,status,priority,completed_at,created_at,updated_at,intake_year,intake_month"
        )
        .order("due_at", {
          ascending: true,
          nullsFirst: false,
        });

      // Fetch every visible lead in pages; Supabase's default response limit
      // can otherwise hide records once the CRM exceeds 1,000 leads.
      const leadsQuery = (async () => {
        const allRows: Lead[] = [];
        const pageSize = 1000;
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await supabase
            .from("leads")
            .select("id,name,ciu_number,phone,email,product_service,status,assigned_to,feedback,follow_up_status,next_follow_up_at,intake_year,intake_month")
            .order("name", { ascending: true })
            .range(offset, offset + pageSize - 1);
          if (error) return { data: null, error };
          const batch = (data || []) as Lead[];
          allRows.push(...batch);
          if (batch.length < pageSize) break;
        }
        return { data: allRows, error: null };
      })();

      let opportunitiesQuery = supabase
        .from("opportunities")
        .select(
          "id,lead_id,title,value,probability,stage_id,status,assigned_to"
        )
        .order("created_at", {
          ascending: false,
        });

      if (role === "salesperson") {
        tasksQuery = tasksQuery.eq(
          "assigned_to",
          user.id
        );

        // Lead visibility is enforced by Supabase RLS. This includes leads
        // assigned to this salesperson and leads linked to tasks assigned to them.
        // Do not filter only by lead owner, or reassigned tasks lose student details.

        opportunitiesQuery =
          opportunitiesQuery.eq(
            "assigned_to",
            user.id
          );
      }

      // Supabase/PostgREST limits each response to a maximum page size.
      // Load every task page so managers and super admins see the complete workload.
      const fetchAllPages = async (baseQuery: any) => {
        const allRows: any[] = [];
        const pageSize = 1000;
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await baseQuery.range(offset, offset + pageSize - 1);
          if (error) return { data: null, error };
          const batch = data || [];
          allRows.push(...batch);
          if (batch.length < pageSize) break;
        }
        return { data: allRows, error: null };
      };

      const [
        tasksResult,
        profilesResult,
        leadsResult,
        opportunitiesResult,
        stagesResult,
        interactionsResult,
        reviewHistoryResult,
        calendarResult,
        absenceResult,
        absenceHistoryResult,
        reportSnapshotsResult,
      ] = await Promise.all([
        fetchAllPages(tasksQuery),

        supabase
          .from("profiles")
          .select(
            "id,full_name,role,is_active"
          )
          .order("full_name", {
            ascending: true,
          }),

        leadsQuery,

        opportunitiesQuery,

        supabase
          .from("pipeline_stages")
          .select(
            "id,name,position,probability,is_won,is_lost"
          )
          .order("position", {
            ascending: true,
          }),

        fetchAllPages(
          supabase
            .from("engagement_interactions")
            .select("id,lead_id,channel,response,outcome,assigned_to,contacted_at,created_by,task_id")
            .eq("channel", "outgoing_call")
            .order("contacted_at", { ascending: false })
        ),

        fetchAllPages(
          supabase
            .from("lead_contact_review_history")
            .select("id,lead_id,trigger_interaction_id,decision,notes,new_assigned_to,decided_by,decided_at")
            .order("decided_at", { ascending: false })
        ),

        fetchAllPages(
          supabase.from("ciu_working_calendar")
            .select("calendar_date,title,day_type,is_active,notes")
            .eq("is_active", true)
            .order("calendar_date", { ascending: true })
        ),

        fetchAllPages(
          supabase.from("salesperson_absence_requests")
            .select("id,salesperson_id,absence_date,day_fraction,reason,status,requested_by,requested_at,decided_by,decided_at,decision_notes")
            .order("absence_date", { ascending: false })
        ),

        fetchAllPages(
          supabase.from("salesperson_absence_decision_history")
            .select("id,request_id,salesperson_id,absence_date,previous_status,new_status,decision_notes,decided_by,decided_at")
            .order("decided_at", { ascending: false })
        ),

        fetchAllPages(
          supabase.from("salesperson_contact_report_snapshots")
            .select("id,report_date,salesperson_id,revision,report_data,finalized_at,finalized_by,finalization_source,supersedes_id,correction_reason")
            .order("revision", { ascending: false })
        ),
      ]);

      if (tasksResult.error)
        throw tasksResult.error;

      if (profilesResult.error)
        throw profilesResult.error;

      if (leadsResult.error)
        throw leadsResult.error;

      if (opportunitiesResult.error)
        throw opportunitiesResult.error;

      if (stagesResult.error)
        throw stagesResult.error;

      if (interactionsResult.error)
        throw interactionsResult.error;

      // These governance tables are introduced by the salesperson-accountability
      // migrations. Keep the core Tasks page usable before those migrations are
      // deployed, but do not hide permission, network, or other database errors.
      const optionalGovernanceResults = [
        reviewHistoryResult,
        calendarResult,
        absenceResult,
        absenceHistoryResult,
        reportSnapshotsResult,
      ];
      for (const result of optionalGovernanceResults) {
        if (result.error && !isMissingOptionalTableError(result.error)) {
          throw result.error;
        }
      }

      setWorkingCalendar((calendarResult.data || []) as WorkingCalendarDay[]);
      setAbsenceRequests((absenceResult.data || []) as AbsenceRequest[]);
      setAbsenceDecisionHistory((absenceHistoryResult.data || []) as AbsenceDecisionHistory[]);
      setContactReportSnapshots((reportSnapshotsResult.data || []) as ContactReportSnapshot[]);
      setDailyInteractions((interactionsResult.data || []) as DailyInteraction[]);
      setContactReviewHistory((reviewHistoryResult.data || []) as ContactReviewHistory[]);

      const loadedTasks = (tasksResult.data || []) as Task[];

      setTasks(loadedTasks);

      setProfiles(
        (profilesResult.data ||
          []) as Profile[]
      );

      setLeads(
        (leadsResult.data || []) as Lead[]
      );

      setOpportunities(
        (opportunitiesResult.data ||
          []) as Opportunity[]
      );

      setStages(
        (stagesResult.data ||
          []) as PipelineStage[]
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load tasks."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Keep management overdue indicators current while this page remains open.
  useEffect(() => {
    const timer = window.setInterval(() => setReviewClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const getLead = (task: Task) => {
    if (!task.lead_id) return null;

    return (
      leads.find(
        (lead) =>
          lead.id === task.lead_id
      ) || null
    );
  };

  const getOpportunity = (task: Task) => {
    if (!task.opportunity_id) return null;

    return (
      opportunities.find(
        (item) =>
          item.id === task.opportunity_id
      ) || null
    );
  };

  const getStaff = (task: Task) => {
    if (!task.assigned_to) return null;

    return (
      profiles.find(
        (profile) =>
          profile.id === task.assigned_to
      ) || null
    );
  };

  const getStage = (
    stageId: string | null
  ) => {
    if (!stageId) return null;

    return (
      stages.find(
        (stage) =>
          stage.id === stageId
      ) || null
    );
  };

  const stats = useMemo(() => {
    const [intakeYear, intakeMonth] = selectedIntake.split("-").map(Number);
    const matchesSelectedIntake = (task: Task) => {
      const lead = getLead(task);
      const taskYear = task.intake_year ?? lead?.intake_year ?? null;
      const taskMonth = task.intake_month ?? lead?.intake_month ?? null;
      return selectedIntake === "all" || (selectedIntake === "unassigned"
        ? !taskYear || !taskMonth
        : taskYear === intakeYear && taskMonth === intakeMonth);
    };
    const scopedLeads = leads.filter((lead) =>
      selectedIntake === "all" || (selectedIntake === "unassigned"
        ? !lead.intake_year || !lead.intake_month
        : lead.intake_year === intakeYear && lead.intake_month === intakeMonth)
    );
    const active = tasks.filter((task) =>
      matchesSelectedIntake(task) && isActiveTask(task) && !isClosedLead(getLead(task))
    );
    const overdue = active.filter(isOverdue).length;
    const dueToday = active.filter((task) => isToday(task.due_at)).length;
    const completed = tasks.filter((task) =>
      matchesSelectedIntake(task) && task.status === "completed"
    ).length;
    return {
      active: active.length,
      overdue,
      dueToday,
      completed,
      interestedLeads: scopedLeads.filter(isInterestedLead).length,
    };
  }, [tasks, leads, selectedIntake]);

  const getEATDateKey = (value: Date) => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(value).reduce((result, part) => {
        if (part.type !== "literal") result[part.type] = part.value;
        return result;
      }, {} as Record<string, string>);
    return `${parts.year}-${parts.month}-${parts.day}`;
  };

  const isOfficialWorkingDay = (dateKey: string) => {
    const calendarOverride = workingCalendar.find((day) => day.calendar_date === dateKey && day.is_active);
    if (calendarOverride) return calendarOverride.day_type === "working_day";
    const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
    return weekday !== 0 && weekday !== 6;
  };

  const approvedAbsenceFraction = (staffId: string, dateKey: string) =>
    Math.min(1, absenceRequests
      .filter((request) => request.salesperson_id === staffId && request.absence_date === dateKey && request.status === "approved")
      .reduce((sum, request) => sum + Number(request.day_fraction || 0), 0));

  const targetForStaff = (staffId: string, dateKey: string) =>
    isOfficialWorkingDay(dateKey) ? Math.max(0, Math.round(50 * (1 - approvedAbsenceFraction(staffId, dateKey)))) : 0;

  const dailyContactSummary = useMemo(() => {
    const isQualifyingAnsweredCall = (interaction: DailyInteraction) => {
      const channel = (interaction.channel || "").trim().toLowerCase();
      const response = (interaction.response || "").trim().toLowerCase();
      const outcome = (interaction.outcome || "").trim().toLowerCase();
      return channel === "outgoing_call" &&
        response === "answered" &&
        outcome !== "wrong number" &&
        Boolean(interaction.lead_id) &&
        Boolean(interaction.created_by || interaction.assigned_to);
    };

    const todayKey = getEATDateKey(new Date());
    const qualifying = dailyInteractions.filter((interaction) => {
      if (!isQualifyingAnsweredCall(interaction) || !interaction.contacted_at) return false;
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Kampala",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date(interaction.contacted_at)).reduce((values, part) => {
        if (part.type !== "literal") values[part.type] = part.value;
        return values;
      }, {} as Record<string, string>);
      return `${parts.year}-${parts.month}-${parts.day}` === todayKey;
    });
    const countForStaff = (staffId: string) =>
      new Set(qualifying
        .filter((interaction) => (interaction.created_by || interaction.assigned_to) === staffId)
        .map((interaction) => interaction.lead_id)
      ).size;

    const teamPairs = new Set(qualifying.map((interaction) =>
      `${interaction.created_by || interaction.assigned_to}:${interaction.lead_id}`
    ));

    return {
      mine: countForStaff(currentUserId),
      team: teamPairs.size,
      staff: profiles
        .filter((profile) => profile.role === "salesperson" && profile.is_active !== false)
        .map((profile) => ({
          id: profile.id,
          name: profile.full_name || "Unnamed salesperson",
          contacted: countForStaff(profile.id),
          target: targetForStaff(profile.id, todayKey),
          absenceFraction: approvedAbsenceFraction(profile.id, todayKey),
        }))
        .sort((a, b) => b.contacted - a.contacted || a.name.localeCompare(b.name)),
      todayKey,
      isWorkingDay: isOfficialWorkingDay(todayKey),
      myTarget: targetForStaff(currentUserId, todayKey),
    };
  }, [dailyInteractions, currentUserId, profiles, workingCalendar, absenceRequests]);

  const exportDailyContactReport = () => {
    if (!canViewTeamContactPerformance) {
      setError("Team contact reports are available to authorised management only.");
      return;
    }
    const escapeCsv = (value: string | number) => {
      const text = String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };
    const dateParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Kampala",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date()).reduce((parts, part) => {
      if (part.type !== "literal") parts[part.type] = part.value;
      return parts;
    }, {} as Record<string, string>);
    const dateKey = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
    const rows = [
      ["Report date (EAT)", dateKey],
      ["Generated at (EAT)", new Intl.DateTimeFormat("en-UG", { timeZone: "Africa/Kampala", dateStyle: "medium", timeStyle: "short" }).format(new Date())],
      ["Report working day", dailyContactSummary.isWorkingDay ? "Yes" : "No"],
      [],
      ["Salesperson", "Unique students contacted", "Daily target", "Status"],
      ...dailyContactSummary.staff.map((person) => [
        person.name,
        person.contacted,
        person.target,
        person.target === 0 ? "Exempt / non-working day" : person.contacted >= person.target ? "Target achieved" : person.contacted > 0 ? "Below target" : "No qualifying calls",
      ]),
    ];
    const csv = "\uFEFF" + rows.map((row) => row.map((value) => escapeCsv(value ?? "")).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ciu-salesperson-contact-progress-${dateKey}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportMyDailyContactReport = () => {
    if (!currentUserId) {
      setError("Your signed-in salesperson profile is not ready. Please try again.");
      return;
    }

    const dateKeyFor = (value: Date) => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Kampala",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(value).reduce((result, part) => {
        if (part.type !== "literal") result[part.type] = part.value;
        return result;
      }, {} as Record<string, string>);
      return `${parts.year}-${parts.month}-${parts.day}`;
    };
    const todayKey = dateKeyFor(new Date());
    const myCalls = dailyInteractions.filter((interaction) => {
      const staffId = interaction.created_by || interaction.assigned_to;
      if (staffId !== currentUserId || !interaction.contacted_at || !interaction.lead_id) return false;
      if ((interaction.channel || "").trim().toLowerCase() !== "outgoing_call") return false;
      if ((interaction.response || "").trim().toLowerCase() !== "answered") return false;
      if ((interaction.outcome || "").trim().toLowerCase() === "wrong number") return false;
      return dateKeyFor(new Date(interaction.contacted_at)) === todayKey;
    });
    const uniqueStudentCount = new Set(myCalls.map((interaction) => interaction.lead_id)).size;
    const myTarget = targetForStaff(currentUserId, todayKey);
    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows: Array<Array<string | number>> = [
      ["CIU Salesperson Daily Contact Report"],
      ["Report date (EAT)", todayKey],
      ["Generated at (EAT)", new Intl.DateTimeFormat("en-UG", { timeZone: "Africa/Kampala", dateStyle: "medium", timeStyle: "short" }).format(new Date())],
      ["Daily target", myTarget],
      ["Unique students reached by answered calls", uniqueStudentCount],
      ["Status", myTarget === 0 ? "Exempt / non-working day" : uniqueStudentCount >= myTarget ? "Target achieved" : uniqueStudentCount > 0 ? "Below target" : "No qualifying calls"],
      [],
      ["Call time (EAT)", "Student", "Phone", "Outcome"],
      ...myCalls
        .sort((a, b) => new Date(a.contacted_at || 0).getTime() - new Date(b.contacted_at || 0).getTime())
        .map((interaction) => {
          const lead = leads.find((item) => item.id === interaction.lead_id);
          return [
            interaction.contacted_at ? new Intl.DateTimeFormat("en-UG", { timeZone: "Africa/Kampala", dateStyle: "short", timeStyle: "short" }).format(new Date(interaction.contacted_at)) : "",
            lead?.name || lead?.ciu_number || "Unnamed student",
            lead?.phone || "",
            interaction.outcome || "",
          ];
        }),
    ];
    const csv = "\uFEFF" + rows.map((row) => row.map((value) => escapeCsv(value ?? "")).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ciu-my-daily-contact-report-${todayKey}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const requestMyAbsence = async () => {
    if (!currentUserId || currentRole !== "salesperson") {
      setError("Only salespeople can submit their own absence request.");
      return;
    }
    if (!absenceDate || !absenceReason.trim()) {
      setError("Choose an absence date and provide a reason.");
      return;
    }
    try {
      setSavingGovernance(true);
      setError("");
      setSuccess("");
      const { error: insertError } = await supabase.from("salesperson_absence_requests").insert({
        salesperson_id: currentUserId,
        absence_date: absenceDate,
        day_fraction: Number(absenceFraction),
        reason: absenceReason.trim(),
        requested_by: currentUserId,
        status: "pending",
      });
      if (insertError) throw insertError;
      setAbsenceDate("");
      setAbsenceFraction("1");
      setAbsenceReason("");
      setSuccess("Absence request submitted for management approval. The target will not change unless approved.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the absence request.");
    } finally {
      setSavingGovernance(false);
    }
  };

  const decideAbsenceRequest = async (request: AbsenceRequest, decision: "approved" | "rejected") => {
    if (!canViewTeamContactPerformance) return;
    const notes = window.prompt(`Optional notes for ${decision === "approved" ? "approval" : "rejection"}:`, "");
    if (notes === null) return;
    try {
      setSavingGovernance(true);
      setError("");
      const { error: rpcError } = await supabase.rpc("decide_salesperson_absence", {
        p_request_id: request.id,
        p_decision: decision,
        p_decision_notes: notes.trim() || null,
      });
      if (rpcError) throw rpcError;
      setSuccess(`Absence request ${decision}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the absence decision.");
    } finally {
      setSavingGovernance(false);
    }
  };

  const saveCalendarDay = async () => {
    if (!canViewTeamContactPerformance) return;
    if (!calendarDate || !calendarTitle.trim()) {
      setError("Choose a date and enter a calendar title.");
      return;
    }
    try {
      setSavingGovernance(true);
      setError("");
      const { error: calendarError } = await supabase.from("ciu_working_calendar").upsert({
        calendar_date: calendarDate,
        title: calendarTitle.trim(),
        day_type: calendarType,
        notes: calendarNotes.trim() || null,
        is_active: true,
        created_by: currentUserId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "calendar_date" });
      if (calendarError) throw calendarError;
      setCalendarDate("");
      setCalendarTitle("");
      setCalendarType("public_holiday");
      setCalendarNotes("");
      setSuccess("CIU calendar date saved. Daily targets and follow-up deadlines will use this calendar.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the CIU calendar date.");
    } finally {
      setSavingGovernance(false);
    }
  };

  const finalizeContactReport = async (staffId: string) => {
    if (!currentUserId) return;
    const person = dailyContactSummary.staff.find((item) => item.id === staffId);
    if (!person) {
      setError("Could not find the salesperson for this report.");
      return;
    }
    const todayKey = dailyContactSummary.todayKey;
    const previous = contactReportSnapshots
      .filter((snapshot) => snapshot.report_date === todayKey && snapshot.salesperson_id === staffId)
      .sort((a, b) => b.revision - a.revision)[0];
    const correctionReason = previous
      ? window.prompt("A report already exists. Enter the reason for this correction; the previous version will be preserved:")
      : null;
    if (previous && (correctionReason === null || !correctionReason.trim())) {
      if (correctionReason !== null) setError("A correction reason is required.");
      return;
    }
    if (!previous && window.confirm("Finalise this report now? It becomes an immutable snapshot. Any later correction creates a new revision and requires a reason.") === false) return;

    const isMyReport = staffId === currentUserId;
    if (!isMyReport && !canViewTeamContactPerformance) {
      setError("Only authorised management can finalise another salesperson's report.");
      return;
    }
    const calls = dailyInteractions.filter((interaction) => {
      if (!interaction.contacted_at || !interaction.lead_id) return false;
      if ((interaction.created_by || interaction.assigned_to) !== staffId) return false;
      if ((interaction.channel || "").toLowerCase() !== "outgoing_call" || (interaction.response || "").toLowerCase() !== "answered") return false;
      if ((interaction.outcome || "").toLowerCase() === "wrong number") return false;
      return getEATDateKey(new Date(interaction.contacted_at)) === todayKey;
    });
    const uniqueLeadIds = Array.from(new Set(calls.map((interaction) => interaction.lead_id)));
    const target = targetForStaff(staffId, todayKey);
    const snapshot = {
      salesperson_id: staffId,
      report_date: todayKey,
      salesperson_name: person.name,
      target,
      unique_students_contacted: uniqueLeadIds.length,
      status: target === 0 ? "Exempt / non-working day" : uniqueLeadIds.length >= target ? "Target achieved" : uniqueLeadIds.length > 0 ? "Below target" : "No qualifying calls",
      working_day: isOfficialWorkingDay(todayKey),
      approved_absence_fraction: approvedAbsenceFraction(staffId, todayKey),
      generated_at_eat: new Intl.DateTimeFormat("en-UG", { timeZone: "Africa/Kampala", dateStyle: "medium", timeStyle: "short" }).format(new Date()),
      calls: calls.map((interaction) => {
        const lead = leads.find((item) => item.id === interaction.lead_id);
        return {
          contacted_at: interaction.contacted_at,
          lead_id: interaction.lead_id,
          student_name: lead?.name || lead?.ciu_number || "Unnamed student",
          ciu_number: lead?.ciu_number || "",
          phone: lead?.phone || "",
          outcome: interaction.outcome || "",
        };
      }),
    };
    try {
      setSavingGovernance(true);
      setError("");
      const { error: rpcError } = await supabase.rpc("finalize_salesperson_contact_report", {
        p_report_date: todayKey,
        p_report_data: snapshot,
        p_correction_reason: previous ? correctionReason!.trim() : null,
      });
      if (rpcError) throw rpcError;
      setSuccess(previous ? "Correction saved as a new report revision. The original snapshot remains unchanged." : "Daily contact report finalised and locked as an immutable snapshot.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finalise the daily report.");
    } finally {
      setSavingGovernance(false);
    }
  };

  const printContactReport = (snapshot: ContactReportSnapshot) => {
    const data = snapshot.report_data as any;
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      setError("Allow pop-ups to print or save the report as PDF.");
      return;
    }
    const safe = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const rows = Array.isArray(data.calls) ? data.calls.map((call: any) => `<tr><td>${safe(call.contacted_at ? new Intl.DateTimeFormat("en-UG", { timeZone: "Africa/Kampala", dateStyle: "short", timeStyle: "short" }).format(new Date(call.contacted_at)) : "")}</td><td>${safe(call.student_name)}</td><td>${safe(call.phone)}</td><td>${safe(call.outcome)}</td></tr>`).join("") : "";
    popup.document.write(`<!doctype html><html><head><title>CIU Daily Contact Report</title><style>body{font:14px Arial,sans-serif;margin:28px;color:#173b2b}h1{font-size:22px;color:#075442}p{margin:6px 0}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{border:1px solid #d9e4dc;padding:8px;text-align:left}th{background:#f0f8f3}@media print{button{display:none}}</style></head><body><h1>Clarke International University — Daily Contact Report</h1><p><b>Salesperson:</b> ${safe(data.salesperson_name)}</p><p><b>Report date:</b> ${safe(snapshot.report_date)} (EAT)</p><p><b>Unique students contacted:</b> ${safe(data.unique_students_contacted)} / ${safe(data.target)}</p><p><b>Status:</b> ${safe(data.status)}</p><p><b>Revision:</b> ${safe(snapshot.revision)} · <b>Finalised:</b> ${safe(new Intl.DateTimeFormat("en-UG", { timeZone: "Africa/Kampala", dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.finalized_at)))}</p>${snapshot.correction_reason ? `<p><b>Correction reason:</b> ${safe(snapshot.correction_reason)}</p>` : ""}<table><thead><tr><th>Call time (EAT)</th><th>Student</th><th>Phone</th><th>Outcome</th></tr></thead><tbody>${rows}</tbody></table><p style="margin-top:24px;color:#64756b;font-size:11px">System-generated record. Manual call outcomes depend on user entry.</p><button onclick="window.print()">Print / Save as PDF</button></body></html>`);
    popup.document.close();
  };

  const exportAbsenceDecisionHistory = () => {
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows: unknown[][] = [
      ["CIU Absence Decision Audit History"],
      ["Generated at (EAT)", new Intl.DateTimeFormat("en-UG", { timeZone: "Africa/Kampala", dateStyle: "medium", timeStyle: "short" }).format(new Date())],
      [],
      ["Decision time (EAT)", "Salesperson", "Absence date", "Decision", "Decision maker", "Notes", "Request ID"],
      ...absenceDecisionHistory
        .filter((entry) => canViewTeamContactPerformance || entry.salesperson_id === currentUserId)
        .map((entry) => {
          const owner = profiles.find((profile) => profile.id === entry.salesperson_id);
          const decisionMaker = profiles.find((profile) => profile.id === entry.decided_by);
          return [
            new Intl.DateTimeFormat("en-UG", { timeZone: "Africa/Kampala", dateStyle: "short", timeStyle: "short" }).format(new Date(entry.decided_at)),
            owner?.full_name || entry.salesperson_id, entry.absence_date, entry.new_status,
            decisionMaker?.full_name || entry.decided_by, entry.decision_notes || "", entry.request_id,
          ];
        }),
    ];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ciu-absence-decision-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportContactReviewHistory = () => {
    if (!canViewTeamContactPerformance) {
      setError("Only authorised management users can export review history.");
      return;
    }
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows: unknown[][] = [
      ["CIU Management Contact Review Audit"],
      ["Generated at (EAT)", new Intl.DateTimeFormat("en-UG", { timeZone: "Africa/Kampala", dateStyle: "medium", timeStyle: "short" }).format(new Date())],
      [],
      ["Decision time (EAT)", "Student", "CIU number", "Phone", "Decision", "Manager", "New assignee", "Notes", "Lead ID", "Trigger interaction ID"],
      ...contactReviewHistory.map((review) => {
        const lead = leads.find((item) => item.id === review.lead_id);
        const reviewer = profiles.find((profile) => profile.id === review.decided_by);
        const assignee = review.new_assigned_to ? profiles.find((profile) => profile.id === review.new_assigned_to) : null;
        return [
          new Intl.DateTimeFormat("en-UG", { timeZone: "Africa/Kampala", dateStyle: "short", timeStyle: "short" }).format(new Date(review.decided_at)),
          lead?.name || "", lead?.ciu_number || "", lead?.phone || "",
          review.decision === "retain" ? "Retain assignment" : review.decision === "reassign" ? "Reassign lead" : "Other action",
          reviewer?.full_name || review.decided_by, assignee?.full_name || "", review.notes, review.lead_id, review.trigger_interaction_id,
        ];
      }),
    ];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ciu-contact-review-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const unansweredReviewFlags = useMemo(() => {
    const grouped = new Map<string, DailyInteraction[]>();
    for (const interaction of dailyInteractions) {
      if (!interaction.lead_id || !interaction.contacted_at) continue;
      const staffId = interaction.created_by || interaction.assigned_to;
      if (!staffId) continue;
      const key = `${staffId}:${interaction.lead_id}`;
      const list = grouped.get(key) || [];
      list.push(interaction);
      grouped.set(key, list);
    }

    const addTwoWeekdaysForReview = (contactedAt: string) => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Kampala",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date(contactedAt)).reduce((values, part) => {
        if (part.type !== "literal") values[part.type] = part.value;
        return values;
      }, {} as Record<string, string>);
      // 14:00 UTC is 17:00 East Africa Time. This weekday-only estimate
      // must be reconciled with the official CIU/Uganda holiday calendar.
      const due = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 14, 0, 0));
      let weekdaysAdded = 0;
      while (weekdaysAdded < 2) {
        due.setUTCDate(due.getUTCDate() + 1);
        const weekday = due.getUTCDay();
        const dateKey = `${due.getUTCFullYear()}-${String(due.getUTCMonth() + 1).padStart(2, "0")}-${String(due.getUTCDate()).padStart(2, "0")}`;
        const override = workingCalendar.find((day) => day.calendar_date === dateKey && day.is_active);
        const isWorking = override ? override.day_type === "working_day" : weekday !== 0 && weekday !== 6;
        if (isWorking) weekdaysAdded += 1;
      }
      return due;
    };
    const flags: Array<{ key: string; lead: Lead; staffName: string; attempts: number; latestInteractionId: string; lastContactedAt: string; reviewDueAt: string; reviewOverdue: boolean }> = [];
    for (const [key, history] of grouped.entries()) {
      const sorted = [...history].sort((a, b) =>
        new Date(b.contacted_at || 0).getTime() - new Date(a.contacted_at || 0).getTime()
      );
      let attempts = 0;
      for (const interaction of sorted) {
        const response = (interaction.response || "").trim().toLowerCase();
        if (response === "unanswered") {
          attempts += 1;
          continue;
        }
        // Any later answered/invalid-number outcome breaks the consecutive
        // unanswered sequence; only true no-answer attempts trigger this flag.
        break;
      }
      if (attempts < 3) continue;
      const latest = sorted[0];
      const lead = leads.find((item) => item.id === latest.lead_id);
      if (!lead || isClosedLead(lead)) continue;
      const staffId = latest.assigned_to || latest.created_by || "";
      const staff = profiles.find((profile) => profile.id === staffId);
      flags.push({
        key,
        lead,
        staffName: staff?.full_name || "Unknown salesperson",
        attempts,
        latestInteractionId: latest.id,
        lastContactedAt: latest.contacted_at || "",
        reviewDueAt: addTwoWeekdaysForReview(latest.contacted_at || new Date().toISOString()).toISOString(),
        reviewOverdue: reviewClock > addTwoWeekdaysForReview(latest.contacted_at || new Date().toISOString()).getTime(),
      });
    }
    const pendingFlags = flags.filter((flag) => {
      const latestDecision = contactReviewHistory
        .filter((review) => review.lead_id === flag.lead.id)
        .sort((a, b) => new Date(b.decided_at).getTime() - new Date(a.decided_at).getTime())[0];
      return !latestDecision || new Date(latestDecision.decided_at).getTime() < new Date(flag.lastContactedAt).getTime();
    });
    return pendingFlags.sort((a, b) => new Date(a.lastContactedAt).getTime() - new Date(b.lastContactedAt).getTime());
  }, [dailyInteractions, leads, profiles, reviewClock, contactReviewHistory, workingCalendar]);

  const performanceSummary = useMemo(() => {
    const [intakeYear, intakeMonth] = selectedIntake.split("-").map(Number);
    const scoped = tasks.filter((task) => {
      const lead = leads.find((item) => item.id === task.lead_id);
      const year = task.intake_year ?? lead?.intake_year ?? null;
      const month = task.intake_month ?? lead?.intake_month ?? null;
      return selectedIntake === "all" || (selectedIntake === "unassigned" ? !year || !month : year === intakeYear && month === intakeMonth);
    }).filter((task) => !isClosedLead(leads.find((lead) => lead.id === task.lead_id)));
    const visible = currentRole === "salesperson" ? scoped.filter((task) => task.assigned_to === currentUserId) : scoped;
    const now = new Date();
    const dueThisMonth = visible.filter((task) => {
      if (!task.due_at) return false;
      const due = new Date(task.due_at);
      return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
    });
    const completedToday = visible.filter((task) => task.status === "completed" && task.completed_at && isToday(task.completed_at)).length;
    const overdue = visible.filter((task) => isOverdue(task)).length;
    const completedDueThisMonth = dueThisMonth.filter((task) => task.status === "completed").length;
    return {
      outstanding: visible.filter(isActiveTask).length,
      overdue,
      completedToday,
      dueThisMonth: dueThisMonth.length,
      completedDueThisMonth,
      completionRate: dueThisMonth.length ? Math.round((completedDueThisMonth / dueThisMonth.length) * 100) : null,
      isManager: currentRole !== "salesperson",
    };
  }, [tasks, leads, selectedIntake, currentRole, currentUserId]);

  const filteredTasks = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return [...tasks]
      .filter((task) => {
        const lead = getLead(task);
        const staff = getStaff(task);
        const [intakeYear, intakeMonth] = selectedIntake.split("-").map(Number);
        const taskIntakeYear = task.intake_year ?? lead?.intake_year ?? null;
        const taskIntakeMonth = task.intake_month ?? lead?.intake_month ?? null;
        if (selectedIntake !== "all" && (selectedIntake === "unassigned" ? Boolean(taskIntakeYear && taskIntakeMonth) : (taskIntakeYear !== intakeYear || taskIntakeMonth !== intakeMonth))) return false;

        if (
          query &&
          ![
            task.title,
            task.description || "",
            lead?.name || "",
            lead?.ciu_number || "",
            lead?.phone || "",
            lead?.email || "",
            staff?.full_name || "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        ) {
          return false;
        }

        if (quickTaskFilter === "open" && (!isActiveTask(task) || isClosedLead(lead))) return false;
        if (quickTaskFilter === "today" && (!isActiveTask(task) || isClosedLead(lead) || !isToday(task.due_at))) return false;
        if (quickTaskFilter === "overdue" && (!isOverdue(task) || isClosedLead(lead))) return false;
        if (quickTaskFilter === "completed" && task.status !== "completed") return false;
        if (quickTaskFilter === "interested" && !isInterestedLead(lead)) return false;

        if (
          statusFilter !== "all" &&
          task.status !== statusFilter
        ) {
          return false;
        }

        if (
          typeFilter !== "all" &&
          task.task_type.toLowerCase() !== typeFilter
        ) {
          return false;
        }

        if (
          assignedFilter !== "all" &&
          task.assigned_to !== assignedFilter
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const priorityDiff =
          getPriority(a) - getPriority(b);

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return (
          new Date(
            a.due_at || a.created_at
          ).getTime() -
          new Date(
            b.due_at || b.created_at
          ).getTime()
        );
      });
  }, [
    tasks,
    leads,
    profiles,
    search,
    statusFilter,
    quickTaskFilter,
    typeFilter,
    assignedFilter,
    selectedIntake,
  ]);

  const interestedLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    const [intakeYear, intakeMonth] = selectedIntake.split("-").map(Number);
    return leads.filter((lead) => {
      if (selectedIntake !== "all" && (selectedIntake === "unassigned" ? Boolean(lead.intake_year && lead.intake_month) : (lead.intake_year !== intakeYear || lead.intake_month !== intakeMonth))) return false;
      if (!isInterestedLead(lead)) return false;
      if (!query) return true;
      return [lead.name, lead.ciu_number, lead.phone, lead.email, lead.product_service]
        .filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [leads, search, selectedIntake]);

  const leadOutcomeBreakdown = useMemo(() => {
    const normalize = (value: string | null | undefined) =>
      (value || "").trim().toLowerCase().replace(/[ _-]+/g, " ");
    const counts = new Map<string, number>();
    OUTCOMES.forEach((outcome) => counts.set(normalize(outcome), 0));
    let unrecorded = 0;
    const [intakeYear, intakeMonth] = selectedIntake.split("-").map(Number);
    const scopedLeads = leads.filter((lead) =>
      selectedIntake === "all" || (selectedIntake === "unassigned"
        ? !lead.intake_year || !lead.intake_month
        : lead.intake_year === intakeYear && lead.intake_month === intakeMonth)
    );
    scopedLeads.forEach((lead) => {
      const outcome = normalize(lead.follow_up_status);
      if (!outcome || outcome === "pending") {
        counts.set("pending", (counts.get("pending") || 0) + 1);
      } else if (counts.has(outcome)) {
        counts.set(outcome, (counts.get(outcome) || 0) + 1);
      } else {
        unrecorded += 1;
      }
    });
    return {
      total: scopedLeads.length,
      items: [
        { label: "Pending", count: counts.get("pending") || 0 },
        ...OUTCOMES.map((outcome) => ({
          label: outcome,
          count: counts.get(normalize(outcome)) || 0,
        })),
      ],
      unrecorded,
    };
  }, [leads, selectedIntake]);

  const openNewTask = (
    lead?: Lead | null
  ) => {
    setEditingTask(null);

    setWalkInMode(false);
    setWalkInName("");
    setWalkInPhone("");
    setWalkInEmail("");
    setWalkInProgramme("");
    setWalkInNotes("");
    setForm({
      ...EMPTY_FORM,
      lead_id: lead?.id || "",
      assigned_to:
        lead?.assigned_to ||
        currentUserId ||
        "",
      title: lead?.name
        ? `Follow up with ${lead.name}`
        : "",
      task_type: "call",
      due_at: defaultTaskDeadline(lead),
    });

    setShowTaskModal(true);
    setError("");
    setSuccess("");
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);

    setForm({
      title: task.title || "",
      description:
        task.description || "",
      task_type: (
        TASK_TYPES.includes(
          task.task_type.toLowerCase() as TaskType
        )
          ? task.task_type.toLowerCase()
          : "other"
      ) as TaskType,
      lead_id: task.lead_id || "",
      opportunity_id:
        task.opportunity_id || "",
      assigned_to:
        task.assigned_to || "",
      due_at: toDateTimeLocal(
        task.due_at
      ),
      status:
        (TASK_STATUSES.includes(
          task.status as TaskStatus
        )
          ? task.status
          : "pending") as TaskStatus,
      priority: TASK_PRIORITIES.includes(task.priority as TaskPriority) ? task.priority as TaskPriority : "medium",
    });

    setShowTaskModal(true);
  };

  const saveTask = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!form.title.trim()) {
        throw new Error(
          "Task title is required."
        );
      }

      if (
  isSalesperson &&
  !isAdmin &&
  form.assigned_to &&
  form.assigned_to !== currentUserId
) {
  throw new Error(
    "You can only assign tasks to yourself."
  );
}

      let linkedLeadId = form.lead_id || null;
      let linkedOpportunityId = form.opportunity_id || null;
      let linkedAssigneeId = form.assigned_to || null;

      if (!editingTask && walkInMode) {
        if (!walkInName.trim()) throw new Error("Please enter the walk-in student's full name.");
        if (!walkInPhone.trim() && !walkInEmail.trim()) throw new Error("Enter at least a telephone number or email address for the walk-in.");

        // Automatically distribute walk-ins to the active salesperson with the fewest open tasks.
        const activeSalespeople = profiles
          .filter((profile) => profile.is_active !== false && profile.role === "salesperson")
          .sort((a, b) => {
            const aOpenTasks = tasks.filter((task) => task.assigned_to === a.id && !["completed", "cancelled", "canceled"].includes(String(task.status).toLowerCase())).length;
            const bOpenTasks = tasks.filter((task) => task.assigned_to === b.id && !["completed", "cancelled", "canceled"].includes(String(task.status).toLowerCase())).length;
            return aOpenTasks - bOpenTasks || String(a.full_name || "").localeCompare(String(b.full_name || ""));
          });

        if (activeSalespeople.length === 0) {
          throw new Error("No active salesperson is available to assign this walk-in. Ask an administrator to activate a salesperson account.");
        }

        linkedAssigneeId = activeSalespeople[0].id;

        const leadPayload = {
          name: walkInName.trim(),
          phone: walkInPhone.trim() || null,
          email: walkInEmail.trim() || null,
          product_service: walkInProgramme.trim() || null,
          intake_year: selectedIntake === "unassigned" ? null : selectedIntake === "all" ? 2027 : Number(selectedIntake.split("-")[0]),
          intake_month: selectedIntake === "unassigned" ? null : selectedIntake === "all" ? 2 : Number(selectedIntake.split("-")[1]),
          original_intake_year: selectedIntake === "unassigned" ? null : selectedIntake === "all" ? 2027 : Number(selectedIntake.split("-")[0]),
          original_intake_month: selectedIntake === "unassigned" ? null : selectedIntake === "all" ? 2 : Number(selectedIntake.split("-")[1]),
          location: "Walk-in",
          status: "new",
          assigned_to: linkedAssigneeId,
          feedback: walkInNotes.trim() || null,
          notes: ["Lead source: Walk-in", walkInNotes.trim()].filter(Boolean).join("\n"),
          follow_up_status: "Pending",
          next_follow_up_at: form.due_at ? new Date(form.due_at).toISOString() : null,
          updated_at: new Date().toISOString(),
        };

        const { data: newLead, error: leadInsertError } = await supabase
          .from("leads")
          .insert(leadPayload)
          .select("id,name,assigned_to")
          .single();

        if (leadInsertError) throw leadInsertError;
        linkedLeadId = newLead.id;

        const { data: existingOpportunity, error: opportunityLookupError } = await supabase
          .from("opportunities").select("id").eq("lead_id", newLead.id).maybeSingle();
        if (opportunityLookupError) throw opportunityLookupError;

        if (!existingOpportunity) {
          const firstStage = stages.find((stage) => !stage.is_won && !stage.is_lost) || stages[0];
          const { data: newOpportunity, error: opportunityInsertError } = await supabase
            .from("opportunities")
            .insert({
              lead_id: newLead.id,
              title: `${newLead.name || "Walk-in student"} - Admission`,
              assigned_to: linkedAssigneeId,
              status: "open",
              stage_id: firstStage?.id || null,
              probability: Number(firstStage?.probability || 0),
            })
            .select("id").maybeSingle();
          if (opportunityInsertError) throw opportunityInsertError;
          linkedOpportunityId = newOpportunity?.id || null;
        }
      }

      const payload = {
        title: form.title.trim(),
        description: [form.description.trim(), !editingTask && walkInMode ? `Walk-in registration: ${walkInName.trim()}${walkInProgramme.trim() ? ` | Programme: ${walkInProgramme.trim()}` : ""}${walkInNotes.trim() ? ` | Notes: ${walkInNotes.trim()}` : ""}` : ""].filter(Boolean).join("\n") || null,
        task_type: form.task_type,
        lead_id: linkedLeadId,
        opportunity_id: linkedOpportunityId,
        assigned_to: !editingTask && walkInMode ? linkedAssigneeId : (form.assigned_to || null),
        due_at: isDeadlineExemptLead(
          linkedLeadId ? leads.find((lead) => lead.id === linkedLeadId) : null
        )
          ? null
          : form.due_at
            ? new Date(form.due_at).toISOString()
            : !editingTask
              ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
              : null,
        status: form.status,
        priority: form.priority,
        intake_year: linkedLeadId ? (leads.find((lead) => lead.id === linkedLeadId)?.intake_year ?? (selectedIntake === "unassigned" ? null : selectedIntake === "all" ? 2027 : Number(selectedIntake.split("-")[0]))) : (selectedIntake === "unassigned" ? null : selectedIntake === "all" ? 2027 : Number(selectedIntake.split("-")[0])),
        intake_month: linkedLeadId ? (leads.find((lead) => lead.id === linkedLeadId)?.intake_month ?? (selectedIntake === "unassigned" ? null : selectedIntake === "all" ? 2 : Number(selectedIntake.split("-")[1]))) : (selectedIntake === "unassigned" ? null : selectedIntake === "all" ? 2 : Number(selectedIntake.split("-")[1])),
        updated_at: new Date().toISOString(),
      };

      if (editingTask) {
        const { error } =
          await supabase
            .from("tasks")
            .update(payload)
            .eq(
              "id",
              editingTask.id
            );

        if (error) throw error;

        setSuccess(
          "Task updated successfully."
        );
      } else {
        const { data: createdTask, error } =
          await supabase
            .from("tasks")
            .insert({
              ...payload,
              created_by: currentUserId,
            })
            .select("id")
            .single();

        if (error) throw error;

        // Keep one current open follow-up per lead. Previous tasks remain in
        // the task history as cancelled, with a note explaining the replacement.
        if (linkedLeadId) {
          const previousTasks = tasks.filter(
            (task) =>
              task.lead_id === linkedLeadId &&
              task.id !== createdTask.id &&
              isActiveTask(task)
          );

          for (const previousTask of previousTasks) {
            const historyNote = `Replaced by a newer follow-up task on ${new Date().toLocaleString("en-UG")}.`;
            const previousDescription = previousTask.description?.trim();
            const updatedDescription = [previousDescription, historyNote]
              .filter(Boolean)
              .join("\n");

            const { error: historyError } = await supabase
              .from("tasks")
              .update({
                status: "cancelled",
                description: updatedDescription,
                completed_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", previousTask.id);

            if (historyError) throw historyError;
          }
        }

        setSuccess(
          walkInMode
            ? "Walk-in student registered, added to the pipeline, and follow-up task created."
            : "New task created. The previous open follow-up was moved to history."
        );
      }

      setShowTaskModal(false);
      setEditingTask(null);
      setForm(EMPTY_FORM);
      setWalkInMode(false);
      setWalkInName("");
      setWalkInPhone("");
      setWalkInEmail("");
      setWalkInProgramme("");
      setWalkInNotes("");

      await loadAll();
    } catch (err: unknown) {
      console.error("Failed to save task:", err);

      const message =
        err &&
        typeof err === "object" &&
        "message" in err
          ? String(err.message)
          : err instanceof Error
            ? err.message
            : JSON.stringify(err);

      setError(
        message || "Failed to save task. Check the browser console."
      );
    } finally {
      setSaving(false);
    }
  };

  const updateTaskStatus = async (
    task: Task,
    status: TaskStatus
  ) => {
    try {
      setError("");
      setSuccess("");

      const { error } =
        await supabase
          .from("tasks")
          .update({
            status,
            completed_at:
              status === "completed"
                ? new Date().toISOString()
                : null,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", task.id);

      if (error) throw error;

      // Completing a task linked to a lead records application progress
      // on the lead and moves the same lead's opportunity into Applied.
      if (status === "completed" && task.lead_id) {
        const completedAt = new Date().toISOString();
        const { error: leadError } = await supabase
          .from("leads")
          .update({
            status: "converted",
            follow_up_status: "Applied",
            next_follow_up_at: null,
            converted_at: completedAt,
            updated_at: completedAt,
          })
          .eq("id", task.lead_id);

        if (leadError) throw leadError;

        const appliedStage = stages.find((stage) =>
          ["applied", "application", "application started"].includes(
            (stage.name || "").trim().toLowerCase()
          )
        );
        if (!appliedStage) {
          throw new Error("The Applied pipeline stage is missing. The lead was updated, but its pipeline stage could not be synchronized.");
        }

        const { data: linkedOpportunity, error: opportunityLookupError } = await supabase
          .from("opportunities")
          .select("id, lead_id, title, value, probability, stage_id, status, assigned_to")
          .eq("lead_id", task.lead_id)
          .limit(1)
          .maybeSingle();

        if (opportunityLookupError) throw opportunityLookupError;

        if (linkedOpportunity) {
          const { error: opportunityUpdateError } = await supabase
            .from("opportunities")
            .update({
              stage_id: appliedStage.id,
              probability: Number(appliedStage.probability ?? 35),
              status: "open",
              updated_at: completedAt,
            })
            .eq("id", linkedOpportunity.id);
          if (opportunityUpdateError) throw opportunityUpdateError;
        } else {
          const lead = leads.find((item) => item.id === task.lead_id);
          if (!lead) throw new Error("The linked lead could not be found to create its pipeline record.");
          const { error: opportunityCreateError } = await supabase
            .from("opportunities")
            .insert({
              lead_id: lead.id,
              title: lead.name || lead.ciu_number || "Student recruitment",
              value: 0,
              probability: Number(appliedStage.probability ?? 35),
              stage_id: appliedStage.id,
              status: "open",
              assigned_to: lead.assigned_to,
              updated_at: completedAt,
            });
          if (opportunityCreateError) throw opportunityCreateError;
        }
      }

      setSuccess(
        status === "completed" && task.lead_id
          ? "Task completed and lead updated as Applied/Admitted."
          : "Task status updated."
      );

      await loadAll();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update task."
      );
    }
  };

  const markComplete = async (task: Task) => {
    if (task.lead_id) {
      openOutcome(task);
      return;
    }
    await updateTaskStatus(task, "completed");
  };

  const runBulkAction = async (action: "assign" | "reschedule" | "priority") => {
    const selected = filteredTasks.filter((task) => selectedTaskIds.includes(task.id));
    if (!selected.length) { setError("Select at least one task first."); return; }
    let patch: Record<string, unknown> = {};
    if (action === "assign") {
      if (isSalesperson) { setError("Only managers can reassign tasks in bulk."); return; }
      const choices = profiles.filter((profile) => profile.is_active !== false && profile.role === "salesperson");
      const choiceText = choices.map((profile, index) => `${index + 1}. ${profile.full_name || "Unnamed staff"}`).join("\\n");
      const selectedNumber = window.prompt(`Enter the staff number to assign ${selected.length} task(s) to, or leave blank to unassign.\\n${choiceText}`);
      if (selectedNumber === null) return;
      const normalized = selectedNumber.trim();
      if (normalized && !/^\\d+$/.test(normalized)) { setError("Enter one of the numbered staff options."); return; }
      const chosenProfile = normalized ? choices[Number(normalized) - 1] : null;
      if (normalized && !chosenProfile) { setError("Choose a valid staff number from the list."); return; }
      patch = { assigned_to: chosenProfile?.id || null };
    } else if (action === "reschedule") {
      const date = window.prompt("Enter the new due date and time (YYYY-MM-DD HH:mm), or leave blank to remove the due date.");
      if (date === null) return;
      if (date.trim()) {
        const parsed = new Date(date.trim().replace(" ", "T"));
        if (Number.isNaN(parsed.getTime())) { setError("Enter a valid date and time, for example 2026-11-20 14:30."); return; }
        patch = { due_at: parsed.toISOString() };
      } else patch = { due_at: null };
    } else {
      const priority = window.prompt("Set priority: high, medium or low.", "medium");
      if (priority === null) return;
      const normalized = priority.trim().toLowerCase();
      if (!TASK_PRIORITIES.includes(normalized as TaskPriority)) { setError("Priority must be high, medium or low."); return; }
      patch = { priority: normalized };
    }
    if (!window.confirm(`Apply this change to ${selected.length} selected task(s)?`)) return;
    try {
      setBulkBusy(true); setError(""); setSuccess("");
      const { error: updateError } = await supabase.from("tasks").update({ ...patch, updated_at: new Date().toISOString() }).in("id", selected.map((task) => task.id));
      if (updateError) throw updateError;
      setSelectedTaskIds([]);
      setSuccess(`Updated ${selected.length} task(s) successfully.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk update failed.");
    } finally { setBulkBusy(false); }
  };

  const deleteTask = async (
    task: Task
  ) => {
    if (
      !window.confirm(
        `Delete "${task.title}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const { error } =
        await supabase
          .from("tasks")
          .delete()
          .eq("id", task.id);

      if (error) throw error;

      if (
        selectedTask?.id === task.id
      ) {
        setSelectedTask(null);
      }

      setSuccess(
        "Task deleted successfully."
      );

      await loadAll();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete task."
      );
    }
  };

  const callStudent = (
    lead: Lead | null
  ) => {
    if (!lead?.phone) {
      setError(
        "This student does not have a phone number."
      );
      return;
    }

    window.location.href =
      `tel:${lead.phone}`;
  };

  const whatsappStudent = (
    lead: Lead | null
  ) => {
    if (!lead?.phone) {
      setError(
        "This student does not have a phone number."
      );
      return;
    }

    const phone = lead.phone.replace(
      /[^\d]/g,
      ""
    );

    if (!phone) {
      setError(
        "The student phone number is invalid."
      );
      return;
    }

    window.open(
      `https://wa.me/${phone}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const emailStudent = (
    lead: Lead | null
  ) => {
    if (!lead?.email) {
      setError(
        "This student does not have an email address."
      );
      return;
    }

    window.location.href =
      `mailto:${lead.email}`;
  };

  const recordContactReviewDecision = async (flag: { lead: Lead; latestInteractionId: string }) => {
    if (!canViewTeamContactPerformance) {
      setError("Only authorised management users can record contact review decisions.");
      return;
    }
    const choice = window.prompt("Choose management action: type RETAIN, REASSIGN, or OTHER.", "RETAIN");
    if (choice === null) return;
    const normalized = choice.trim().toLowerCase();
    const decision = normalized === "retain" ? "retain" : normalized === "reassign" ? "reassign" : normalized === "other" || normalized === "other_action" ? "other_action" : null;
    if (!decision) {
      setError("Enter RETAIN, REASSIGN, or OTHER.");
      return;
    }
    let newAssignee: string | null = null;
    if (decision === "reassign") {
      const salespeople = profiles.filter((profile) => profile.is_active !== false && profile.role === "salesperson");
      if (!salespeople.length) {
        setError("No active salespeople are available for reassignment.");
        return;
      }
      const selected = window.prompt("Enter the number of the new salesperson:\n" + salespeople.map((person, index) => `${index + 1}. ${person.full_name || "Unnamed salesperson"}`).join("\n"));
      if (selected === null) return;
      if (!/^\d+$/.test(selected.trim()) || !salespeople[Number(selected.trim()) - 1]) {
        setError("Choose a valid salesperson number.");
        return;
      }
      newAssignee = salespeople[Number(selected.trim()) - 1].id;
    }
    const notes = window.prompt("Enter the management review notes (required for the audit trail):");
    if (notes === null) return;
    if (!notes.trim()) {
      setError("Review notes are required.");
      return;
    }
    try {
      setSavingReviewLeadId(flag.lead.id);
      setError("");
      setSuccess("");
      const { error: rpcError } = await supabase.rpc("record_lead_contact_review_decision", {
        p_lead_id: flag.lead.id,
        p_trigger_interaction_id: flag.latestInteractionId,
        p_decision: decision,
        p_notes: notes.trim(),
        p_new_assigned_to: newAssignee,
      });
      if (rpcError) throw rpcError;
      setSuccess(decision === "reassign" ? "Review recorded and lead reassigned. The decision is retained in the audit history." : "Management review decision saved to the audit history.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the management review decision.");
    } finally {
      setSavingReviewLeadId(null);
    }
  };

  const suggestNextWeekdayFollowUp = () => {
    // Suggest the next official working day using the maintained CIU calendar.
    const suggested = new Date();
    suggested.setDate(suggested.getDate() + 1);
    while (!isOfficialWorkingDay(getEATDateKey(suggested))) {
      suggested.setDate(suggested.getDate() + 1);
    }
    suggested.setHours(9, 0, 0, 0);
    setOutcomeDate(toDateTimeLocal(suggested.toISOString()));
  };

  const openOutcome = (
    task: Task
  ) => {
    const lead = getLead(task);

    setOutcomeTask(task);
    setSelectedOutcome("");
    setOutcomeNotes(
      lead?.feedback || ""
    );
    setOutcomeDate(
      task.due_at
        ? toDateTimeLocal(
            task.due_at
          )
        : toDateTimeLocal(
            new Date().toISOString()
          )
    );

    setError("");
    setSuccess("");
  };

  const updateLeadFromOutcome = async (
    task: Task,
    outcome: string,
    notes: string
  ) => {
    if (!task.lead_id) return;

    
    const leadStatusMap: Record<string, string> = {
      Interested: "qualified",

      Applied: "converted",
      "Application Submitted": "converted",
      Admitted: "converted",
      "Paid Application Fee": "converted",
      "Acceptance Fee Paid": "converted",
      "Paid Acceptance Fee": "converted",
      Enrolled: "converted",

      // Follow-up outcomes are not lead statuses.
      "Follow up later": "contacted",
      "Financial issues": "contacted",
      "No Answer": "contacted",
      Unreachable: "contacted",

      "Not interested": "unqualified",
      "Lost Leads": "lost",
      "Wrong Number": "unqualified",
      Dropped: "lost",
    };

    const leadStatus =
      leadStatusMap[outcome] ||
      "contacted";

    const { error } =
      await supabase
        .from("leads")
        .update({
          status: leadStatus,
          feedback:
            notes.trim() || null,
          follow_up_status: outcome,
          next_follow_up_at:
            null,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          task.lead_id
        );

    if (error) {
      throw error;
    }
  };

  const moveToPipeline = async (
    task: Task,
    stageName: string
  ) => {
    if (!task.lead_id) return;

    const lead = getLead(task);

    if (!lead) {
      throw new Error(
        "The linked student could not be found."
      );
    }

    let targetStageName =
      stageName;

    switch (stageName) {
      case "Applied":
      case "Application Submitted":
      case "Admitted":
        targetStageName = "Applied";
        break;

      case "Paid Application Fee":
        targetStageName =
          "Paid Application Fee";
        break;

      case "Acceptance Fee Paid":
      case "Paid Acceptance Fee":
        targetStageName =
          "Paid Acceptance Fee";
        break;

      case "Enrolled":
        targetStageName = "Enrolled";
        break;

      default:
        return;
    }

    const targetStage =
      stages.find(
        (stage) =>
          stage.name
            .trim()
            .toLowerCase() ===
          targetStageName
            .trim()
            .toLowerCase()
      ) ||
      stages.find(
        (stage) =>
          stage.name
            .toLowerCase()
            .includes(
              targetStageName.toLowerCase()
            )
      );

    if (!targetStage) {
      throw new Error(
        `Pipeline stage "${targetStageName}" was not found.`
      );
    }

    const assignedTo =
      task.assigned_to ||
      lead.assigned_to ||
      currentUserId;

    let opportunityId =
      task.opportunity_id;

    if (!opportunityId) {
      const {
        data: existingOpportunity,
        error: opportunityLookupError,
      } = await supabase
        .from("opportunities")
        .select("id")
        .eq(
          "lead_id",
          lead.id
        )
        .maybeSingle();

      if (opportunityLookupError) {
        throw opportunityLookupError;
      }

      opportunityId =
        existingOpportunity?.id ||
        null;
    }

    if (opportunityId) {
      const { error } =
        await supabase
          .from("opportunities")
          .update({
            stage_id:
              targetStage.id,
            assigned_to:
              assignedTo,
            probability:
              Number(
                targetStage.probability ||
                  0
              ),
            status:
              targetStage.name
                .trim()
                .toLowerCase() ===
              "enrolled"
                ? "won"
                : "open",
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            opportunityId
          );

      if (error) throw error;

      return;
    }

    const { error } =
      await supabase
        .from("opportunities")
        .insert({
          lead_id: lead.id,
          title: lead.name
            ? `${lead.name} - Admission`
            : "Admission Opportunity",
          stage_id:
            targetStage.id,
          assigned_to:
            assignedTo,
          status:
            targetStage.name
              .trim()
              .toLowerCase() ===
            "enrolled"
              ? "won"
              : "open",
          probability:
            Number(
              targetStage.probability ||
                0
            ),
        });

    if (error) throw error;
  };

  const createFollowUpTask = async (
    task: Task,
    followUpDate: string
  ) => {
    if (!task.lead_id) return;

    const lead = getLead(task);

    if (!lead) return;

    const assignedTo =
      task.assigned_to ||
      lead.assigned_to ||
      currentUserId;

    /*
     * DUPLICATE PROTECTION
     *
     * Do not create another active task for
     * the same student and staff member if
     * one already exists.
     */
    const { data: existingTasks, error } =
      await supabase
        .from("tasks")
        .select(
          "id,status,due_at,title"
        )
        .eq(
          "lead_id",
          task.lead_id
        )
        .eq(
          "assigned_to",
          assignedTo
        )
        .neq(
          "id",
          task.id
        )
        .in("status", [
          "pending",
          "in_progress",
        ])
        .limit(1);

    if (error) throw error;

    if (
      existingTasks &&
      existingTasks.length > 0
    ) {
      return;
    }

    if (isDeadlineExemptLead(lead)) return;

    const dateValue =
      followUpDate ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } =
      await supabase
        .from("tasks")
        .insert({
          title: `Follow up with ${
            lead.name || "Student"
          }`,
          description:
            "Follow-up task automatically created after the previous task outcome.",
          task_type:
            task.task_type.toLowerCase() === "whatsapp"
              ? "whatsapp"
              : task.task_type.toLowerCase() === "email"
                ? "email"
                : "call",
          lead_id:
            task.lead_id,
          opportunity_id:
            task.opportunity_id ||
            null,
          assigned_to:
            assignedTo,
          due_at:
            new Date(
              dateValue
            ).toISOString(),
          status: "pending",
          intake_year: lead.intake_year ?? (selectedIntake === "unassigned" ? null : selectedIntake === "all" ? 2027 : Number(selectedIntake.split("-")[0])),
          intake_month: lead.intake_month ?? (selectedIntake === "unassigned" ? null : selectedIntake === "all" ? 2 : Number(selectedIntake.split("-")[1])),
          created_by:
            currentUserId,
        });

    if (insertError) {
      throw insertError;
    }

    const { error: leadError } =
      await supabase
        .from("leads")
        .update({
          next_follow_up_at:
            new Date(
              dateValue
            ).toISOString(),
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          task.lead_id
        );

    if (leadError) {
      throw leadError;
    }
  };

  const saveOutcome = async () => {
    if (!outcomeTask) return;

    if (!selectedOutcome) {
      setError(
        "Please select an outcome."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await updateLeadFromOutcome(
        outcomeTask,
        selectedOutcome,
        outcomeNotes
      );

      const previousDescription =
        outcomeTask.description
          ?.trim() || "";

      const outcomeEntry =
        `[${new Date().toLocaleString(
          "en-UG"
        )}] Outcome: ${selectedOutcome}${
          outcomeNotes.trim()
            ? ` — ${outcomeNotes.trim()}`
            : ""
        }`;

      const newDescription =
        previousDescription
          ? `${previousDescription}\n\n${outcomeEntry}`
          : outcomeEntry;

      // Log each call outcome in the existing engagement history. The task_id
      // lookup makes retries idempotent at the UI level and avoids counting a
      // second interaction when the task save is retried.
      // Record the call interaction before completing the task. If interaction
      // logging fails, the task remains open; if task completion then fails,
      // a retry finds the existing interaction and can safely finish the task.
      if ((outcomeTask.task_type || "").toLowerCase() === "call" && outcomeTask.lead_id) {
        const { data: priorInteraction, error: priorInteractionError } = await supabase
          .from("engagement_interactions")
          .select("id")
          .eq("task_id", outcomeTask.id)
          .limit(1)
          .maybeSingle();
        if (priorInteractionError) throw priorInteractionError;

        if (!priorInteraction) {
          const normalizedOutcome = selectedOutcome.trim().toLowerCase();
          const response = ["no answer", "unreachable"].includes(normalizedOutcome)
            ? "unanswered"
            : normalizedOutcome === "wrong number"
              ? "invalid_number"
              : "answered";
          const { error: interactionInsertError } = await supabase
            .from("engagement_interactions")
            .insert({
              lead_id: outcomeTask.lead_id,
              task_id: outcomeTask.id,
              reason: "Salesperson task call outcome",
              channel: "outgoing_call",
              response,
              outcome: selectedOutcome,
              assigned_to: currentUserId,
              created_by: currentUserId,
              contacted_at: new Date().toISOString(),
            });
          if (interactionInsertError) throw interactionInsertError;
        }
      }

      const { error: taskError } =
        await supabase
          .from("tasks")
          .update({
            description: newDescription,
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", outcomeTask.id);

      if (taskError) {
        throw taskError;
      }

      if (
        PIPELINE_WAITING_OUTCOMES.includes(
          selectedOutcome
        ) ||
        selectedOutcome === "Enrolled"
      ) {
        await moveToPipeline(
          outcomeTask,
          selectedOutcome
        );
      }

      if (
        selectedOutcome ===
          "Follow up later" ||
        selectedOutcome ===
          "No Answer" ||
        selectedOutcome ===
          "Unreachable"
      ) {
        await createFollowUpTask(
          outcomeTask,
          outcomeDate
        );
      }

      setOutcomeTask(null);
      setSelectedOutcome("");
      setOutcomeNotes("");
      setOutcomeDate("");

      setSuccess(
        `Outcome "${selectedOutcome}" recorded successfully.`
      );

      await loadAll();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save outcome."
      );
    } finally {
      setSaving(false);
    }
  };

  const autoAssignLeads = async () => {
    const activeSalespeople = profiles
      .filter((profile) => profile.role === "salesperson" && profile.is_active !== false)
      .sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || "")));

    if (activeSalespeople.length === 0) {
      setError("No active salespeople are available. Activate at least one salesperson account and try again.");
      return;
    }

    const [year, month] = selectedIntake.split("-").map(Number);
    // Keep all leads in scope so the action can repair missing tasks even for
    // leads that were assigned during an earlier run. Only unassigned leads
    // are distributed; existing owners are preserved.
    const scopedLeads = leads.filter((lead) =>
      selectedIntake === "all" ||
      (selectedIntake === "unassigned"
        ? !lead.intake_year || !lead.intake_month
        : lead.intake_year === year && lead.intake_month === month)
    );
    const unassignedLeads = scopedLeads.filter((lead) => !lead.assigned_to);
    const leadsMissingActiveTasks = scopedLeads.filter((lead) =>
      !isClosedLead(lead) && !tasks.some((task) => task.lead_id === lead.id && isActiveTask(task))
    );

    if (scopedLeads.length === 0 || (unassignedLeads.length === 0 && leadsMissingActiveTasks.length === 0)) {
      setError("There are no unassigned leads or missing active follow-up tasks in the selected intake.");
      return;
    }

    const scopeLabel = selectedIntake === "all"
      ? "all intakes"
      : selectedIntake === "unassigned"
        ? "leads without an intake"
        : ({ "2026-11": "November 2026", "2027-2": "February 2027", "2027-4": "April 2027", "2027-8": "August 2027", "2027-11": "November 2027", "2028-2": "February 2028" } as Record<string, string>)[selectedIntake] || selectedIntake;

    const confirmed = window.confirm(
      `Assign ${unassignedLeads.length.toLocaleString()} unassigned leads in ${scopeLabel} across ${activeSalespeople.length} active salespeople, and create up to ${leadsMissingActiveTasks.length.toLocaleString()} missing follow-up tasks? Existing lead assignments and active tasks will be preserved.`
    );
    if (!confirmed) return;

    try {
      setAutoAssigningLeads(true);
      setError("");
      setSuccess("");

      // Count existing assignments across all intakes to balance total lead workload.
      const scopedIds = new Set(unassignedLeads.map((lead) => lead.id));
      const workload = new Map<string, number>();
      activeSalespeople.forEach((person) => workload.set(person.id, 0));
      leads.forEach((lead) => {
        if (scopedIds.has(lead.id) || !lead.assigned_to) return;
        if (workload.has(lead.assigned_to)) {
          workload.set(lead.assigned_to, (workload.get(lead.assigned_to) || 0) + 1);
        }
      });

      const assignments = new Map<string, string[]>();
      activeSalespeople.forEach((person) => assignments.set(person.id, []));
      [...unassignedLeads]
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
        .forEach((lead) => {
          const nextPerson = [...activeSalespeople].sort((a, b) =>
            (workload.get(a.id) || 0) - (workload.get(b.id) || 0) ||
            String(a.full_name || "").localeCompare(String(b.full_name || ""))
          )[0];
          assignments.get(nextPerson.id)?.push(lead.id);
          workload.set(nextPerson.id, (workload.get(nextPerson.id) || 0) + 1);
        });

      // Update in small batches per salesperson; no lead records are created or deleted.
      for (const person of activeSalespeople) {
        const ids = assignments.get(person.id) || [];
        for (let offset = 0; offset < ids.length; offset += 100) {
          const batchIds = ids.slice(offset, offset + 100);
          const { error: updateError } = await supabase
            .from("leads")
            .update({ assigned_to: person.id, updated_at: new Date().toISOString() })
            .in("id", batchIds);
          if (updateError) throw updateError;

          // Keep existing follow-up tasks and pipeline opportunities aligned
          // with the lead owner so staff workload counts reflect reassignment.
          const { error: taskAssignmentError } = await supabase
            .from("tasks")
            .update({ assigned_to: person.id, updated_at: new Date().toISOString() })
            .in("lead_id", batchIds);
          if (taskAssignmentError) throw taskAssignmentError;

          const { error: opportunityAssignmentError } = await supabase
            .from("opportunities")
            .update({ assigned_to: person.id, updated_at: new Date().toISOString() })
            .in("lead_id", batchIds);
          if (opportunityAssignmentError) throw opportunityAssignmentError;
        }
      }

      // Create an outstanding follow-up task for each newly assigned, active
      // lead that has no existing active task. Existing tasks are never duplicated.
      const newlyAssigned = scopedLeads.map((lead) => {
        const assignedPerson = activeSalespeople.find((person) => assignments.get(person.id)?.includes(lead.id));
        return assignedPerson ? { ...lead, assigned_to: assignedPerson.id } : lead;
      });
      const leadsNeedingTasks = newlyAssigned.filter((lead) =>
        !isClosedLead(lead) && !tasks.some((task) => task.lead_id === lead.id && isActiveTask(task))
      );
      const taskRows = leadsNeedingTasks.map((lead) => {
        const linkedOpportunity = opportunities.find((opportunity) => opportunity.lead_id === lead.id);
        return {
          title: `Follow up with ${lead.name || "Student"}`,
          description: "Follow-up task created automatically when the lead was assigned to a salesperson.",
          task_type: "call",
          lead_id: lead.id,
          opportunity_id: linkedOpportunity?.id || null,
          assigned_to: lead.assigned_to,
          due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: "pending",
          priority: "medium",
          intake_year: lead.intake_year ?? null,
          intake_month: lead.intake_month ?? null,
          created_by: currentUserId,
        };
      });
      let createdTaskCount = 0;
      for (let offset = 0; offset < taskRows.length; offset += 100) {
        const batch = taskRows.slice(offset, offset + 100);
        const { error: taskInsertError } = await supabase.from("tasks").insert(batch);
        if (taskInsertError) throw taskInsertError;
        createdTaskCount += batch.length;
      }

      setLeads((current) => current.map((lead) => {
        const person = activeSalespeople.find((item) => assignments.get(item.id)?.includes(lead.id));
        return person ? { ...lead, assigned_to: person.id } : lead;
      }));
      setLeadAssignmentFilter("unassigned");
      await loadAll();
      setSuccess(`Assigned ${unassignedLeads.length.toLocaleString()} previously unassigned leads across ${activeSalespeople.length} active salespeople for ${scopeLabel}; created ${createdTaskCount.toLocaleString()} new follow-up tasks for leads that lacked one. Existing assignments and active tasks were preserved.`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Automatic lead assignment failed. Please refresh and check assignments before retrying.");
      await loadAll();
    } finally {
      setAutoAssigningLeads(false);
    }
  };

  const assignLeadToSalesperson = async (leadId: string, salespersonId: string) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.assigned_to === (salespersonId || null)) return;
    try {
      setSavingLeadAssignmentId(leadId);
      setError("");
      setSuccess("");
      const { error: assignmentError } = await supabase
        .from("leads")
        .update({
          assigned_to: salespersonId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);
      if (assignmentError) throw assignmentError;

      // Reassign existing follow-up tasks and pipeline records with their lead.
      const { error: linkedTaskError } = await supabase
        .from("tasks")
        .update({ assigned_to: salespersonId || null, updated_at: new Date().toISOString() })
        .eq("lead_id", leadId);
      if (linkedTaskError) throw linkedTaskError;

      const { error: linkedOpportunityError } = await supabase
        .from("opportunities")
        .update({ assigned_to: salespersonId || null, updated_at: new Date().toISOString() })
        .eq("lead_id", leadId);
      if (linkedOpportunityError) throw linkedOpportunityError;

      setLeads((current) => current.map((item) =>
        item.id === leadId ? { ...item, assigned_to: salespersonId || null } : item
      ));
      await loadAll();
      const person = profiles.find((item) => item.id === salespersonId);
      setSuccess(salespersonId
        ? `${lead.name || "Lead"} assigned to ${person?.full_name || "the selected salesperson"}.`
        : `${lead.name || "Lead"} is now unassigned.`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not update lead assignment.");
    } finally {
      setSavingLeadAssignmentId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setQuickTaskFilter("all");
    setTypeFilter("all");
    setAssignedFilter("all");
  };

  // Assignment progress is scoped to the selected recruitment intake.
  // The total lead count remains informational; the outstanding assignment
  // count should reach zero when every lead in scope has an owner.
  const assignmentQueueStats = useMemo(() => {
    const [year, month] = selectedIntake.split("-").map(Number);
    const scopedLeads = leads.filter((lead) =>
      selectedIntake === "all" ||
      (selectedIntake === "unassigned"
        ? !lead.intake_year || !lead.intake_month
        : lead.intake_year === year && lead.intake_month === month)
    );
    return {
      total: scopedLeads.length,
      unassigned: scopedLeads.filter((lead) => !lead.assigned_to).length,
    };
  }, [leads, selectedIntake]);

  return (
    <div
      className="ciu-tasks-page"
      style={{
        minHeight: "100vh",
        background: "#f7f9f8",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "1500px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}
<div
  className="ciu-tasks-hero"
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
    marginBottom: "12px",
    padding: "14px 18px",
    background: "#ffffff",
    border: "1px solid #e0e7e3",
    borderLeft: "3px solid #006b59",
    borderRadius: "10px",
    boxShadow: "0 1px 3px rgba(20, 40, 32, 0.035)",
    position: "relative",
    overflow: "hidden",
  }}
>
  <div style={{ position: "relative", zIndex: 1 }}>
    <h1
      style={{
        margin: 0,
        fontSize: "26px",
        lineHeight: 1.25,
        fontWeight: 700,
        color: "#202b26",
        letterSpacing: "-0.03em",
      }}
    >
      {isSalesperson ? "My Tasks" : "Tasks & Follow-ups"}
    </h1>

    <p
      style={{
        margin: "9px 0 0",
        color: "#64756b",
        fontSize: "14px",
        lineHeight: 1.6,
      }}
    >
      {isSalesperson
        ? "Manage your assigned student activities and follow-ups."
        : "Manage student activities, follow-ups and admissions actions."}
    </p>
  </div>

  <button
    type="button"
    onClick={() => openNewTask()}
    style={{
      position: "relative",
      zIndex: 1,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      border: "1px solid #087443",
      borderRadius: "10px",
      padding: "12px 18px",
      background: "#087443",
      color: "#ffffff",
      fontWeight: 700,
      cursor: "pointer",
      fontSize: "13px",
      boxShadow: "none",
      whiteSpace: "nowrap",
    }}
  >
    + New Task
  </button>

  <div
    aria-hidden="true"
    style={{
      position: "absolute",
      right: "-35px",
      top: "-65px",
      width: "175px",
      height: "175px",
      borderRadius: "50%",
      background: "rgba(8, 116, 67, 0.045)",
      pointerEvents: "none",
    }}
  />
</div>
<section style={{ marginBottom: 10, padding: 10, border: "1px solid #dce8df", borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
  <div><strong style={{ color: "#075442", fontSize: 14 }}>Recruitment intake</strong><p style={{ margin: "3px 0 0", color: "#68776f", fontSize: 12 }}>Tasks and follow-up leads are filtered to this intake.</p></div>
  <select value={selectedIntake} onChange={(event) => setSelectedIntake(event.target.value)} style={{ border: "1px solid #cfded4", borderRadius: 9, padding: "10px 12px", fontSize: 13, background: "#fff", color: "#173b2b" }}>
    <option value="all">All Intakes</option><option value="unassigned">Needs intake assignment</option><option value="2026-11">November 2026</option><option value="2027-2">February 2027</option><option value="2027-4">April 2027</option><option value="2027-8">August 2027</option><option value="2027-11">November 2027</option><option value="2028-2">February 2028</option>
  </select>
</section>
{/* ALERTS */}
        {error && (
          <div
            style={{
              marginBottom: "16px",
              padding: "13px 15px",
              borderRadius: "10px",
              background: "#fff1f2",
              border:
                "1px solid #fecdd3",
              color: "#be123c",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              marginBottom: "16px",
              padding: "13px 15px",
              borderRadius: "10px",
              background: "#ecfdf5",
              border:
                "1px solid #a7f3d0",
              color: "#047857",
              fontSize: "13px",
            }}
          >
            {success}
          </div>
        )}

        {/* ROLE-SPECIFIC PERFORMANCE SUMMARY */}
        <section aria-label="Task performance summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 8, marginBottom: 10 }}>
          {[
            { label: performanceSummary.isManager ? "Team contacted today (per-salesperson unique)" : "Unique students contacted today", value: performanceSummary.isManager ? dailyContactSummary.team : dailyContactSummary.mine, note: "Answered calls only · target adjusts for approved absence and non-working days" },
            { label: performanceSummary.isManager ? "Team outstanding" : "My outstanding", value: performanceSummary.outstanding },
            { label: performanceSummary.isManager ? "Team overdue" : "My overdue", value: performanceSummary.overdue },
            { label: performanceSummary.isManager ? "Team completed today" : "Completed today", value: performanceSummary.completedToday },
            { label: "Due this month completed", value: performanceSummary.completionRate === null ? "—" : `${performanceSummary.completionRate}%`, note: performanceSummary.dueThisMonth ? `${performanceSummary.completedDueThisMonth} of ${performanceSummary.dueThisMonth} tasks due this month` : "No tasks due this month" },
          ].map((metric) => (
            <div key={metric.label} style={{ background: "#ffffff", border: "1px solid #dce8df", borderRadius: 10, padding: "9px 11px", minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#64756b", fontWeight: 650 }}>{metric.label}</div>
              <div style={{ marginTop: 3, fontSize: 21, lineHeight: 1.2, fontWeight: 800, color: metric.label.toLowerCase().includes("overdue") && Number(metric.value) > 0 ? "#b42318" : "#075442" }}>{metric.value}</div>
              {"note" in metric && <div style={{ marginTop: 3, fontSize: 10, color: "#64748b" }}>{metric.note}</div>}
            </div>
          ))}
        </section>

        <section aria-label="CIU working calendar and absence management" style={{ marginBottom: 16, border: "1px solid #cfe1d6", borderRadius: 14, background: "#ffffff", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", background: "#f0f8f3", borderBottom: "1px solid #dce9e1" }}>
            <div style={{ color: "#075442", fontSize: 15, fontWeight: 800 }}>CIU Working Calendar & Staff Absence</div>
            <div style={{ color: "#536b5d", fontSize: 12, marginTop: 4 }}>Targets use the maintained calendar. Weekends are excluded unless explicitly marked as a CIU working day. Enter official holidays and campus closures here.</div>
          </div>
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
            {canViewTeamContactPerformance && (
              <div style={{ border: "1px solid #e2ece5", borderRadius: 10, padding: 12 }}>
                <div style={{ color: "#075442", fontWeight: 750, fontSize: 13, marginBottom: 10 }}>Add or update calendar date</div>
                <label style={{ display: "block", fontSize: 11, color: "#52665a", marginBottom: 4 }}>Date</label>
                <input type="date" value={calendarDate} onChange={(event) => setCalendarDate(event.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #cbd5cf", borderRadius: 7, marginBottom: 8 }} />
                <label style={{ display: "block", fontSize: 11, color: "#52665a", marginBottom: 4 }}>Title</label>
                <input value={calendarTitle} onChange={(event) => setCalendarTitle(event.target.value)} placeholder="e.g. Uganda public holiday" style={{ width: "100%", padding: 8, border: "1px solid #cbd5cf", borderRadius: 7, marginBottom: 8 }} />
                <label style={{ display: "block", fontSize: 11, color: "#52665a", marginBottom: 4 }}>Day type</label>
                <select value={calendarType} onChange={(event) => setCalendarType(event.target.value as WorkingCalendarDay["day_type"])} style={{ width: "100%", padding: 8, border: "1px solid #cbd5cf", borderRadius: 7, marginBottom: 8 }}>
                  <option value="public_holiday">Public holiday (no target)</option>
                  <option value="ciu_closure">CIU closure (no target)</option>
                  <option value="working_day">Official working day (override weekend)</option>
                </select>
                <textarea value={calendarNotes} onChange={(event) => setCalendarNotes(event.target.value)} placeholder="Source / notes (optional)" rows={2} style={{ width: "100%", padding: 8, border: "1px solid #cbd5cf", borderRadius: 7, marginBottom: 8 }} />
                <button type="button" disabled={savingGovernance} onClick={() => void saveCalendarDay()} style={{ padding: "8px 12px", border: 0, borderRadius: 7, background: "#087443", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{savingGovernance ? "Saving…" : "Save calendar date"}</button>
              </div>
            )}
            {currentRole === "salesperson" && (
              <div style={{ border: "1px solid #e2ece5", borderRadius: 10, padding: 12 }}>
                <div style={{ color: "#075442", fontWeight: 750, fontSize: 13, marginBottom: 10 }}>Request absence</div>
                <label style={{ display: "block", fontSize: 11, color: "#52665a", marginBottom: 4 }}>Date</label>
                <input type="date" value={absenceDate} onChange={(event) => setAbsenceDate(event.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #cbd5cf", borderRadius: 7, marginBottom: 8 }} />
                <label style={{ display: "block", fontSize: 11, color: "#52665a", marginBottom: 4 }}>Absence fraction</label>
                <select value={absenceFraction} onChange={(event) => setAbsenceFraction(event.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #cbd5cf", borderRadius: 7, marginBottom: 8 }}>
                  <option value="1">Full day (100%)</option>
                  <option value="0.75">Three-quarter day (75%)</option>
                  <option value="0.5">Half day (50%)</option>
                  <option value="0.25">Quarter day (25%)</option>
                </select>
                <textarea value={absenceReason} onChange={(event) => setAbsenceReason(event.target.value)} placeholder="Reason for absence (required)" rows={2} style={{ width: "100%", padding: 8, border: "1px solid #cbd5cf", borderRadius: 7, marginBottom: 8 }} />
                <button type="button" disabled={savingGovernance} onClick={() => void requestMyAbsence()} style={{ padding: "8px 12px", border: 0, borderRadius: 7, background: "#087443", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Submit request</button>
              </div>
            )}
            <div style={{ border: "1px solid #e2ece5", borderRadius: 10, padding: 12 }}>
              <div style={{ color: "#075442", fontWeight: 750, fontSize: 13, marginBottom: 8 }}>Upcoming / recorded calendar dates</div>
              {workingCalendar.length ? workingCalendar.slice(0, 8).map((day) => <div key={day.calendar_date} style={{ padding: "7px 0", borderBottom: "1px solid #edf3ef", fontSize: 12 }}><b>{day.calendar_date}</b> · {day.title}<div style={{ color: "#64756b", fontSize: 11 }}>{day.day_type.replaceAll("_", " ")}</div></div>) : <div style={{ color: "#64756b", fontSize: 12 }}>No calendar dates entered yet. Management should maintain the official Uganda/CIU holiday calendar.</div>}
            </div>
          </div>
          {absenceRequests.length > 0 && (
            <div style={{ padding: 14, borderTop: "1px solid #e2ece5" }}>
              <div style={{ color: "#075442", fontWeight: 750, fontSize: 13, marginBottom: 8 }}>{canViewTeamContactPerformance ? "Staff absence requests" : "My absence requests"}</div>
              <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead><tr style={{ textAlign: "left", fontSize: 11, color: "#52665a" }}><th style={{ padding: 7 }}>Salesperson</th><th style={{ padding: 7 }}>Date</th><th style={{ padding: 7 }}>Fraction</th><th style={{ padding: 7 }}>Reason</th><th style={{ padding: 7 }}>Status</th><th style={{ padding: 7 }}>Action</th></tr></thead>
                <tbody>{absenceRequests.filter((request) => canViewTeamContactPerformance || request.salesperson_id === currentUserId || request.requested_by === currentUserId).slice(0, 30).map((request) => {
                  const owner = profiles.find((profile) => profile.id === request.salesperson_id);
                  return <tr key={request.id}><td style={{ padding: 7, borderTop: "1px solid #edf3ef", fontSize: 12 }}>{owner?.full_name || "Salesperson"}</td><td style={{ padding: 7, borderTop: "1px solid #edf3ef", fontSize: 12 }}>{request.absence_date}</td><td style={{ padding: 7, borderTop: "1px solid #edf3ef", fontSize: 12 }}>{Math.round(Number(request.day_fraction) * 100)}%</td><td style={{ padding: 7, borderTop: "1px solid #edf3ef", fontSize: 12 }}>{request.reason}</td><td style={{ padding: 7, borderTop: "1px solid #edf3ef", fontSize: 12, fontWeight: 700 }}>{request.status}</td><td style={{ padding: 7, borderTop: "1px solid #edf3ef" }}>{canViewTeamContactPerformance && request.status === "pending" ? <div style={{ display: "flex", gap: 5 }}><button type="button" disabled={savingGovernance} onClick={() => void decideAbsenceRequest(request, "approved")} style={{ border: "1px solid #087443", borderRadius: 6, padding: "5px 7px", color: "#087443", background: "#fff", fontSize: 11 }}>Approve</button><button type="button" disabled={savingGovernance} onClick={() => void decideAbsenceRequest(request, "rejected")} style={{ border: "1px solid #b42318", borderRadius: 6, padding: "5px 7px", color: "#b42318", background: "#fff", fontSize: 11 }}>Reject</button></div> : "—"}</td></tr>;
                })}</tbody>
              </table></div>
            </div>
          )}
          {absenceDecisionHistory.filter((entry) => canViewTeamContactPerformance || entry.salesperson_id === currentUserId).length > 0 && (
            <div style={{ padding: 14, borderTop: "1px solid #e2ece5" }}>
              <div style={{ color: "#075442", fontWeight: 750, fontSize: 13, marginBottom: 8 }}>Absence Decision Audit History</div><button type="button" onClick={exportAbsenceDecisionHistory} style={{ marginBottom: 8, border: "1px solid #0b6b50", borderRadius: 7, padding: "6px 9px", background: "#fff", color: "#075442", fontSize: 11, fontWeight: 700 }}>Export absence audit (CSV)</button>
              <div style={{ color: "#64756b", fontSize: 11, marginBottom: 8 }}>Previous approval/rejection decisions are preserved for audit and cannot be silently edited or deleted.</div>
              <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}>
                <thead><tr style={{ textAlign: "left", fontSize: 11, color: "#52665a" }}><th style={{ padding: 7 }}>Decision time (EAT)</th><th style={{ padding: 7 }}>Salesperson</th><th style={{ padding: 7 }}>Absence date</th><th style={{ padding: 7 }}>Decision</th><th style={{ padding: 7 }}>Decision by</th><th style={{ padding: 7 }}>Notes</th></tr></thead>
                <tbody>{absenceDecisionHistory.filter((entry) => canViewTeamContactPerformance || entry.salesperson_id === currentUserId).slice(0, 50).map((entry) => {
                  const owner = profiles.find((profile) => profile.id === entry.salesperson_id);
                  const decisionMaker = profiles.find((profile) => profile.id === entry.decided_by);
                  return <tr key={entry.id}><td style={{ padding: 7, borderTop: "1px solid #edf3ef", fontSize: 12, whiteSpace: "nowrap" }}>{formatDateTime(entry.decided_at)}</td><td style={{ padding: 7, borderTop: "1px solid #edf3ef", fontSize: 12 }}>{owner?.full_name || "Salesperson"}</td><td style={{ padding: 7, borderTop: "1px solid #edf3ef", fontSize: 12 }}>{entry.absence_date}</td><td style={{ padding: 7, borderTop: "1px solid #edf3ef", fontSize: 12, fontWeight: 750 }}>{entry.new_status}</td><td style={{ padding: 7, borderTop: "1px solid #edf3ef", fontSize: 12 }}>{decisionMaker?.full_name || "Management user"}</td><td style={{ padding: 7, borderTop: "1px solid #edf3ef", fontSize: 12 }}>{entry.decision_notes || "—"}</td></tr>;
                })}</tbody>
              </table></div>
            </div>
          )}
        </section>

        <section aria-label="Daily contact report finalisation" style={{ marginBottom: 16, border: "1px solid #cfe1d6", borderRadius: 14, background: "#ffffff", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", background: "#f0f8f3", borderBottom: "1px solid #dce9e1" }}>
            <div style={{ color: "#075442", fontSize: 15, fontWeight: 800 }}>End-of-Day Contact Reports</div>
            <div style={{ color: "#536b5d", fontSize: 12, marginTop: 4 }}>Reports may be finalised from 5:00pm East Africa Time. Existing reports are preserved; corrections create a new revision with a required reason.</div>
          </div>
          <div style={{ padding: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: "#173b2b", fontSize: 12, flex: 1 }}>Today ({dailyContactSummary.todayKey}): {dailyContactSummary.isWorkingDay ? "official working day" : "non-working day"} · Target for you: {dailyContactSummary.myTarget}</div>
            {currentRole === "salesperson" && <button type="button" disabled={savingGovernance} onClick={() => void finalizeContactReport(currentUserId)} style={{ padding: "8px 12px", border: "1px solid #087443", borderRadius: 8, background: "#fff", color: "#075442", fontWeight: 750, cursor: "pointer" }}>Finalise my report</button>}
            {canViewTeamContactPerformance && dailyContactSummary.staff.map((person) => <button key={person.id} type="button" disabled={savingGovernance} onClick={() => void finalizeContactReport(person.id)} style={{ padding: "7px 10px", border: "1px solid #cfe1d6", borderRadius: 8, background: "#fff", color: "#075442", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Finalise: {person.name}</button>)}
          </div>
          <div style={{ padding: "0 14px 14px", overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}>
            <thead><tr style={{ textAlign: "left", color: "#52665a", fontSize: 11 }}><th style={{ padding: 8 }}>Salesperson</th><th style={{ padding: 8 }}>Report date</th><th style={{ padding: 8 }}>Revision</th><th style={{ padding: 8 }}>Students / target</th><th style={{ padding: 8 }}>Finalised at (EAT)</th><th style={{ padding: 8 }}>PDF</th></tr></thead>
            <tbody>{contactReportSnapshots.filter((snapshot) => snapshot.report_date === dailyContactSummary.todayKey).sort((a, b) => a.salesperson_id.localeCompare(b.salesperson_id) || b.revision - a.revision).filter((snapshot) => canViewTeamContactPerformance || snapshot.salesperson_id === currentUserId).map((snapshot) => {
              const data = snapshot.report_data as any;
              const owner = profiles.find((profile) => profile.id === snapshot.salesperson_id);
              return <tr key={snapshot.id}><td style={{ padding: 8, borderTop: "1px solid #edf3ef", fontSize: 12 }}>{owner?.full_name || data.salesperson_name || "Salesperson"}</td><td style={{ padding: 8, borderTop: "1px solid #edf3ef", fontSize: 12 }}>{snapshot.report_date}</td><td style={{ padding: 8, borderTop: "1px solid #edf3ef", fontSize: 12 }}>{snapshot.revision}{snapshot.correction_reason ? <div style={{ color: "#64756b", fontSize: 10 }}>{snapshot.correction_reason}</div> : null}</td><td style={{ padding: 8, borderTop: "1px solid #edf3ef", fontSize: 12 }}>{String(data.unique_students_contacted ?? 0)} / {String(data.target ?? 50)}<div style={{ color: "#64756b", fontSize: 10 }}>{String(data.status ?? "")}</div></td><td style={{ padding: 8, borderTop: "1px solid #edf3ef", fontSize: 12 }}>{formatDateTime(snapshot.finalized_at)}<div style={{ color: "#64756b", fontSize: 10 }}>{snapshot.finalization_source === "automated" ? "Automated" : "Manual"}{snapshot.finalized_by ? " · user recorded" : ""}</div></td><td style={{ padding: 8, borderTop: "1px solid #edf3ef" }}><button type="button" onClick={() => printContactReport(snapshot)} style={{ border: "1px solid #087443", borderRadius: 6, padding: "6px 8px", background: "#fff", color: "#075442", fontSize: 11 }}>Print / Save PDF</button></td></tr>;
            })}</tbody>
          </table></div>
        </section>

        {currentRole === "salesperson" && (
          <section aria-label="My daily contact report" style={{ marginBottom: 16, border: "1px solid #cfe1d6", borderRadius: 12, background: "#ffffff", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: "#075442", fontSize: 14, fontWeight: 800 }}>My Daily Contact Progress</div>
              <div style={{ color: "#536b5d", fontSize: 12, marginTop: 4 }}>Today: {dailyContactSummary.mine} unique students reached by answered phone calls out of {dailyContactSummary.myTarget} target.</div>
            </div>
            <button type="button" onClick={exportMyDailyContactReport} style={{ border: "1px solid #087443", borderRadius: 8, padding: "8px 11px", background: "#ffffff", color: "#075442", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Export My Report (CSV)</button>
          </section>
        )}

        {canViewTeamContactPerformance && (
          <section aria-label="Daily salesperson contact progress" style={{ marginBottom: 16, border: "1px solid #cfe1d6", borderRadius: 14, background: "#ffffff", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", background: "#f0f8f3", borderBottom: "1px solid #dce9e1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#075442", fontSize: 15, fontWeight: 800 }}>Daily Salesperson Contact Progress</div>
                <div style={{ color: "#536b5d", fontSize: 12, marginTop: 4 }}>CIU working-day target: 50 unique students reached by answered phone call, proportionately adjusted for approved absence. Counts are attributed to the staff member who recorded the call.</div>
              </div>
              <button type="button" onClick={exportDailyContactReport} style={{ border: "1px solid #087443", borderRadius: 8, padding: "8px 11px", background: "#ffffff", color: "#075442", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Export CSV for Excel</button>
            </div>
            <div style={{ padding: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                <thead><tr style={{ textAlign: "left", color: "#52665a", fontSize: 11 }}>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8e3" }}>Salesperson</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8e3" }}>Unique students</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8e3" }}>Target progress</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8e3" }}>Status</th>
                </tr></thead>
                <tbody>
                  {dailyContactSummary.staff.map((person) => {
                    const achieved = person.target > 0 && person.contacted >= person.target;
                    return <tr key={person.id}>
                      <td style={{ padding: "9px 10px", borderBottom: "1px solid #eef2ef", color: "#183b2b", fontSize: 12, fontWeight: 650 }}>{person.name}</td>
                      <td style={{ padding: "9px 10px", borderBottom: "1px solid #eef2ef", color: "#183b2b", fontSize: 12 }}>{person.contacted} / {person.target}</td>
                      <td style={{ padding: "9px 10px", borderBottom: "1px solid #eef2ef", minWidth: 120 }}>
                        <div style={{ height: 7, background: "#e8efe9", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${person.target > 0 ? Math.min(100, (person.contacted / person.target) * 100) : 0}%`, background: achieved ? "#087443" : "#8bc63f", borderRadius: 999 }} />
                        </div>
                      </td>
                      <td style={{ padding: "9px 10px", borderBottom: "1px solid #eef2ef", fontSize: 11, fontWeight: 700, color: achieved ? "#087443" : person.contacted > 0 ? "#8a5a00" : "#64748b" }}>{person.target === 0 ? "Exempt / non-working day" : achieved ? "Target achieved" : person.contacted > 0 ? "In progress" : "No qualifying calls"}</td>
                    </tr>;
                  })}
                  {dailyContactSummary.staff.length === 0 && <tr><td colSpan={4} style={{ padding: 12, color: "#64748b", fontSize: 12 }}>No active salesperson profiles were found.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {canViewTeamContactPerformance && unansweredReviewFlags.length > 0 && (
          <section aria-label="Leads requiring unanswered-call review" style={{ marginBottom: 16, border: "1px solid #f0d4a8", borderRadius: 14, background: "#fffdf7", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", background: "#fff6e5", borderBottom: "1px solid #f0d4a8" }}>
              <div style={{ color: "#7a4b00", fontSize: 15, fontWeight: 800 }}>Management Review Required</div>
              <div style={{ color: "#7a5b2d", fontSize: 12, marginTop: 4 }}>These leads have at least three consecutive unanswered call attempts. They remain assigned to their current salesperson until management decides what to do.</div>
            </div>
            <div style={{ padding: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead><tr style={{ textAlign: "left", color: "#7a5b2d", fontSize: 11 }}>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #f0d4a8" }}>Prospective student</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #f0d4a8" }}>Salesperson</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #f0d4a8" }}>Consecutive unanswered calls</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #f0d4a8" }}>Latest attempt</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #f0d4a8" }}>Review deadline (EAT)</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #f0d4a8" }}>Management action</th>
                </tr></thead>
                <tbody>{unansweredReviewFlags.map((flag) => (
                  <tr key={flag.key}>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #f8ead2", color: "#4b3718", fontSize: 12 }}>{flag.lead.name || flag.lead.ciu_number || "Unnamed lead"}{flag.lead.phone ? <div style={{ color: "#7a6a50", marginTop: 2 }}>{flag.lead.phone}</div> : null}</td>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #f8ead2", color: "#4b3718", fontSize: 12 }}>{flag.staffName}</td>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #f8ead2", color: "#9a3412", fontWeight: 800, fontSize: 12 }}>{flag.attempts}</td>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #f8ead2", color: "#4b3718", fontSize: 12 }}>{formatDateTime(flag.lastContactedAt)}</td>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #f8ead2", color: flag.reviewOverdue ? "#b42318" : "#4b3718", fontWeight: flag.reviewOverdue ? 800 : 500, fontSize: 12 }}>{formatDateTime(flag.reviewDueAt)}{flag.reviewOverdue ? <div style={{ marginTop: 3, fontSize: 10 }}>OVERDUE</div> : null}</td>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #f8ead2", minWidth: 150 }}>
                      <button type="button" disabled={savingReviewLeadId === flag.lead.id} onClick={() => void recordContactReviewDecision(flag)} style={{ border: "1px solid #a16207", borderRadius: 7, padding: "7px 9px", background: "#fff", color: "#854d0e", fontSize: 11, fontWeight: 750, cursor: savingReviewLeadId === flag.lead.id ? "wait" : "pointer", opacity: savingReviewLeadId === flag.lead.id ? 0.65 : 1 }}>
                        {savingReviewLeadId === flag.lead.id ? "Saving…" : "Record decision"}
                      </button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}

        {canViewTeamContactPerformance && contactReviewHistory.length > 0 && (
          <section aria-label="Management contact review history" style={{ marginBottom: 16, border: "1px solid #cfe1d6", borderRadius: 14, background: "#ffffff", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", background: "#f0f8f3", borderBottom: "1px solid #dce9e1" }}>
              <div style={{ color: "#075442", fontSize: 15, fontWeight: 800 }}>Management Contact Review History</div>
              <button type="button" onClick={exportContactReviewHistory} style={{ marginTop: 10, border: "1px solid #0b6b50", borderRadius: 8, padding: "8px 11px", background: "#ffffff", color: "#075442", fontWeight: 750, fontSize: 12, cursor: "pointer" }}>Export audit history (CSV)</button>
              <div style={{ color: "#527064", fontSize: 12, marginTop: 4 }}>Append-only record of previous decisions. Reassignments are reflected in the lead's current assignment; earlier decisions remain visible here.</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
                <thead><tr style={{ background: "#fbfdfb", textAlign: "left" }}>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #dce9e1" }}>Decision time (EAT)</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #dce9e1" }}>Student</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #dce9e1" }}>Decision</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #dce9e1" }}>Manager</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #dce9e1" }}>New assignee</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid #dce9e1" }}>Notes</th>
                </tr></thead>
                <tbody>{contactReviewHistory.slice(0, 100).map((review) => {
                  const reviewedLead = leads.find((lead) => lead.id === review.lead_id);
                  const reviewer = profiles.find((profile) => profile.id === review.decided_by);
                  const newAssignee = review.new_assigned_to ? profiles.find((profile) => profile.id === review.new_assigned_to) : null;
                  const decisionLabel = review.decision === "retain" ? "Retain assignment" : review.decision === "reassign" ? "Reassign lead" : "Other action";
                  return (
                    <tr key={review.id}>
                      <td style={{ padding: "9px 10px", borderBottom: "1px solid #edf3ef", fontSize: 12, whiteSpace: "nowrap" }}>{formatDateTime(review.decided_at)}</td>
                      <td style={{ padding: "9px 10px", borderBottom: "1px solid #edf3ef", fontSize: 12 }}>{reviewedLead?.name || reviewedLead?.ciu_number || review.lead_id}</td>
                      <td style={{ padding: "9px 10px", borderBottom: "1px solid #edf3ef", fontSize: 12, fontWeight: 750 }}>{decisionLabel}</td>
                      <td style={{ padding: "9px 10px", borderBottom: "1px solid #edf3ef", fontSize: 12 }}>{reviewer?.full_name || "Management user"}</td>
                      <td style={{ padding: "9px 10px", borderBottom: "1px solid #edf3ef", fontSize: 12 }}>{newAssignee?.full_name || (review.new_assigned_to ? "Assigned user" : "—")}</td>
                      <td style={{ padding: "9px 10px", borderBottom: "1px solid #edf3ef", fontSize: 12, minWidth: 200, whiteSpace: "pre-wrap" }}>{review.notes}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            {contactReviewHistory.length > 100 ? <div style={{ padding: "9px 12px", color: "#527064", fontSize: 11 }}>Showing the latest 100 of {contactReviewHistory.length} decisions.</div> : null}
          </section>
        )}

        {!isSalesperson && (
          <section aria-label="Lead assignment queue" style={{ marginBottom: 16, border: "1px solid #cfe1d6", borderRadius: 14, background: "#ffffff", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "14px 16px", background: "#f0f8f3", borderBottom: "1px solid #dce9e1" }}>
              <div style={{ flex: "1 1 280px" }}>
                <div style={{ color: "#075442", fontSize: 15, fontWeight: 800 }}>Lead Assignment Queue</div>
                <div style={{ color: "#536b5d", fontSize: 12, marginTop: 4 }}>View all leads for the selected intake and assign or reassign each lead to a salesperson. Changes save immediately.</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => void autoAssignLeads()} disabled={autoAssigningLeads || loading || leads.length === 0} style={{ border: "1px solid #087443", borderRadius: 9, padding: "10px 13px", background: autoAssigningLeads ? "#6b8f80" : "#087443", color: "#fff", fontWeight: 750, fontSize: 12, cursor: autoAssigningLeads || loading || leads.length === 0 ? "not-allowed" : "pointer", opacity: autoAssigningLeads || loading || leads.length === 0 ? 0.7 : 1, whiteSpace: "nowrap" }}>{autoAssigningLeads ? "Auto-assigning..." : "⚡ Auto-assign leads"}</button>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ borderRadius: 10, padding: "8px 12px", background: "#ffffff", border: "1px solid #cfe1d6", textAlign: "center", minWidth: 94 }}>
                    <div style={{ fontSize: 20, fontWeight: 850, color: "#075442" }}>{assignmentQueueStats.total.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: "#64756b" }}>Leads in scope</div>
                  </div>
                  <div style={{ borderRadius: 10, padding: "8px 12px", background: assignmentQueueStats.unassigned === 0 ? "#f0fdf4" : "#fffaf0", border: assignmentQueueStats.unassigned === 0 ? "1px solid #bbf7d0" : "1px solid #fed7aa", textAlign: "center", minWidth: 112 }}>
                    <div style={{ fontSize: 20, fontWeight: 850, color: assignmentQueueStats.unassigned === 0 ? "#15803d" : "#b45309" }}>{assignmentQueueStats.unassigned.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: "#64756b" }}>Unassigned remaining</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(170px, 220px)", gap: 10, padding: 12, borderBottom: "1px solid #edf2ee" }}>
              <input value={leadAssignmentSearch} onChange={(event) => setLeadAssignmentSearch(event.target.value)} placeholder="Search lead name, CIU number, phone, programme..." style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cfded4", borderRadius: 8, padding: "10px 12px", fontSize: 12 }} />
              <select value={leadAssignmentFilter} onChange={(event) => setLeadAssignmentFilter(event.target.value)} style={{ border: "1px solid #cfded4", borderRadius: 8, padding: "10px 12px", background: "#fff", color: "#173b2b", fontSize: 12 }}>
                <option value="all">All assignment statuses</option>
                <option value="unassigned">Unassigned leads</option>
                <option value="assigned">Assigned leads</option>
              </select>
            </div>
            {(() => {
              const query = leadAssignmentSearch.trim().toLowerCase();
              const [year, month] = selectedIntake.split("-").map(Number);
              const rows = leads.filter((lead) => {
                if (selectedIntake !== "all" && (selectedIntake === "unassigned"
                  ? Boolean(lead.intake_year && lead.intake_month)
                  : lead.intake_year !== year || lead.intake_month !== month)) return false;
                if (leadAssignmentFilter === "unassigned" && lead.assigned_to) return false;
                if (leadAssignmentFilter === "assigned" && !lead.assigned_to) return false;
                const staffName = profiles.find((profile) => profile.id === lead.assigned_to)?.full_name || "";
                return !query || [lead.name, lead.ciu_number, lead.phone, lead.email, lead.product_service, staffName].filter(Boolean).join(" ").toLowerCase().includes(query);
              });
              return (
                <>
                  <div style={{ padding: "8px 14px", color: "#64756b", fontSize: 11, background: "#fbfdfb" }}>
                    Showing <strong>{rows.length.toLocaleString()}</strong> of {leads.length.toLocaleString()} loaded leads
                    {selectedIntake === "all" ? " across all intakes" : selectedIntake === "2027-2" ? " for February 2027" : selectedIntake === "unassigned" ? " needing intake assignment" : ""}
                  </div>
                  <div style={{ maxHeight: 480, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                      <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "#f8faf9" }}>
                        <tr>
                          {["LEAD", "CONTACT / PROGRAMME", "INTAKE", "CURRENT SALESPERSON", "ASSIGN SALESPERSON"].map((heading) => <th key={heading} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, color: "#64756b", borderBottom: "1px solid #e1ebe4", whiteSpace: "nowrap" }}>{heading}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((lead) => {
                          const currentPerson = profiles.find((profile) => profile.id === lead.assigned_to);
                          const intakeLabel = lead.intake_year && lead.intake_month
                            ? `${({ 2: "February", 4: "April", 8: "August", 11: "November" } as Record<number, string>)[lead.intake_month] || lead.intake_month} ${lead.intake_year}`
                            : "No intake";
                          return (
                            <tr key={lead.id} style={{ borderBottom: "1px solid #edf2ee" }}>
                              <td style={{ padding: "10px 12px", fontSize: 12, color: "#173b2b", fontWeight: 750 }}>{lead.name || "Unnamed lead"}<div style={{ fontSize: 10, color: "#718178", marginTop: 3 }}>{lead.ciu_number || "No CIU number"}</div></td>
                              <td style={{ padding: "10px 12px", fontSize: 11, color: "#536b5d" }}>{[lead.phone, lead.email, lead.product_service].filter(Boolean).join(" · ") || "No contact details"}</td>
                              <td style={{ padding: "10px 12px", fontSize: 11, color: "#536b5d", whiteSpace: "nowrap" }}>{intakeLabel}</td>
                              <td style={{ padding: "10px 12px", fontSize: 11, color: currentPerson ? "#173b2b" : "#a16207" }}>{currentPerson?.full_name || (lead.assigned_to ? "Assigned staff unavailable" : "Unassigned")}</td>
                              <td style={{ padding: "8px 12px", minWidth: 190 }}>
                                <select aria-label={`Assign ${lead.name || "lead"} to salesperson`} value={lead.assigned_to || ""} disabled={savingLeadAssignmentId === lead.id} onChange={(event) => void assignLeadToSalesperson(lead.id, event.target.value)} style={{ width: "100%", border: "1px solid #cfded4", borderRadius: 8, padding: "9px 10px", background: savingLeadAssignmentId === lead.id ? "#f3f4f6" : "#fff", color: "#173b2b", fontSize: 11 }}>
                                  <option value="">Unassigned</option>
                                  {profiles.filter((profile) => profile.role === "salesperson" && (profile.is_active !== false || profile.id === lead.assigned_to)).map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || "Unnamed salesperson"}{profile.is_active === false ? " (inactive)" : ""}</option>)}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                        {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#64756b", fontSize: 12 }}>No leads match these filters.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </section>
        )}

        {/* FILTER BAR */}
        <div
          style={{
            background: "#ffffff",
            border:
              "1px solid #e5e7eb",
            borderRadius: "14px",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                isSalesperson
                  ? "minmax(220px, 1fr) repeat(2, minmax(150px, 180px)) auto"
                  : "minmax(220px, 1fr) repeat(3, minmax(150px, 180px)) auto",
              gap: "10px",
              alignItems: "center",
            }}
          >
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search student, CIU number, task..."
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                border:
                  "1px solid #d1d5db",
                borderRadius: "9px",
                padding:
                  "11px 12px",
                fontSize: "13px",
                outline: "none",
              }}
            />

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setQuickTaskFilter("all");
              }}
              style={{
                border:
                  "1px solid #d1d5db",
                borderRadius: "9px",
                padding:
                  "11px 12px",
                fontSize: "13px",
                background:
                  "#ffffff",
              }}
            >
              <option value="all">
                All Statuses
              </option>

              {TASK_STATUSES.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {statusLabel(
                      status
                    )}
                  </option>
                )
              )}
            </select>

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value
                )
              }
              style={{
                border:
                  "1px solid #d1d5db",
                borderRadius: "9px",
                padding:
                  "11px 12px",
                fontSize: "13px",
                background:
                  "#ffffff",
              }}
            >
              <option value="all">
                All Types
              </option>

              {TASK_TYPES.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {taskTypeLabel(type)}
                  </option>
                )
              )}
            </select>

            {!isSalesperson && (
              <select
                value={
                  assignedFilter
                }
                onChange={(event) =>
                  setAssignedFilter(
                    event.target.value
                  )
                }
                style={{
                  border:
                    "1px solid #d1d5db",
                  borderRadius:
                    "9px",
                  padding:
                    "11px 12px",
                  fontSize: "13px",
                  background:
                    "#ffffff",
                }}
              >
                <option value="all">
                  All Staff
                </option>

                {profiles
                  .filter(
                    (profile) =>
                      profile.is_active !==
                        false &&
                      profile.role ===
                        "salesperson"
                  )
                  .map(
                    (profile) => (
                      <option
                        key={
                          profile.id
                        }
                        value={
                          profile.id
                        }
                      >
                        {profile.full_name ||
                          "Unnamed Staff"}
                      </option>
                    )
                  )}
              </select>
            )}

            <button
              type="button"
              onClick={
                clearFilters
              }
              style={{
                border:
                  "1px solid #d1d5db",
                borderRadius: "9px",
                padding:
                  "10px 13px",
                background:
                  "#ffffff",
                color: "#374151",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* TASK TABLE */}
        <div
          style={{
            background: "#ffffff",
            border:
              "1px solid #e5e7eb",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding:
                "10px 14px",
              borderBottom:
                "1px solid #e5e7eb",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 750,
                  color: "#111827",
                  fontSize: "15px",
                }}
              >
                Work Queue
              </div>

              <div
                style={{
                  marginTop: "3px",
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                {filteredTasks.length}{" "}
                task
                {filteredTasks.length ===
                1
                  ? ""
                  : "s"}{" "}
                shown
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                loadAll()
              }
              style={{
                border:
                  "1px solid #d1d5db",
                background:
                  "#ffffff",
                borderRadius: "8px",
                padding:
                  "8px 11px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              Refresh
            </button>
          </div>

          {selectedTaskIds.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "9px 12px", borderBottom: "1px solid #e5eee8", background: "#f4faf6" }}>
              <strong style={{ fontSize: 12, color: "#075442" }}>{selectedTaskIds.filter((id) => filteredTasks.some((task) => task.id === id)).length} selected</strong>
              <button type="button" disabled={bulkBusy} onClick={() => void runBulkAction("assign")} style={{ border: "1px solid #b8d4c5", background: "#fff", borderRadius: 7, padding: "6px 9px", color: "#075442", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Reassign</button>
              <button type="button" disabled={bulkBusy} onClick={() => void runBulkAction("reschedule")} style={{ border: "1px solid #b8d4c5", background: "#fff", borderRadius: 7, padding: "6px 9px", color: "#075442", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Reschedule</button>
              <button type="button" disabled={bulkBusy} onClick={() => void runBulkAction("priority")} style={{ border: "1px solid #b8d4c5", background: "#fff", borderRadius: 7, padding: "6px 9px", color: "#075442", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Set priority</button>
              <button type="button" onClick={() => setSelectedTaskIds([])} style={{ border: "none", background: "transparent", color: "#64748b", fontSize: 11, cursor: "pointer" }}>Clear selection</button>
            </div>
          )}
          {loading ? (
            <div
              style={{
                padding: "60px",
                textAlign:
                  "center",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              Loading tasks...
            </div>
          ) : filteredTasks.length ===
            0 ? (
            <div
              style={{
                padding: "70px 30px",
                textAlign:
                  "center",
              }}
            >
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#374151",
                }}
              >
                No tasks found
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                Try changing your
                filters or create
                a new task.
              </div>

              <button
                type="button"
                onClick={() =>
                  openNewTask()
                }
                style={{
                  marginTop: "15px",
                  border: "none",
                  borderRadius:
                    "8px",
                  background:
                    "#111827",
                  color:
                    "#ffffff",
                  padding:
                    "10px 15px",
                  cursor:
                    "pointer",
                  fontWeight:
                    700,
                  fontSize:
                    "13px",
                }}
              >
                + Create Task
              </button>
            </div>
                   ) : (
            <>
{quickTaskFilter === "interested" && (
  <section aria-label="Interested leads follow-up list" style={{ margin: "12px 0 16px", border: "1px solid #dce9e2", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 15px", background: "#f4f8f5", borderBottom: "1px solid #e4eee8" }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 13, color: "#075442" }}>Interested leads</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Leads marked Interested or Qualified, including those without an existing task.</div>
      </div>
      <span style={{ borderRadius: 999, background: "#e4f1e9", color: "#075442", fontWeight: 800, fontSize: 12, padding: "5px 9px" }}>{interestedLeads.length.toLocaleString()}</span>
    </div>
    {interestedLeads.length === 0 ? (
      <div style={{ padding: 16, fontSize: 12, color: "#64748b" }}>No interested leads match your search.</div>
    ) : (
      <div style={{ maxHeight: 280, overflow: "auto" }}>
        {interestedLeads.map((lead) => {
          const hasOpenTask = tasks.some((task) => task.lead_id === lead.id && isActiveTask(task));
          return (
            <div key={lead.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 15px", borderTop: "1px solid #f0f4f1" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 750, color: "#172f29" }}>{lead.name || "Unnamed lead"}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{[lead.ciu_number, lead.phone, lead.product_service].filter(Boolean).join(" · ") || "No additional details"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                <span style={{ fontSize: 11, color: hasOpenTask ? "#47725f" : "#9a6700" }}>{hasOpenTask ? "Open follow-up exists" : "No open follow-up"}</span>
                <button type="button" onClick={() => openNewTask(lead)} style={{ border: "1px solid #cbded3", borderRadius: 8, background: "#fff", color: "#075442", fontSize: 11, fontWeight: 750, padding: "7px 9px", cursor: "pointer" }}>+ Task</button>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </section>
)}
<div
  ref={tableScrollRef}
  onScroll={(event) => {
    const bottom = tableBottomScrollRef.current;
    if (
      bottom &&
      bottom.scrollLeft !== event.currentTarget.scrollLeft
    ) {
      bottom.scrollLeft = event.currentTarget.scrollLeft;
    }
  }}
  style={{
    width: "100%",
    maxHeight: "65vh",
    overflowX: "hidden",
    overflowY: "auto",
  }}
>

<table
  style={{
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1120px",
  }}
>
                <thead>
                  <tr
                    style={{
                      background:
                        "#f8fafc",
                    }}
                  >
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e5e7eb", width: 34 }}>
                      <input type="checkbox" aria-label="Select all visible tasks" checked={filteredTasks.length > 0 && filteredTasks.every((task) => selectedTaskIds.includes(task.id))} onChange={(event) => setSelectedTaskIds(event.target.checked ? Array.from(new Set([...selectedTaskIds, ...filteredTasks.map((task) => task.id)])) : selectedTaskIds.filter((id) => !filteredTasks.some((task) => task.id === id)))} />
                    </th>
                    {[
                      "TASK",
                      "STUDENT",
                      "TYPE",
                      "PRIORITY",
                      "DUE",
                      "STATUS",
                      "ASSIGNED TO",
                      "ACTIONS",
                    ].map(
                      (heading) => (
                        <th
                          key={
                            heading
                          }
                          style={{
                            padding:
                              "8px 10px",
                            textAlign:
                              heading ===
                              "ACTIONS"
                                ? "right"
                                : "left",
                            fontSize:
                              "11px",
                            fontWeight:
                              750,
                            color:
                              "#64748b",
                            letterSpacing:
                              "0.04em",
                            borderBottom:
                              "1px solid #e5e7eb",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredTasks.map(
                    (task) => {
                      const lead =
                        getLead(
                          task
                        );

                      const staff =
                        getStaff(
                          task
                        );

                      const stage =
                        getStage(
                          getOpportunity(
                            task
                          )
                            ?.stage_id ||
                            null
                        );

                      const overdue =
                        isOverdue(
                          task
                        );

                      return (
                        <tr
                          key={task.id}
                          onClick={(event) => {
                            const target = event.target as HTMLElement;
                            if (target.closest("button, a, input, select, textarea, label")) return;
                            setSelectedTask(task);
                          }}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            cursor: "pointer",
                          }}
                        >
                          <td style={{ padding: "8px 10px", verticalAlign: "top", width: 34 }}>
                            <input type="checkbox" aria-label={`Select task ${task.title}`} checked={selectedTaskIds.includes(task.id)} onChange={(event) => setSelectedTaskIds((current) => event.target.checked ? Array.from(new Set([...current, task.id])) : current.filter((id) => id !== task.id))} />
                          </td>
                          {/* TASK */}
                          <td
                            style={{
                              padding: "8px 10px",
                              verticalAlign:
                                "top",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                gap: "10px",
                                alignItems:
                                  "flex-start",
                              }}
                            >
                              <button
                                type="button"
                                title={
                                  task.status ===
                                  "completed"
                                    ? "Completed"
                                    : "Mark complete"
                                }
                                onClick={() => {
                                  if (
                                    task.status !==
                                    "completed"
                                  ) {
                                    if (task.lead_id) openOutcome(task);
                                    else markComplete(task);
                                  }
                                }}
                                style={{
                                  width:
                                    "23px",
                                  height:
                                    "23px",
                                  minWidth:
                                    "23px",
                                  borderRadius:
                                    "50%",
                                  border:
                                    task.status ===
                                    "completed"
                                      ? "1px solid #10b981"
                                      : "1px solid #d1d5db",
                                  background:
                                    task.status ===
                                    "completed"
                                      ? "#ecfdf5"
                                      : "#ffffff",
                                  color:
                                    "#047857",
                                  cursor:
                                    task.status ===
                                    "completed"
                                      ? "default"
                                      : "pointer",
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  justifyContent:
                                    "center",
                                  padding: 0,
                                  fontSize:
                                    "11px",
                                }}
                              >
                                {task.status ===
                                "completed"
                                  ? "✓"
                                  : ""}
                              </button>

                              <div
                                style={{
                                  minWidth: 0,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedTask(
                                      task
                                    )
                                  }
                                  style={{
                                    border:
                                      "none",
                                    background:
                                      "transparent",
                                    padding: 0,
                                    textAlign:
                                      "left",
                                    cursor:
                                      "pointer",
                                    fontWeight:
                                      700,
                                    color:
                                      "#111827",
                                    fontSize:
                                      "13px",
                                  }}
                                >
                                  {task.title.replace(/:\s*.+$/, "").trim()}
                                </button>

                                {task.description && (
                                  <div
                                    style={{
                                      marginTop:
                                        "4px",
                                      color:
                                        "#64748b",
                                      fontSize:
                                        "12px",
                                      maxWidth:
                                        "280px",
                                      whiteSpace:
                                        "nowrap",
                                      overflow:
                                        "hidden",
                                      textOverflow:
                                        "ellipsis",
                                    }}
                                  >
                                    {
                                      task.description
                                    }
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* STUDENT */}
                          <td
                            style={{
                              padding: "8px 10px",
                              verticalAlign: "top",
                            }}
                          >
                            {lead ? (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "9px",
                                }}
                              >
                                <div
                                  style={{
                                    width: "34px",
                                    height: "34px",
                                    flexShrink: 0,
                                    borderRadius: "50%",
                                    background: "#eef2ff",
                                    color: "#4338ca",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "11px",
                                    fontWeight: 800,
                                  }}
                                >
                                  {getInitials(lead.name)}
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 650,
                                      color: "#111827",
                                      fontSize: "13px",
                                    }}
                                  >
                                    {lead.name || "Unnamed Student"}
                                  </div>

                                  <div
                                    style={{
                                      marginTop: "2px",
                                      color: "#64748b",
                                      fontSize: "11px",
                                    }}
                                  >
                                    {lead.ciu_number || "No CIU number"}
                                  </div>

                                  {lead.phone ? (
                                    <a
                                      href={`tel:${lead.phone}`}
                                      title={`Call ${lead.name || "student"}`}
                                      style={{
                                        display: "inline-block",
                                        marginTop: "4px",
                                        color: "#106053",
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        textDecoration: "none",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      ☎ {lead.phone}
                                    </a>
                                  ) : (
                                    <div
                                      style={{
                                        marginTop: "4px",
                                        color: "#b45309",
                                        fontSize: "11px",
                                      }}
                                    >
                                      Telephone number not provided
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span
                                style={{
                                  color: "#9ca3af",
                                  fontSize: "12px",
                                }}
                              >
                                No student
                              </span>
                            )}
                          </td>

                          {/* TYPE */}
                          <td
                            style={{
                              padding: "8px 10px",
                              verticalAlign:
                                "top",
                            }}
                          >
                            <span
                              style={{
                                display:
                                  "inline-flex",
                                alignItems:
                                  "center",
                                gap: "6px",
                                fontSize:
                                  "12px",
                                color:
                                  "#374151",
                              }}
                            >
                              <span>
                                {taskTypeIcon(
                                  task.task_type
                                )}
                              </span>
                              {
                                taskTypeLabel(task.task_type)
                              }
                            </span>
                          </td>

                          {/* PRIORITY */}
                          <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
                            {(() => {
                              const priority = task.priority || (overdue ? "high" : isToday(task.due_at) ? "high" : task.status === "in_progress" ? "medium" : "low");
                              const colors = priority === "high" ? { bg: "#fff1f0", fg: "#b42318" } : priority === "medium" ? { bg: "#fff7e6", fg: "#9a6700" } : { bg: "#edf7f0", fg: "#176b45" };
                              return <span style={{ display: "inline-flex", padding: "4px 7px", borderRadius: 999, background: colors.bg, color: colors.fg, fontSize: 10, fontWeight: 750, textTransform: "capitalize" }}>{priority}</span>;
                            })()}
                          </td>

                          {/* DUE */}
                          <td
                            style={{
                              padding: "8px 10px",
                              verticalAlign:
                                "top",
                            }}
                          >
                            <div
                              style={{
                                fontSize:
                                  "12px",
                                fontWeight:
                                  overdue
                                    ? 700
                                    : 500,
                                color:
                                  overdue
                                    ? "#dc2626"
                                    : isToday(
                                        task.due_at
                                      )
                                    ? "#2563eb"
                                    : "#374151",
                              }}
                            >
                              {formatDateTime(
                                task.due_at
                              )}
                            </div>

                            {overdue && (
                              <div
                                style={{
                                  marginTop:
                                    "3px",
                                  fontSize:
                                    "10px",
                                  color:
                                    "#dc2626",
                                  fontWeight:
                                    700,
                                }}
                              >
                                OVERDUE
                              </div>
                            )}
                          </td>

                          {/* STATUS */}
                          <td
                            style={{
                              padding: "8px 10px",
                              verticalAlign:
                                "top",
                            }}
                          >
                            <span
                              style={{
                                display:
                                  "inline-flex",
                                padding:
                                  "5px 8px",
                                borderRadius:
                                  "999px",
                                background:
                                  task.status ===
                                  "completed"
                                    ? "#ecfdf5"
                                    : task.status ===
                                      "in_progress"
                                    ? "#eff6ff"
                                    : task.status ===
                                      "cancelled"
                                    ? "#f3f4f6"
                                    : "#fff7ed",
                                color:
                                  task.status ===
                                  "completed"
                                    ? "#047857"
                                    : task.status ===
                                      "in_progress"
                                    ? "#1d4ed8"
                                    : task.status ===
                                      "cancelled"
                                    ? "#6b7280"
                                    : "#c2410c",
                                fontSize:
                                  "11px",
                                fontWeight:
                                  700,
                              }}
                            >
                              {statusLabel(
                                task.status
                              )}
                            </span>

                            {stage && (
                              <div
                                style={{
                                  marginTop:
                                    "5px",
                                  color:
                                    "#64748b",
                                  fontSize:
                                    "10px",
                                }}
                              >
                                {stage.name}
                              </div>
                            )}
                          </td>

                          {/* ASSIGNED */}
                          <td
                            style={{
                              padding: "8px 10px",
                              verticalAlign:
                                "top",
                              fontSize:
                                "12px",
                              color:
                                "#374151",
                            }}
                          >
                            {staff?.full_name ||
                              "Unassigned"}
                          </td>

                          
{/* ACTIONS */}
<td
  style={{
    padding: "8px 10px",
    verticalAlign: "top",
    textAlign: "right",
    position: "relative",
    whiteSpace: "nowrap",
  }}
>
  <div
    style={{
      display: "inline-block",
      position: "relative",
    }}
  >
    <button
      type="button"
      onClick={() =>
        setOpenActionsTaskId(
          openActionsTaskId === task.id
            ? null
            : task.id
        )
      }
      style={{
        border: "1px solid #d1d5db",
        background: "#ffffff",
        color: "#166534",
        borderRadius: "8px",
        padding: "8px 12px",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      Actions ▾
    </button>

    {openActionsTaskId === task.id && (
      <div
        style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          right: 0,
          minWidth: "185px",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
          padding: "6px",
          zIndex: 100,
          textAlign: "left",
        }}
      >
        {lead?.phone && (
          <>
            <button
              type="button"
              onClick={() => {
                setOpenActionsTaskId(null);
                callStudent(lead);
              }}
              style={actionMenuItemStyle}
            >
              📞 Call Student
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenActionsTaskId(null);
                whatsappStudent(lead);
              }}
              style={actionMenuItemStyle}
            >
              WhatsApp
            </button>
          </>
        )}

        {lead?.email && (
          <button
            type="button"
            onClick={() => {
              setOpenActionsTaskId(null);
              emailStudent(lead);
            }}
            style={actionMenuItemStyle}
          >
            ✉ Email
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setOpenActionsTaskId(null);
            openOutcome(task);
          }}
          style={actionMenuItemStyle}
        >
          Record Outcome
        </button>

        <button
          type="button"
          onClick={() => {
            setOpenActionsTaskId(null);
            openEditTask(task);
          }}
          style={actionMenuItemStyle}
        >
          ✏ Edit Task
        </button>

        <button
          type="button"
          onClick={() => {
            setOpenActionsTaskId(null);
            void deleteTask(task);
          }}
          style={{
            ...actionMenuItemStyle,
            color: "#dc2626",
          }}
        >
          Delete Task
        </button>
      </div>
    )}
  </div>
</td>
                      </tr>
                    );
                  }
                )}
                </tbody>
                           </table>
            </div>
            <div
              ref={tableBottomScrollRef}
              onScroll={(event) => {
                const top = tableScrollRef.current;
                if (
                  top &&
                  top.scrollLeft !== event.currentTarget.scrollLeft
                ) {
                  top.scrollLeft = event.currentTarget.scrollLeft;
                }
              }}
              aria-label="Scroll task table horizontally"
              style={{
                width: "100%",
                overflowX: "auto",
                overflowY: "hidden",
                height: "16px",
                borderTop: "1px solid #e5e7eb",
                background: "#f8fafc",
              }}
            >
              <div
                style={{
                  width: `${Math.max(tableScrollWidth, 1050)}px`,
                  height: "1px",
                }}
              />
             </div>
            </>
          )}
        </div>
      </div>

      {/* TASK MODAL */}
      {showTaskModal && (
        <div
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowTaskModal(
                false
              );
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              maxHeight:
                "calc(100vh - 40px)",
              overflowY: "auto",
              background:
                "#ffffff",
              borderRadius:
                "16px",
              boxShadow:
                "0 25px 70px rgba(0,0,0,0.20)",
            }}
          >
            <div
              className="ciu-task-drawer-header"
              style={{
                padding:
                  "20px 22px",
                borderBottom:
                  "1px solid #e5e7eb",
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize:
                      "19px",
                    fontWeight:
                      800,
                    color:
                      "#111827",
                  }}
                >
                  {editingTask
                    ? "Edit Task"
                    : "Create New Task"}
                </h2>

                <p
                  style={{
                    margin:
                      "5px 0 0",
                    color:
                      "#6b7280",
                    fontSize:
                      "12px",
                  }}
                >
                  Create and assign
                  a CRM activity.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowTaskModal(
                    false
                  )
                }
                style={{
                  border:
                    "none",
                  background:
                    "#f3f4f6",
                  width: "32px",
                  height: "32px",
                  borderRadius:
                    "8px",
                  cursor:
                    "pointer",
                  fontSize:
                    "17px",
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={saveTask}
              style={{
                padding: "22px",
              }}
            >
              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "15px",
                }}
              >
                <div
                  style={{
                    gridColumn:
                      "1 / -1",
                  }}
                >
                  <label
                    style={{
                      display:
                        "block",
                      marginBottom:
                        "6px",
                      fontSize:
                        "12px",
                      fontWeight:
                        700,
                      color:
                        "#374151",
                    }}
                  >
                    Task Title *
                  </label>

                  <input
                    value={
                      form.title
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          title:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    required
                    placeholder="e.g. Call student about Nursing application"
                    style={{
                      width:
                        "100%",
                      boxSizing:
                        "border-box",
                      border:
                        "1px solid #d1d5db",
                      borderRadius:
                        "9px",
                      padding:
                        "11px 12px",
                      fontSize:
                        "13px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 700, color: "#374151" }}>Recruitment Intake</label>
                  <select
                    value={selectedIntake}
                    onChange={(event) => {
                      const nextIntake = event.target.value;
                      setSelectedIntake(nextIntake);
                      const [year, month] = nextIntake.split("-").map(Number);
                      const currentLead = leads.find((lead) => lead.id === form.lead_id);
                      if (currentLead && (nextIntake === "unassigned" ? Boolean(currentLead.intake_year && currentLead.intake_month) : (currentLead.intake_year !== year || currentLead.intake_month !== month))) {
                        setForm((current) => ({ ...current, lead_id: "", opportunity_id: "" }));
                      }
                    }}
                    style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: "9px", padding: "11px 12px", fontSize: "13px", background: "#ffffff" }}
                  >
                    <option value="all">All Intakes (linked student intake / February 2027 default)</option>
                    <option value="unassigned">Needs intake assignment</option>
                    <option value="2026-11">November 2026</option>
                    <option value="2027-2">February 2027</option>
                    <option value="2027-4">April 2027</option>
                    <option value="2027-8">August 2027</option>
                    <option value="2027-11">November 2027</option>
                    <option value="2028-2">February 2028</option>
                  </select>
                  <p style={{ marginTop: 5, color: "#68776f", fontSize: 11 }}>The task is recorded against this intake.</p>
                </div>

                <div>
                  <label
                    style={{
                      display:
                        "block",
                      marginBottom:
                        "6px",
                      fontSize:
                        "12px",
                      fontWeight:
                        700,
                      color:
                        "#374151",
                    }}
                  >
                    Task Type
                  </label>

                  <select
                    value={
                      form.task_type
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          task_type:
                            event
                              .target
                              .value as TaskType,
                        })
                      )
                    }
                    style={{
                      width:
                        "100%",
                      border:
                        "1px solid #d1d5db",
                      borderRadius:
                        "9px",
                      padding:
                        "11px 12px",
                      fontSize:
                        "13px",
                      background:
                        "#ffffff",
                    }}
                  >
                    {TASK_TYPES.map(
                      (type) => (
                        <option
                          key={
                            type
                          }
                          value={
                            type
                          }
                        >
                          {taskTypeLabel(type)}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display:
                        "block",
                      marginBottom:
                        "6px",
                      fontSize:
                        "12px",
                      fontWeight:
                        700,
                      color:
                        "#374151",
                    }}
                  >
                    Status
                  </label>

                  <select
                    value={
                      form.status
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          status:
                            event
                              .target
                              .value as TaskStatus,
                        })
                      )
                    }
                    style={{
                      width:
                        "100%",
                      border:
                        "1px solid #d1d5db",
                      borderRadius:
                        "9px",
                      padding:
                        "11px 12px",
                      fontSize:
                        "13px",
                      background:
                        "#ffffff",
                    }}
                  >
                    {TASK_STATUSES.map(
                      (status) => (
                        <option
                          key={
                            status
                          }
                          value={
                            status
                          }
                        >
                          {statusLabel(
                            status
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "8px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151" }}>Student / Lead</label>
                    {!editingTask && (
                      <button type="button" onClick={() => {
                        setWalkInMode((value) => !value);
                        setForm((current) => ({ ...current, lead_id: "", opportunity_id: "", title: walkInMode ? "" : "Follow up with new walk-in", assigned_to: current.assigned_to || currentUserId }));
                      }} style={{ border: "1px solid #087443", borderRadius: "8px", padding: "7px 10px", background: walkInMode ? "#ecfdf5" : "#ffffff", color: "#087443", fontWeight: 700, fontSize: "11px", cursor: "pointer" }}>
                        {walkInMode ? "Select Existing Lead" : "+ Register New Walk-in"}
                      </button>
                    )}
                  </div>

                  {walkInMode && !editingTask ? (
                    <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px", padding: "14px", border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: "10px", marginBottom: "8px" }}>
                      <div style={{ gridColumn: "1 / -1", color: "#166534", fontSize: "12px", fontWeight: 700 }}>New walk-in student details</div>
                      <div>
                        <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 700, color: "#374151" }}>Full name *</label>
                        <input value={walkInName} onChange={(event) => setWalkInName(event.target.value)} required={walkInMode} placeholder="Student's full name" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px", fontSize: "13px", background: "#ffffff" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 700, color: "#374151" }}>Telephone *</label>
                        <input value={walkInPhone} onChange={(event) => setWalkInPhone(event.target.value)} required={walkInMode && !walkInEmail.trim()} placeholder="e.g. 07..." style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px", fontSize: "13px", background: "#ffffff" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 700, color: "#374151" }}>Email</label>
                        <input type="email" value={walkInEmail} onChange={(event) => setWalkInEmail(event.target.value)} required={walkInMode && !walkInPhone.trim()} placeholder="student@example.com" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px", fontSize: "13px", background: "#ffffff" }} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 700, color: "#374151" }}>Programme of interest</label>
                        <input value={walkInProgramme} onChange={(event) => setWalkInProgramme(event.target.value)} placeholder="e.g. Bachelor of Nursing" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px", fontSize: "13px", background: "#ffffff" }} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 700, color: "#374151" }}>Visit / follow-up notes</label>
                        <textarea value={walkInNotes} onChange={(event) => setWalkInNotes(event.target.value)} rows={2} placeholder="What did the visitor ask about? Any next steps?" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px", fontSize: "13px", background: "#ffffff", resize: "vertical" }} />
                      </div>
                    </div>
                  ) : (
                  <select
                    value={
                      form.lead_id
                    }
                    onChange={(
                      event
                    ) => {
                      const lead =
                        leads.find(
                          (
                            item
                          ) =>
                            item.id ===
                            event
                              .target
                              .value
                        );

                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          lead_id:
                            event
                              .target
                              .value,
                          assigned_to:
                            lead?.assigned_to ||
                            current.assigned_to ||
                            currentUserId,
                        })
                      );
                    }}
                    style={{
                      width:
                        "100%",
                      border:
                        "1px solid #d1d5db",
                      borderRadius:
                        "9px",
                      padding:
                        "11px 12px",
                      fontSize:
                        "13px",
                      background:
                        "#ffffff",
                    }}
                  >
                    <option value="">
                      No student
                    </option>

                    {leads.filter((lead) => (selectedIntake === "all" ? true : selectedIntake === "unassigned" ? (!lead.intake_year || !lead.intake_month) : (lead.intake_year === Number(selectedIntake.split("-")[0]) && lead.intake_month === Number(selectedIntake.split("-")[1])))).map(
                      (lead) => (
                        <option
                          key={
                            lead.id
                          }
                          value={
                            lead.id
                          }
                        >
                          {lead.name ||
                            "Unnamed Student"}
                          {lead.ciu_number
                            ? ` — ${lead.ciu_number}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                  )}
                </div>

                <div>
                  <label
                    style={{
                      display:
                        "block",
                      marginBottom:
                        "6px",
                      fontSize:
                        "12px",
                      fontWeight:
                        700,
                      color:
                        "#374151",
                    }}
                  >
                    Assigned To
                  </label>

                  <select
                    value={
                      form.assigned_to
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          assigned_to:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    disabled={
                      isSalesperson
                    }
                    style={{
                      width:
                        "100%",
                      border:
                        "1px solid #d1d5db",
                      borderRadius:
                        "9px",
                      padding:
                        "11px 12px",
                      fontSize:
                        "13px",
                      background:
                        isSalesperson
                          ? "#f3f4f6"
                          : "#ffffff",
                    }}
                  >
                    <option value="">
                      Unassigned
                    </option>

                    {profiles
                      .filter(
                        (
                          profile
                        ) =>
                          profile.is_active !==
                            false &&
                          profile.role ===
                            "salesperson"
                      )
                      .map(
                        (
                          profile
                        ) => (
                          <option
                            key={
                              profile.id
                            }
                            value={
                              profile.id
                            }
                          >
                            {profile.full_name ||
                              "Unnamed Staff"}
                          </option>
                        )
                      )}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display:
                        "block",
                      marginBottom:
                        "6px",
                      fontSize:
                        "12px",
                      fontWeight:
                        700,
                      color:
                        "#374151",
                    }}
                  >
                    Due Date & Time
                  </label>

                  <input
                    type="datetime-local"
                    value={
                      form.due_at
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          due_at:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    style={{
                      width:
                        "100%",
                      boxSizing:
                        "border-box",
                      border:
                        "1px solid #d1d5db",
                      borderRadius:
                        "9px",
                      padding:
                        "10px 12px",
                      fontSize:
                        "13px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 700, color: "#374151" }}>Priority</label>
                  <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: "9px", padding: "10px 12px", fontSize: "13px", background: "#ffffff" }}>
                    {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>)}
                  </select>
                </div>
                <div
                  style={{
                    gridColumn:
                      "1 / -1",
                  }}
                >
                  <label
                    style={{
                      display:
                        "block",
                      marginBottom:
                        "6px",
                      fontSize:
                        "12px",
                      fontWeight:
                        700,
                      color:
                        "#374151",
                    }}
                  >
                    Description / Notes
                  </label>

                  <textarea
                    value={
                      form.description
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          description:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    rows={5}
                    placeholder="Add notes, instructions or context..."
                    style={{
                      width:
                        "100%",
                      boxSizing:
                        "border-box",
                      border:
                        "1px solid #d1d5db",
                      borderRadius:
                        "9px",
                      padding:
                        "11px 12px",
                      fontSize:
                        "13px",
                      resize:
                        "vertical",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop:
                    "22px",
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap: "9px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setShowTaskModal(
                      false
                    )
                  }
                  style={{
                    border:
                      "1px solid #d1d5db",
                    background:
                      "#ffffff",
                    borderRadius:
                      "9px",
                    padding:
                      "10px 15px",
                    cursor:
                      "pointer",
                    fontSize:
                      "13px",
                    fontWeight:
                      600,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  style={{
                    border:
                      "none",
                    background:
                      saving
                        ? "#9ca3af"
                        : "#111827",
                    color:
                      "#ffffff",
                    borderRadius:
                      "9px",
                    padding:
                      "10px 17px",
                    cursor:
                      saving
                        ? "not-allowed"
                        : "pointer",
                    fontSize:
                      "13px",
                    fontWeight:
                      700,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editingTask
                    ? "Save Changes"
                    : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OUTCOME MODAL */}
      {outcomeTask && (
        <div
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setOutcomeTask(
                null
              );
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,0.48)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "min(620px, 100%)",
              maxHeight:
                "calc(100vh - 40px)",
              overflowY: "auto",
              background:
                "#ffffff",
              borderRadius:
                "16px",
              boxShadow:
                "0 25px 70px rgba(0,0,0,0.22)",
            }}
          >
            <div
              style={{
                padding:
                  "20px 22px",
                borderBottom:
                  "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "flex-start",
                  gap: "15px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize:
                        "11px",
                      fontWeight:
                        750,
                      color:
                        "#64748b",
                      textTransform:
                        "uppercase",
                      letterSpacing:
                        "0.06em",
                    }}
                  >
                    Record Outcome
                  </div>

                  <h2
                    style={{
                      margin:
                        "5px 0 0",
                      fontSize:
                        "19px",
                      fontWeight:
                        800,
                      color:
                        "#111827",
                    }}
                  >
                    {outcomeTask.title}
                  </h2>

                  <div
                    style={{
                      marginTop:
                        "5px",
                      color:
                        "#64748b",
                      fontSize:
                        "12px",
                    }}
                  >
                    {getLead(
                      outcomeTask
                    )?.name ||
                      "Student"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setOutcomeTask(
                      null
                    )
                  }
                  style={{
                    border:
                      "none",
                    background:
                      "#f3f4f6",
                    width: "32px",
                    height: "32px",
                    borderRadius:
                      "8px",
                    cursor:
                      "pointer",
                    fontSize:
                      "17px",
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div
              style={{
                padding: "22px",
              }}
            >
              <div>
                <label
                  style={{
                    display:
                      "block",
                    marginBottom:
                      "7px",
                    fontSize:
                      "12px",
                    fontWeight:
                      700,
                    color:
                      "#374151",
                  }}
                >
                  Outcome *
                </label>

                <select
                  value={
                    selectedOutcome
                  }
                  onChange={(
                    event
                  ) => {
                    const nextOutcome = event.target.value;
                    setSelectedOutcome(nextOutcome);
                    if (nextOutcome === "No Answer" || nextOutcome === "Unreachable") {
                      suggestNextWeekdayFollowUp();
                    }
                  }}
                  style={{
                    width:
                      "100%",
                    border:
                      "1px solid #d1d5db",
                    borderRadius:
                      "9px",
                    padding:
                      "11px 12px",
                    fontSize:
                      "13px",
                    background:
                      "#ffffff",
                  }}
                >
                  <option value="">
                    Select outcome
                  </option>

                  {OUTCOMES.map(
                    (outcome) => (
                      <option
                        key={
                          outcome
                        }
                        value={
                          outcome
                        }
                      >
                        {outcome}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div
                style={{
                  marginTop:
                    "15px",
                }}
              >
                <label
                  style={{
                    display:
                      "block",
                    marginBottom:
                      "7px",
                    fontSize:
                      "12px",
                    fontWeight:
                      700,
                    color:
                      "#374151",
                  }}
                >
                  Notes / Feedback
                </label>

                <textarea
                  value={
                    outcomeNotes
                  }
                  onChange={(
                    event
                  ) =>
                    setOutcomeNotes(
                      event
                        .target
                        .value
                    )
                  }
                  rows={5}
                  placeholder="Record what the student said, next steps, payment information, application information, etc."
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    border:
                      "1px solid #d1d5db",
                    borderRadius:
                      "9px",
                    padding:
                      "11px 12px",
                    fontSize:
                      "13px",
                    resize:
                      "vertical",
                  }}
                />
              </div>

              {[
                "Follow up later",
                "No Answer",
                "Unreachable",
              ].includes(
                selectedOutcome
              ) && (
                <div
                  style={{
                    marginTop:
                      "15px",
                  }}
                >
                  <label
                    style={{
                      display:
                        "block",
                      marginBottom:
                        "7px",
                      fontSize:
                        "12px",
                      fontWeight:
                        700,
                      color:
                        "#374151",
                    }}
                  >
                    Next Follow-up
                  </label>

                  <input
                    type="datetime-local"
                    value={
                      outcomeDate
                    }
                    onChange={(
                      event
                    ) =>
                      setOutcomeDate(
                        event
                          .target
                          .value
                      )
                    }
                    style={{
                      width:
                        "100%",
                      boxSizing:
                        "border-box",
                      border:
                        "1px solid #d1d5db",
                      borderRadius:
                        "9px",
                      padding:
                        "10px 12px",
                      fontSize:
                        "13px",
                    }}
                  />

                  <div
                    style={{
                      marginTop:
                        "6px",
                      fontSize:
                        "11px",
                      color:
                        "#64748b",
                    }}
                  >
                    A new follow-up
                    task will be
                    created automatically.
                  </div>
                </div>
              )}

              {PIPELINE_WAITING_OUTCOMES.includes(
                selectedOutcome
              ) && (
                <div
                  style={{
                    marginTop:
                      "15px",
                    padding:
                      "12px 13px",
                    borderRadius:
                      "9px",
                    background:
                      "#eff6ff",
                    border:
                      "1px solid #bfdbfe",
                    color:
                      "#1d4ed8",
                    fontSize:
                      "12px",
                    lineHeight:
                      1.5,
                  }}
                >
                  This outcome will
                  also move the student
                  into the corresponding
                  Pipeline stage.
                </div>
              )}

              {selectedOutcome ===
                "Enrolled" && (
                <div
                  style={{
                    marginTop:
                      "15px",
                    padding:
                      "12px 13px",
                    borderRadius:
                      "9px",
                    background:
                      "#ecfdf5",
                    border:
                      "1px solid #a7f3d0",
                    color:
                      "#047857",
                    fontSize:
                      "12px",
                    lineHeight:
                      1.5,
                  }}
                >
                  Enrolled will move
                  the student to the
                  Enrolled Pipeline stage
                  and ensure an admission
                  record exists.
                </div>
              )}

              <div
                style={{
                  marginTop:
                    "22px",
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap: "9px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setOutcomeTask(
                      null
                    )
                  }
                  style={{
                    border:
                      "1px solid #d1d5db",
                    background:
                      "#ffffff",
                    borderRadius:
                      "9px",
                    padding:
                      "10px 15px",
                    cursor:
                      "pointer",
                    fontSize:
                      "13px",
                    fontWeight:
                      600,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    saving ||
                    !selectedOutcome
                  }
                  onClick={
                    saveOutcome
                  }
                  style={{
                    border:
                      "none",
                    background:
                      saving ||
                      !selectedOutcome
                        ? "#9ca3af"
                        : "#111827",
                    color:
                      "#ffffff",
                    borderRadius:
                      "9px",
                    padding:
                      "10px 17px",
                    cursor:
                      saving ||
                      !selectedOutcome
                        ? "not-allowed"
                        : "pointer",
                    fontSize:
                      "13px",
                    fontWeight:
                      700,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : "Save Outcome"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TASK DETAIL MODAL */}
      {selectedTask && (
        <div
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedTask(
                null
              );
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.32)",
            zIndex: 1050,
            display: "flex",
            alignItems: "stretch",
            justifyContent: "flex-end",
            padding: 0,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Task details"
            className="ciu-task-drawer"
            style={{
              width: "min(560px, 100%)",
              height: "100dvh",
              maxHeight: "100dvh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "18px 0 0 18px",
              borderLeft: "1px solid #dce7e0",
              boxShadow: "-20px 0 60px rgba(15,23,42,0.16)",
              animation: "ciuTaskDrawerIn 180ms ease-out",
            }}
          >
            <div
              style={{
                padding:
                  "20px 22px",
                borderBottom:
                  "1px solid #e5e7eb",
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap: "15px",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize:
                      "11px",
                    fontWeight:
                      750,
                    color:
                      "#64748b",
                    textTransform:
                      "uppercase",
                    letterSpacing:
                      "0.06em",
                  }}
                >
                  Task Details
                </div>

                <h2
                  style={{
                    margin:
                      "5px 0 0",
                    fontSize:
                      "20px",
                    fontWeight:
                      800,
                    color:
                      "#111827",
                  }}
                >
                  {
                    selectedTask.title
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedTask(
                    null
                  )
                }
                style={{
                  border:
                    "none",
                  background:
                    "#f3f4f6",
                  width: "32px",
                  height: "32px",
                  borderRadius:
                    "8px",
                  cursor:
                    "pointer",
                  fontSize:
                    "17px",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: "22px",
              }}
            >
              {(() => {
                const lead =
                  getLead(
                    selectedTask
                  );

                const staff =
                  getStaff(
                    selectedTask
                  );

                const opportunity =
                  getOpportunity(
                    selectedTask
                  );

                return (
                  <>
                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(2, minmax(0, 1fr))",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          padding:
                            "13px",
                          background:
                            "#f8fafc",
                          borderRadius:
                            "10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "10px",
                            color:
                              "#64748b",
                            fontWeight:
                              750,
                          }}
                        >
                          STUDENT
                        </div>

                        <div
                          style={{
                            marginTop:
                              "5px",
                            fontWeight:
                              700,
                            fontSize:
                              "13px",
                            color:
                              "#111827",
                          }}
                        >
                          {lead?.name ||
                            "No student linked"}
                        </div>

                        {lead?.ciu_number && (
                          <div
                            style={{
                              marginTop: "3px",
                              color: "#64748b",
                              fontSize: "11px",
                            }}
                          >
                            {lead.ciu_number}
                          </div>
                        )}

                        {lead?.phone ? (
                          <a
                            href={`tel:${lead.phone}`}
                            style={{
                              display: "inline-block",
                              marginTop: "6px",
                              color: "#106053",
                              fontSize: "12px",
                              fontWeight: 700,
                              textDecoration: "none",
                            }}
                          >
                            ☎ {lead.phone}
                          </a>
                        ) : (
                          <div style={{ marginTop: "5px", color: "#b45309", fontSize: "11px" }}>
                            No telephone number
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          padding:
                            "13px",
                          background:
                            "#f8fafc",
                          borderRadius:
                            "10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "10px",
                            color:
                              "#64748b",
                            fontWeight:
                              750,
                          }}
                        >
                          PROGRAMME
                        </div>

                        <div
                          style={{
                            marginTop:
                              "5px",
                            fontWeight:
                              700,
                            fontSize:
                              "13px",
                            color:
                              "#111827",
                          }}
                        >
                          {lead?.product_service ||
                            "Not specified"}
                        </div>
                      </div>

                      <div
                        style={{
                          padding:
                            "13px",
                          background:
                            "#f8fafc",
                          borderRadius:
                            "10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "10px",
                            color:
                              "#64748b",
                            fontWeight:
                              750,
                          }}
                        >
                          DUE
                        </div>

                        <div
                          style={{
                            marginTop:
                              "5px",
                            fontWeight:
                              700,
                            fontSize:
                              "13px",
                            color:
                              isOverdue(
                                selectedTask
                              )
                                ? "#dc2626"
                                : "#111827",
                          }}
                        >
                          {formatDateTime(
                            selectedTask.due_at
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          padding:
                            "13px",
                          background:
                            "#f8fafc",
                          borderRadius:
                            "10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "10px",
                            color:
                              "#64748b",
                            fontWeight:
                              750,
                          }}
                        >
                          ASSIGNED TO
                        </div>

                        <div
                          style={{
                            marginTop:
                              "5px",
                            fontWeight:
                              700,
                            fontSize:
                              "13px",
                            color:
                              "#111827",
                          }}
                        >
                          {staff?.full_name ||
                            "Unassigned"}
                        </div>
                      </div>
                    </div>

                    {opportunity && (
                      <div
                        style={{
                          marginTop:
                            "15px",
                          padding:
                            "13px",
                          background:
                            "#eff6ff",
                          border:
                            "1px solid #bfdbfe",
                          borderRadius:
                            "10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "10px",
                            color:
                              "#1d4ed8",
                            fontWeight:
                              750,
                          }}
                        >
                          PIPELINE
                        </div>

                        <div
                          style={{
                            marginTop:
                              "5px",
                            fontSize:
                              "13px",
                            fontWeight:
                              700,
                            color:
                              "#1e3a8a",
                          }}
                        >
                          {
                            getStage(
                              opportunity.stage_id
                            )?.name ||
                            "No stage"
                          }
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        marginTop:
                          "18px",
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "11px",
                          fontWeight:
                            750,
                          color:
                            "#64748b",
                          textTransform:
                            "uppercase",
                        }}
                      >
                        Description &
                        Activity Notes
                      </div>

                      <div
                        style={{
                          marginTop:
                            "7px",
                          padding:
                            "14px",
                          background:
                            "#f8fafc",
                          borderRadius:
                            "10px",
                          whiteSpace:
                            "pre-wrap",
                          fontSize:
                            "13px",
                          lineHeight:
                            1.6,
                          color:
                            "#374151",
                        }}
                      >
                        {selectedTask.description ||
                          "No description or notes recorded."}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop:
                          "20px",
                        display:
                          "flex",
                        justifyContent:
                          "flex-end",
                        gap: "8px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      {lead?.phone && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              callStudent(
                                lead
                              )
                            }
                            style={{
                              border:
                                "1px solid #d1d5db",
                              background:
                                "#ffffff",
                              borderRadius:
                                "8px",
                              padding:
                                "9px 12px",
                              cursor:
                                "pointer",
                              fontSize:
                                "12px",
                              fontWeight:
                                600,
                            }}
                          >
                            Call
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              whatsappStudent(
                                lead
                              )
                            }
                            style={{
                              border:
                                "1px solid #d1d5db",
                              background:
                                "#ffffff",
                              borderRadius:
                                "8px",
                              padding:
                                "9px 12px",
                              cursor:
                                "pointer",
                              fontSize:
                                "12px",
                              fontWeight:
                                600,
                            }}
                          >
                            WhatsApp
                          </button>
                        </>
                      )}

                      {lead?.email && (
                        <button
                          type="button"
                          onClick={() =>
                            emailStudent(
                              lead
                            )
                          }
                          style={{
                            border:
                              "1px solid #d1d5db",
                            background:
                              "#ffffff",
                            borderRadius:
                              "8px",
                            padding:
                              "9px 12px",
                            cursor:
                              "pointer",
                            fontSize:
                              "12px",
                            fontWeight:
                              600,
                          }}
                        >
                          Email
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTask(
                            null
                          );
                          openOutcome(
                            selectedTask
                          );
                        }}
                        style={{
                          border:
                            "none",
                          background:
                            "#111827",
                          color:
                            "#ffffff",
                          borderRadius:
                            "8px",
                          padding:
                            "9px 13px",
                          cursor:
                            "pointer",
                            fontSize:
                              "12px",
                          fontWeight:
                            700,
                        }}
                      >
                        Record Outcome
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTask(
                            null
                          );
                          openEditTask(
                            selectedTask
                          );
                        }}
                        style={{
                          border:
                            "1px solid #d1d5db",
                          background:
                            "#ffffff",
                          borderRadius:
                            "8px",
                          padding:
                            "9px 12px",
                          cursor:
                            "pointer",
                          fontSize:
                            "12px",
                          fontWeight:
                            600,
                        }}
                      >
                        Edit
                      </button>

                      {selectedTask.status !==
                        "completed" && (
                        <button
                          type="button"
                          onClick={() =>
                            markComplete(
                              selectedTask
                            )
                          }
                          style={{
                            border:
                              "1px solid #a7f3d0",
                            background:
                              "#ecfdf5",
                            color:
                              "#047857",
                            borderRadius:
                              "8px",
                            padding:
                              "9px 12px",
                            cursor:
                              "pointer",
                            fontSize:
                              "12px",
                            fontWeight:
                              700,
                          }}
                        >
                          Complete
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() =>
                            deleteTask(
                              selectedTask
                            )
                          }
                          style={{
                            border:
                              "1px solid #fecaca",
                            background:
                              "#fff1f2",
                            color:
                              "#be123c",
                            borderRadius:
                              "8px",
                            padding:
                              "9px 12px",
                            cursor:
                              "pointer",
                            fontSize:
                              "12px",
                            fontWeight:
                              700,
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}