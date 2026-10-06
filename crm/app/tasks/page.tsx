"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Task = {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  lead_id: string | null;
  assigned_to: string | null;
  due_at: string | null;
  status: string;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
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

const TASK_TYPES = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
  { value: "proposal", label: "Proposal" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const EMPTY_FORM = {
  title: "",
  description: "",
  task_type: "call",
  due_at: "",
  status: "pending",
  assigned_to: "",
  lead_id: "",
};

function formatDateTime(value: string | null) {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString("en-UG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getTypeLabel(value: string) {
  return (
    TASK_TYPES.find((item) => item.value === value)?.label ||
    value
  );
}

function getStatusLabel(value: string) {
  return (
    STATUS_OPTIONS.find((item) => item.value === value)?.label ||
    value
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

function getTodayRange() {
  const now = new Date();

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );

  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );

  return {
    start,
    end,
  };
}

export default function TasksPage() {
  const supabase = createClient();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);

  async function loadTasks() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("tasks")
      .select(
        "id, title, description, task_type, lead_id, assigned_to, due_at, status, completed_at, created_at, updated_at"
      )
      .order("due_at", {
        ascending: true,
        nullsFirst: false,
      });

    if (loadError) {
      console.error(loadError);
      setError(loadError.message);
      setTasks([]);
    } else {
      setTasks((data || []) as Task[]);
    }

    setLoading(false);
  }

  async function loadProfiles() {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (profileError) {
      console.error(profileError);
      return;
    }

    setProfiles((data || []) as Profile[]);
  }

  async function loadLeads() {
    const { data, error: leadError } = await supabase
      .from("leads")
      .select("id, name, ciu_number, phone")
      .order("created_at", { ascending: false })
      .limit(500);

    if (leadError) {
      console.error(leadError);
      return;
    }

    setLeads((data || []) as Lead[]);
  }

  async function loadAll() {
    await Promise.all([
      loadTasks(),
      loadProfiles(),
      loadLeads(),
    ]);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredTasks = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return [...tasks]
      .filter((task) => {
        if (statusFilter === "all") return true;
        return task.status === statusFilter;
      })
      .filter((task) => {
        if (typeFilter === "all") return true;
        return task.task_type === typeFilter;
      })
      .filter((task) => {
        if (!searchValue) return true;

        const assignedName =
          profiles.find(
            (profile) => profile.id === task.assigned_to
          )?.full_name || "";

        const leadName =
          leads.find((lead) => lead.id === task.lead_id)?.name || "";

        return [
          task.title,
          task.description,
          task.task_type,
          task.status,
          assignedName,
          leadName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchValue);
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
    profiles,
    leads,
    search,
    statusFilter,
    typeFilter,
  ]);

  const stats = useMemo(() => {
    const now = new Date();
    const { start, end } = getTodayRange();

    const dueToday = tasks.filter((task) => {
      if (!task.due_at) return false;
      if (
        task.status === "completed" ||
        task.status === "cancelled"
      ) {
        return false;
      }

      const due = new Date(task.due_at);

      return due >= start && due <= end;
    }).length;

    const overdue = tasks.filter((task) => {
      if (!task.due_at) return false;
      if (
        task.status === "completed" ||
        task.status === "cancelled"
      ) {
        return false;
      }

      return new Date(task.due_at) < now;
    }).length;

    const completedThisMonth = tasks.filter((task) => {
      if (task.status !== "completed") return false;

      const completedDate = task.completed_at
        ? new Date(task.completed_at)
        : task.updated_at
          ? new Date(task.updated_at)
          : null;

      if (!completedDate) return false;

      return (
        completedDate.getMonth() === now.getMonth() &&
        completedDate.getFullYear() === now.getFullYear()
      );
    }).length;

    const completed = tasks.filter(
      (task) => task.status === "completed"
    ).length;

    const cancelled = tasks.filter(
      (task) => task.status === "cancelled"
    ).length;

    const totalForRate = tasks.length - cancelled;

    const completionRate =
      totalForRate > 0
        ? Math.round((completed / totalForRate) * 100)
        : 0;

    return {
      dueToday,
      overdue,
      completedThisMonth,
      completionRate,
    };
  }, [tasks]);

  function openNewTask() {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEditTask(task: Task) {
    setEditingTask(task);

    setForm({
      title: task.title || "",
      description: task.description || "",
      task_type: task.task_type || "call",
      due_at: toDateTimeLocal(task.due_at),
      status: task.status || "pending",
      assigned_to: task.assigned_to || "",
      lead_id: task.lead_id || "",
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
    setError("");
  }

  async function handleSaveTask(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Please enter a task title.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      task_type: form.task_type,
      due_at: form.due_at
        ? new Date(form.due_at).toISOString()
        : null,
      status: form.status,
      assigned_to: form.assigned_to || null,
      lead_id: form.lead_id || null,
    };

    if (editingTask) {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          ...payload,
          completed_at:
            form.status === "completed"
              ? editingTask.completed_at ||
                new Date().toISOString()
              : null,
        })
        .eq("id", editingTask.id);

      if (updateError) {
        console.error(updateError);
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setSuccess("Task updated successfully.");
    } else {
      const {
        data: currentUserData,
      } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from("tasks")
        .insert({
          ...payload,
          created_by: currentUserData.user?.id || null,
          completed_at:
            form.status === "completed"
              ? new Date().toISOString()
              : null,
        });

      if (insertError) {
        console.error(insertError);
        setError(insertError.message);
        setSaving(false);
        return;
      }

      setSuccess("Task created successfully.");
    }

    setSaving(false);
    setShowModal(false);
    setEditingTask(null);
    setForm(EMPTY_FORM);

    await loadTasks();
  }

  async function markComplete(task: Task) {
    if (task.status === "completed") return;

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      return;
    }

    setSuccess("Task marked as completed.");
    await loadTasks();
  }

  async function deleteTask(task: Task) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${task.title}"?`
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id);

    if (deleteError) {
      console.error(deleteError);
      setError(deleteError.message);
      return;
    }

    setSuccess("Task deleted successfully.");
    await loadTasks();
  }

  function getAssigneeName(id: string | null) {
    if (!id) return "Unassigned";

    return (
      profiles.find((profile) => profile.id === id)
        ?.full_name || "Unassigned"
    );
  }

  function getLeadName(id: string | null) {
    if (!id) return "";

    const lead = leads.find((item) => item.id === id);

    if (!lead) return "";

    return lead.ciu_number
      ? `${lead.name || "Unnamed"} (${lead.ciu_number})`
      : lead.name || "Unnamed lead";
  }

  function getStatusStyle(status: string) {
    if (status === "completed") {
      return {
        background: "#dcfce7",
        color: "#166534",
      };
    }

    if (status === "in_progress") {
      return {
        background: "#dbeafe",
        color: "#1d4ed8",
      };
    }

    if (status === "cancelled") {
      return {
        background: "#f3f4f6",
        color: "#4b5563",
      };
    }

    return {
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  return (
    <>
      <div className="crm-page-heading">
        <div>
          <h1>Tasks & Follow-ups</h1>
          <p>
            Stay on top of activities and never miss an
            opportunity.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewTask}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            visibility: "visible",
            opacity: 1,
            color: "#ffffff",
            background: "#2563eb",
            border: "1px solid #2563eb",
            padding: "10px 16px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            minHeight: 40,
            whiteSpace: "nowrap",
          }}
        >
          + New Task
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 8,
            background: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 8,
            background: "#dcfce7",
            color: "#166534",
            border: "1px solid #bbf7d0",
          }}
        >
          {success}
        </div>
      )}

      <div className="crm-kpis">
        <div className="crm-kpi">
          <span className="crm-kpi-label">Due Today</span>
          <div className="crm-kpi-value">
            {stats.dueToday}
          </div>
          <span className="crm-kpi-change">
            Needs attention
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">Overdue</span>
          <div className="crm-kpi-value">
            {stats.overdue}
          </div>
          <span className="crm-kpi-change">
            Requires action
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">
            Completed This Month
          </span>
          <div className="crm-kpi-value">
            {stats.completedThisMonth}
          </div>
          <span className="crm-kpi-change">
            Completed tasks
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">
            Completion Rate
          </span>
          <div className="crm-kpi-value">
            {stats.completionRate}%
          </div>
          <span className="crm-kpi-change">
            Current task list
          </span>
        </div>
      </div>

      <div className="crm-card">
        <div
          className="crm-card-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2>My Tasks</h2>
            <span>Activities and follow-ups</span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search tasks..."
              style={{
                padding: "9px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                minWidth: 220,
                color: "#111827",
                background: "#ffffff",
              }}
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              style={{
                padding: "9px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                color: "#111827",
                background: "#ffffff",
              }}
            >
              <option value="all">All Statuses</option>

              {STATUS_OPTIONS.map((status) => (
                <option
                  key={status.value}
                  value={status.value}
                >
                  {status.label}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value)
              }
              style={{
                padding: "9px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                color: "#111827",
                background: "#ffffff",
              }}
            >
              <option value="all">All Types</option>

              {TASK_TYPES.map((type) => (
                <option
                  key={type.value}
                  value={type.value}
                >
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="crm-card-body">
          {loading ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              Loading tasks...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div
              style={{
                padding: 50,
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                No tasks found
              </div>

              <div style={{ marginBottom: 18 }}>
                Create your first task or change your
                filters.
              </div>

              <button
                type="button"
                onClick={openNewTask}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  visibility: "visible",
                  opacity: 1,
                  color: "#ffffff",
                  background: "#2563eb",
                  border: "1px solid #2563eb",
                  padding: "10px 16px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Create Task
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
              }}
            >
              {filteredTasks.map((task) => {
                const statusStyle =
                  getStatusStyle(task.status);

                const isOverdue =
                  task.due_at &&
                  new Date(task.due_at) < new Date() &&
                  task.status !== "completed" &&
                  task.status !== "cancelled";

                return (
                  <div
                    key={task.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "16px 0",
                      borderBottom:
                        "1px solid #e5e7eb",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => markComplete(task)}
                      disabled={
                        task.status === "completed"
                      }
                      title={
                        task.status === "completed"
                          ? "Completed"
                          : "Mark as completed"
                      }
                      style={{
                        width: 24,
                        height: 24,
                        minWidth: 24,
                        borderRadius: "50%",
                        border:
                          task.status === "completed"
                            ? "2px solid #16a34a"
                            : "2px solid #9ca3af",
                        background:
                          task.status === "completed"
                            ? "#16a34a"
                            : "#ffffff",
                        color: "#ffffff",
                        cursor:
                          task.status === "completed"
                            ? "default"
                            : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {task.status === "completed"
                        ? "✓"
                        : ""}
                    </button>

                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <strong
                          style={{
                            color: "#111827",
                            fontSize: 15,
                          }}
                        >
                          {task.title}
                        </strong>

                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            background: "#eef2ff",
                            color: "#4338ca",
                          }}
                        >
                          {getTypeLabel(
                            task.task_type
                          )}
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: 5,
                          color: "#6b7280",
                          fontSize: 13,
                        }}
                      >
                        {getAssigneeName(
                          task.assigned_to
                        )}

                        {getLeadName(task.lead_id) && (
                          <>
                            {" • "}
                            {getLeadName(task.lead_id)}
                          </>
                        )}

                        {" • "}
                        {task.due_at
                          ? formatDateTime(task.due_at)
                          : "No due date"}
                      </div>

                      {task.description && (
                        <div
                          style={{
                            marginTop: 5,
                            color: "#4b5563",
                            fontSize: 13,
                          }}
                        >
                          {task.description}
                        </div>
                      )}

                      {isOverdue && (
                        <div
                          style={{
                            marginTop: 5,
                            color: "#dc2626",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          Overdue
                        </div>
                      )}
                    </div>

                    <span
                      style={{
                        ...statusStyle,
                        padding: "5px 9px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getStatusLabel(task.status)}
                    </span>

                    <div
                      style={{
                        display: "flex",
                        gap: 7,
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                      {task.status !== "completed" && (
                        <button
                          type="button"
                          onClick={() =>
                            markComplete(task)
                          }
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            visibility: "visible",
                            opacity: 1,
                            color: "#ffffff",
                            background: "#16a34a",
                            border:
                              "1px solid #16a34a",
                            padding: "7px 10px",
                            borderRadius: 7,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Complete
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          openEditTask(task)
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          visibility: "visible",
                          opacity: 1,
                          color: "#ffffff",
                          background: "#2563eb",
                          border:
                            "1px solid #2563eb",
                          padding: "7px 10px",
                          borderRadius: 7,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteTask(task)
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          visibility: "visible",
                          opacity: 1,
                          color: "#ffffff",
                          background: "#dc2626",
                          border:
                            "1px solid #dc2626",
                          padding: "7px 10px",
                          borderRadius: 7,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 650,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: 12,
              boxShadow:
                "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom:
                  "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                    color: "#111827",
                  }}
                >
                  {editingTask
                    ? "Edit Task"
                    : "Create New Task"}
                </h2>

                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#6b7280",
                    fontSize: 13,
                  }}
                >
                  Create and manage CRM activities.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border:
                    "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveTask}>
              <div
                style={{
                  padding: 20,
                  display: "grid",
                  gap: 16,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    Task Title *
                  </label>

                  <input
                    value={form.title}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        title: event.target.value,
                      })
                    }
                    placeholder="e.g. Call admitted student"
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border:
                        "1px solid #d1d5db",
                      borderRadius: 8,
                      color: "#111827",
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    Description
                  </label>

                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        description:
                          event.target.value,
                      })
                    }
                    rows={3}
                    placeholder="Add notes or instructions..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border:
                        "1px solid #d1d5db",
                      borderRadius: 8,
                      color: "#111827",
                      background: "#ffffff",
                      boxSizing: "border-box",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: 16,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Task Type
                    </label>

                    <select
                      value={form.task_type}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          task_type:
                            event.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border:
                          "1px solid #d1d5db",
                        borderRadius: 8,
                        color: "#111827",
                        background: "#ffffff",
                      }}
                    >
                      {TASK_TYPES.map((type) => (
                        <option
                          key={type.value}
                          value={type.value}
                        >
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Status
                    </label>

                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          status:
                            event.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border:
                          "1px solid #d1d5db",
                        borderRadius: 8,
                        color: "#111827",
                        background: "#ffffff",
                      }}
                    >
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
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: 16,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Due Date & Time
                    </label>

                    <input
                      type="datetime-local"
                      value={form.due_at}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          due_at:
                            event.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border:
                          "1px solid #d1d5db",
                        borderRadius: 8,
                        color: "#111827",
                        background: "#ffffff",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Assign To
                    </label>

                    <select
                      value={form.assigned_to}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          assigned_to:
                            event.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border:
                          "1px solid #d1d5db",
                        borderRadius: 8,
                        color: "#111827",
                        background: "#ffffff",
                      }}
                    >
                      <option value="">
                        Unassigned
                      </option>

                      {profiles.map((profile) => (
                        <option
                          key={profile.id}
                          value={profile.id}
                        >
                          {profile.full_name ||
                            "Unnamed staff"}
                          {profile.role
                            ? ` — ${profile.role}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    Related Lead
                  </label>

                  <select
                    value={form.lead_id}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        lead_id:
                          event.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border:
                        "1px solid #d1d5db",
                      borderRadius: 8,
                      color: "#111827",
                      background: "#ffffff",
                    }}
                  >
                    <option value="">
                      No related lead
                    </option>

                    {leads.map((lead) => (
                      <option
                        key={lead.id}
                        value={lead.id}
                      >
                        {lead.name ||
                          "Unnamed lead"}
                        {lead.ciu_number
                          ? ` — ${lead.ciu_number}`
                          : ""}
                        {lead.phone
                          ? ` — ${lead.phone}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "#fee2e2",
                      color: "#991b1b",
                      border:
                        "1px solid #fecaca",
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: "16px 20px",
                  borderTop:
                    "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    visibility: "visible",
                    opacity: 1,
                    color: "#374151",
                    background: "#ffffff",
                    border:
                      "1px solid #d1d5db",
                    padding: "10px 16px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    visibility: "visible",
                    opacity: 1,
                    color: "#ffffff",
                    background: saving
                      ? "#93c5fd"
                      : "#2563eb",
                    border:
                      "1px solid #2563eb",
                    padding: "10px 16px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: saving
                      ? "not-allowed"
                      : "pointer",
                    minWidth: 120,
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
    </>
  );
}