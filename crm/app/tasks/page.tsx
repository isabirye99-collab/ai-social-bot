"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type TaskStatus = string;

type TaskType =
  | "Call"
  | "Email"
  | "WhatsApp";

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
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
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
};

const TASK_TYPES: TaskType[] = [
  "Call",
  "Email",
  "WhatsApp",
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

// Database task_status enum values. Applicant outcomes are recorded separately.
const TASK_STATUSES: TaskStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];

const PIPELINE_WAITING_OUTCOMES = [
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
  task_type: "Call",
  lead_id: "",
  opportunity_id: "",
  assigned_to: "",
  due_at: "",
  status: "pending",
};

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
    case "pending": return "Pending";
    case "in_progress": return "In Progress";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    default: return status;
  }
}

function taskTypeIcon(type: string) {
  switch (type) {
    case "Call":
      return "☎";
    case "WhatsApp":
      return "◉";
    case "Email":
      return "✉";
    case "Meeting":
      return "◫";
    case "Note":
      return "▤";
    case "Proposal":
      return "▱";
    default:
      return "✓";
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
    (OUTCOMES.includes(task.status) && task.status !== "Follow up later") ||
    ["completed", "cancelled", "canceled"].includes(task.status.toLowerCase())
  ) {
    return false;
  }

  return new Date(task.due_at).getTime() < Date.now();
}

function isActiveTask(task: Task) {
  return (
    !["completed", "cancelled", "canceled"].includes(task.status.toLowerCase())
  );
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
  const [typeFilter, setTypeFilter] =
    useState("all");
  const [assignedFilter, setAssignedFilter] =
    useState("all");

  const [showTaskModal, setShowTaskModal] =
    useState(false);
  const [showTaskMenu, setShowTaskMenu] = useState(false);

  const [editingTask, setEditingTask] =
    useState<Task | null>(null);

  const [selectedTask, setSelectedTask] =
    useState<Task | null>(null);
  const [openActionsTaskId, setOpenActionsTaskId] =
    useState<string | null>(null);

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

  const isSalesperson =
    currentRole === "salesperson";

  const isAdmin =
    currentRole === "admin" ||
    currentRole === "super_admin";

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
          "id,title,description,task_type,lead_id,opportunity_id,assigned_to,due_at,status,completed_at,created_at,updated_at"
        )
        .order("due_at", {
          ascending: true,
          nullsFirst: false,
        });

      let leadsQuery = supabase
        .from("leads")
        .select(
          "id,name,ciu_number,phone,email,product_service,status,assigned_to,feedback,follow_up_status,next_follow_up_at"
        )
        .order("name", {
          ascending: true,
        });

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

        leadsQuery = leadsQuery.eq(
          "assigned_to",
          user.id
        );

        opportunitiesQuery =
          opportunitiesQuery.eq(
            "assigned_to",
            user.id
          );
      }

      const [
        tasksResult,
        profilesResult,
        leadsResult,
        opportunitiesResult,
        stagesResult,
      ] = await Promise.all([
        tasksQuery,

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

      setTasks(
        (tasksResult.data || []) as Task[]
      );

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
    const active = tasks.filter(
      isActiveTask
    );

    const overdue = active.filter(
      isOverdue
    ).length;

    const dueToday = active.filter(
      (task) => isToday(task.due_at)
    ).length;

    const completed = tasks.filter(
      (task) => OUTCOMES.includes(task.status)
    ).length;

    return {
      active: active.length,
      overdue,
      dueToday,
      completed,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return [...tasks]
      .filter((task) => {
        const lead = getLead(task);
        const staff = getStaff(task);

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

        if (statusFilter === "recorded") {
          if (!OUTCOMES.includes(task.status)) return false;
        } else if (
          statusFilter !== "all" &&
          task.status !== statusFilter
        ) {
          return false;
        }

        if (
          typeFilter !== "all" &&
          task.task_type !== typeFilter
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
    typeFilter,
    assignedFilter,
  ]);

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
      task_type: "Call",
      due_at: lead?.next_follow_up_at
        ? toDateTimeLocal(
            lead.next_follow_up_at
          )
        : "",
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
      task_type:
        (TASK_TYPES.includes(
          task.task_type as TaskType
        )
          ? task.task_type
          : "Other") as TaskType,
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
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        status: form.status,
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
        const { error } =
          await supabase
            .from("tasks")
            .insert({
              ...payload,
              created_by:
                currentUserId,
            });

        if (error) throw error;

        setSuccess(
          walkInMode
            ? "Walk-in student registered, added to the pipeline, and follow-up task created."
            : "Task created successfully."
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

      setSuccess(
        "Task status updated."
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

  const markComplete = async (
    task: Task
  ) => {
    await updateTaskStatus(
      task,
      "completed"
    );
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

  const openOutcome = (
    task: Task
  ) => {
    const lead = getLead(task);

    setOutcomeTask(task);
    setSelectedOutcome("");
    // Require a fresh comment for each recorded outcome.
    setOutcomeNotes("");
    const defaultFollowUp = new Date();
    defaultFollowUp.setDate(defaultFollowUp.getDate() + 7);
    setOutcomeDate(
      task.due_at
        ? toDateTimeLocal(task.due_at)
        : toDateTimeLocal(defaultFollowUp.toISOString())
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

    // The database lead_status enum only accepts:
    // new, contacted, qualified, unqualified, converted, lost.
    // Keep the detailed call outcome in follow_up_status (text).
    const leadStatusMap: Record<
      string,
      "new" | "contacted" | "qualified" | "unqualified" | "converted" | "lost"
    > = {
      Interested: "qualified",

      Applied: "converted",
      "Application Submitted": "converted",
      Admitted: "converted",
      "Paid Application Fee": "converted",
      "Acceptance Fee Paid": "converted",
      "Paid Acceptance Fee": "converted",
      Enrolled: "converted",

      "Follow up later": "contacted",
      "Financial issues": "contacted",
      "No Answer": "contacted",
      Unreachable: "contacted",

      "Not interested": "lost",
      "Lost Leads": "lost",
      "Wrong Number": "unqualified",
      Dropped: "lost",
    };

    const leadStatus = leadStatusMap[outcome] || "contacted";

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
          "pending",
        ])
        .limit(1);

    if (error) throw error;

    if (
      existingTasks &&
      existingTasks.length > 0
    ) {
      return;
    }

    const dateValue =
      followUpDate ||
      new Date().toISOString();

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
            task.task_type === "WhatsApp"
              ? "WhatsApp"
              : task.task_type === "Email"
              ? "Email"
              : "Call",
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
      setError("Please select an outcome.");
      return;
    }

    if (!outcomeNotes.trim()) {
      setError("Please enter a reason or comment before saving this outcome.");
      return;
    }

    const requiresFollowUp =
      !PIPELINE_WAITING_OUTCOMES.includes(selectedOutcome) &&
      selectedOutcome !== "Enrolled";

    if (requiresFollowUp && !outcomeDate) {
      setError("Please set the next follow-up date.");
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

      const { error: taskError } =
        await supabase
          .from("tasks")
          .update({
            description:
              newDescription,
            // The applicant outcome is stored on the lead and in the
            // task description; task status remains a valid workflow status.
            status: "completed",
            completed_at:
              new Date().toISOString(),
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            outcomeTask.id
          );

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

      // Every non-pipeline outcome remains in the Tasks follow-up workflow.
      // Pipeline milestones are the only outcomes that do not receive a new follow-up task.
      if (requiresFollowUp) {
        await createFollowUpTask(outcomeTask, outcomeDate);
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
      console.error("Save outcome failed:", err);

      const failure = err as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };
      const message =
        err instanceof Error
          ? err.message
          : failure?.message || "An unknown database error occurred.";
      const details = [
        failure?.code ? `Code: ${failure.code}` : "",
        failure?.details || "",
        failure?.hint ? `Hint: ${failure.hint}` : "",
      ].filter(Boolean).join(" ");

      setError(`Failed to save outcome: ${message}${details ? ` — ${details}` : ""}`);
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setAssignedFilter("all");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f8f7",
        padding: "14px 12px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1540px",
          margin: "0 auto",
        }}
      >
        {/* DASHBOARD-MATCHED HEADER */}
        <header
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "18px",
            flexWrap: "wrap",
            overflow: "visible",
            marginBottom: "14px",
            padding: "16px 20px",
            background: "linear-gradient(110deg, #ffffff 0%, #f7fbf8 100%)",
            border: "1px solid #dfe9e3",
            borderRadius: "16px",
            boxShadow: "0 8px 28px rgba(20,50,40,.045)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "5px" }}>
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#8dc642", boxShadow: "0 0 0 5px rgba(141,198,66,.16)" }} />
              <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".16em", color: "#718179" }}>
                CRM Work Centre
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: "30px", lineHeight: 1.15, fontWeight: 850, letterSpacing: "-.04em", color: "#123d30" }}>
              {isSalesperson ? "My Tasks" : "Tasks & Follow-ups"}
            </h1>
            <p style={{ margin: "6px 0 0", color: "#7d8b84", fontSize: "13px" }}>
              {isSalesperson
                ? "Manage your assigned student activities and follow-ups."
                : "Manage student activities, follow-ups and admissions actions."}
            </p>
          </div>

          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowTaskMenu((open) => !open)}
              aria-expanded={showTaskMenu}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                border: "1px solid #106053",
                borderRadius: "11px",
                padding: "11px 16px",
                background: "#106053",
                color: "#ffffff",
                fontWeight: 750,
                cursor: "pointer",
                fontSize: "13px",
                boxShadow: "0 4px 12px rgba(16,96,83,.14)",
              }}
            >
              + New Task <span style={{ color: "#ffffff" }}>▾</span>
            </button>
            {showTaskMenu && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                minWidth: "205px",
                padding: "6px",
                background: "#ffffff",
                border: "1px solid #dfe9e3",
                borderRadius: "11px",
                boxShadow: "0 12px 28px rgba(15,23,42,.14)",
                zIndex: 50,
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowTaskMenu(false);
                    openNewTask();
                  }}
                  style={{ ...actionMenuItemStyle, fontWeight: 700, padding: "11px 12px" }}
                >
                  Update Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTaskMenu(false);
                    openNewTask();
                    setWalkInMode(true);
                    setWalkInName("");
                    setWalkInPhone("");
                    setWalkInEmail("");
                    setWalkInProgramme("");
                    setWalkInNotes("");
                    setForm((current) => ({
                      ...current,
                      lead_id: "",
                      opportunity_id: "",
                      title: "Follow up with new walk-in",
                      assigned_to: currentUserId || "",
                      task_type: "Call",
                    }));
                  }}
                  style={{ ...actionMenuItemStyle, fontWeight: 700, color: "#106053", padding: "11px 12px" }}
                >
                  + Register Walk-in
                </button>
              </div>
            )}
          </div>
        </header>

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

        {/* KPI CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "10px",
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius: "14px",
              padding: "14px",
            }}
          >
            <div
              style={{
                color: "#64748b",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              OPEN TASKS
            </div>

            <div
              style={{
                marginTop: "7px",
                fontSize: "28px",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {stats.active}
            </div>

            <div
              style={{
                marginTop: "4px",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              Active work
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius: "14px",
              padding: "18px",
            }}
          >
            <div
              style={{
                color: "#64748b",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              DUE TODAY
            </div>

            <div
              style={{
                marginTop: "7px",
                fontSize: "28px",
                fontWeight: 800,
                color: "#106053",
              }}
            >
              {stats.dueToday}
            </div>

            <div
              style={{
                marginTop: "4px",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              Today's activities
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius: "14px",
              padding: "18px",
            }}
          >
            <div
              style={{
                color: "#64748b",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              OVERDUE
            </div>

            <div
              style={{
                marginTop: "7px",
                fontSize: "28px",
                fontWeight: 800,
                color: "#dc2626",
              }}
            >
              {stats.overdue}
            </div>

            <div
              style={{
                marginTop: "4px",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              Need attention
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius: "14px",
              padding: "18px",
            }}
          >
            <div
              style={{
                color: "#64748b",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              COMPLETED
            </div>

            <div
              style={{
                marginTop: "7px",
                fontSize: "28px",
                fontWeight: 800,
                color: "#106053",
              }}
            >
              {stats.completed}
            </div>

            <div
              style={{
                marginTop: "4px",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              Completed activities
            </div>
          </div>
        </div>

        {/* FILTER BAR */}
        <div
          style={{
            background: "#ffffff",
            border:
              "1px solid #e5e7eb",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "18px",
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
              onChange={(event) =>
                setStatusFilter(
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
                All Outcomes
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
                    {type}
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
                "17px 18px",
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
              onClick={() => setStatusFilter(statusFilter === "recorded" ? "all" : "recorded")}
              aria-pressed={statusFilter === "recorded"}
              style={{
                border: statusFilter === "recorded" ? "1px solid #106053" : "1px solid #dfe9e3",
                background: statusFilter === "recorded" ? "#eaf4ee" : "#ffffff",
                color: "#106053",
                borderRadius: "8px",
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              View Recorded Outcomes ({stats.completed})
            </button>

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
            <div
              style={{
                overflowX: "auto",
                overflowY: "auto",
                maxHeight: "680px",
                scrollbarGutter: "stable",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                  minWidth:
                    "1050px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "#f8fafc",
                    }}
                  >
                    {[
                      "TASK",
                      "STUDENT",
                      "TYPE",
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
                              "12px 16px",
                            textAlign:
                              heading ===
                              "ACTIONS"
                                ? "right"
                                : "left",
                            fontSize:
                              "11px",
                            fontWeight:
                              750,
                            letterSpacing:
                              "0.04em",
                            borderBottom: "1px solid #d8e5df",
                            whiteSpace: "nowrap",
                            position: "sticky",
                            top: 0,
                            zIndex: 5,
                            background: "#106053",
                            color: "#ffffff",
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
                          key={
                            task.id
                          }
                          style={{
                            borderBottom:
                              "1px solid #f1f5f9",
                          }}
                        >
                          {/* TASK */}
                          <td
                            style={{
                              padding:
                                "15px 16px",
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
                                    markComplete(
                                      task
                                    );
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
                                  {task.title}
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
                              padding:
                                "15px 16px",
                              verticalAlign:
                                "top",
                            }}
                          >
                            {lead ? (
                              <div
                                style={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  gap: "9px",
                                }}
                              >
                                <div
                                  style={{
                                    width:
                                      "34px",
                                    height:
                                      "34px",
                                    borderRadius:
                                      "50%",
                                    background:
                                      "#eef2ff",
                                    color:
                                      "#4338ca",
                                    display:
                                      "flex",
                                    alignItems:
                                      "center",
                                    justifyContent:
                                      "center",
                                    fontSize:
                                      "11px",
                                    fontWeight:
                                      800,
                                  }}
                                >
                                  {getInitials(
                                    lead.name
                                  )}
                                </div>

                                <div>
                                  <div
                                    style={{
                                      fontWeight:
                                        650,
                                      color:
                                        "#111827",
                                      fontSize:
                                        "13px",
                                    }}
                                  >
                                    {lead.name ||
                                      "Unnamed Student"}
                                  </div>

                                  {lead.ciu_number && (
                                    <div
                                      style={{
                                        marginTop: "2px",
                                        color: "#64748b",
                                        fontSize: "11px",
                                      }}
                                    >
                                      CIU No: {lead.ciu_number}
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      marginTop: "3px",
                                      color: lead.phone ? "#0f766e" : "#dc2626",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Tel: {lead.phone || "No telephone number recorded"}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span
                                style={{
                                  color:
                                    "#9ca3af",
                                  fontSize:
                                    "12px",
                                }}
                              >
                                No student
                              </span>
                            )}
                          </td>

                          {/* TYPE */}
                          <td
                            style={{
                              padding:
                                "15px 16px",
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
                                task.task_type
                              }
                            </span>
                          </td>

                          {/* DUE */}
                          <td
                            style={{
                              padding:
                                "15px 16px",
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
                              padding:
                                "15px 16px",
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
                              padding:
                                "15px 16px",
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
    padding: "15px 16px",
    verticalAlign: "top",
    textAlign: "right",
    whiteSpace: "nowrap",
  }}
>
  <button
    type="button"
    onClick={() => openEditTask(task)}
    style={{
      border: "1px solid #d8e5df",
      background: "#ffffff",
      color: "#106053",
      borderRadius: "8px",
      padding: "8px 13px",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: 750,
    }}
  >
    Edit
  </button>
</td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
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
                padding: "16px",
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
                          {type}
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

                    <option value="">Select outcome</option>
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
                      <div style={{ gridColumn: "1 / -1", color: "#106053", fontSize: "12px", fontWeight: 700 }}>New walk-in student details</div>
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

                    {leads.map(
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
              width: "min(600px, 100%)",
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
                  onChange={(event) => {
                    const nextOutcome = event.target.value;
                    setSelectedOutcome(nextOutcome);
                    if (
                      !PIPELINE_WAITING_OUTCOMES.includes(nextOutcome) &&
                      nextOutcome !== "Enrolled"
                    ) {
                      const due = new Date();
                      due.setDate(due.getDate() + 7);
                      setOutcomeDate(toDateTimeLocal(due.toISOString()));
                    } else {
                      setOutcomeDate("");
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
                  Reason / Comment *
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
                  required
                  rows={5}
                  placeholder="Record what happened, the applicant response, next steps, or why this outcome was selected..."
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

              {selectedOutcome &&
                !PIPELINE_WAITING_OUTCOMES.includes(selectedOutcome) &&
                selectedOutcome !== "Enrolled" && (
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
                    Default 7-Day Follow-up
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
                    A follow-up task will be created automatically, due 7 days from the date this outcome is saved. You may adjust the date if needed.
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
            background:
              "rgba(15,23,42,0.45)",
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "min(680px, 100%)",
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
                            CIU No: {lead.ciu_number}
                          </div>
                        )}
                        <div
                          style={{
                            marginTop: "5px",
                            color: lead?.phone ? "#0f766e" : "#dc2626",
                            fontSize: "12px",
                            fontWeight: 650,
                          }}
                        >
                          Telephone: {lead?.phone || "No telephone number recorded"}
                        </div>
                        {lead?.email && (
                          <div
                            style={{
                              marginTop: "3px",
                              color: "#64748b",
                              fontSize: "11px",
                              overflowWrap: "anywhere",
                            }}
                          >
                            Email: {lead.email}
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