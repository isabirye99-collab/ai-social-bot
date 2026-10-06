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
  email: string | null;
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

const TASK_STATUSES: TaskStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
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
  currency = "UGX"
) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${currency} ${Number(value).toLocaleString("en-UG")}`;
}

function getStatusLabel(status: string) {
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

function getStatusStyle(status: string) {
  switch (status) {
    case "pending":
      return {
        background: "#fff7ed",
        color: "#c2410c",
      };

    case "in_progress":
      return {
        background: "#eff6ff",
        color: "#1d4ed8",
      };

    case "completed":
      return {
        background: "#ecfdf5",
        color: "#047857",
      };

    case "cancelled":
      return {
        background: "#f3f4f6",
        color: "#6b7280",
      };

    default:
      return {
        background: "#f3f4f6",
        color: "#374151",
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
    task.status === "completed" ||
    task.status === "cancelled"
  ) {
    return false;
  }

  return new Date(task.due_at).getTime() < Date.now();
}

function isCompletedThisMonth(task: Task) {
  if (task.status !== "completed" || !task.completed_at) {
    return false;
  }

  const date = new Date(task.completed_at);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
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
  if (!name) return "—";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [opportunities, setOpportunities] = useState<
    Opportunity[]
  >([]);
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
  const [assignedFilter, setAssignedFilter] =
    useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] =
    useState<Task | null>(null);

  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);

  const [selectedTask, setSelectedTask] =
    useState<Task | null>(null);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

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
            "id,title,description,task_type,lead_id,opportunity_id,assigned_to,due_at,status,completed_at,created_at,updated_at"
          )
          .order("due_at", {
            ascending: true,
            nullsFirst: false,
          }),

        supabase
          .from("profiles")
          .select(
            "id,full_name,role,is_active"
          )
          .order("full_name", {
            ascending: true,
          }),

        supabase
          .from("leads")
          .select(
            "id,name,ciu_number,phone,email"
          )
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("opportunities")
          .select(
            "id,lead_id,title,value,currency,stage_id"
          )
          .order("title", {
            ascending: true,
          }),

        supabase
          .from("pipeline_stages")
          .select(
            "id,name,position"
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

      setTasks(
        (tasksResult.data || []) as Task[]
      );

      setProfiles(
        (profilesResult.data || []) as Profile[]
      );

      setLeads(
        (leadsResult.data || []) as Lead[]
      );

      setOpportunities(
        (opportunitiesResult.data || []) as Opportunity[]
      );

      setPipelineStages(
        (stagesResult.data || []) as PipelineStage[]
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
        (lead) => lead.id === task.lead_id
      ) || null
    );
  };

  const getOpportunity = (task: Task) => {
    if (!task.opportunity_id) return null;

    return (
      opportunities.find(
        (opportunity) =>
          opportunity.id === task.opportunity_id
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

  const getStage = (stageId: string | null) => {
    if (!stageId) return null;

    return (
      pipelineStages.find(
        (stage) => stage.id === stageId
      ) || null
    );
  };

  const stats = useMemo(() => {
    const activeTasks = tasks.filter(
      (task) =>
        task.status !== "completed" &&
        task.status !== "cancelled"
    );

    const dueToday = activeTasks.filter(
      (task) => isToday(task.due_at)
    ).length;

    const overdue = activeTasks.filter(
      (task) => isOverdue(task)
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

  const teamWorkload = useMemo(() => {
    return profiles
      .filter(
        (profile) =>
          profile.is_active !== false &&
          profile.role === "salesperson"
      )
      .map((profile) => {
        const staffTasks = tasks.filter(
          (task) =>
            task.assigned_to === profile.id
        );

        const pending = staffTasks.filter(
          (task) =>
            task.status !== "completed" &&
            task.status !== "cancelled"
        ).length;

        const overdue = staffTasks.filter(
          (task) =>
            task.status !== "completed" &&
            task.status !== "cancelled" &&
            isOverdue(task)
        ).length;

        return {
          id: profile.id,
          name:
            profile.full_name ||
            "Unnamed Staff",
          pending,
          overdue,
        };
      })
      .sort((a, b) => {
        if (b.overdue !== a.overdue) {
          return b.overdue - a.overdue;
        }

        return b.pending - a.pending;
      });
  }, [profiles, tasks]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (
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

      if (!query) {
        return true;
      }

      const lead = getLead(task);
      const opportunity =
        getOpportunity(task);
      const staff = getStaff(task);

      const searchable = [
        task.title,
        task.description,
        task.task_type,
        task.status,
        lead?.name,
        lead?.ciu_number,
        lead?.phone,
        lead?.email,
        opportunity?.title,
        staff?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    tasks,
    search,
    statusFilter,
    typeFilter,
    assignedFilter,
    leads,
    opportunities,
    profiles,
  ]);

  const openCreateModal = () => {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);

    setForm({
      title: task.title || "",
      description: task.description || "",
      task_type:
        (task.task_type as TaskType) ||
        "Call",
      lead_id: task.lead_id || "",
      opportunity_id:
        task.opportunity_id || "",
      assigned_to:
        task.assigned_to || "",
      due_at: toDateTimeLocal(
        task.due_at
      ),
      status:
        (task.status as TaskStatus) ||
        "pending",
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const handleSaveTask = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Please enter a task title.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        title: form.title.trim(),
        description:
          form.description.trim() || null,
        task_type: form.task_type,
        lead_id: form.lead_id || null,
        opportunity_id:
          form.opportunity_id || null,
        assigned_to:
          form.assigned_to || null,
        due_at:
          form.due_at
            ? new Date(
                form.due_at
              ).toISOString()
            : null,
        status: form.status,
      };

      if (editingTask) {
        const { error: updateError } =
          await supabase
            .from("tasks")
            .update({
              ...payload,
              completed_at:
                form.status === "completed"
                  ? editingTask.completed_at ||
                    new Date().toISOString()
                  : null,
              updated_at:
                new Date().toISOString(),
            })
            .eq("id", editingTask.id);

        if (updateError) {
          throw updateError;
        }

        setSuccess("Task updated successfully.");
      } else {
        const {
          data: {
            user,
          },
        } = await supabase.auth.getUser();

        const insertPayload: Record<
          string,
          unknown
        > = {
          ...payload,
        };

        if (user?.id) {
          insertPayload.created_by =
            user.id;
        }

        if (form.status === "completed") {
          insertPayload.completed_at =
            new Date().toISOString();
        }

        const { error: insertError } =
          await supabase
            .from("tasks")
            .insert(insertPayload);

        if (insertError) {
          throw insertError;
        }

        setSuccess("Task created successfully.");
      }

      setShowModal(false);
      setEditingTask(null);
      setForm(EMPTY_FORM);

      await loadAll();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save task."
      );
    } finally {
      setSaving(false);
    }
  };

  const markComplete = async (task: Task) => {
    try {
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
        throw updateError;
      }

      setSuccess("Task marked as completed.");

      await loadAll();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to complete task."
      );
    }
  };

  const updateStatus = async (
    task: Task,
    status: TaskStatus
  ) => {
    try {
      setError("");
      setSuccess("");

      const { error: updateError } =
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

      if (updateError) {
        throw updateError;
      }

      setSuccess("Task status updated.");

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

  const deleteTask = async (task: Task) => {
    const confirmed = window.confirm(
      `Delete "${task.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const { error: deleteError } =
        await supabase
          .from("tasks")
          .delete()
          .eq("id", task.id);

      if (deleteError) {
        throw deleteError;
      }

      setSuccess("Task deleted successfully.");

      if (selectedTask?.id === task.id) {
        setSelectedTask(null);
      }

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

  const callLead = (lead: Lead | null) => {
    if (!lead?.phone) {
      setError(
        "This lead does not have a phone number."
      );
      return;
    }

    window.location.href = `tel:${lead.phone}`;
  };

  const whatsappLead = (
    lead: Lead | null
  ) => {
    if (!lead?.phone) {
      setError(
        "This lead does not have a phone number."
      );
      return;
    }

    const phone = lead.phone.replace(
      /[^\d]/g,
      ""
    );

    if (!phone) {
      setError(
        "The lead phone number is invalid."
      );
      return;
    }

    window.open(
      `https://wa.me/${phone}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const emailLead = (lead: Lead | null) => {
    if (!lead?.email) {
      setError(
        "This lead does not have an email address."
      );
      return;
    }

    window.location.href =
      `mailto:${lead.email}`;
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setAssignedFilter("all");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: "42px",
    padding: "0 12px",
    border:
      "1px solid #d1d5db",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#111827",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const smallActionButton: React.CSSProperties = {
    border:
      "1px solid #d1d5db",
    background: "#ffffff",
    color: "#374151",
    borderRadius: "7px",
    padding: "6px 9px",
    fontSize: "12px",
    fontWeight: 650,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "30px",
        color: "#111827",
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
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
            marginBottom: "24px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: 800,
                letterSpacing:
                  "-0.5px",
              }}
            >
              Tasks & Follow-ups
            </h1>

            <p
              style={{
                margin:
                  "6px 0 0",
                color: "#6b7280",
                fontSize: "14px",
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
              borderRadius: "9px",
              background: "#111827",
              color: "#ffffff",
              padding:
                "11px 17px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
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
              padding: "12px 15px",
              borderRadius: "9px",
              border:
                "1px solid #fecaca",
              background: "#fef2f2",
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
              padding: "12px 15px",
              borderRadius: "9px",
              border:
                "1px solid #a7f3d0",
              background: "#ecfdf5",
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
          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius: "14px",
              padding: "19px",
            }}
          >
            <div
              style={{
                color: "#6b7280",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              Due Today
            </div>

            <div
              style={{
                fontSize: "28px",
                fontWeight: 800,
              }}
            >
              {stats.dueToday}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius: "14px",
              padding: "19px",
            }}
          >
            <div
              style={{
                color: "#6b7280",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              Overdue
            </div>

            <div
              style={{
                fontSize: "28px",
                fontWeight: 800,
                color:
                  stats.overdue > 0
                    ? "#b91c1c"
                    : "#111827",
              }}
            >
              {stats.overdue}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius: "14px",
              padding: "19px",
            }}
          >
            <div
              style={{
                color: "#6b7280",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              Completed This Month
            </div>

            <div
              style={{
                fontSize: "28px",
                fontWeight: 800,
              }}
            >
              {stats.completedThisMonth}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius: "14px",
              padding: "19px",
            }}
          >
            <div
              style={{
                color: "#6b7280",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              Completion Rate
            </div>

            <div
              style={{
                fontSize: "28px",
                fontWeight: 800,
              }}
            >
              {stats.completionRate}%
            </div>
          </div>
        </div>

        {/* TEAM WORKLOAD */}
        <div
          style={{
            background: "#ffffff",
            border:
              "1px solid #e5e7eb",
            borderRadius: "14px",
            padding: "20px 22px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "19px",
                  fontWeight: 750,
                }}
              >
                Team Workload
              </h2>

              <p
                style={{
                  margin:
                    "5px 0 0",
                  color: "#6b7280",
                  fontSize: "13px",
                }}
              >
                Pending and overdue tasks
                by salesperson
              </p>
            </div>

            <div
              style={{
                fontSize: "13px",
                color: "#6b7280",
              }}
            >
              {teamWorkload.length} active
              salesperson
              {teamWorkload.length === 1
                ? ""
                : "s"}
            </div>
          </div>

          {teamWorkload.length === 0 ? (
            <div
              style={{
                padding: "18px",
                borderRadius: "10px",
                background: "#f9fafb",
                color: "#6b7280",
                fontSize: "14px",
                textAlign: "center",
              }}
            >
              No active salespeople found.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              {teamWorkload.map(
                (staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() =>
                      setAssignedFilter(
                        staff.id
                      )
                    }
                    style={{
                      textAlign: "left",
                      border:
                        assignedFilter ===
                        staff.id
                          ? "2px solid #111827"
                          : "1px solid #e5e7eb",
                      borderRadius:
                        "12px",
                      padding: "15px",
                      background:
                        assignedFilter ===
                        staff.id
                          ? "#f9fafb"
                          : "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        fontSize:
                          "14px",
                        fontWeight: 700,
                        color: "#111827",
                        marginBottom:
                          "12px",
                      }}
                    >
                      {staff.name}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "1fr 1fr",
                        gap: "10px",
                      }}
                    >
                      <div
                        style={{
                          padding: "10px",
                          borderRadius:
                            "8px",
                          background:
                            "#f3f4f6",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "11px",
                            color:
                              "#6b7280",
                            marginBottom:
                              "3px",
                          }}
                        >
                          Pending
                        </div>

                        <div
                          style={{
                            fontSize:
                              "20px",
                            fontWeight: 800,
                          }}
                        >
                          {staff.pending}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: "10px",
                          borderRadius:
                            "8px",
                          background:
                            staff.overdue >
                            0
                              ? "#fef2f2"
                              : "#f3f4f6",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "11px",
                            color:
                              staff.overdue >
                              0
                                ? "#b91c1c"
                                : "#6b7280",
                            marginBottom:
                              "3px",
                          }}
                        >
                          Overdue
                        </div>

                        <div
                          style={{
                            fontSize:
                              "20px",
                            fontWeight: 800,
                            color:
                              staff.overdue >
                              0
                                ? "#b91c1c"
                                : "#111827",
                          }}
                        >
                          {staff.overdue}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* MAIN CARD */}
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
                "20px 22px",
              borderBottom:
                "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                marginBottom: "18px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "19px",
                  fontWeight: 750,
                }}
              >
                Team Tasks
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

            {/* FILTERS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(250px, 1fr) 180px 180px 180px",
                gap: "10px",
              }}
            >
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search tasks, leads, staff..."
                style={inputStyle}
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                style={inputStyle}
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
                      {getStatusLabel(
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
                style={inputStyle}
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

              <select
                value={assignedFilter}
                onChange={(event) =>
                  setAssignedFilter(
                    event.target.value
                  )
                }
                style={inputStyle}
              >
                <option value="all">
                  All Staff
                </option>

                {profiles
                  .filter(
                    (profile) =>
                      profile.is_active !==
                      false
                  )
                  .map((profile) => (
                    <option
                      key={profile.id}
                      value={profile.id}
                    >
                      {profile.full_name ||
                        "Unnamed Staff"}
                    </option>
                  ))}
              </select>
            </div>

            {(search ||
              statusFilter !== "all" ||
              typeFilter !== "all" ||
              assignedFilter !== "all") && (
              <div
                style={{
                  marginTop: "10px",
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                <span>
                  Showing{" "}
                  {filteredTasks.length} of{" "}
                  {tasks.length} tasks
                </span>

                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    border: "none",
                    background:
                      "transparent",
                    color: "#2563eb",
                    fontSize: "13px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {/* TABLE */}
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
                minWidth: "1100px",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#f9fafb",
                  }}
                >
                  {[
                    "TASK",
                    "TYPE",
                    "RELATED",
                    "ASSIGNED TO",
                    "DUE",
                    "STATUS",
                    "ACTIONS",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding:
                          "12px 18px",
                        textAlign:
                          heading ===
                          "ACTIONS"
                            ? "right"
                            : "left",
                        fontSize:
                          "11px",
                        fontWeight: 750,
                        color:
                          "#6b7280",
                        letterSpacing:
                          "0.04em",
                        borderBottom:
                          "1px solid #e5e7eb",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding:
                          "50px",
                        textAlign:
                          "center",
                        color:
                          "#6b7280",
                      }}
                    >
                      Loading tasks...
                    </td>
                  </tr>
                ) : filteredTasks.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding:
                          "60px",
                        textAlign:
                          "center",
                        color:
                          "#6b7280",
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "15px",
                          fontWeight:
                            650,
                          color:
                            "#374151",
                          marginBottom:
                            "5px",
                        }}
                      >
                        No tasks found
                      </div>

                      <div
                        style={{
                          fontSize:
                            "13px",
                        }}
                      >
                        Try changing your
                        filters or create
                        a new task.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map(
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

                      const stage =
                        getStage(
                          opportunity?.stage_id ||
                            null
                        );

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
                                gap: "10px",
                                alignItems:
                                  "flex-start",
                              }}
                            >
                              <button
                                type="button"
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
                                title={
                                  task.status ===
                                  "completed"
                                    ? "Completed"
                                    : "Mark complete"
                                }
                                style={{
                                  width:
                                    "24px",
                                  height:
                                    "24px",
                                  minWidth:
                                    "24px",
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
                                    fontSize:
                                      "14px",
                                    fontWeight:
                                      700,
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
                                gap: "6px",
                                fontSize:
                                  "13px",
                                color:
                                  "#374151",
                              }}
                            >
                              <span>
                                {getTaskTypeIcon(
                                  task.task_type
                                )}
                              </span>

                              <span>
                                {
                                  task.task_type
                                }
                              </span>
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
                                      700,
                                  }}
                                >
                                  {lead.name ||
                                    "Unnamed Lead"}
                                </div>

                                {lead.ciu_number && (
                                  <div
                                    style={{
                                      color:
                                        "#6b7280",
                                      fontSize:
                                        "12px",
                                      marginTop:
                                        "3px",
                                    }}
                                  >
                                    CIU:{" "}
                                    {
                                      lead.ciu_number
                                    }
                                  </div>
                                )}

                                {lead.phone && (
                                  <div
                                    style={{
                                      color:
                                        "#6b7280",
                                      fontSize:
                                        "12px",
                                      marginTop:
                                        "2px",
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
                                      700,
                                  }}
                                >
                                  {
                                    opportunity.title
                                  }
                                </div>

                                <div
                                  style={{
                                    color:
                                      "#6b7280",
                                    fontSize:
                                      "12px",
                                    marginTop:
                                      "3px",
                                  }}
                                >
                                  {formatCurrency(
                                    opportunity.value,
                                    opportunity.currency ||
                                      "UGX"
                                  )}
                                </div>

                                {stage && (
                                  <div
                                    style={{
                                      color:
                                        "#6b7280",
                                      fontSize:
                                        "12px",
                                      marginTop:
                                        "2px",
                                    }}
                                  >
                                    {stage.name}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span
                                style={{
                                  color:
                                    "#9ca3af",
                                  fontSize:
                                    "13px",
                                }}
                              >
                                No relation
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
                            {staff ? (
                              <div
                                style={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  gap: "8px",
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
                                      "#f3f4f6",
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
                                    color:
                                      "#374151",
                                  }}
                                >
                                  {getInitials(
                                    staff.full_name
                                  )}
                                </div>

                                <span
                                  style={{
                                    fontSize:
                                      "13px",
                                    fontWeight:
                                      600,
                                  }}
                                >
                                  {staff.full_name ||
                                    "Unnamed Staff"}
                                </span>
                              </div>
                            ) : (
                              <span
                                style={{
                                  color:
                                    "#9ca3af",
                                  fontSize:
                                    "13px",
                                }}
                              >
                                Unassigned
                              </span>
                            )}
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
                                  "13px",
                                fontWeight:
                                  600,
                                color:
                                  overdue
                                    ? "#b91c1c"
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
                                    "4px",
                                  fontSize:
                                    "11px",
                                  fontWeight:
                                    700,
                                  color:
                                    "#b91c1c",
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

                              {lead?.phone && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    callLead(
                                      lead
                                    )
                                  }
                                  style={{
                                    ...smallActionButton,
                                    color:
                                      "#1d4ed8",
                                    border:
                                      "1px solid #bfdbfe",
                                    background:
                                      "#eff6ff",
                                  }}
                                >
                                  Call
                                </button>
                              )}

                              {lead?.phone && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    whatsappLead(
                                      lead
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
                                  WhatsApp
                                </button>
                              )}

                              {lead?.email && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    emailLead(
                                      lead
                                    )
                                  }
                                  style={{
                                    ...smallActionButton,
                                    color:
                                      "#7c3aed",
                                    border:
                                      "1px solid #ddd6fe",
                                    background:
                                      "#f5f3ff",
                                  }}
                                >
                                  Email
                                </button>
                              )}

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
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "700px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "14px",
              boxShadow:
                "0 20px 50px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                padding:
                  "20px 22px",
                borderBottom:
                  "1px solid #e5e7eb",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "20px",
                    fontWeight: 800,
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
                  Create and manage
                  staff activities and
                  follow-ups.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowModal(false)
                }
                style={{
                  border: "none",
                  background:
                    "transparent",
                  fontSize: "24px",
                  cursor: "pointer",
                  color:
                    "#6b7280",
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSaveTask}
              style={{
                padding: "22px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "16px",
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
                      fontSize:
                        "13px",
                      fontWeight:
                        700,
                      marginBottom:
                        "6px",
                    }}
                  >
                    Task Title
                  </label>

                  <input
                    value={
                      form.title
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (current) => ({
                          ...current,
                          title:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    placeholder="e.g. Call student about admission"
                    style={
                      inputStyle
                    }
                  />
                </div>

                <div>
                  <label
                    style={{
                      display:
                        "block",
                      fontSize:
                        "13px",
                      fontWeight:
                        700,
                      marginBottom:
                        "6px",
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
                        (current) => ({
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

                <div>
                  <label
                    style={{
                      display:
                        "block",
                      fontSize:
                        "13px",
                      fontWeight:
                        700,
                      marginBottom:
                        "6px",
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
                        (current) => ({
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
                    {TASK_STATUSES.map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {getStatusLabel(
                            status
                          )}
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
                      fontSize:
                        "13px",
                      fontWeight:
                        700,
                      marginBottom:
                        "6px",
                    }}
                  >
                    Lead
                  </label>

                  <select
                    value={
                      form.lead_id
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (current) => ({
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
                      No Lead
                    </option>

                    {leads.map(
                      (lead) => (
                        <option
                          key={lead.id}
                          value={lead.id}
                        >
                          {lead.name ||
                            "Unnamed Lead"}
                          {lead.ciu_number
                            ? ` — ${lead.ciu_number}`
                            : ""}
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
                      fontSize:
                        "13px",
                      fontWeight:
                        700,
                      marginBottom:
                        "6px",
                    }}
                  >
                    Opportunity
                  </label>

                  <select
                    value={
                      form.opportunity_id
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (current) => ({
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
                      No Opportunity
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
                            "Untitled Opportunity"}
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
                      fontSize:
                        "13px",
                      fontWeight:
                        700,
                      marginBottom:
                        "6px",
                    }}
                  >
                    Assigned Staff
                  </label>

                  <select
                    value={
                      form.assigned_to
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (current) => ({
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
                        (profile) =>
                          profile.is_active !==
                          false
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
                </div>

                <div>
                  <label
                    style={{
                      display:
                        "block",
                      fontSize:
                        "13px",
                      fontWeight:
                        700,
                      marginBottom:
                        "6px",
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
                        (current) => ({
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
                      fontSize:
                        "13px",
                      fontWeight:
                        700,
                      marginBottom:
                        "6px",
                    }}
                  >
                    Description
                  </label>

                  <textarea
                    value={
                      form.description
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (current) => ({
                          ...current,
                          description:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    placeholder="Add task details, instructions or notes..."
                    rows={5}
                    style={{
                      ...inputStyle,
                      height:
                        "auto",
                      padding:
                        "11px 12px",
                      resize:
                        "vertical",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "flex-end",
                  gap: "10px",
                  marginTop: "22px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setShowModal(
                      false
                    )
                  }
                  style={{
                    border:
                      "1px solid #d1d5db",
                    background:
                      "#ffffff",
                    color:
                      "#374151",
                    borderRadius:
                      "8px",
                    padding:
                      "10px 16px",
                    fontWeight:
                      650,
                    cursor:
                      "pointer",
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
                      "8px",
                    padding:
                      "10px 17px",
                    fontWeight:
                      700,
                    cursor:
                      saving
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editingTask
                    ? "Update Task"
                    : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW TASK MODAL */}
      {selectedTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1001,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "620px",
              background: "#ffffff",
              borderRadius: "14px",
              boxShadow:
                "0 20px 50px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                padding:
                  "20px 22px",
                borderBottom:
                  "1px solid #e5e7eb",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "flex-start",
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
                      "#6b7280",
                    textTransform:
                      "uppercase",
                    marginBottom:
                      "6px",
                  }}
                >
                  {selectedTask.task_type}
                </div>

                <h2
                  style={{
                    margin: 0,
                    fontSize:
                      "21px",
                    fontWeight:
                      800,
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
                  border: "none",
                  background:
                    "transparent",
                  fontSize:
                    "24px",
                  cursor:
                    "pointer",
                  color:
                    "#6b7280",
                }}
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
                    "1fr 1fr",
                  gap: "18px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize:
                        "11px",
                      color:
                        "#6b7280",
                      fontWeight:
                        750,
                      textTransform:
                        "uppercase",
                      marginBottom:
                        "5px",
                    }}
                  >
                    Status
                  </div>

                  <span
                    style={{
                      display:
                        "inline-flex",
                      padding:
                        "5px 9px",
                      borderRadius:
                        "999px",
                      fontSize:
                        "11px",
                      fontWeight:
                        700,
                      ...getStatusStyle(
                        selectedTask.status
                      ),
                    }}
                  >
                    {getStatusLabel(
                      selectedTask.status
                    )}
                  </span>
                </div>

                <div>
                  <div
                    style={{
                      fontSize:
                        "11px",
                      color:
                        "#6b7280",
                      fontWeight:
                        750,
                      textTransform:
                        "uppercase",
                      marginBottom:
                        "5px",
                    }}
                  >
                    Due
                  </div>

                  <div
                    style={{
                      fontSize:
                        "13px",
                      fontWeight:
                        600,
                    }}
                  >
                    {formatDateTime(
                      selectedTask.due_at
                    )}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize:
                        "11px",
                      color:
                        "#6b7280",
                      fontWeight:
                        750,
                      textTransform:
                        "uppercase",
                      marginBottom:
                        "5px",
                    }}
                  >
                    Assigned To
                  </div>

                  <div
                    style={{
                      fontSize:
                        "13px",
                      fontWeight:
                        600,
                    }}
                  >
                    {getStaff(
                      selectedTask
                    )?.full_name ||
                      "Unassigned"}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize:
                        "11px",
                      color:
                        "#6b7280",
                      fontWeight:
                        750,
                      textTransform:
                        "uppercase",
                      marginBottom:
                        "5px",
                    }}
                  >
                    Created
                  </div>

                  <div
                    style={{
                      fontSize:
                        "13px",
                      fontWeight:
                        600,
                    }}
                  >
                    {formatDate(
                      selectedTask.created_at
                    )}
                  </div>
                </div>
              </div>

              {selectedTask.description && (
                <div
                  style={{
                    marginTop:
                      "22px",
                    padding:
                      "14px",
                    borderRadius:
                      "10px",
                    background:
                      "#f9fafb",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "11px",
                      color:
                        "#6b7280",
                      fontWeight:
                        750,
                      textTransform:
                        "uppercase",
                      marginBottom:
                        "6px",
                    }}
                  >
                    Description
                  </div>

                  <div
                    style={{
                      fontSize:
                        "14px",
                      lineHeight:
                        1.6,
                      color:
                        "#374151",
                    }}
                  >
                    {
                      selectedTask.description
                    }
                  </div>
                </div>
              )}

              {(() => {
                const lead =
                  getLead(
                    selectedTask
                  );

                const opportunity =
                  getOpportunity(
                    selectedTask
                  );

                if (!lead && !opportunity) {
                  return null;
                }

                return (
                  <div
                    style={{
                      marginTop:
                        "18px",
                      padding:
                        "14px",
                      borderRadius:
                        "10px",
                      border:
                        "1px solid #e5e7eb",
                    }}
                  >
                    <div
                      style={{
                        fontSize:
                          "11px",
                        color:
                          "#6b7280",
                        fontWeight:
                          750,
                        textTransform:
                          "uppercase",
                        marginBottom:
                          "7px",
                      }}
                    >
                      Related Record
                    </div>

                    {lead && (
                      <div>
                        <div
                          style={{
                            fontSize:
                              "14px",
                            fontWeight:
                              750,
                          }}
                        >
                          {lead.name ||
                            "Unnamed Lead"}
                        </div>

                        {lead.ciu_number && (
                          <div
                            style={{
                              fontSize:
                                "12px",
                              color:
                                "#6b7280",
                              marginTop:
                                "3px",
                            }}
                          >
                            CIU Number:{" "}
                            {
                              lead.ciu_number
                            }
                          </div>
                        )}

                        {lead.phone && (
                          <div
                            style={{
                              fontSize:
                                "12px",
                              color:
                                "#6b7280",
                              marginTop:
                                "3px",
                            }}
                          >
                            Phone:{" "}
                            {
                              lead.phone
                            }
                          </div>
                        )}

                        {lead.email && (
                          <div
                            style={{
                              fontSize:
                                "12px",
                              color:
                                "#6b7280",
                              marginTop:
                                "3px",
                            }}
                          >
                            Email:{" "}
                            {
                              lead.email
                            }
                          </div>
                        )}
                      </div>
                    )}

                    {opportunity && (
                      <div
                        style={{
                          marginTop:
                            lead
                              ? "12px"
                              : "0",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "14px",
                            fontWeight:
                              750,
                          }}
                        >
                          {
                            opportunity.title
                          }
                        </div>

                        <div
                          style={{
                            fontSize:
                              "12px",
                            color:
                              "#6b7280",
                            marginTop:
                              "3px",
                          }}
                        >
                          {formatCurrency(
                            opportunity.value,
                            opportunity.currency ||
                              "UGX"
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginTop: "22px",
                }}
              >
                {getLead(
                  selectedTask
                )?.phone && (
                  <button
                    type="button"
                    onClick={() =>
                      callLead(
                        getLead(
                          selectedTask
                        )
                      )
                    }
                    style={{
                      ...smallActionButton,
                      color:
                        "#1d4ed8",
                      border:
                        "1px solid #bfdbfe",
                      background:
                        "#eff6ff",
                    }}
                  >
                    Call Lead
                  </button>
                )}

                {getLead(
                  selectedTask
                )?.phone && (
                  <button
                    type="button"
                    onClick={() =>
                      whatsappLead(
                        getLead(
                          selectedTask
                        )
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
                    WhatsApp
                  </button>
                )}

                {getLead(
                  selectedTask
                )?.email && (
                  <button
                    type="button"
                    onClick={() =>
                      emailLead(
                        getLead(
                          selectedTask
                        )
                      )
                    }
                    style={{
                      ...smallActionButton,
                      color:
                        "#7c3aed",
                      border:
                        "1px solid #ddd6fe",
                      background:
                        "#f5f3ff",
                    }}
                  >
                    Email
                  </button>
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
                    Complete Task
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
                    smallActionButton
                  }
                >
                  Edit Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESPONSIVE STYLE */}
      <style jsx>{`
        @media (max-width: 1000px) {
          main {
            padding: 18px !important;
          }

          .unused {
            display: none;
          }
        }

        @media (max-width: 800px) {
          div {
            box-sizing: border-box;
          }
        }
      `}</style>
    </main>
  );
}