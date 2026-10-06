"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

type TaskType =
  | "Call"
  | "Email"
  | "WhatsApp"
  | "Meeting"
  | "Note"
  | "Proposal"
  | "Other";

type Task = {
  id: string;
  title: string;
  description: string | null;
  task_type: TaskType | string;
  lead_id: string | null;
  opportunity_id: string | null;
  assigned_to: string | null;
  due_at: string | null;
  status: TaskStatus | string;
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
};

type Opportunity = {
  id: string;
  lead_id: string | null;
  title: string | null;
  value: number | null;
  currency: string | null;
  stage_id: string | null;
};

type PipelineStage = {
  id: string;
  name: string;
  position: number | null;
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
  "Meeting",
  "Note",
  "Proposal",
  "Other",
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
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

function formatCurrency(
  value: number | null,
  currency: string | null = "UGX"
) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${currency || "UGX"} ${Number(value).toLocaleString("en-UG")}`;
}

function getStatusLabel(status: string) {
  const found = STATUS_OPTIONS.find((item) => item.value === status);
  return found?.label || status;
}

function getStatusStyle(status: string) {
  switch (status) {
    case "pending":
      return {
        background: "#fff7ed",
        color: "#c2410c",
        border: "1px solid #fed7aa",
      };

    case "in_progress":
      return {
        background: "#eff6ff",
        color: "#1d4ed8",
        border: "1px solid #bfdbfe",
      };

    case "completed":
      return {
        background: "#ecfdf5",
        color: "#047857",
        border: "1px solid #a7f3d0",
      };

    case "cancelled":
      return {
        background: "#f3f4f6",
        color: "#6b7280",
        border: "1px solid #d1d5db",
      };

    default:
      return {
        background: "#f9fafb",
        color: "#374151",
        border: "1px solid #e5e7eb",
      };
  }
}

function getTaskTypeIcon(type: string) {
  switch (type) {
    case "Call":
      return "☎";

    case "Email":
      return "✉";

    case "WhatsApp":
      return "◉";

    case "Meeting":
      return "▣";

    case "Note":
      return "☰";

    case "Proposal":
      return "▤";

    default:
      return "•";
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
  if (!task.due_at) return false;

  if (
    task.status === "completed" ||
    task.status === "cancelled"
  ) {
    return false;
  }

  return new Date(task.due_at) < new Date();
}

function isCompletedThisMonth(task: Task) {
  if (task.status !== "completed" || !task.completed_at) {
    return false;
  }

  const completedDate = new Date(task.completed_at);
  const now = new Date();

  return (
    completedDate.getFullYear() === now.getFullYear() &&
    completedDate.getMonth() === now.getMonth()
  );
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pipelineStages, setPipelineStages] = useState<
    PipelineStage[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [
        tasksResult,
        profilesResult,
        leadsResult,
        opportunitiesResult,
        stagesResult,
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select(
            `
              id,
              title,
              description,
              task_type,
              lead_id,
              opportunity_id,
              assigned_to,
              due_at,
              status,
              completed_at,
              created_at,
              updated_at
            `
          )
          .order("due_at", {
            ascending: true,
            nullsFirst: false,
          }),

        supabase
          .from("profiles")
          .select(
            "id, full_name, role, is_active"
          )
          .order("full_name", {
            ascending: true,
          }),

        supabase
          .from("leads")
          .select(
            "id, name, ciu_number, phone"
          )
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("opportunities")
          .select(
            "id, lead_id, title, value, currency, stage_id"
          )
          .order("title", {
            ascending: true,
          }),

        supabase
          .from("pipeline_stages")
          .select(
            "id, name, position"
          )
          .order("position", {
            ascending: true,
          }),
      ]);

      if (tasksResult.error) {
        throw tasksResult.error;
      }

      if (profilesResult.error) {
        throw profilesResult.error;
      }

      if (leadsResult.error) {
        throw leadsResult.error;
      }

      if (opportunitiesResult.error) {
        throw opportunitiesResult.error;
      }

      if (stagesResult.error) {
        throw stagesResult.error;
      }

      setTasks((tasksResult.data || []) as Task[]);
      setProfiles((profilesResult.data || []) as Profile[]);
      setLeads((leadsResult.data || []) as Lead[]);
      setOpportunities(
        (opportunitiesResult.data || []) as Opportunity[]
      );
      setPipelineStages(
        (stagesResult.data || []) as PipelineStage[]
      );
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          "Failed to load tasks. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const activeTasks = tasks.filter(
      (task) =>
        task.status !== "completed" &&
        task.status !== "cancelled"
    );

    const dueToday = activeTasks.filter((task) =>
      isToday(task.due_at)
    ).length;

    const overdue = activeTasks.filter((task) =>
      isOverdue(task)
    ).length;

    const completed = tasks.filter(
      (task) => task.status === "completed"
    ).length;

    const completedThisMonth = tasks.filter(
      (task) => isCompletedThisMonth(task)
    ).length;

    const cancelled = tasks.filter(
      (task) => task.status === "cancelled"
    ).length;

    const totalForRate =
      tasks.length - cancelled;

    const completionRate =
      totalForRate > 0
        ? Math.round(
            (completed / totalForRate) * 100
          )
        : 0;

    return {
      active: activeTasks.length,
      dueToday,
      overdue,
      completed,
      completedThisMonth,
      cancelled,
      completionRate,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const searchValue = search
      .trim()
      .toLowerCase();

    return [...tasks]
      .filter((task) => {
        /*
         * IMPORTANT:
         *
         * When the user is viewing "All Statuses",
         * only active tasks are shown.
         *
         * Completed tasks remain in Supabase and can
         * still be accessed by selecting "Completed"
         * in the status filter.
         */
        if (statusFilter === "all") {
          return task.status !== "completed";
        }

        return task.status === statusFilter;
      })
      .filter((task) => {
        if (typeFilter === "all") {
          return true;
        }

        return task.task_type === typeFilter;
      })
      .filter((task) => {
        if (!searchValue) {
          return true;
        }

        const lead = leads.find(
          (item) => item.id === task.lead_id
        );

        const opportunity = opportunities.find(
          (item) => item.id === task.opportunity_id
        );

        const staff = profiles.find(
          (item) => item.id === task.assigned_to
        );

        const searchableText = [
          task.title,
          task.description,
          task.task_type,
          task.status,
          lead?.name,
          lead?.ciu_number,
          lead?.phone,
          opportunity?.title,
          staff?.full_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(searchValue);
      })
      .sort((a, b) => {
        if (!a.due_at && !b.due_at) return 0;
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;

        return (
          new Date(a.due_at).getTime() -
          new Date(b.due_at).getTime()
        );
      });
  }, [
    tasks,
    search,
    statusFilter,
    typeFilter,
    leads,
    opportunities,
    profiles,
  ]);

  function openCreateModal() {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEditModal(task: Task) {
    setEditingTask(task);

    setForm({
      title: task.title || "",
      description: task.description || "",
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
        task.status as TaskStatus,
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingTask(null);
    setForm(EMPTY_FORM);
  }

  async function handleSaveTask(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!form.title.trim()) {
        throw new Error(
          "Please enter a task title."
        );
      }

      let dueAt: string | null = null;

      if (form.due_at) {
        const parsedDate = new Date(
          form.due_at
        );

        if (Number.isNaN(parsedDate.getTime())) {
          throw new Error(
            "Please enter a valid due date and time."
          );
        }

        dueAt = parsedDate.toISOString();
      }

      const completedAt =
        form.status === "completed"
          ? editingTask?.completed_at ||
            new Date().toISOString()
          : null;

      const payload = {
        title: form.title.trim(),
        description:
          form.description.trim() || null,
        task_type: form.task_type,
        lead_id:
          form.lead_id || null,
        opportunity_id:
          form.opportunity_id || null,
        assigned_to:
          form.assigned_to || null,
        due_at: dueAt,
        status: form.status,
        completed_at: completedAt,
        updated_at:
          new Date().toISOString(),
      };

      if (editingTask) {
        const { error: updateError } =
          await supabase
            .from("tasks")
            .update(payload)
            .eq("id", editingTask.id);

        if (updateError) {
          throw updateError;
        }

        setSuccess(
          "Task updated successfully."
        );
      } else {
        const { error: insertError } =
          await supabase
            .from("tasks")
            .insert({
              ...payload,
              created_at:
                new Date().toISOString(),
            });

        if (insertError) {
          throw insertError;
        }

        setSuccess(
          "Task created successfully."
        );
      }

      await loadAll();

      setShowModal(false);
      setEditingTask(null);
      setForm(EMPTY_FORM);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Failed to save task."
      );
    } finally {
      setSaving(false);
    }
  }

  async function markComplete(task: Task) {
    if (task.status === "completed") {
      return;
    }

    setError("");
    setSuccess("");

    const { error: updateError } =
      await supabase
        .from("tasks")
        .update({
          status: "completed",
          completed_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", task.id);

    if (updateError) {
      console.error(updateError);

      setError(updateError.message);
      return;
    }

    setSuccess(
      "Task marked as completed."
    );

    await loadAll();
  }

  async function updateStatus(
    task: Task,
    status: TaskStatus
  ) {
    setError("");
    setSuccess("");

    const completedAt =
      status === "completed"
        ? task.completed_at ||
          new Date().toISOString()
        : null;

    const { error: updateError } =
      await supabase
        .from("tasks")
        .update({
          status,
          completed_at: completedAt,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", task.id);

    if (updateError) {
      console.error(updateError);

      setError(updateError.message);
      return;
    }

    setSuccess(
      `Task moved to ${getStatusLabel(
        status
      )}.`
    );

    await loadAll();
  }

  async function deleteTask(task: Task) {
    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${task.title}"?`
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    const { error: deleteError } =
      await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id);

    if (deleteError) {
      console.error(deleteError);

      setError(deleteError.message);
      return;
    }

    if (selectedTask?.id === task.id) {
      setSelectedTask(null);
    }

    setSuccess(
      "Task deleted successfully."
    );

    await loadAll();
  }

  function getLead(task: Task) {
    return leads.find(
      (lead) => lead.id === task.lead_id
    );
  }

  function getOpportunity(task: Task) {
    return opportunities.find(
      (opportunity) =>
        opportunity.id ===
        task.opportunity_id
    );
  }

  function getStaff(task: Task) {
    return profiles.find(
      (profile) =>
        profile.id === task.assigned_to
    );
  }

  function getStage(opportunity: Opportunity | undefined) {
    if (!opportunity?.stage_id) {
      return undefined;
    }

    return pipelineStages.find(
      (stage) =>
        stage.id ===
        opportunity.stage_id
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#111827",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "1500px",
          margin: "0 auto",
        }}
      >
        {/* PAGE HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
            marginBottom: "24px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "30px",
                fontWeight: 800,
                letterSpacing: "-0.5px",
              }}
            >
              Tasks & Follow-ups
            </h1>

            <p
              style={{
                margin:
                  "7px 0 0",
                color: "#6b7280",
                fontSize: "15px",
              }}
            >
              Stay on top of activities
              and never miss an opportunity.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            style={{
              border: "none",
              borderRadius: "10px",
              background: "#111827",
              color: "#ffffff",
              padding:
                "12px 18px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.12)",
            }}
          >
            + New Task
          </button>
        </div>

        {/* ALERTS */}
        {error && (
          <div
            style={{
              marginBottom: "16px",
              padding: "13px 16px",
              borderRadius: "10px",
              background: "#fef2f2",
              border:
                "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              marginBottom: "16px",
              padding: "13px 16px",
              borderRadius: "10px",
              background: "#ecfdf5",
              border:
                "1px solid #a7f3d0",
              color: "#047857",
              fontSize: "14px",
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
              "repeat(4, minmax(0, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <KpiCard
            label="Due Today"
            value={stats.dueToday}
            icon="◷"
            description="Active tasks due today"
          />

          <KpiCard
            label="Overdue"
            value={stats.overdue}
            icon="!"
            description="Active tasks past due"
            danger={stats.overdue > 0}
          />

          <KpiCard
            label="Completed This Month"
            value={
              stats.completedThisMonth
            }
            icon="✓"
            description="Tasks completed this month"
          />

          <KpiCard
            label="Completion Rate"
            value={`${stats.completionRate}%`}
            icon="%"
            description={`${stats.completed} completed tasks`}
          />
        </div>

        {/* MAIN CARD */}
        <div
          style={{
            background: "#ffffff",
            border:
              "1px solid #e5e7eb",
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow:
              "0 2px 8px rgba(15,23,42,0.04)",
          }}
        >
          {/* CARD HEADER */}
          <div
            style={{
              padding: "20px 22px",
              borderBottom:
                "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "20px",
                marginBottom: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "20px",
                    fontWeight: 750,
                  }}
                >
                  My Tasks
                </h2>

                <p
                  style={{
                    margin:
                      "5px 0 0",
                    color: "#6b7280",
                    fontSize: "13px",
                  }}
                >
                  Activities and follow-ups
                </p>
              </div>

              <div
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                Showing{" "}
                <strong
                  style={{
                    color: "#111827",
                  }}
                >
                  {filteredTasks.length}
                </strong>{" "}
                task
                {filteredTasks.length === 1
                  ? ""
                  : "s"}
              </div>
            </div>

            {/* FILTERS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(250px, 1fr) 180px 180px",
                gap: "12px",
              }}
            >
              <div
                style={{
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position:
                      "absolute",
                    left: "13px",
                    top: "50%",
                    transform:
                      "translateY(-50%)",
                    color: "#9ca3af",
                    fontSize: "16px",
                  }}
                >
                  ⌕
                </span>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search tasks, leads, staff..."
                  style={{
                    width: "100%",
                    height: "42px",
                    boxSizing:
                      "border-box",
                    border:
                      "1px solid #d1d5db",
                    borderRadius: "9px",
                    padding:
                      "0 13px 0 38px",
                    outline: "none",
                    fontSize: "14px",
                    background:
                      "#ffffff",
                  }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                style={{
                  height: "42px",
                  border:
                    "1px solid #d1d5db",
                  borderRadius: "9px",
                  padding:
                    "0 12px",
                  fontSize: "14px",
                  background:
                    "#ffffff",
                  color: "#111827",
                  outline: "none",
                }}
              >
                <option value="all">
                  All Active Statuses
                </option>

                {STATUS_OPTIONS.map(
                  (status) => (
                    <option
                      key={status.value}
                      value={status.value}
                    >
                      {status.label}
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
                  height: "42px",
                  border:
                    "1px solid #d1d5db",
                  borderRadius: "9px",
                  padding:
                    "0 12px",
                  fontSize: "14px",
                  background:
                    "#ffffff",
                  color: "#111827",
                  outline: "none",
                }}
              >
                <option value="all">
                  All Task Types
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
            </div>
          </div>

          {/* COMPLETED FILTER INFORMATION */}
          {statusFilter ===
            "completed" && (
            <div
              style={{
                margin:
                  "16px 22px 0",
                padding:
                  "11px 14px",
                borderRadius: "9px",
                background:
                  "#ecfdf5",
                border:
                  "1px solid #a7f3d0",
                color: "#047857",
                fontSize: "13px",
              }}
            >
              You are viewing completed
              tasks. These tasks remain
              stored in the database for
              history and reporting.
            </div>
          )}

          {/* TABLE */}
          <div
            style={{
              overflowX: "auto",
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: "70px 20px",
                  textAlign: "center",
                  color: "#6b7280",
                }}
              >
                Loading tasks...
              </div>
            ) : filteredTasks.length ===
              0 ? (
              <div
                style={{
                  padding: "70px 20px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: "54px",
                    height: "54px",
                    borderRadius: "50%",
                    background:
                      "#f3f4f6",
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    margin:
                      "0 auto 14px",
                    fontSize: "24px",
                    color: "#6b7280",
                  }}
                >
                  ✓
                </div>

                <h3
                  style={{
                    margin:
                      "0 0 6px",
                    fontSize: "17px",
                  }}
                >
                  No tasks found
                </h3>

                <p
                  style={{
                    margin: 0,
                    color: "#6b7280",
                    fontSize: "14px",
                  }}
                >
                  {statusFilter ===
                  "all"
                    ? "There are no active tasks to display."
                    : "No tasks match the selected filters."}
                </p>
              </div>
            ) : (
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
                      borderBottom:
                        "1px solid #e5e7eb",
                    }}
                  >
                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      TASK
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      TYPE
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      RELATED
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      ASSIGNED TO
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      DUE
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      STATUS
                    </th>

                    <th
                      style={{
                        ...tableHeaderStyle,
                        textAlign: "right",
                      }}
                    >
                      ACTIONS
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTasks.map(
                    (task) => {
                      const lead =
                        getLead(task);

                      const opportunity =
                        getOpportunity(
                          task
                        );

                      const staff =
                        getStaff(task);

                      const overdue =
                        isOverdue(task);

                      return (
                        <tr
                          key={task.id}
                          style={{
                            borderBottom:
                              "1px solid #f1f5f9",
                          }}
                        >
                          {/* TASK */}
                          <td
                            style={{
                              padding:
                                "17px 18px",
                              verticalAlign:
                                "top",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                gap: "11px",
                                alignItems:
                                  "flex-start",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  markComplete(
                                    task
                                  )
                                }
                                title={
                                  task.status ===
                                  "completed"
                                    ? "Completed"
                                    : "Mark complete"
                                }
                                disabled={
                                  task.status ===
                                  "completed"
                                }
                                style={{
                                  width:
                                    "28px",
                                  height:
                                    "28px",
                                  minWidth:
                                    "28px",
                                  borderRadius:
                                    "50%",
                                  border:
                                    task.status ===
                                    "completed"
                                      ? "1px solid #10b981"
                                      : "1px solid #cbd5e1",
                                  background:
                                    task.status ===
                                    "completed"
                                      ? "#10b981"
                                      : "#ffffff",
                                  color:
                                    task.status ===
                                    "completed"
                                      ? "#ffffff"
                                      : "#64748b",
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
                                  fontSize:
                                    "13px",
                                  marginTop:
                                    "1px",
                                }}
                              >
                                {task.status ===
                                "completed"
                                  ? "✓"
                                  : ""}
                              </button>

                              <div>
                                <div
                                  style={{
                                    fontWeight:
                                      700,
                                    fontSize:
                                      "14px",
                                    color:
                                      "#111827",
                                    marginBottom:
                                      "4px",
                                  }}
                                >
                                  {task.title}
                                </div>

                                {task.description && (
                                  <div
                                    style={{
                                      color:
                                        "#6b7280",
                                      fontSize:
                                        "12px",
                                      maxWidth:
                                        "300px",
                                      lineHeight:
                                        1.5,
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

                          {/* TYPE */}
                          <td
                            style={{
                              padding:
                                "17px 18px",
                              verticalAlign:
                                "top",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "inline-flex",
                                alignItems:
                                  "center",
                                gap: "7px",
                                fontSize:
                                  "13px",
                                fontWeight:
                                  600,
                                color:
                                  "#374151",
                              }}
                            >
                              <span
                                style={{
                                  width:
                                    "27px",
                                  height:
                                    "27px",
                                  borderRadius:
                                    "7px",
                                  background:
                                    "#f3f4f6",
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  justifyContent:
                                    "center",
                                  fontSize:
                                    "13px",
                                }}
                              >
                                {getTaskTypeIcon(
                                  task.task_type
                                )}
                              </span>

                              {
                                task.task_type
                              }
                            </div>
                          </td>

                          {/* RELATED */}
                          <td
                            style={{
                              padding:
                                "17px 18px",
                              verticalAlign:
                                "top",
                            }}
                          >
                            {lead ? (
                              <div>
                                <div
                                  style={{
                                    fontSize:
                                      "13px",
                                    fontWeight:
                                      650,
                                    color:
                                      "#111827",
                                  }}
                                >
                                  {lead.name ||
                                    "Unnamed lead"}
                                </div>

                                {lead.ciu_number && (
                                  <div
                                    style={{
                                      marginTop:
                                        "3px",
                                      fontSize:
                                        "11px",
                                      color:
                                        "#6b7280",
                                    }}
                                  >
                                    {
                                      lead.ciu_number
                                    }
                                  </div>
                                )}

                                {lead.phone && (
                                  <div
                                    style={{
                                      marginTop:
                                        "2px",
                                      fontSize:
                                        "11px",
                                      color:
                                        "#6b7280",
                                    }}
                                  >
                                    {
                                      lead.phone
                                    }
                                  </div>
                                )}
                              </div>
                            ) : opportunity ? (
                              <div>
                                <div
                                  style={{
                                    fontSize:
                                      "13px",
                                    fontWeight:
                                      650,
                                  }}
                                >
                                  {
                                    opportunity.title
                                  }
                                </div>

                                <div
                                  style={{
                                    marginTop:
                                      "3px",
                                    fontSize:
                                      "11px",
                                    color:
                                      "#6b7280",
                                  }}
                                >
                                  {
                                    formatCurrency(
                                      opportunity.value,
                                      opportunity.currency
                                    )
                                  }
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
                                No related record
                              </span>
                            )}
                          </td>

                          {/* ASSIGNED */}
                          <td
                            style={{
                              padding:
                                "17px 18px",
                              verticalAlign:
                                "top",
                            }}
                          >
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
                                    "30px",
                                  height:
                                    "30px",
                                  borderRadius:
                                    "50%",
                                  background:
                                    "#e5e7eb",
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  justifyContent:
                                    "center",
                                  fontSize:
                                    "11px",
                                  fontWeight:
                                    700,
                                  color:
                                    "#374151",
                                }}
                              >
                                {staff?.full_name
                                  ? staff.full_name
                                      .split(
                                        " "
                                      )
                                      .map(
                                        (
                                          part
                                        ) =>
                                          part[0]
                                      )
                                      .join("")
                                      .slice(
                                        0,
                                        2
                                      )
                                      .toUpperCase()
                                  : "—"}
                              </div>

                              <div
                                style={{
                                  fontSize:
                                    "12px",
                                  color:
                                    "#374151",
                                  fontWeight:
                                    600,
                                }}
                              >
                                {staff
                                  ?.full_name ||
                                  "Unassigned"}
                              </div>
                            </div>
                          </td>

                          {/* DUE */}
                          <td
                            style={{
                              padding:
                                "17px 18px",
                              verticalAlign:
                                "top",
                            }}
                          >
                            <div
                              style={{
                                fontSize:
                                  "12px",
                                color:
                                  overdue
                                    ? "#dc2626"
                                    : "#374151",
                                fontWeight:
                                  overdue
                                    ? 700
                                    : 500,
                              }}
                            >
                              {formatDateTime(
                                task.due_at
                              )}
                            </div>

                            {overdue && (
                              <div
                                style={{
                                  display:
                                    "inline-block",
                                  marginTop:
                                    "5px",
                                  fontSize:
                                    "10px",
                                  fontWeight:
                                    700,
                                  color:
                                    "#dc2626",
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
                                "17px 18px",
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
                                padding:
                                  "5px 9px",
                                borderRadius:
                                  "999px",
                                fontSize:
                                  "11px",
                                fontWeight:
                                  700,
                                whiteSpace:
                                  "nowrap",
                                ...getStatusStyle(
                                  task.status
                                ),
                              }}
                            >
                              {getStatusLabel(
                                task.status
                              )}
                            </span>
                          </td>

                          {/* ACTIONS */}
                          <td
                            style={{
                              padding:
                                "17px 18px",
                              verticalAlign:
                                "top",
                              textAlign:
                                "right",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "flex-end",
                                gap: "6px",
                                flexWrap:
                                  "wrap",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedTask(
                                    task
                                  )
                                }
                                style={
                                  smallActionButton
                                }
                              >
                                View
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openEditModal(
                                    task
                                  )
                                }
                                style={
                                  smallActionButton
                                }
                              >
                                Edit
                              </button>

                              {task.status !==
                                "completed" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    markComplete(
                                      task
                                    )
                                  }
                                  style={{
                                    ...smallActionButton,
                                    color:
                                      "#047857",
                                    border:
                                      "1px solid #a7f3d0",
                                    background:
                                      "#ecfdf5",
                                  }}
                                >
                                  Complete
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  deleteTask(
                                    task
                                  )
                                }
                                style={{
                                  ...smallActionButton,
                                  color:
                                    "#b91c1c",
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* VIEW TASK MODAL */}
      {selectedTask && (
        <div
          onClick={() =>
            setSelectedTask(null)
          }
          style={modalOverlayStyle}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={modalCardStyle}
          >
            {(() => {
              const lead =
                getLead(selectedTask);

              const opportunity =
                getOpportunity(
                  selectedTask
                );

              const staff =
                getStaff(selectedTask);

              const stage =
                getStage(opportunity);

              return (
                <>
                  <div
                    style={
                      modalHeaderStyle
                    }
                  >
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontSize:
                            "21px",
                          fontWeight:
                            800,
                        }}
                      >
                        Task Details
                      </h2>

                      <p
                        style={{
                          margin:
                            "5px 0 0",
                          color:
                            "#6b7280",
                          fontSize:
                            "13px",
                        }}
                      >
                        View task and
                        follow-up
                        information
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTask(
                          null
                        )
                      }
                      style={
                        closeButtonStyle
                      }
                    >
                      ×
                    </button>
                  </div>

                  <div
                    style={{
                      padding:
                        "22px",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(2, minmax(0, 1fr))",
                        gap: "18px",
                      }}
                    >
                      <DetailItem
                        label="Task"
                        value={
                          selectedTask.title
                        }
                      />

                      <DetailItem
                        label="Task Type"
                        value={
                          selectedTask.task_type
                        }
                      />

                      <DetailItem
                        label="Status"
                        value={
                          getStatusLabel(
                            selectedTask.status
                          )
                        }
                      />

                      <DetailItem
                        label="Due Date"
                        value={formatDateTime(
                          selectedTask.due_at
                        )}
                      />

                      <DetailItem
                        label="Assigned To"
                        value={
                          staff?.full_name ||
                          "Unassigned"
                        }
                      />

                      <DetailItem
                        label="Created"
                        value={formatDate(
                          selectedTask.created_at
                        )}
                      />

                      {selectedTask.completed_at && (
                        <DetailItem
                          label="Completed"
                          value={formatDateTime(
                            selectedTask.completed_at
                          )}
                        />
                      )}

                      {lead && (
                        <DetailItem
                          label="Related Lead"
                          value={
                            lead.name ||
                            "Unnamed lead"
                          }
                        />
                      )}

                      {lead?.ciu_number && (
                        <DetailItem
                          label="CIU Number"
                          value={
                            lead.ciu_number
                          }
                        />
                      )}

                      {lead?.phone && (
                        <DetailItem
                          label="Phone"
                          value={
                            lead.phone
                          }
                        />
                      )}

                      {opportunity && (
                        <DetailItem
                          label="Pipeline Opportunity"
                          value={
                            opportunity.title ||
                            "Opportunity"
                          }
                        />
                      )}

                      {stage && (
                        <DetailItem
                          label="Pipeline Stage"
                          value={
                            stage.name
                          }
                        />
                      )}

                      {opportunity && (
                        <DetailItem
                          label="Opportunity Value"
                          value={formatCurrency(
                            opportunity.value,
                            opportunity.currency
                          )}
                        />
                      )}
                    </div>

                    {selectedTask.description && (
                      <div
                        style={{
                          marginTop:
                            "20px",
                        }}
                      >
                        <div
                          style={
                            detailLabelStyle
                          }
                        >
                          DESCRIPTION
                        </div>

                        <div
                          style={{
                            marginTop:
                              "7px",
                            padding:
                              "12px 14px",
                            borderRadius:
                              "9px",
                            background:
                              "#f8fafc",
                            color:
                              "#374151",
                            fontSize:
                              "13px",
                            lineHeight:
                              1.6,
                            whiteSpace:
                              "pre-wrap",
                          }}
                        >
                          {
                            selectedTask.description
                          }
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        marginTop:
                          "24px",
                        display:
                          "flex",
                        justifyContent:
                          "flex-end",
                        gap: "9px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      {lead?.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          style={{
                            ...secondaryButtonStyle,
                            textDecoration:
                              "none",
                          }}
                        >
                          Call Lead
                        </a>
                      )}

                      {selectedTask.status !==
                        "completed" && (
                        <button
                          type="button"
                          onClick={async () => {
                            await markComplete(
                              selectedTask
                            );

                            setSelectedTask(
                              null
                            );
                          }}
                          style={
                            primaryButtonStyle
                          }
                        >
                          ✓ Mark Complete
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTask(
                            null
                          );
                          openEditModal(
                            selectedTask
                          );
                        }}
                        style={
                          secondaryButtonStyle
                        }
                      >
                        Edit Task
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div
          onClick={closeModal}
          style={modalOverlayStyle}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              ...modalCardStyle,
              maxWidth: "780px",
            }}
          >
            <div
              style={
                modalHeaderStyle
              }
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize:
                      "21px",
                    fontWeight:
                      800,
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
                      "13px",
                  }}
                >
                  {editingTask
                    ? "Update the task details below."
                    : "Create a new activity or follow-up."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                style={
                  closeButtonStyle
                }
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleSaveTask
              }
            >
              <div
                style={{
                  padding:
                    "22px",
                }}
              >
                {error && (
                  <div
                    style={{
                      marginBottom:
                        "17px",
                      padding:
                        "11px 13px",
                      borderRadius:
                        "8px",
                      background:
                        "#fef2f2",
                      border:
                        "1px solid #fecaca",
                      color:
                        "#b91c1c",
                      fontSize:
                        "13px",
                    }}
                  >
                    {error}
                  </div>
                )}

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: "17px",
                  }}
                >
                  {/* TITLE */}
                  <div
                    style={{
                      gridColumn:
                        "1 / -1",
                    }}
                  >
                    <FormLabel>
                      Task Title
                    </FormLabel>

                    <input
                      required
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
                      placeholder="e.g. Call admitted student"
                      style={
                        inputStyle
                      }
                    />
                  </div>

                  {/* DESCRIPTION */}
                  <div
                    style={{
                      gridColumn:
                        "1 / -1",
                    }}
                  >
                    <FormLabel>
                      Description
                    </FormLabel>

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
                      placeholder="Add task details, notes or instructions..."
                      rows={4}
                      style={{
                        ...inputStyle,
                        height:
                          "auto",
                        padding:
                          "11px 12px",
                        resize:
                          "vertical",
                        fontFamily:
                          "inherit",
                      }}
                    />
                  </div>

                  {/* TYPE */}
                  <div>
                    <FormLabel>
                      Task Type
                    </FormLabel>

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
                      style={
                        inputStyle
                      }
                    >
                      {TASK_TYPES.map(
                        (
                          type
                        ) => (
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

                  {/* STATUS */}
                  <div>
                    <FormLabel>
                      Status
                    </FormLabel>

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
                      style={
                        inputStyle
                      }
                    >
                      {STATUS_OPTIONS.map(
                        (
                          status
                        ) => (
                          <option
                            key={
                              status.value
                            }
                            value={
                              status.value
                            }
                          >
                            {
                              status.label
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* LEAD */}
                  <div>
                    <FormLabel>
                      Related Lead
                    </FormLabel>

                    <select
                      value={
                        form.lead_id
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            lead_id:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      style={
                        inputStyle
                      }
                    >
                      <option value="">
                        No lead
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
                              "Unnamed lead"}
                            {lead.ciu_number
                              ? ` — ${lead.ciu_number}`
                              : ""}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* OPPORTUNITY */}
                  <div>
                    <FormLabel>
                      Pipeline Opportunity
                    </FormLabel>

                    <select
                      value={
                        form.opportunity_id
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            opportunity_id:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      style={
                        inputStyle
                      }
                    >
                      <option value="">
                        No opportunity
                      </option>

                      {opportunities.map(
                        (
                          opportunity
                        ) => (
                          <option
                            key={
                              opportunity.id
                            }
                            value={
                              opportunity.id
                            }
                          >
                            {opportunity.title ||
                              "Untitled opportunity"}
                            {opportunity.value !==
                            null
                              ? ` — ${formatCurrency(
                                  opportunity.value,
                                  opportunity.currency
                                )}`
                              : ""}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* STAFF */}
                  <div>
                    <FormLabel>
                      Assigned Staff
                    </FormLabel>

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
                      style={
                        inputStyle
                      }
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
                              false
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
                                "Unnamed staff"}
                              {profile.role
                                ? ` — ${profile.role}`
                                : ""}
                            </option>
                          )
                        )}
                    </select>
                  </div>

                  {/* DUE DATE */}
                  <div>
                    <FormLabel>
                      Due Date & Time
                    </FormLabel>

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
                      style={
                        inputStyle
                      }
                    />
                  </div>
                </div>

                {/* FORM FOOTER */}
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "flex-end",
                    gap: "9px",
                    marginTop:
                      "24px",
                    paddingTop:
                      "18px",
                    borderTop:
                      "1px solid #e5e7eb",
                  }}
                >
                  <button
                    type="button"
                    onClick={
                      closeModal
                    }
                    disabled={
                      saving
                    }
                    style={
                      secondaryButtonStyle
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving
                    }
                    style={{
                      ...primaryButtonStyle,
                      opacity:
                        saving
                          ? 0.7
                          : 1,
                    }}
                  >
                    {saving
                      ? "Saving..."
                      : editingTask
                      ? "Update Task"
                      : "Create Task"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function KpiCard({
  label,
  value,
  icon,
  description,
  danger = false,
}: {
  label: string;
  value: string | number;
  icon: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border:
          "1px solid #e5e7eb",
        borderRadius: "13px",
        padding: "18px",
        boxShadow:
          "0 2px 7px rgba(15,23,42,0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: "10px",
        }}
      >
        <div>
          <div
            style={{
              color: "#6b7280",
              fontSize: "12px",
              fontWeight: 700,
              textTransform:
                "uppercase",
              letterSpacing:
                "0.35px",
            }}
          >
            {label}
          </div>

          <div
            style={{
              marginTop:
                "8px",
              fontSize: "28px",
              lineHeight: 1,
              fontWeight: 800,
              color: danger
                ? "#dc2626"
                : "#111827",
            }}
          >
            {value}
          </div>

          <div
            style={{
              marginTop:
                "8px",
              color: "#9ca3af",
              fontSize: "11px",
            }}
          >
            {description}
          </div>
        </div>

        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius:
              "10px",
            background: danger
              ? "#fef2f2"
              : "#f3f4f6",
            color: danger
              ? "#dc2626"
              : "#374151",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            fontSize: "17px",
            fontWeight: 800,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={
          detailLabelStyle
        }
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "5px",
          color: "#111827",
          fontSize:
            "14px",
          fontWeight:
            600,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FormLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display:
          "block",
        marginBottom:
          "7px",
        color:
          "#374151",
        fontSize:
          "12px",
        fontWeight:
          700,
      }}
    >
      {children}
    </label>
  );
}

/* =========================================================
   STYLES
========================================================= */

const tableHeaderStyle: React.CSSProperties = {
  padding: "12px 18px",
  textAlign: "left",
  fontSize: "10px",
  fontWeight: 800,
  color: "#6b7280",
  letterSpacing: "0.7px",
  whiteSpace: "nowrap",
};

const smallActionButton: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#374151",
  borderRadius: "7px",
  padding: "6px 9px",
  fontSize: "11px",
  fontWeight: 650,
  cursor: "pointer",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background:
    "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  overflowY: "auto",
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "900px",
  maxHeight: "calc(100vh - 40px)",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: "14px",
  boxShadow:
    "0 25px 70px rgba(15,23,42,0.25)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "20px",
  padding: "20px 22px",
  borderBottom: "1px solid #e5e7eb",
};

const closeButtonStyle: React.CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  color: "#6b7280",
  fontSize: "22px",
  lineHeight: 1,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "42px",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  padding: "0 12px",
  fontSize: "13px",
  color: "#111827",
  background: "#ffffff",
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "8px",
  background: "#111827",
  color: "#ffffff",
  padding: "10px 15px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#374151",
  padding: "10px 15px",
  fontSize: "13px",
  fontWeight: 650,
  cursor: "pointer",
};

const detailLabelStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: "0.6px",
  textTransform: "uppercase",
};