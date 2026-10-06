"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Lead = {
  id: string;
  ciu_number: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  product_service: string | null;
  status: string | null;
  feedback: string | null;
  follow_up_status: string | null;
  next_follow_up_at: string | null;
  created_at: string | null;
};

type Admission = {
  id: string;
  ciu_number: string | null;
  full_names: string | null;
  telephone: string | null;
  email: string | null;
  program: string | null;
  stage: string | null;
  created_at: string | null;
};

type Opportunity = {
  id: string;
  title: string | null;
  value: number | null;
  status: string | null;
  probability: number | null;
  stage_id: string | null;
  created_at: string | null;
  expected_close_date: string | null;
};

type PipelineStage = {
  id: string;
  name: string;
  position: number | null;
  probability: number | null;
  is_won: boolean | null;
  is_lost: boolean | null;
};

type Task = {
  id: string;
  title: string | null;
  description: string | null;
  task_type: string | null;
  due_at: string | null;
  status: string | null;
  lead_id: string | null;
  assigned_to: string | null;
  created_at: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
};

type DashboardStats = {
  totalLeads: number;
  customers: number;
  openDeals: number;
  salesForecast: number;
  followUps: number;
  tasksDueToday: number;
  newLeadsThisMonth: number;
  newCustomersThisMonth: number;
};

const supabase = createClient();

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-UG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-UG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusStyle(status: string | null) {
  const value = (status || "").toLowerCase();

  if (
    value.includes("converted") ||
    value.includes("won") ||
    value.includes("enrolled") ||
    value.includes("paid")
  ) {
    return {
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (
    value.includes("lost") ||
    value.includes("dropped") ||
    value.includes("cancelled") ||
    value.includes("unqualified")
  ) {
    return {
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  if (
    value.includes("qualified") ||
    value.includes("interested") ||
    value.includes("admitted") ||
    value.includes("progress")
  ) {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#374151",
  };
}

function isSameDay(dateA: Date, dateB: Date) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function isThisMonth(value: string | null) {
  if (!value) return false;

  const date = new Date(value);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function isOverdueFollowUp(value: string | null) {
  if (!value) return false;

  const followUpDate = new Date(value);
  const now = new Date();

  return followUpDate < now;
}

function isTodayFollowUp(value: string | null) {
  if (!value) return false;

  const followUpDate = new Date(value);
  const now = new Date();

  return isSameDay(followUpDate, now);
}

function isUpcomingFollowUp(value: string | null) {
  if (!value) return false;

  const followUpDate = new Date(value);
  const now = new Date();

  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  return (
    followUpDate > now &&
    followUpDate <= sevenDaysFromNow
  );
}

function normalizeWhatsAppNumber(phone: string | null) {
  if (!phone) return "";

  const cleaned = phone.replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+")) {
    return cleaned.substring(1);
  }

  if (cleaned.startsWith("0")) {
    return `256${cleaned.substring(1)}`;
  }

  return cleaned;
}

function isClosedLead(lead: Lead) {
  const status = (lead.status || "").toLowerCase();

  return (
    status === "converted" ||
    status === "lost" ||
    status === "unqualified"
  );
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    try {
      setError("");

      const [
        leadsResult,
        admissionsResult,
        opportunitiesResult,
        pipelineStagesResult,
        tasksResult,
        profilesResult,
      ] = await Promise.all([
        supabase
          .from("leads")
          .select(
            `
              id,
              ciu_number,
              name,
              phone,
              email,
              product_service,
              status,
              feedback,
              follow_up_status,
              next_follow_up_at,
              created_at
            `
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("admissions")
          .select(
            `
              id,
              ciu_number,
              full_names,
              telephone,
              email,
              program,
              stage,
              created_at
            `
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("opportunities")
          .select(
            `
              id,
              title,
              value,
              status,
              probability,
              stage_id,
              created_at,
              expected_close_date
            `
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("pipeline_stages")
          .select(
            `
              id,
              name,
              position,
              probability,
              is_won,
              is_lost
            `
          )
          .order("position", { ascending: true }),

        supabase
          .from("tasks")
          .select(
            `
              id,
              title,
              description,
              task_type,
              due_at,
              status,
              lead_id,
              assigned_to,
              created_at
            `
          )
          .order("due_at", { ascending: true }),

        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name", { ascending: true }),
      ]);

      if (leadsResult.error) {
        throw new Error(`Leads: ${leadsResult.error.message}`);
      }

      if (admissionsResult.error) {
        throw new Error(`Admissions: ${admissionsResult.error.message}`);
      }

      if (opportunitiesResult.error) {
        throw new Error(
          `Opportunities: ${opportunitiesResult.error.message}`
        );
      }

      if (pipelineStagesResult.error) {
        throw new Error(
          `Pipeline stages: ${pipelineStagesResult.error.message}`
        );
      }

      if (tasksResult.error) {
        throw new Error(`Tasks: ${tasksResult.error.message}`);
      }

      if (profilesResult.error) {
        throw new Error(`Profiles: ${profilesResult.error.message}`);
      }

      setLeads((leadsResult.data || []) as Lead[]);
      setAdmissions((admissionsResult.data || []) as Admission[]);
      setOpportunities((opportunitiesResult.data || []) as Opportunity[]);
      setPipelineStages(
        (pipelineStagesResult.data || []) as PipelineStage[]
      );
      setTasks((tasksResult.data || []) as Task[]);
      setProfiles((profilesResult.data || []) as Profile[]);
    } catch (err) {
      console.error("Dashboard loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
  };

  const stats = useMemo<DashboardStats>(() => {
    const now = new Date();

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const openOpportunities = opportunities.filter(
      (opportunity) =>
        (opportunity.status || "").toLowerCase() === "open"
    );

    const salesForecast = openOpportunities.reduce(
      (total, opportunity) => {
        const value = Number(opportunity.value || 0);
        const probability = Number(opportunity.probability ?? 100);

        return total + value * (probability / 100);
      },
      0
    );

    const followUps = leads.filter((lead) => {
      if (!lead.next_follow_up_at) return false;
      if (isClosedLead(lead)) return false;

      const followUpDate = new Date(lead.next_follow_up_at);

      return followUpDate <= endOfToday;
    }).length;

    const tasksDueToday = tasks.filter((task) => {
      if (!task.due_at) return false;

      const taskDate = new Date(task.due_at);

      return (
        isSameDay(taskDate, now) &&
        task.status !== "completed" &&
        task.status !== "cancelled"
      );
    }).length;

    return {
      totalLeads: leads.length,
      customers: admissions.length,
      openDeals: openOpportunities.length,
      salesForecast,
      followUps,
      tasksDueToday,
      newLeadsThisMonth: leads.filter((lead) =>
        isThisMonth(lead.created_at)
      ).length,
      newCustomersThisMonth: admissions.filter((admission) =>
        isThisMonth(admission.created_at)
      ).length,
    };
  }, [leads, admissions, opportunities, tasks]);

  const overdueFollowUps = useMemo(() => {
    return leads
      .filter((lead) => {
        if (!lead.next_follow_up_at) return false;
        if (isClosedLead(lead)) return false;

        return isOverdueFollowUp(lead.next_follow_up_at);
      })
      .sort((a, b) => {
        return (
          new Date(a.next_follow_up_at || 0).getTime() -
          new Date(b.next_follow_up_at || 0).getTime()
        );
      });
  }, [leads]);

  const todayFollowUps = useMemo(() => {
    return leads
      .filter((lead) => {
        if (!lead.next_follow_up_at) return false;
        if (isClosedLead(lead)) return false;

        return isTodayFollowUp(lead.next_follow_up_at);
      })
      .sort((a, b) => {
        return (
          new Date(a.next_follow_up_at || 0).getTime() -
          new Date(b.next_follow_up_at || 0).getTime()
        );
      });
  }, [leads]);

  const upcomingFollowUps = useMemo(() => {
    return leads
      .filter((lead) => {
        if (!lead.next_follow_up_at) return false;
        if (isClosedLead(lead)) return false;

        return isUpcomingFollowUp(lead.next_follow_up_at);
      })
      .sort((a, b) => {
        return (
          new Date(a.next_follow_up_at || 0).getTime() -
          new Date(b.next_follow_up_at || 0).getTime()
        );
      });
  }, [leads]);

  const interestedLeads = useMemo(() => {
    return leads.filter((lead) => {
      const status = (lead.status || "").toLowerCase();
      const feedback = (lead.feedback || "").toLowerCase();

      return (
        status === "qualified" ||
        feedback.includes("interested")
      );
    });
  }, [leads]);

  const admissionProspects = useMemo(() => {
    const prospectStages = [
      "application started",
      "application submitted",
      "admitted",
      "acceptance paid",
      "enrolled",
    ];

    return admissions.filter((admission) => {
      const stage = (admission.stage || "").toLowerCase();

      return prospectStages.includes(stage);
    });
  }, [admissions]);

  const acceptanceFollowUps = useMemo(() => {
    return admissions.filter((admission) => {
      const stage = (admission.stage || "").toLowerCase();

      return (
        stage === "admitted" ||
        stage === "acceptance paid"
      );
    });
  }, [admissions]);

  const todayTasks = useMemo(() => {
    const now = new Date();

    return tasks
      .filter((task) => {
        if (!task.due_at) return false;

        if (
          task.status === "completed" ||
          task.status === "cancelled"
        ) {
          return false;
        }

        return isSameDay(new Date(task.due_at), now);
      })
      .sort((a, b) => {
        return (
          new Date(a.due_at || 0).getTime() -
          new Date(b.due_at || 0).getTime()
        );
      });
  }, [tasks]);

  const recentLeads = useMemo(() => {
    return leads.slice(0, 6);
  }, [leads]);

  const recentCustomers = useMemo(() => {
    return admissions.slice(0, 6);
  }, [admissions]);

  const upcomingTasks = useMemo(() => {
    return tasks
      .filter(
        (task) =>
          task.status !== "completed" &&
          task.status !== "cancelled"
      )
      .sort((a, b) => {
        const dateA = a.due_at
          ? new Date(a.due_at).getTime()
          : Number.MAX_SAFE_INTEGER;

        const dateB = b.due_at
          ? new Date(b.due_at).getTime()
          : Number.MAX_SAFE_INTEGER;

        return dateA - dateB;
      })
      .slice(0, 6);
  }, [tasks]);

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();

    profiles.forEach((profile) => {
      map.set(profile.id, profile.full_name || "Unassigned");
    });

    return map;
  }, [profiles]);

  const pipelineSummary = useMemo(() => {
    return pipelineStages.map((stage) => {
      const stageOpportunities = opportunities.filter(
        (opportunity) => opportunity.stage_id === stage.id
      );

      const value = stageOpportunities.reduce(
        (total, opportunity) =>
          total + Number(opportunity.value || 0),
        0
      );

      return {
        ...stage,
        count: stageOpportunities.length,
        value,
      };
    });
  }, [pipelineStages, opportunities]);

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: "32px",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 32,
              textAlign: "center",
              color: "#64748b",
            }}
          >
            Loading dashboard...
          </div>
        </div>
      </main>
    );
  }

  const priorityFollowUps = [
    ...overdueFollowUps,
    ...todayFollowUps,
  ].slice(0, 8);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "28px 32px 48px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        color: "#111827",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            marginBottom: 28,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Dashboard
            </h1>

            <p
              style={{
                margin: "6px 0 0",
                color: "#64748b",
                fontSize: 14,
              }}
            >
              Overview of your CRM activities, leads, customers and sales.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              visibility: "visible",
              opacity: refreshing ? 0.7 : 1,
              color: "#ffffff",
              background: "#2563eb",
              border: "1px solid #2563eb",
              padding: "10px 16px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: refreshing ? "not-allowed" : "pointer",
              minHeight: 40,
              whiteSpace: "nowrap",
            }}
          >
            {refreshing ? "Refreshing..." : "Refresh Dashboard"}
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div
            style={{
              marginBottom: 24,
              padding: "14px 16px",
              borderRadius: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: 14,
            }}
          >
            <strong>Dashboard error:</strong> {error}
          </div>
        )}

        {/* KPI CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <Link
            href="/leads"
            style={{
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 20,
                minHeight: 130,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  marginBottom: 10,
                }}
              >
                Total Leads
              </div>

              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {stats.totalLeads}
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "#16a34a",
                }}
              >
                +{stats.newLeadsThisMonth} this month
              </div>
            </div>
          </Link>

          <Link
            href="/customers"
            style={{
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 20,
                minHeight: 130,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  marginBottom: 10,
                }}
              >
                Customers
              </div>

              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {stats.customers}
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "#16a34a",
                }}
              >
                +{stats.newCustomersThisMonth} this month
              </div>
            </div>
          </Link>

          <Link
            href="/pipeline"
            style={{
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 20,
                minHeight: 130,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  marginBottom: 10,
                }}
              >
                Open Deals
              </div>

              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {stats.openDeals}
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                Active opportunities
              </div>
            </div>
          </Link>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
              minHeight: 130,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#64748b",
                marginBottom: 10,
              }}
            >
              Sales Forecast
            </div>

            <div
              style={{
                fontSize: 25,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {formatCurrency(stats.salesForecast)}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#64748b",
              }}
            >
              Weighted open pipeline
            </div>
          </div>

          <Link
            href="/leads"
            style={{
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 20,
                minHeight: 130,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  marginBottom: 10,
                }}
              >
                Follow-ups
              </div>

              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {stats.followUps}
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color:
                    stats.followUps > 0
                      ? "#dc2626"
                      : "#16a34a",
                }}
              >
                {stats.followUps > 0
                  ? "Requires attention"
                  : "Nothing due"}
              </div>
            </div>
          </Link>

          <Link
            href="/tasks"
            style={{
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 20,
                minHeight: 130,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  marginBottom: 10,
                }}
              >
                Tasks Due Today
              </div>

              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {stats.tasksDueToday}
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                Pending activities
              </div>
            </div>
          </Link>
        </div>

        {/* DAILY FOLLOW-UP WORKSPACE */}
        <section
          style={{
            marginBottom: 24,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 20px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                Daily Follow-up Workspace
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                Focus on students and activities that need attention.
              </p>
            </div>

            <Link
              href="/leads"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                visibility: "visible",
                opacity: 1,
                color: "#ffffff",
                background: "#2563eb",
                border: "1px solid #2563eb",
                padding: "9px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Open Leads
            </Link>
          </div>

          {/* WORKSPACE COUNTS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 12,
              padding: 20,
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 10,
                padding: 15,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#991b1b",
                  fontWeight: 600,
                }}
              >
                Overdue
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#dc2626",
                }}
              >
                {overdueFollowUps.length}
              </div>
            </div>

            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 10,
                padding: 15,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#1d4ed8",
                  fontWeight: 600,
                }}
              >
                Due Today
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#2563eb",
                }}
              >
                {todayFollowUps.length}
              </div>
            </div>

            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 10,
                padding: 15,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#166534",
                  fontWeight: 600,
                }}
              >
                Next 7 Days
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#16a34a",
                }}
              >
                {upcomingFollowUps.length}
              </div>
            </div>

            <div
              style={{
                background: "#f5f3ff",
                border: "1px solid #ddd6fe",
                borderRadius: 10,
                padding: 15,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#6d28d9",
                  fontWeight: 600,
                }}
              >
                Interested Leads
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#7c3aed",
                }}
              >
                {interestedLeads.length}
              </div>
            </div>

            <div
              style={{
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: 10,
                padding: 15,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#c2410c",
                  fontWeight: 600,
                }}
              >
                Admission Prospects
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#ea580c",
                }}
              >
                {admissionProspects.length}
              </div>
            </div>

            <div
              style={{
                background: "#ecfeff",
                border: "1px solid #a5f3fc",
                borderRadius: 10,
                padding: 15,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#0e7490",
                  fontWeight: 600,
                }}
              >
                Today's Tasks
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#0891b2",
                }}
              >
                {todayTasks.length}
              </div>
            </div>
          </div>

          {/* PRIORITY FOLLOW-UPS */}
          <div style={{ padding: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  Priority Follow-ups
                </h3>

                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  Overdue and today's follow-ups.
                </p>
              </div>
            </div>

            {priorityFollowUps.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: 10,
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                No urgent follow-ups right now.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {priorityFollowUps.map((lead) => {
                  const phone = normalizeWhatsAppNumber(
                    lead.phone
                  );

                  const overdue = isOverdueFollowUp(
                    lead.next_follow_up_at
                  );

                  return (
                    <div
                      key={lead.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 14,
                        padding: 14,
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          minWidth: 220,
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: "#111827",
                          }}
                        >
                          {lead.name || "Unnamed Lead"}
                        </div>

                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: "#64748b",
                          }}
                        >
                          {lead.product_service ||
                            "No programme"}

                          {lead.ciu_number
                            ? ` · ${lead.ciu_number}`
                            : ""}
                        </div>

                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 12,
                            color: overdue
                              ? "#dc2626"
                              : "#2563eb",
                            fontWeight: 600,
                          }}
                        >
                          {overdue
                            ? "OVERDUE"
                            : "DUE TODAY"}{" "}
                          ·{" "}
                          {formatDateTime(
                            lead.next_follow_up_at
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 7,
                          flexWrap: "wrap",
                        }}
                      >
                        {lead.phone && (
                          <>
                            <a
                              href={`tel:${lead.phone}`}
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
                                padding: "7px 11px",
                                borderRadius: 7,
                                fontSize: 12,
                                fontWeight: 600,
                                textDecoration: "none",
                              }}
                            >
                              Call
                            </a>

                            {phone && (
                              <a
                                href={`https://wa.me/${phone}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  visibility: "visible",
                                  opacity: 1,
                                  color: "#ffffff",
                                  background: "#25d366",
                                  border:
                                    "1px solid #25d366",
                                  padding: "7px 11px",
                                  borderRadius: 7,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  textDecoration: "none",
                                }}
                              >
                                WhatsApp
                              </a>
                            )}
                          </>
                        )}

                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              visibility: "visible",
                              opacity: 1,
                              color: "#ffffff",
                              background: "#7c3aed",
                              border: "1px solid #7c3aed",
                              padding: "7px 11px",
                              borderRadius: 7,
                              fontSize: 12,
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            Email
                          </a>
                        )}

                        <Link
                          href="/leads"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            visibility: "visible",
                            opacity: 1,
                            color: "#1f2937",
                            background: "#f3f4f6",
                            border: "1px solid #d1d5db",
                            padding: "7px 11px",
                            borderRadius: 7,
                            fontSize: 12,
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          View Lead
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* UPCOMING FOLLOW-UPS */}
          <div
            style={{
              padding: 20,
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <h3
              style={{
                margin: "0 0 14px",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Upcoming Follow-ups
            </h3>

            {upcomingFollowUps.length === 0 ? (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: 10,
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                No follow-ups scheduled for the next 7 days.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 10,
                }}
              >
                {upcomingFollowUps.map((lead) => (
                  <div
                    key={lead.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: 13,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {lead.name || "Unnamed Lead"}
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        color: "#64748b",
                        fontSize: 12,
                      }}
                    >
                      {lead.product_service || "No programme"}
                    </div>

                    <div
                      style={{
                        marginTop: 7,
                        color: "#16a34a",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {formatDateTime(
                        lead.next_follow_up_at
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ADMISSION WORKSPACE */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 20,
            marginBottom: 24,
          }}
        >
          {/* ADMISSION PROSPECTS */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  Admission Prospects
                </h2>

                <p
                  style={{
                    margin: "4px 0 0",
                    color: "#64748b",
                    fontSize: 12,
                  }}
                >
                  Students moving through the admissions journey.
                </p>
              </div>

              <Link
                href="/customers"
                style={{
                  color: "#2563eb",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                View Admissions
              </Link>
            </div>

            <div>
              {admissionProspects.length === 0 ? (
                <div
                  style={{
                    padding: 30,
                    textAlign: "center",
                    color: "#64748b",
                    fontSize: 14,
                  }}
                >
                  No active admission prospects.
                </div>
              ) : (
                admissionProspects.slice(0, 8).map(
                  (admission, index) => {
                    const statusStyle = getStatusStyle(
                      admission.stage
                    );

                    return (
                      <div
                        key={admission.id}
                        style={{
                          padding: "14px 20px",
                          borderBottom:
                            index ===
                            Math.min(
                              admissionProspects.length,
                              8
                            ) -
                              1
                              ? "none"
                              : "1px solid #f1f5f9",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: "#111827",
                              }}
                            >
                              {admission.full_names ||
                                "Unnamed Student"}
                            </div>

                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 12,
                                color: "#64748b",
                              }}
                            >
                              {admission.program ||
                                "No programme"}

                              {admission.ciu_number
                                ? ` · ${admission.ciu_number}`
                                : ""}
                            </div>
                          </div>

                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "4px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 600,
                              background:
                                statusStyle.background,
                              color: statusStyle.color,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {admission.stage || "New"}
                          </span>
                        </div>
                      </div>
                    );
                  }
                )
              )}
            </div>
          </section>

          {/* ACCEPTANCE FOLLOW-UPS */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                Acceptance & Fee Follow-ups
              </h2>

              <p
                style={{
                  margin: "4px 0 0",
                  color: "#64748b",
                  fontSize: 12,
                }}
              >
                Admitted and acceptance-stage students requiring attention.
              </p>
            </div>

            <div>
              {acceptanceFollowUps.length === 0 ? (
                <div
                  style={{
                    padding: 30,
                    textAlign: "center",
                    color: "#64748b",
                    fontSize: 14,
                  }}
                >
                  No admission fee follow-ups currently available.
                </div>
              ) : (
                acceptanceFollowUps.slice(0, 8).map(
                  (admission, index) => (
                    <div
                      key={admission.id}
                      style={{
                        padding: "14px 20px",
                        borderBottom:
                          index ===
                          Math.min(
                            acceptanceFollowUps.length,
                            8
                          ) -
                            1
                            ? "none"
                            : "1px solid #f1f5f9",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 14,
                            }}
                          >
                            {admission.full_names ||
                              "Unnamed Student"}
                          </div>

                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              color: "#64748b",
                            }}
                          >
                            {admission.program ||
                              "No programme"}
                          </div>

                          {admission.telephone && (
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 12,
                                color: "#64748b",
                              }}
                            >
                              {admission.telephone}
                            </div>
                          )}
                        </div>

                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            background:
                              admission.stage
                                ?.toLowerCase()
                                .includes("admitted")
                                ? "#fff7ed"
                                : "#dcfce7",
                            color:
                              admission.stage
                                ?.toLowerCase()
                                .includes("admitted")
                                ? "#c2410c"
                                : "#166534",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {admission.stage || "New"}
                        </span>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </section>
        </div>

        {/* TODAY'S TASKS */}
        <section
          style={{
            marginBottom: 24,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 20px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                Today's Tasks
              </h2>

              <p
                style={{
                  margin: "4px 0 0",
                  color: "#64748b",
                  fontSize: 12,
                }}
              >
                Tasks that need to be completed today.
              </p>
            </div>

            <Link
              href="/tasks"
              style={{
                color: "#2563eb",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              View Tasks
            </Link>
          </div>

          <div>
            {todayTasks.length === 0 ? (
              <div
                style={{
                  padding: 30,
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: 14,
                }}
              >
                No pending tasks for today.
              </div>
            ) : (
              todayTasks.map((task, index) => (
                <div
                  key={task.id}
                  style={{
                    padding: "14px 20px",
                    borderBottom:
                      index === todayTasks.length - 1
                        ? "none"
                        : "1px solid #f1f5f9",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        {task.title || "Untitled task"}
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: "#64748b",
                        }}
                      >
                        {task.task_type || "Task"}

                        {task.assigned_to
                          ? ` · ${
                              profileMap.get(
                                task.assigned_to
                              ) || "Assigned"
                            }`
                          : ""}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                        }}
                      >
                        {formatDateTime(task.due_at)}
                      </span>

                      <Link
                        href="/tasks"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          visibility: "visible",
                          opacity: 1,
                          color: "#ffffff",
                          background: "#0891b2",
                          border: "1px solid #0891b2",
                          padding: "7px 11px",
                          borderRadius: 7,
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* PIPELINE + UPCOMING TASKS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.35fr) minmax(320px, 1fr)",
            gap: 20,
            marginBottom: 24,
          }}
        >
          {/* PIPELINE */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  Pipeline Summary
                </h2>

                <p
                  style={{
                    margin: "4px 0 0",
                    color: "#64748b",
                    fontSize: 12,
                  }}
                >
                  Opportunities by pipeline stage
                </p>
              </div>

              <Link
                href="/pipeline"
                style={{
                  color: "#2563eb",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                View Pipeline
              </Link>
            </div>

            <div style={{ padding: 20 }}>
              {pipelineSummary.length === 0 ? (
                <div
                  style={{
                    padding: 30,
                    textAlign: "center",
                    color: "#64748b",
                    fontSize: 14,
                  }}
                >
                  No pipeline stages available.
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  {pipelineSummary.map((stage) => {
                    const maxCount = Math.max(
                      ...pipelineSummary.map(
                        (item) => item.count
                      ),
                      1
                    );

                    const percentage =
                      (stage.count / maxCount) * 100;

                    return (
                      <div key={stage.id}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            marginBottom: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#374151",
                            }}
                          >
                            {stage.name}
                          </span>

                          <span
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                            }}
                          >
                            {stage.count}{" "}
                            {stage.count === 1
                              ? "deal"
                              : "deals"}{" "}
                            · {formatCurrency(stage.value)}
                          </span>
                        </div>

                        <div
                          style={{
                            height: 8,
                            borderRadius: 999,
                            background: "#e5e7eb",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${percentage}%`,
                              background: "#2563eb",
                              borderRadius: 999,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* UPCOMING TASKS */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  Upcoming Tasks
                </h2>

                <p
                  style={{
                    margin: "4px 0 0",
                    color: "#64748b",
                    fontSize: 12,
                  }}
                >
                  Your next activities
                </p>
              </div>

              <Link
                href="/tasks"
                style={{
                  color: "#2563eb",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                View Tasks
              </Link>
            </div>

            <div>
              {upcomingTasks.length === 0 ? (
                <div
                  style={{
                    padding: 30,
                    textAlign: "center",
                    color: "#64748b",
                    fontSize: 14,
                  }}
                >
                  No upcoming tasks.
                </div>
              ) : (
                upcomingTasks.map((task, index) => (
                  <div
                    key={task.id}
                    style={{
                      padding: "14px 20px",
                      borderBottom:
                        index === upcomingTasks.length - 1
                          ? "none"
                          : "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#111827",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {task.title || "Untitled task"}
                        </div>

                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: "#64748b",
                          }}
                        >
                          {task.task_type || "Task"}

                          {task.assigned_to
                            ? ` · ${
                                profileMap.get(
                                  task.assigned_to
                                ) || "Assigned"
                              }`
                            : ""}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          whiteSpace: "nowrap",
                          textAlign: "right",
                        }}
                      >
                        {formatDateTime(task.due_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* RECENT LEADS + CUSTOMERS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 20,
          }}
        >
          {/* RECENT LEADS */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  Recent Leads
                </h2>

                <p
                  style={{
                    margin: "4px 0 0",
                    color: "#64748b",
                    fontSize: 12,
                  }}
                >
                  Latest leads added to the CRM
                </p>
              </div>

              <Link
                href="/leads"
                style={{
                  color: "#2563eb",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                View All
              </Link>
            </div>

            <div style={{ overflowX: "auto" }}>
              {recentLeads.length === 0 ? (
                <div
                  style={{
                    padding: 30,
                    textAlign: "center",
                    color: "#64748b",
                    fontSize: 14,
                  }}
                >
                  No leads available.
                </div>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#f8fafc",
                        textAlign: "left",
                      }}
                    >
                      <th
                        style={{
                          padding: "11px 16px",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Name
                      </th>

                      <th
                        style={{
                          padding: "11px 16px",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Program
                      </th>

                      <th
                        style={{
                          padding: "11px 16px",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentLeads.map((lead) => {
                      const statusStyle = getStatusStyle(
                        lead.status
                      );

                      return (
                        <tr
                          key={lead.id}
                          style={{
                            borderTop:
                              "1px solid #f1f5f9",
                          }}
                        >
                          <td
                            style={{
                              padding: "13px 16px",
                              verticalAlign: "top",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 600,
                                color: "#111827",
                              }}
                            >
                              {lead.name || "Unnamed Lead"}
                            </div>

                            <div
                              style={{
                                marginTop: 3,
                                fontSize: 11,
                                color: "#64748b",
                              }}
                            >
                              {lead.ciu_number ||
                                "No CIU number"}
                            </div>
                          </td>

                          <td
                            style={{
                              padding: "13px 16px",
                              color: "#475569",
                              verticalAlign: "top",
                            }}
                          >
                            {lead.product_service || "—"}
                          </td>

                          <td
                            style={{
                              padding: "13px 16px",
                              verticalAlign: "top",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "4px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 600,
                                background:
                                  statusStyle.background,
                                color: statusStyle.color,
                              }}
                            >
                              {lead.status || "New"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* RECENT CUSTOMERS */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  Recent Customers
                </h2>

                <p
                  style={{
                    margin: "4px 0 0",
                    color: "#64748b",
                    fontSize: 12,
                  }}
                >
                  Latest admissions and customers
                </p>
              </div>

              <Link
                href="/customers"
                style={{
                  color: "#2563eb",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                View All
              </Link>
            </div>

            <div style={{ overflowX: "auto" }}>
              {recentCustomers.length === 0 ? (
                <div
                  style={{
                    padding: 30,
                    textAlign: "center",
                    color: "#64748b",
                    fontSize: 14,
                  }}
                >
                  No customers available.
                </div>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#f8fafc",
                        textAlign: "left",
                      }}
                    >
                      <th
                        style={{
                          padding: "11px 16px",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Student
                      </th>

                      <th
                        style={{
                          padding: "11px 16px",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Program
                      </th>

                      <th
                        style={{
                          padding: "11px 16px",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Stage
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentCustomers.map((customer) => {
                      const statusStyle = getStatusStyle(
                        customer.stage
                      );

                      return (
                        <tr
                          key={customer.id}
                          style={{
                            borderTop:
                              "1px solid #f1f5f9",
                          }}
                        >
                          <td
                            style={{
                              padding: "13px 16px",
                              verticalAlign: "top",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 600,
                                color: "#111827",
                              }}
                            >
                              {customer.full_names ||
                                "Unnamed Student"}
                            </div>

                            <div
                              style={{
                                marginTop: 3,
                                fontSize: 11,
                                color: "#64748b",
                              }}
                            >
                              {customer.ciu_number ||
                                "No CIU number"}
                            </div>
                          </td>

                          <td
                            style={{
                              padding: "13px 16px",
                              color: "#475569",
                              verticalAlign: "top",
                            }}
                          >
                            {customer.program || "—"}
                          </td>

                          <td
                            style={{
                              padding: "13px 16px",
                              verticalAlign: "top",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "4px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 600,
                                background:
                                  statusStyle.background,
                                color: statusStyle.color,
                              }}
                            >
                              {customer.stage || "New"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        {/* OPPORTUNITIES */}
        <section
          style={{
            marginTop: 20,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 20px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                Recent Opportunities
              </h2>

              <p
                style={{
                  margin: "4px 0 0",
                  color: "#64748b",
                  fontSize: 12,
                }}
              >
                Latest sales opportunities
              </p>
            </div>

            <Link
              href="/pipeline"
              style={{
                color: "#2563eb",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              View Pipeline
            </Link>
          </div>

          <div style={{ overflowX: "auto" }}>
            {opportunities.length === 0 ? (
              <div
                style={{
                  padding: 30,
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: 14,
                }}
              >
                No opportunities available.
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8fafc",
                      textAlign: "left",
                    }}
                  >
                    <th
                      style={{
                        padding: "11px 16px",
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      Opportunity
                    </th>

                    <th
                      style={{
                        padding: "11px 16px",
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      Value
                    </th>

                    <th
                      style={{
                        padding: "11px 16px",
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      Status
                    </th>

                    <th
                      style={{
                        padding: "11px 16px",
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      Probability
                    </th>

                    <th
                      style={{
                        padding: "11px 16px",
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      Expected Close
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {opportunities.slice(0, 8).map(
                    (opportunity) => {
                      const statusStyle =
                        getStatusStyle(
                          opportunity.status
                        );

                      return (
                        <tr
                          key={opportunity.id}
                          style={{
                            borderTop:
                              "1px solid #f1f5f9",
                          }}
                        >
                          <td
                            style={{
                              padding: "13px 16px",
                              fontWeight: 600,
                              color: "#111827",
                            }}
                          >
                            {opportunity.title ||
                              "Untitled Opportunity"}
                          </td>

                          <td
                            style={{
                              padding: "13px 16px",
                              color: "#475569",
                            }}
                          >
                            {formatCurrency(
                              Number(
                                opportunity.value || 0
                              )
                            )}
                          </td>

                          <td
                            style={{
                              padding: "13px 16px",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "4px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 600,
                                background:
                                  statusStyle.background,
                                color: statusStyle.color,
                              }}
                            >
                              {opportunity.status ||
                                "Open"}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: "13px 16px",
                              color: "#475569",
                            }}
                          >
                            {opportunity.probability ??
                              0}
                            %
                          </td>

                          <td
                            style={{
                              padding: "13px 16px",
                              color: "#475569",
                            }}
                          >
                            {formatDate(
                              opportunity.expected_close_date
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* QUICK ACTIONS */}
        <section
          style={{
            marginTop: 20,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2
            style={{
              margin: "0 0 16px",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            Quick Actions
          </h2>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <Link
              href="/leads"
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
                textDecoration: "none",
                minHeight: 40,
              }}
            >
              Manage Leads
            </Link>

            <Link
              href="/customers"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                visibility: "visible",
                opacity: 1,
                color: "#ffffff",
                background: "#16a34a",
                border: "1px solid #16a34a",
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                minHeight: 40,
              }}
            >
              View Customers
            </Link>

            <Link
              href="/pipeline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                visibility: "visible",
                opacity: 1,
                color: "#ffffff",
                background: "#7c3aed",
                border: "1px solid #7c3aed",
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                minHeight: 40,
              }}
            >
              Manage Pipeline
            </Link>

            <Link
              href="/tasks"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                visibility: "visible",
                opacity: 1,
                color: "#ffffff",
                background: "#ea580c",
                border: "1px solid #ea580c",
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                minHeight: 40,
              }}
            >
              Manage Tasks
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}