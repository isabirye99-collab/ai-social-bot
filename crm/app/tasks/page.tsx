"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

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
  status: string | null;
  assigned_to: string | null;
  product_service: string | null;
  feedback: string | null;
  follow_up_status: string | null;
  next_follow_up_at: string | null;
};

type Opportunity = {
  id: string;
  lead_id: string | null;
  title: string | null;
  stage_id: string | null;
  assigned_to: string | null;
};

type PipelineStage = {
  id: string;
  name: string;
  position: number | null;
  probability: number | null;
};

type TaskForm = {
  title: string;
  description: string;
  task_type: string;
  lead_id: string;
  opportunity_id: string;
  assigned_to: string;
  due_at: string;
  status: TaskStatus;
};

const TASK_TYPES = [
  "Call",
  "WhatsApp",
  "Email",
  "Meeting",
  "Note",
  "Proposal",
  "Other",
];

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
  "Acceptance Fee Paid",
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

function labelStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "No due date";

  return new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(task: Task) {
  if (!task.due_at) return false;

  return (
    task.status !== "completed" &&
    task.status !== "cancelled" &&
    new Date(task.due_at).getTime() < Date.now()
  );
}

const PIPELINE_WAITING_OUTCOMES = [
  "Interested",
  "Applied",
  "Application Submitted",
  "Admitted",
  "Acceptance Fee Paid",
];

function isToday(value: string | null) {
  if (!value) return false;

  const date = new Date(value);
  const now = new Date();

  return date.toDateString() === now.toDateString();
}

function isPipelineWaiting(lead: Lead | null, task: Task) {
  if (!lead || task.status !== "completed") return false;

  return PIPELINE_WAITING_OUTCOMES.includes(
    lead.follow_up_status ?? ""
  );
}

function getTaskPriority(task: Task, lead: Lead | null) {
  const open =
    task.status !== "completed" &&
    task.status !== "cancelled";

  const nextDate =
    lead?.next_follow_up_at || task.due_at;

  if (
    open &&
    task.title.toLowerCase().startsWith("new lead:")
  ) {
    return 1;
  }

  if (open && isOverdue(task)) return 2;

  if (open && isToday(nextDate)) return 3;

  if (open) return 4;

  if (isPipelineWaiting(lead, task)) return 5;

  return 6;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);

  const [currentUserId, setCurrentUserId] = useState("");
  const [currentRole, setCurrentRole] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [outcomeTask, setOutcomeTask] = useState<Task | null>(null);

  const [outcome, setOutcome] = useState("");
const [nextFollowUp, setNextFollowUp] = useState("");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [nextDueAt, setNextDueAt] = useState("");

  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);

  const isSalesperson = currentRole === "salesperson";

  const canManageAll =
    currentRole === "admin" ||
    currentRole === "super_admin" ||
    currentRole === "manager";

  async function loadData() {
    setLoading(true);
    setError("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Your session could not be verified.");
      setLoading(false);
      return;
    }

    const userId = authData.user.id;

    setCurrentUserId(userId);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("id", userId)
      .single();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    setCurrentRole(profile?.role ?? "");

    let taskQuery = supabase
      .from("tasks")
      .select(
        "id,title,description,task_type,lead_id,opportunity_id,assigned_to,due_at,status,completed_at,created_at,updated_at"
      )
      .order("due_at", {
        ascending: true,
        nullsFirst: false,
      });

    if (profile?.role === "salesperson") {
      taskQuery = taskQuery.eq("assigned_to", userId);
    }

    const [
      taskResult,
      profileResult,
      leadResult,
      opportunityResult,
      stageResult,
    ] = await Promise.all([
      taskQuery,

      supabase
        .from("profiles")
        .select("id,full_name,role,is_active")
        .eq("is_active", true)
        .order("full_name"),

      supabase
        .from("leads")
        .select(
          "id,name,ciu_number,phone,email,status,assigned_to,product_service,feedback,follow_up_status,next_follow_up_at"
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("opportunities")
        .select(
          "id,lead_id,title,stage_id,assigned_to"
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("pipeline_stages")
        .select("id,name,position,probability")
        .order("position"),
    ]);

    if (taskResult.error) {
      setError(taskResult.error.message);
      setLoading(false);
      return;
    }

    const loadedTasks = (taskResult.data ?? []) as Task[];
    const loadedLeads = (leadResult.data ?? []) as Lead[];

    // Tasks is the salesperson's working space. Any assigned lead that has
    // never had a task is automatically given its first follow-up task.
    // Existing task history prevents duplicate automatic tasks.
    const taskLeadIds = new Set(
      loadedTasks
        .filter((task) => Boolean(task.lead_id))
        .map((task) => task.lead_id as string)
    );

    const workingLeads = loadedLeads.filter((lead) => {
      if (!lead.assigned_to || taskLeadIds.has(lead.id)) {
        return false;
      }

      if (profile?.role === "salesperson") {
        return lead.assigned_to === userId;
      }

      return true;
    });

    if (workingLeads.length > 0) {
      const automaticTasks = workingLeads.map((lead) => ({
        title: `New lead: ${lead.name ?? "Student"}`,
        description:
          lead.feedback?.trim() ||
          "Newly assigned lead. Contact the student and record the outcome.",
        task_type: "call",
        lead_id: lead.id,
        opportunity_id: null,
        assigned_to: lead.assigned_to,
        due_at:
          lead.next_follow_up_at ??
          new Date().toISOString(),
        status: "pending",
        created_by: userId,
      }));

      const { data: createdTasks, error: automaticTaskError } =
        await supabase
          .from("tasks")
          .insert(automaticTasks)
          .select(
            "id,title,description,task_type,lead_id,opportunity_id,assigned_to,due_at,status,completed_at,created_at,updated_at"
          );

      if (automaticTaskError) {
        setError(
          automaticTaskError.message
        );
      } else {
        loadedTasks.push(
          ...((createdTasks ?? []) as Task[])
        );
      }
    }

    setTasks(loadedTasks);
    setProfiles((profileResult.data ?? []) as Profile[]);
    setLeads(loadedLeads);
    setOpportunities(
      (opportunityResult.data ?? []) as Opportunity[]
    );
    setStages((stageResult.data ?? []) as PipelineStage[]);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const leadMap = useMemo(
    () => new Map(leads.map((lead) => [lead.id, lead])),
    [leads]
  );

  const opportunityMap = useMemo(
    () =>
      new Map(
        opportunities.map((opportunity) => [
          opportunity.id,
          opportunity,
        ])
      ),
    [opportunities]
  );

  const profileMap = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [profile.id, profile])
      ),
    [profiles]
  );

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const lead = task.lead_id
        ? leadMap.get(task.lead_id)
        : null;

      const opportunity = task.opportunity_id
        ? opportunityMap.get(task.opportunity_id)
        : null;

        const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        (task.description ?? "").toLowerCase().includes(query) ||
        (lead?.name ?? "").toLowerCase().includes(query) ||
        (lead?.ciu_number ?? "").toLowerCase().includes(query) ||
        (lead?.phone ?? "").toLowerCase().includes(query) ||
        (opportunity?.title ?? "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        task.status === statusFilter;

      const matchesType =
        typeFilter === "all" ||
        task.task_type.toLowerCase() ===
          typeFilter.toLowerCase();

      if (
        isSalesperson &&
        lead?.follow_up_status === "Enrolled"
      ) {
        return false;
      }

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType
      );
    })
    .sort((a, b) => {
      const leadA = a.lead_id ? leadMap.get(a.lead_id) : null;
      const leadB = b.lead_id ? leadMap.get(b.lead_id) : null;

      const priorityDifference =
        getTaskPriority(a, leadA) -
        getTaskPriority(b, leadB);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const dateA =
        leadA?.next_follow_up_at || a.due_at;
      const dateB =
        leadB?.next_follow_up_at || b.due_at;

      if (dateA && dateB) {
        return (
          new Date(dateA).getTime() -
          new Date(dateB).getTime()
        );
      }

      if (dateA) return -1;
      if (dateB) return 1;

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });
  }, [
    tasks,
    search,
    statusFilter,
    typeFilter,
    leadMap,
    opportunityMap,
  ]);

  const counts = useMemo(() => {
    const open = tasks.filter(
      (task) =>
        task.status === "pending" ||
        task.status === "in_progress"
    ).length;

    const overdue = tasks.filter(isOverdue).length;

    const completed = tasks.filter(
      (task) => task.status === "completed"
    ).length;

    const today = tasks.filter((task) => {
      if (!task.due_at) return false;

      const due = new Date(task.due_at);
      const now = new Date();

      return (
        due.toDateString() === now.toDateString() &&
        task.status !== "completed" &&
        task.status !== "cancelled"
      );
    }).length;

    return {
      open,
      overdue,
      completed,
      today,
    };
  }, [tasks]);

  function openCreate() {
    setEditingTask(null);

    setForm({
      ...EMPTY_FORM,
      assigned_to: isSalesperson
        ? currentUserId
        : "",
      due_at: new Date(
        Date.now() + 60 * 60 * 1000
      )
        .toISOString()
        .slice(0, 16),
    });

    setShowForm(true);
  }

  function openEdit(task: Task) {
    if (
      isSalesperson &&
      task.assigned_to !== currentUserId
    ) {
      return;
    }

    setEditingTask(task);

    setForm({
      title: task.title,
      description: task.description ?? "",
      task_type: task.task_type
        ? labelStatus(task.task_type)
        : "Call",
      lead_id: task.lead_id ?? "",
      opportunity_id: task.opportunity_id ?? "",
      assigned_to:
        task.assigned_to ??
        (isSalesperson ? currentUserId : ""),
      due_at: task.due_at
        ? new Date(task.due_at)
            .toISOString()
            .slice(0, 16)
        : "",
      status: TASK_STATUSES.includes(
        task.status as TaskStatus
      )
        ? (task.status as TaskStatus)
        : "pending",
    });

    setShowForm(true);
  }

  async function handleSaveTask(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!form.title.trim()) return;

    setSaving(true);
    setError("");

    const assignedTo = isSalesperson
      ? currentUserId
      : form.assigned_to || null;

    const payload = {
      title: form.title.trim(),
      description:
        form.description.trim() || null,
      task_type: form.task_type.toLowerCase(),
      lead_id: form.lead_id || null,
      opportunity_id:
        form.opportunity_id || null,
      assigned_to: assignedTo,
      due_at: form.due_at
        ? new Date(form.due_at).toISOString()
        : null,
      status: form.status,
      ...(form.status === "completed"
        ? {
            completed_at:
              new Date().toISOString(),
          }
        : {}),
    };

    const result = editingTask
      ? await supabase
          .from("tasks")
          .update(payload)
          .eq("id", editingTask.id)
      : await supabase
          .from("tasks")
          .insert({
            ...payload,
            created_by: currentUserId,
          });

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setShowForm(false);
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setSaving(false);

    await loadData();
  }
  async function completeTask(task: Task) {
    if (
      isSalesperson &&
      task.assigned_to !== currentUserId
    ) {
      return;
    }

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setViewingTask(null);

    await loadData();
  }

  async function deleteTask(task: Task) {
    if (
      isSalesperson &&
      task.assigned_to !== currentUserId
    ) {
      return;
    }

    if (
      !window.confirm(
        `Delete "${task.title}"?`
      )
    ) {
      return;
    }

    const { error: deleteError } =
      await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setViewingTask(null);

    await loadData();
  }

  function openOutcome(task: Task) {
    setViewingTask(null);
    setOutcomeTask(task);
    setOutcome("");
    setOutcomeNotes("");
    setNextFollowUp("");
    setNextDueAt("");
  }

  async function updateLeadFromOutcome(
    task: Task,
    selectedOutcome: string,
    notes: string
  ) {
    if (!task.lead_id) return;

    let leadStatus = "Pending";

    switch (selectedOutcome) {
      case "Interested":
        leadStatus = "Interested";
        break;

      case "Applied":
      case "Application Submitted":
      case "Admitted":
      case "Acceptance Fee Paid":
      case "Enrolled":
        leadStatus = "Converted";
        break;

      case "Not interested":
        leadStatus = "Not interested";
        break;

      case "Financial issues":
        leadStatus = "Financial issues";
        break;

      case "Lost Leads":
        leadStatus = "Lost Leads";
        break;

      case "Dropped":
        leadStatus = "Dropped";
        break;

      case "Follow up later":
        leadStatus = "Follow up later";
        break;

      case "No Answer":
        leadStatus = "No Answer";
        break;

      case "Unreachable":
        leadStatus = "Unreachable";
        break;

      case "Wrong Number":
        leadStatus = "Ineffective Data";
        break;

      default:
        leadStatus = "Called";
    }

    const { error } = await supabase
      .from("leads")
      .update({
        status: leadStatus,
        feedback: notes.trim() || null,
        follow_up_status: selectedOutcome,
        next_follow_up_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.lead_id);

    if (error) {
      throw error;
    }
  }

  async function moveToPipeline(
    task: Task,
    stageName: string
  ) {
    if (!task.lead_id) return;

    const lead = leadMap.get(task.lead_id);

    if (!lead) return;

    const targetStage =
      stages.find(
        (stage) =>
          stage.name.toLowerCase() ===
          stageName.toLowerCase()
      ) ??
      stages.find(
        (stage) =>
          stage.name
            .toLowerCase()
            .includes(stageName.toLowerCase())
      );

    if (!targetStage) {
      return;
    }

    if (task.opportunity_id) {
      const { error } = await supabase
        .from("opportunities")
        .update({
          stage_id: targetStage.id,
          assigned_to:
            task.assigned_to ??
            currentUserId,
        })
        .eq("id", task.opportunity_id);

      if (error) {
        throw error;
      }

      return;
    }

    const { data: existingOpportunity } =
      await supabase
        .from("opportunities")
        .select("id")
        .eq("lead_id", lead.id)
        .maybeSingle();

    if (existingOpportunity?.id) {
      const { error } = await supabase
        .from("opportunities")
        .update({
          stage_id: targetStage.id,
          assigned_to:
            task.assigned_to ??
            currentUserId,
        })
        .eq(
          "id",
          existingOpportunity.id
        );

      if (error) {
        throw error;
      }

      return;
    }

    const { error } = await supabase
      .from("opportunities")
      .insert({
        lead_id: lead.id,
        title: lead.name
          ? `${lead.name} - Admission`
          : "Admission Opportunity",
        stage_id: targetStage.id,
        assigned_to:
          task.assigned_to ??
          currentUserId,
        status: "open",
        probability:
          targetStage.probability ?? 0,
      });

    if (error) {
      throw error;
    }
  }

  async function saveOutcome() {
    if (!outcomeTask || !outcome) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateLeadFromOutcome(
        outcomeTask,
        outcome,
        outcomeNotes
      );

      const pipelineOutcomes = [
        "Interested",
        "Applied",
        "Application Submitted",
        "Admitted",
        "Acceptance Fee Paid",
        "Enrolled",
      ];

      if (
        pipelineOutcomes.includes(outcome)
      ) {
        await moveToPipeline(
          outcomeTask,
          outcome
        );
      }

      const existingDescription =
        outcomeTask.description ?? "";

      const outcomeDescription =
        `${existingDescription}\n\nOutcome: ${outcome}` +
        (outcomeNotes.trim()
          ? `\nNotes: ${outcomeNotes.trim()}`
          : "");

      const { error: taskError } =
        await supabase
          .from("tasks")
          .update({
            status: "completed",
            completed_at:
              new Date().toISOString(),
            description:
              outcomeDescription.trim(),
          })
          .eq("id", outcomeTask.id);

      if (taskError) {
        throw taskError;
      }

      const needsNextTask =
        outcome === "Follow up later" ||
        outcome === "No Answer" ||
        outcome === "Unreachable";

      if (
        needsNextTask &&
        outcomeTask.assigned_to
      ) {
        const defaultDays =
          outcome === "Follow up later"
            ? 3
            : 1;

        const dueAt = nextFollowUp
          ? new Date(nextFollowUp).toISOString()
          : new Date(
              Date.now() +
                defaultDays *
                  24 *
                  60 *
                  60 *
                  1000
            ).toISOString();

        const lead =
          outcomeTask.lead_id
            ? leadMap.get(
                outcomeTask.lead_id
              )
            : null;

        const { error: nextTaskError } =
          await supabase
            .from("tasks")
            .insert({
              title: `Follow up: ${
                lead?.name ?? "Student"
              }`,
              description:
                `Next follow-up created automatically. Previous outcome: ${outcome}.`,
              task_type:
                outcomeTask.task_type,
              lead_id:
                outcomeTask.lead_id,
              opportunity_id:
                outcomeTask.opportunity_id,
              assigned_to:
                outcomeTask.assigned_to,
              due_at: dueAt,
              status: "pending",
              created_by:
                currentUserId,
            });

        if (nextTaskError) {
          throw nextTaskError;
        }

        if (outcomeTask.lead_id) {
          const { error: followUpLeadError } = await supabase
            .from("leads")
            .update({
              next_follow_up_at: dueAt,
              updated_at: new Date().toISOString(),
            })
            .eq("id", outcomeTask.lead_id);

          if (followUpLeadError) {
            throw followUpLeadError;
          }
        }
      }

      setOutcomeTask(null);
      setOutcome("");
      setOutcomeNotes("");
      setNextDueAt("");

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save the outcome."
      );
    } finally {
      setSaving(false);
    }
  }

  function contactStudent(
    task: Task,
    channel:
      | "call"
      | "whatsapp"
      | "email"
  ) {
    const lead = task.lead_id
      ? leadMap.get(task.lead_id)
      : null;

    if (!lead) {
      return;
    }

    if (
      channel === "call" &&
      lead.phone
    ) {
      window.location.href =
        `tel:${lead.phone}`;
    }

    if (
      channel === "whatsapp" &&
      lead.phone
    ) {
      const phone =
        lead.phone.replace(
          /[^\d]/g,
          ""
        );

      window.open(
        `https://wa.me/${phone}`,
        "_blank"
      );
    }

    if (
      channel === "email" &&
      lead.email
    ) {
      window.location.href =
        `mailto:${lead.email}`;
    }
  }

  function quickCreate(
    type: string
  ) {
    setEditingTask(null);

    setForm({
      ...EMPTY_FORM,
      task_type: type,
      title: `${type} follow-up`,
      assigned_to: isSalesperson
        ? currentUserId
        : "",
      due_at: new Date(
        Date.now() +
          60 * 60 * 1000
      )
        .toISOString()
        .slice(0, 16),
    });

    setShowForm(true);
  }

  return (
    <main className="ciu-page">
      <div className="ciu-page-inner">

        <section
          className="ciu-hero"
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
            width: "100%",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#8bc63f",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Work Centre
            </div>

            <h1
              style={{
                margin:
                  "6px 0 4px",
                fontSize: 30,
              }}
            >
              {isSalesperson
                ? "My Tasks & Follow-ups"
                : "Tasks & Follow-ups"}
            </h1>

            <p
              style={{
                margin: 0,
                opacity: 0.82,
              }}
            >
              All calls, WhatsApp,
              email and follow-up
              work in one place.
            </p>
          </div>

          <button
            className="ciu-btn"
            onClick={openCreate}
            style={{
              marginLeft: "auto",
              flexShrink: 0,
              alignSelf: "flex-start",
              whiteSpace: "nowrap",
            }}
          >
            + New Task
          </button>
        </section>

        {error && (
          <div
            style={{
              margin:
                "16px 0",
              padding: 14,
              borderRadius: 10,
              background:
                "#fff0f0",
              color: "#a12626",
              border:
                "1px solid #f0caca",
            }}
          >
            {error}
          </div>
        )}

        <section
          className="ciu-kpis"
          style={{
            marginTop: 18,
          }}
        >
          <div className="ciu-kpi">
            <span>
              Open Tasks
            </span>
            <strong>
              {counts.open}
            </strong>
          </div>

          <div className="ciu-kpi">
            <span>
              Due Today
            </span>
            <strong>
              {counts.today}
            </strong>
          </div>

          <div className="ciu-kpi">
            <span>
              Overdue
            </span>
            <strong>
              {counts.overdue}
            </strong>
          </div>

          <div className="ciu-kpi">
            <span>
              Completed
            </span>
            <strong>
              {counts.completed}
            </strong>
          </div>
        </section>

        <section
          className="ciu-toolbar"
          style={{
            marginTop: 18,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search student, CIU number or task..."
            style={{
              flex:
                "1 1 280px",
              minHeight: 42,
              border:
                "1px solid #dfe9e5",
              borderRadius: 9,
              padding:
                "0 13px",
            }}
          />

          <select
            className="ciu-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All statuses
            </option>

            {TASK_STATUSES.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {labelStatus(
                    status
                  )}
                </option>
              )
            )}
          </select>

          <select
            className="ciu-select"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All types
            </option>

            {TASK_TYPES.map(
              (type) => (
                <option
                  key={type}
                  value={type.toLowerCase()}
                >
                  {type}
                </option>
              )
            )}
          </select>

          <button
            className="ciu-btn-light"
            onClick={loadData}
          >
            Refresh
          </button>
        </section>

        <section
          className="ciu-card"
          style={{
            marginTop: 18,
          }}
        >
          <div className="ciu-card-head">
            <div>
              <h2
                style={{
                  margin: 0,
                }}
              >
                Task List
              </h2>

              <p
                style={{
                  margin:
                    "4px 0 0",
                  color:
                    "#6b7f78",
                  fontSize: 13,
                }}
              >
                {visibleTasks.length} task
                {visibleTasks.length === 1
                  ? ""
                  : "s"}{" "}
                shown
              </p>
            </div>
          </div>

          <div
            style={{
              width: "100%",
              overflow: "hidden",
            }}
          >
            <table
              className="ciu-report-table"
              style={{
                width: "100%",
                tableLayout: "fixed",
                fontSize: 12,
              }}
            >
              <colgroup>
                <col style={{ width: isSalesperson ? "17%" : "15%" }} />
                <col style={{ width: isSalesperson ? "11%" : "10%" }} />
                <col style={{ width: isSalesperson ? "12%" : "11%" }} />
                <col style={{ width: isSalesperson ? "21%" : "19%" }} />
                <col style={{ width: isSalesperson ? "13%" : "12%" }} />
                {!isSalesperson && <col style={{ width: "10%" }} />}
                <col style={{ width: isSalesperson ? "9%" : "9%" }} />
                <col style={{ width: isSalesperson ? "17%" : "14%" }} />
              </colgroup>

              <thead>
                <tr>
                  <th>Student</th>
                  <th>Phone</th>
                  <th>Programme</th>
                  <th>Feedback / Task</th>
                  <th>Next Follow-up</th>
                  {!isSalesperson && <th>Assigned To</th>}
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={isSalesperson ? 7 : 8}
                      style={{ padding: 30, textAlign: "center" }}
                    >
                      Loading tasks...
                    </td>
                  </tr>
                ) : visibleTasks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isSalesperson ? 7 : 8}
                      style={{
                        padding: 40,
                        textAlign: "center",
                        color: "#6b7f78",
                      }}
                    >
                      No tasks match the current filters.
                    </td>
                  </tr>
                ) : (
                  visibleTasks.map((task) => {
                    const lead = task.lead_id
                      ? leadMap.get(task.lead_id)
                      : null;

                    const profile = task.assigned_to
                      ? profileMap.get(task.assigned_to)
                      : null;

                    const overdue = isOverdue(task);

                    return (
                      <tr key={task.id}>
                        <td style={{ verticalAlign: "top" }}>
                          <strong
                            style={{
                              display: "block",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={lead?.name ?? "No student linked"}
                          >
                            {lead?.name ?? "No student linked"}
                          </strong>

                          {(() => {
                            const priority = getTaskPriority(task, lead);
                            const priorityLabel =
                              priority === 1
                                ? "NEW"
                                : priority === 2
                                  ? "OVERDUE"
                                  : priority === 3
                                    ? "DUE TODAY"
                                    : priority === 5
                                      ? "PIPELINE"
                                      : "";

                            if (!priorityLabel) return null;

                            return (
                              <span
                                style={{
                                  display: "inline-block",
                                  marginTop: 4,
                                  padding: "2px 6px",
                                  borderRadius: 999,
                                  background:
                                    priority === 5
                                      ? "#edf1f7"
                                      : priority === 1
                                        ? "#fff4d6"
                                        : "#fff0ef",
                                  color:
                                    priority === 5
                                      ? "#304b6d"
                                      : priority === 1
                                        ? "#8a5a00"
                                        : "#b42318",
                                  fontSize: 9,
                                  fontWeight: 800,
                                  letterSpacing: 0.4,
                                }}
                              >
                                {priorityLabel}
                              </span>
                            );
                          })()}
                          {lead?.ciu_number && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#6b7f78",
                                marginTop: 3,
                              }}
                            >
                              {lead.ciu_number}
                            </div>
                          )}
                        </td>

                        <td style={{ verticalAlign: "top" }}>
                          {lead?.phone ? (
                            <a
                              href={`tel:${lead.phone}`}
                              style={{
                                color: "#00695c",
                                textDecoration: "none",
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {lead.phone}
                            </a>
                          ) : (
                            <span style={{ color: "#9aa9a4" }}>—</span>
                          )}
                        </td>

                        <td style={{ verticalAlign: "top" }}>
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={lead?.product_service ?? "Not specified"}
                          >
                            {lead?.product_service || "Not specified"}
                          </div>
                        </td>

                        <td style={{ verticalAlign: "top" }}>
                          <strong
                            style={{
                              display: "block",
                              fontSize: 11,
                              color: "#00695c",
                              marginBottom: 3,
                            }}
                          >
                            {labelStatus(task.task_type)}
                          </strong>
                          <div
                            style={{
                              lineHeight: 1.35,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                            title={
                              lead?.feedback ||
                              task.description ||
                              task.title
                            }
                          >
                            {lead?.feedback ||
                              task.description ||
                              task.title ||
                              "No feedback yet"}
                          </div>
                        </td>

                        <td style={{ verticalAlign: "top" }}>
                          <div
                            style={{
                              color: overdue ? "#b42318" : "#17322c",
                              fontWeight: overdue ? 800 : 600,
                              lineHeight: 1.35,
                            }}
                          >
                            {formatDate(
                              lead?.next_follow_up_at || task.due_at
                            )}
                          </div>
                          {overdue && (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#b42318",
                                marginTop: 2,
                              }}
                            >
                              Overdue
                            </div>
                          )}
                        </td>

                        {!isSalesperson && (
                          <td style={{ verticalAlign: "top" }}>
                            {profile?.full_name ?? "Unassigned"}
                          </td>
                        )}

                        <td style={{ verticalAlign: "top" }}>
                          <span className="ciu-status">
                            {labelStatus(task.status)}
                          </span>
                        </td>

                        <td style={{ verticalAlign: "top" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 5,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              className="ciu-btn-light"
                              style={{
                                padding: "7px 9px",
                                fontSize: 11,
                              }}
                              onClick={() => setViewingTask(task)}
                            >
                              Open
                            </button>

                            {task.status !== "completed" &&
                              task.status !== "cancelled" && (
                                <button
                                  className="ciu-btn"
                                  style={{
                                    padding: "7px 9px",
                                    fontSize: 11,
                                  }}
                                  onClick={() => openOutcome(task)}
                                >
                                  Outcome
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="ciu-card"
          style={{
            marginTop: 18,
          }}
        >
          <div className="ciu-card-head">
            <h2
              style={{
                margin: 0,
              }}
            >
              Quick Actions
            </h2>
          </div>

          <div
            style={{
              display:
                "flex",
              gap: 10,
              flexWrap:
                "wrap",
            }}
          >
            {[
              "Call",
              "WhatsApp",
              "Email",
              "Meeting",
            ].map(
              (type) => (
                <button
                  key={type}
                  className="ciu-btn-light"
                  onClick={() =>
                    quickCreate(
                      type
                    )
                  }
                >
                  + {type} Task
                </button>
              )
            )}
          </div>
        </section>
      </div>.
      {(showForm || viewingTask || outcomeTask) && (
        <div className="task-modal-backdrop">
          <div className="task-modal">
            {showForm && (
              <>
                <div className="task-modal-head">
                  <div>
                    <h2>{editingTask ? "Edit Task" : "Create Task"}</h2>
                    <p>Create and manage student follow-up work.</p>
                  </div>
                  <button
                    type="button"
                    className="task-close"
                    onClick={() => setShowForm(false)}
                  >
                    X
                  </button>
                </div>

                <form onSubmit={handleSaveTask}>
                  <div className="task-form-grid">
                    <div className="task-field task-field-full">
                      <label>Task Title</label>
                      <input
                        value={form.title}
                        onChange={(e) =>
                          setForm({ ...form, title: e.target.value })
                        }
                        placeholder="e.g. Call admitted student"
                        required
                      />
                    </div>

                    <div className="task-field">
                      <label>Task Type</label>
                      <select
                        value={form.task_type}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            task_type: e.target.value,
                          })
                        }
                      >
                        {TASK_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {labelStatus(type)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="task-field">
                      <label>Status</label>
                      <select
                        value={form.status}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            status: e.target.value as TaskStatus,
                          })
                        }
                      >
                        {TASK_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {labelStatus(status)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="task-field">
                      <label>Student / Lead</label>
                      <select
                        value={form.lead_id}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            lead_id: e.target.value,
                          })
                        }
                      >
                        <option value="">Select student</option>
                        {leads.map((lead) => (
                          <option key={lead.id} value={lead.id}>
                            {lead.name} {lead.phone ? `- ${lead.phone}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="task-field">
                      <label>Pipeline Opportunity</label>
                      <select
                        value={form.opportunity_id}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            opportunity_id: e.target.value,
                          })
                        }
                      >
                        <option value="">None</option>
                        {opportunities.map((opportunity) => (
                          <option key={opportunity.id} value={opportunity.id}>
                            {opportunity.title || "Pipeline Opportunity"}
                          </option>
                        ))}
                      </select>
                    </div>

                    {!isSalesperson && (
                      <div className="task-field">
                        <label>Assign To</label>
                        <select
                          value={form.assigned_to}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              assigned_to: e.target.value,
                            })
                          }
                        >
                          <option value="">Select staff</option>
                          {profiles
                            .filter((profile) => profile.is_active !== false)
                            .map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.full_name || "Staff"}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    <div className="task-field">
                      <label>Due Date & Time</label>
                      <input
                        type="datetime-local"
                        value={form.due_at}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            due_at: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="task-field task-field-full">
                      <label>Description / Instructions</label>
                      <textarea
                        rows={4}
                        value={form.description}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            description: e.target.value,
                          })
                        }
                        placeholder="Add instructions or context for the follow-up..."
                      />
                    </div>
                  </div>

                  <div className="task-modal-actions">
                    <button
                      type="button"
                      className="ciu-btn-light"
                      onClick={() => setShowForm(false)}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="ciu-btn"
                      disabled={saving}
                    >
                      {saving
                        ? "Saving..."
                        : editingTask
                          ? "Update Task"
                          : "Create Task"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {viewingTask && !showForm && !outcomeTask && (
              <>
                <div className="task-modal-head">
                  <div>
                    <h2>Task Details</h2>
                    <p>{viewingTask.title}</p>
                  </div>

                  <button
                    type="button"
                    className="task-close"
                    onClick={() => setViewingTask(null)}
                  >
                    X
                  </button>
                </div>

                <div className="task-detail-grid">
                  <div>
                    <span>Student</span>
                    <strong>
                      {viewingTask.lead_id
                        ? leadMap.get(viewingTask.lead_id)?.name || "Student"
                        : "No student linked"}
                    </strong>
                  </div>

                  <div>
                    <span>Task Type</span>
                    <strong>{labelStatus(viewingTask.task_type)}</strong>
                  </div>

                  <div>
                    <span>Status</span>
                    <strong>{labelStatus(viewingTask.status)}</strong>
                  </div>

                  <div>
                    <span>Assigned To</span>
                    <strong>
                      {viewingTask.assigned_to
                        ? profileMap.get(viewingTask.assigned_to)?.full_name ||
                          "Staff"
                        : "Unassigned"}
                    </strong>
                  </div>

                  <div>
                    <span>Due</span>
                    <strong>
                      {viewingTask.due_at
                        ? formatDate(viewingTask.due_at)
                        : "No due date"}
                    </strong>
                  </div>

                  <div>
                    <span>Created</span>
                    <strong>{formatDate(viewingTask.created_at)}</strong>
                  </div>
                </div>

                <div className="task-detail-description">
                  <span>Description</span>
                  <p>
                    {viewingTask.description ||
                      "No additional instructions provided."}
                  </p>
                </div>

                <div className="task-contact-actions">
                  {viewingTask.lead_id && leadMap.get(viewingTask.lead_id)?.phone && (
                    <>
                      <button
                        type="button"
                        className="task-action-call"
                        onClick={() =>
                          contactStudent(viewingTask, "call")
                        }
                      >
                        Call
                      </button>

                      <button
                        type="button"
                        className="task-action-whatsapp"
                        onClick={() =>
                          contactStudent(viewingTask, "whatsapp")
                        }
                      >
                        WhatsApp
                      </button>
                    </>
                  )}

                  {viewingTask.lead_id && leadMap.get(viewingTask.lead_id)?.email && (
                    <button
                      type="button"
                      className="task-action-email"
                      onClick={() =>
                        contactStudent(viewingTask, "email")
                      }
                    >
                      Email
                    </button>
                  )}
                </div>

                <div className="task-modal-actions">
                  <button
                    type="button"
                    className="ciu-btn-light"
                    onClick={() => {
                      openOutcome(viewingTask);
                      setViewingTask(null);
                    }}
                  >
                    Record Outcome
                  </button>

                  <button
                    type="button"
                    className="ciu-btn-light"
                    onClick={() => openEdit(viewingTask)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="ciu-btn"
                    onClick={() => completeTask(viewingTask)}
                  >
                    Complete
                  </button>

                  <button
                    type="button"
                    className="task-danger-btn"
                    onClick={() => deleteTask(viewingTask)}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}

            {outcomeTask && !showForm && (
              <>
                <div className="task-modal-head">
                  <div>
                    <h2>Record Outcome</h2>
                    <p>{outcomeTask.title}</p>
                  </div>

                  <button
                    type="button"
                    className="task-close"
                    onClick={() => setOutcomeTask(null)}
                  >
                    X
                  </button>
                </div>

                <div className="task-outcome-box">
                  <div className="task-field">
                    <label>Outcome</label>
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                    >
                      {OUTCOMES.map((item) => (
                        <option key={item} value={item}>
                          {labelStatus(item)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(outcome === "Follow up later" ||
                    outcome === "No Answer" ||
                    outcome === "Unreachable") && (
                    <div className="task-field">
                      <label>Next Follow-up</label>
                      <input
                        type="datetime-local"
                        value={nextFollowUp}
                        onChange={(e) => {
                          setNextFollowUp(e.target.value);
                          setNextDueAt(e.target.value);
                        }}
                      />
                    </div>
                  )}

                  <div className="task-field">
                    <label>Notes / Feedback</label>
                    <textarea
                      rows={5}
                      value={outcomeNotes}
                      onChange={(e) => setOutcomeNotes(e.target.value)}
                      placeholder="Record what happened during the call, WhatsApp or email..."
                    />
                  </div>

                  <div className="task-outcome-note">
                    The outcome will update the related lead and complete this
                    task. If a next follow-up is selected, a new task will be
                    created automatically.
                  </div>
                </div>

                <div className="task-modal-actions">
                  <button
                    type="button"
                    className="ciu-btn-light"
                    onClick={() => setOutcomeTask(null)}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="ciu-btn"
                    disabled={saving}
                    onClick={saveOutcome}
                  >
                    {saving ? "Saving..." : "Save Outcome & Complete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .task-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0, 40, 34, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .task-modal {
          width: min(850px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 18px;
          padding: 28px;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.2);
        }

        .task-modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .task-modal-head h2 {
          margin: 0 0 6px;
          color: #004d40;
          font-size: 24px;
        }

        .task-modal-head p {
          margin: 0;
          color: #6b7f78;
        }

        .task-close {
          width: 36px;
          height: 36px;
          border: 1px solid #dfe9e5;
          border-radius: 10px;
          background: white;
          cursor: pointer;
          font-weight: 700;
          color: #004d40;
        }

        .task-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .task-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .task-field-full {
          grid-column: 1 / -1;
        }

        .task-field label {
          font-size: 13px;
          font-weight: 700;
          color: #17322c;
        }

        .task-field input,
        .task-field select,
        .task-field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dfe9e5;
          border-radius: 10px;
          padding: 11px 12px;
          font: inherit;
          color: #17322c;
          background: white;
          outline: none;
        }

        .task-field input:focus,
        .task-field select:focus,
        .task-field textarea:focus {
          border-color: #00695c;
          box-shadow: 0 0 0 3px rgba(0, 105, 92, 0.08);
        }

        .task-modal-actions {
          display: flex;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 24px;
          padding-top: 18px;
          border-top: 1px solid #eef3f1;
        }

        .task-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .task-detail-grid > div {
          padding: 15px;
          border: 1px solid #e5eeeb;
          border-radius: 12px;
          background: #f8fbfa;
        }

        .task-detail-grid span,
        .task-detail-description span {
          display: block;
          font-size: 12px;
          color: #6b7f78;
          margin-bottom: 5px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .task-detail-grid strong {
          color: #17322c;
        }

        .task-detail-description {
          padding: 16px;
          border-radius: 12px;
          background: #eef7df;
          margin-bottom: 18px;
        }

        .task-detail-description p {
          margin: 0;
          color: #17322c;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .task-contact-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .task-contact-actions button {
          border: 0;
          border-radius: 9px;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 700;
        }

        .task-action-call {
          background: #eaf5f2;
          color: #00695c;
        }

        .task-action-whatsapp {
          background: #eef7df;
          color: #3d6b20;
        }

        .task-action-email {
          background: #edf1f7;
          color: #304b6d;
        }

        .task-danger-btn {
          border: 0;
          border-radius: 9px;
          padding: 10px 16px;
          background: #fff0ef;
          color: #b42318;
          cursor: pointer;
          font-weight: 700;
        }

        .task-outcome-box {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .task-outcome-note {
          padding: 14px;
          border-radius: 10px;
          background: #eef7df;
          color: #456052;
          font-size: 13px;
          line-height: 1.5;
        }

        @media (max-width: 700px) {
          .task-modal-backdrop {
            padding: 10px;
          }

          .task-modal {
            padding: 20px;
            border-radius: 14px;
          }

          .task-form-grid,
          .task-detail-grid {
            grid-template-columns: 1fr;
          }

          .task-field-full {
            grid-column: auto;
          }

          .task-modal-actions {
            justify-content: stretch;
          }

          .task-modal-actions button {
            flex: 1;
          }
        }
      `}</style>
    </main>
  );
}