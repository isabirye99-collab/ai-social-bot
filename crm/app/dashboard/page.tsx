"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type CrmRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "salesperson"
  | "marketing"
  | "finance"
  | "viewer";

type Lead = {
  id: string;
  assigned_to: string | null;
  status: string | null;
  next_follow_up_at: string | null;
  created_at: string | null;
};

type Admission = {
  id: string;
  assigned_to: string | null;
  stage: string | null;
  created_at: string | null;
};

type Opportunity = {
  id: string;
  assigned_to: string | null;
  value: number | null;
  status: string | null;
  probability: number | null;
};

type Task = {
  id: string;
  assigned_to: string | null;
  due_at: string | null;
  status: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  role: CrmRole | null;
};

const supabase = createClient();

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isThisMonth(value: string | null) {
  if (!value) return false;

  const d = new Date(value);
  const n = new Date();

  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth()
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function roleLabel(role: CrmRole | null) {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "salesperson":
      return "Salesperson";
    case "marketing":
      return "Marketing";
    case "finance":
      return "Finance";
    case "viewer":
      return "Viewer";
    default:
      return "User";
  }
}

function getRoleInitials(name: string | null) {
  if (!name) return "NI";

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You are not authenticated.");
      }

      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profileData) {
        throw new Error(
          "Your CRM profile could not be found."
        );
      }

      const currentProfile = profileData as Profile;

      setProfile(currentProfile);

      const isSalesperson =
        currentProfile.role === "salesperson";

      let leadsQuery = supabase
        .from("leads")
        .select(
          "id,assigned_to,status,next_follow_up_at,created_at"
        );

      let admissionsQuery = supabase
        .from("admissions")
        .select(
          "id,assigned_to,stage,created_at"
        );

      let opportunitiesQuery = supabase
        .from("opportunities")
        .select(
          "id,assigned_to,value,status,probability"
        );

      let tasksQuery = supabase
        .from("tasks")
        .select(
          "id,assigned_to,due_at,status"
        );

      if (isSalesperson) {
        leadsQuery = leadsQuery.eq(
          "assigned_to",
          user.id
        );

        admissionsQuery = admissionsQuery.eq(
          "assigned_to",
          user.id
        );

        opportunitiesQuery =
          opportunitiesQuery.eq(
            "assigned_to",
            user.id
          );

        tasksQuery = tasksQuery.eq(
          "assigned_to",
          user.id
        );
      }

      const [l, a, o, t] = await Promise.all([
        leadsQuery,
        admissionsQuery,
        opportunitiesQuery,
        tasksQuery,
      ]);

      const firstError = [l, a, o, t].find(
        (x) => x.error
      );

      if (firstError?.error) {
        throw new Error(
          firstError.error.message
        );
      }

      setLeads((l.data || []) as Lead[]);
      setAdmissions(
        (a.data || []) as Admission[]
      );
      setOpportunities(
        (o.data || []) as Opportunity[]
      );
      setTasks((t.data || []) as Task[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();

    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);

    const openDeals = opportunities.filter(
      (x) =>
        (x.status || "").toLowerCase() ===
        "open"
    );

    const forecast = openDeals.reduce(
      (sum, x) =>
        sum +
        Number(x.value || 0) *
          (Number(x.probability ?? 100) / 100),
      0
    );

    const followUps = leads.filter((x) => {
      if (!x.next_follow_up_at) return false;

      const status = (
        x.status || ""
      ).toLowerCase();

      if (
        [
          "converted",
          "lost",
          "unqualified",
        ].includes(status)
      ) {
        return false;
      }

      return (
        new Date(x.next_follow_up_at) <=
        endToday
      );
    }).length;

    const tasksToday = tasks.filter((x) => {
      if (!x.due_at) return false;

      const status = (
        x.status || ""
      ).toLowerCase();

      if (
        ["completed", "cancelled"].includes(
          status
        )
      ) {
        return false;
      }

      return sameDay(
        new Date(x.due_at),
        now
      );
    }).length;

    const interested = leads.filter(
      (x) =>
        (x.status || "").toLowerCase() ===
        "qualified"
    ).length;

    const enrolled = admissions.filter(
      (x) =>
        (x.stage || "").toLowerCase() ===
        "enrolled"
    ).length;

    const completedTasks = tasks.filter(
      (x) =>
        (x.status || "").toLowerCase() ===
        "completed"
    ).length;

    const newLeads = leads.filter((x) =>
      isThisMonth(x.created_at)
    ).length;

    const conversionRate =
      leads.length > 0
        ? Math.round(
            (enrolled / leads.length) * 1000
          ) / 10
        : 0;

    return {
      leads: leads.length,
      interested,
      openDeals: openDeals.length,
      forecast,
      enrolled,
      followUps,
      tasksToday,
      completedTasks,
      newLeads,
      conversionRate,
    };
  }, [
    leads,
    admissions,
    opportunities,
    tasks,
  ]);

  if (loading) {
    return (
      <main className="ciu-page">
        <div className="ciu-page-inner">
          <div className="dashboard-loading">
            <div className="dashboard-loading-spinner" />
            <div>
              <strong>
                Loading dashboard
              </strong>
              <span>
                Preparing your CRM overview...
              </span>
            </div>
          </div>
        </div>

        <style jsx>{`
          .dashboard-loading {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 28px;
            background: #ffffff;
            border: 1px solid #dfe9e5;
            border-radius: 16px;
            color: #17322c;
          }

          .dashboard-loading div:last-child {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .dashboard-loading span {
            color: #6b7f78;
            font-size: 13px;
          }

          .dashboard-loading-spinner {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid #dfe9e5;
            border-top-color: #00695c;
            animation: dashboard-spin 0.8s linear infinite;
          }

          @keyframes dashboard-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  const isSalesperson =
    profile?.role === "salesperson";

  const isAdmin =
    profile?.role === "admin" ||
    profile?.role === "super_admin";

  const dashboardTitle = isSalesperson
    ? "My Dashboard"
    : "Management Dashboard";

  const dashboardSubtitle = isSalesperson
    ? "Your personal leads, follow-ups, tasks, pipeline and enrollment performance."
    : "A focused view of admissions, pipeline and follow-up activity.";

  const primaryKpis = [
    {
      label: isSalesperson
        ? "My Leads"
        : "Total Leads",
      value: stats.leads,
      note:
        "+" +
        stats.newLeads +
        " this month",
      href: "/leads",
      icon: "LE",
    },
    {
      label: isSalesperson
        ? "My Interested"
        : "Interested",
      value: stats.interested,
      note: "Qualified leads",
      href: "/leads",
      icon: "IN",
    },
    {
      label: isSalesperson
        ? "My Open Deals"
        : "Open Deals",
      value: stats.openDeals,
      note: "Active opportunities",
      href: "/pipeline",
      icon: "OP",
    },
    {
      label: isSalesperson
        ? "My Forecast"
        : "Sales Forecast",
      value: money(stats.forecast),
      note: "Weighted pipeline",
      href: "/pipeline",
      icon: "UG",
    },
  ];

  const secondaryKpis = [
    {
      label: isSalesperson
        ? "My Enrolled"
        : "Enrolled",
      value: stats.enrolled,
      note: "Current admissions",
      href: "/customers",
    },
    {
      label: isSalesperson
        ? "My Follow-ups"
        : "Follow-ups",
      value: stats.followUps,
      note: stats.followUps
        ? "Needs attention"
        : "Nothing due",
      href: "/tasks",
    },
    {
      label: "Tasks Due Today",
      value: stats.tasksToday,
      note: "Open tasks",
      href: "/tasks",
    },
    {
      label: "Tasks Completed",
      value: stats.completedTasks,
      note: "Completed tasks",
      href: "/tasks",
    },
  ];

  return (
    <main className="ciu-page">
      <div className="ciu-page-inner">

        {/* HEADER */}

        <section className="dashboard-header">
          <div className="dashboard-header-left">
            <div className="dashboard-avatar">
              {getRoleInitials(
                profile?.full_name || null
              )}
            </div>

            <div>
              <div className="dashboard-eyebrow">
                CRM OVERVIEW
              </div>

              <h1>{dashboardTitle}</h1>

              <p>
                {dashboardSubtitle}
              </p>

              {profile && (
                <div className="dashboard-user">
                  {profile.full_name ||
                    "CRM User"}
                  <span>•</span>
                  {roleLabel(profile.role)}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              setRefreshing(true);
              await loadDashboard();
            }}
            disabled={refreshing}
            className="dashboard-refresh"
          >
            <span>
              {refreshing ? "↻" : "⟳"}
            </span>

            {refreshing
              ? "Refreshing..."
              : "Refresh Dashboard"}
          </button>
        </section>

        {/* ERROR */}

        {error && (
          <div className="dashboard-error">
            <strong>
              Unable to load some dashboard data
            </strong>

            <span>{error}</span>

            <button
              type="button"
              onClick={loadDashboard}
            >
              Try Again
            </button>
          </div>
        )}

        {/* PRIMARY KPI CARDS */}

        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <h2>CRM Performance</h2>
              <span>
                Your most important CRM numbers at a glance.
              </span>
            </div>
          </div>

          <div className="dashboard-kpi-grid">
            {primaryKpis.map((kpi) => (
              <Link
                key={kpi.label}
                href={kpi.href}
                className="dashboard-kpi-card"
              >
                <div className="dashboard-kpi-top">
                  <div className="dashboard-kpi-icon">
                    {kpi.icon}
                  </div>

                  <span className="dashboard-kpi-arrow">
                    →
                  </span>
                </div>

                <div className="dashboard-kpi-label">
                  {kpi.label}
                </div>

                <div
                  className={`dashboard-kpi-value ${
                    typeof kpi.value ===
                      "string" &&
                    kpi.value.length > 10
                      ? "dashboard-kpi-value-money"
                      : ""
                  }`}
                >
                  {kpi.value}
                </div>

                <div className="dashboard-kpi-note">
                  {kpi.note}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* SECONDARY KPI CARDS */}

        <section className="dashboard-secondary-grid">
          {secondaryKpis.map((kpi) => (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="dashboard-secondary-card"
            >
              <div>
                <span className="dashboard-secondary-label">
                  {kpi.label}
                </span>

                <strong>
                  {kpi.value}
                </strong>

                <small>
                  {kpi.note}
                </small>
              </div>

              <span className="dashboard-secondary-arrow">
                →
              </span>
            </Link>
          ))}
        </section>

        {/* MONTHLY STRIP */}

        <section className="dashboard-month-strip">
          <div>
            <strong>
              {isSalesperson
                ? "My activity this month"
                : "This month"}
            </strong>

            <span>
              Current CRM activity and performance
            </span>
          </div>

          <div className="dashboard-month-metrics">
            <div>
              <strong>
                {stats.newLeads}
              </strong>
              <span>New Leads</span>
            </div>

            <div>
              <strong>
                {stats.interested}
              </strong>
              <span>Interested</span>
            </div>

            <div>
              <strong>
                {stats.enrolled}
              </strong>
              <span>Enrolled</span>
            </div>

            <div>
              <strong>
                {stats.conversionRate}%
              </strong>
              <span>Conversion</span>
            </div>
          </div>
        </section>

        {/* PERFORMANCE + ATTENTION */}

        <div className="dashboard-two-column">

          {/* PERFORMANCE */}

          <section className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <div className="dashboard-card-eyebrow">
                  PERFORMANCE
                </div>

                <h2>
                  {isSalesperson
                    ? "My Performance"
                    : "Performance Overview"}
                </h2>

                <p>
                  {isSalesperson
                    ? "Your current activity and conversion performance."
                    : "Current CRM activity and conversion performance."}
                </p>
              </div>

              <Link
                href="/reports"
                className="dashboard-outline-button"
              >
                View Reports →
              </Link>
            </div>

            <div className="performance-grid">

              <div className="performance-item">
                <div className="performance-icon">
                  TK
                </div>

                <strong>
                  {stats.completedTasks}
                </strong>

                <span>
                  Tasks completed
                </span>
              </div>

              <div className="performance-item">
                <div className="performance-icon">
                  TD
                </div>

                <strong>
                  {stats.tasksToday}
                </strong>

                <span>
                  Tasks due today
                </span>
              </div>

              <div className="performance-item">
                <div className="performance-icon">
                  FU
                </div>

                <strong>
                  {stats.followUps}
                </strong>

                <span>
                  Follow-ups due
                </span>
              </div>

              <div className="performance-item">
                <div className="performance-icon">
                  CR
                </div>

                <strong>
                  {stats.conversionRate}%
                </strong>

                <span>
                  {isSalesperson
                    ? "My conversion"
                    : "Overall conversion"}
                </span>
              </div>

            </div>
          </section>

          {/* TODAY'S ATTENTION */}

          <section className="dashboard-card">
            <div className="dashboard-card-header">
              <div>
                <div className="dashboard-card-eyebrow">
                  ACTION REQUIRED
                </div>

                <h2>
                  Today's Attention
                </h2>

                <p>
                  {isSalesperson
                    ? "Your items that need action now."
                    : "Items that need action now."}
                </p>
              </div>
            </div>

            <div className="attention-list">

              <Link
                href="/tasks"
                className="attention-row"
              >
                <div className="attention-row-left">
                  <div className="attention-dot">
                    01
                  </div>

                  <div>
                    <strong>
                      Follow-ups due
                    </strong>

                    <span>
                      Leads requiring contact
                    </span>
                  </div>
                </div>

                <strong className="attention-number">
                  {stats.followUps}
                </strong>
              </Link>

              <Link
                href="/tasks"
                className="attention-row"
              >
                <div className="attention-row-left">
                  <div className="attention-dot">
                    02
                  </div>

                  <div>
                    <strong>
                      Tasks due today
                    </strong>

                    <span>
                      Open tasks requiring action
                    </span>
                  </div>
                </div>

                <strong className="attention-number">
                  {stats.tasksToday}
                </strong>
              </Link>

              <Link
                href="/leads"
                className="attention-row"
              >
                <div className="attention-row-left">
                  <div className="attention-dot">
                    03
                  </div>

                  <div>
                    <strong>
                      Interested leads
                    </strong>

                    <span>
                      Qualified prospects
                    </span>
                  </div>
                </div>

                <strong className="attention-number">
                  {stats.interested}
                </strong>
              </Link>

            </div>
          </section>

        </div>

        {/* QUICK ACTIONS */}

        <section className="dashboard-card dashboard-quick-actions">
          <div className="dashboard-card-header">
            <div>
              <div className="dashboard-card-eyebrow">
                QUICK ACTIONS
              </div>

              <h2>
                Continue Working
              </h2>

              <p>
                Jump directly into the areas you use most.
              </p>
            </div>
          </div>

          <div className="quick-action-grid">

            <Link
              href="/leads"
              className="quick-action"
            >
              <div className="quick-action-icon">
                LE
              </div>

              <div>
                <strong>
                  Leads
                </strong>

                <span>
                  Manage prospects
                </span>
              </div>

              <span>→</span>
            </Link>

            <Link
              href="/tasks"
              className="quick-action"
            >
              <div className="quick-action-icon">
                TK
              </div>

              <div>
                <strong>
                  Tasks
                </strong>

                <span>
                  Manage follow-ups
                </span>
              </div>

              <span>→</span>
            </Link>

            <Link
              href="/pipeline"
              className="quick-action"
            >
              <div className="quick-action-icon">
                PL
              </div>

              <div>
                <strong>
                  Pipeline
                </strong>

                <span>
                  Track opportunities
                </span>
              </div>

              <span>→</span>
            </Link>

            <Link
              href="/customers"
              className="quick-action"
            >
              <div className="quick-action-icon">
                CU
              </div>

              <div>
                <strong>
                  Customers
                </strong>

                <span>
                  View enrolled students
                </span>
              </div>

              <span>→</span>
            </Link>

          </div>
        </section>

        {/* ADMIN NOTE */}

        {isAdmin && (
          <div className="dashboard-admin-note">
            <strong>
              Organization-wide view
            </strong>

            <span>
              You are viewing CRM performance across the organization.
            </span>
          </div>
        )}

      </div>

      <style jsx>{`

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 26px 28px;
          margin-bottom: 18px;
          border-radius: 18px;
          background:
            linear-gradient(
              135deg,
              #004d40 0%,
              #00695c 58%,
              #08796c 100%
            );
          color: #ffffff;
          box-shadow:
            0 10px 28px rgba(0, 77, 64, 0.12);
        }

        .dashboard-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .dashboard-avatar {
          width: 54px;
          height: 54px;
          flex: 0 0 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: rgba(255,255,255,0.16);
          border: 1px solid rgba(255,255,255,0.22);
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .dashboard-eyebrow {
          margin-bottom: 5px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          opacity: 0.72;
        }

        .dashboard-header h1 {
          margin: 0;
          font-size: 26px;
          line-height: 1.15;
          font-weight: 800;
        }

        .dashboard-header p {
          margin: 7px 0 0;
          max-width: 680px;
          font-size: 13px;
          line-height: 1.5;
          opacity: 0.86;
        }

        .dashboard-user {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          font-size: 11px;
          font-weight: 700;
          opacity: 0.82;
        }

        .dashboard-refresh {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 16px;
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 10px;
          background: rgba(255,255,255,0.13);
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition:
            background 0.2s ease,
            transform 0.2s ease;
        }

        .dashboard-refresh:hover {
          background: rgba(255,255,255,0.2);
          transform: translateY(-1px);
        }

        .dashboard-refresh:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        .dashboard-refresh span {
          font-size: 17px;
          line-height: 1;
        }

        .dashboard-error {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
          padding: 13px 15px;
          border: 1px solid #f0c7c2;
          border-radius: 12px;
          background: #fff4f2;
          color: #8f3028;
          font-size: 12px;
        }

        .dashboard-error strong {
          white-space: nowrap;
        }

        .dashboard-error span {
          flex: 1;
          color: #a24b43;
        }

        .dashboard-error button {
          border: 0;
          background: transparent;
          color: #8f3028;
          font-weight: 800;
          cursor: pointer;
          text-decoration: underline;
        }

        .dashboard-section {
          margin-bottom: 18px;
        }

        .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 12px;
        }

        .section-heading h2 {
          margin: 0;
          color: #17322c;
          font-size: 17px;
          font-weight: 800;
        }

        .section-heading span {
          display: block;
          margin-top: 4px;
          color: #6b7f78;
          font-size: 12px;
        }

        .dashboard-kpi-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 15px;
        }

        .dashboard-kpi-card {
          display: block;
          min-width: 0;
          min-height: 166px;
          padding: 18px;
          border: 1px solid #dfe9e5;
          border-radius: 15px;
          background: #ffffff;
          text-decoration: none;
          box-shadow:
            0 4px 14px rgba(23, 50, 44, 0.035);
          transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .dashboard-kpi-card:hover {
          transform: translateY(-3px);
          border-color: #b8d8cf;
          box-shadow:
            0 10px 24px rgba(23, 50, 44, 0.08);
        }

        .dashboard-kpi-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .dashboard-kpi-icon {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: #eaf5f2;
          color: #00695c;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        .dashboard-kpi-arrow {
          color: #a2b6b0;
          font-size: 18px;
          transition: transform 0.2s ease;
        }

        .dashboard-kpi-card:hover
          .dashboard-kpi-arrow {
          transform: translateX(3px);
          color: #00695c;
        }

        .dashboard-kpi-label {
          margin-top: 17px;
          color: #6b7f78;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }

        .dashboard-kpi-value {
          margin-top: 5px;
          color: #17322c;
          font-size: 28px;
          line-height: 1.1;
          font-weight: 850;
          letter-spacing: -0.03em;
        }

        .dashboard-kpi-value-money {
          font-size: 19px;
          letter-spacing: -0.02em;
        }

        .dashboard-kpi-note {
          margin-top: 8px;
          color: #7c8e89;
          font-size: 11px;
          font-weight: 600;
        }

        .dashboard-secondary-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 18px;
        }

        .dashboard-secondary-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px;
          border: 1px solid #dfe9e5;
          border-radius: 13px;
          background: #f9fbfa;
          text-decoration: none;
          transition:
            background 0.2s ease,
            border-color 0.2s ease,
            transform 0.2s ease;
        }

        .dashboard-secondary-card:hover {
          background: #ffffff;
          border-color: #b8d8cf;
          transform: translateY(-2px);
        }

        .dashboard-secondary-card > div {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .dashboard-secondary-label {
          color: #6b7f78;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .dashboard-secondary-card strong {
          margin-top: 4px;
          color: #17322c;
          font-size: 22px;
          line-height: 1;
        }

        .dashboard-secondary-card small {
          margin-top: 5px;
          color: #8a9b96;
          font-size: 10px;
        }

        .dashboard-secondary-arrow {
          color: #8bc63f;
          font-size: 18px;
          font-weight: 800;
        }

        .dashboard-month-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
          padding: 16px 18px;
          border: 1px solid #d8e9c0;
          border-radius: 14px;
          background: #eef7df;
        }

        .dashboard-month-strip > div:first-child {
          min-width: 170px;
        }

        .dashboard-month-strip strong {
          display: block;
          color: #17483f;
          font-size: 13px;
          font-weight: 800;
        }

        .dashboard-month-strip span {
          display: block;
          margin-top: 3px;
          color: #6e8176;
          font-size: 11px;
        }

        .dashboard-month-metrics {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(90px, 1fr));
          gap: 10px;
          flex: 1;
        }

        .dashboard-month-metrics > div {
          padding-left: 15px;
          border-left: 1px solid #d4e4bd;
        }

        .dashboard-month-metrics strong {
          font-size: 17px;
        }

        .dashboard-month-metrics span {
          font-size: 10px;
        }

        .dashboard-two-column {
          display: grid;
          grid-template-columns:
            minmax(0, 1.25fr)
            minmax(320px, 0.75fr);
          gap: 18px;
          margin-bottom: 18px;
        }

        .dashboard-card {
          min-width: 0;
          padding: 20px;
          border: 1px solid #dfe9e5;
          border-radius: 16px;
          background: #ffffff;
          box-shadow:
            0 4px 14px rgba(23, 50, 44, 0.03);
        }

        .dashboard-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
          margin-bottom: 18px;
        }

        .dashboard-card-eyebrow {
          margin-bottom: 4px;
          color: #8aa099;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.13em;
        }

        .dashboard-card h2 {
          margin: 0;
          color: #17322c;
          font-size: 17px;
          font-weight: 800;
        }

        .dashboard-card-header p {
          margin: 5px 0 0;
          color: #788b85;
          font-size: 11px;
          line-height: 1.5;
        }

        .dashboard-outline-button {
          flex: 0 0 auto;
          padding: 8px 11px;
          border: 1px solid #dfe9e5;
          border-radius: 9px;
          color: #00695c;
          background: #f8fbfa;
          text-decoration: none;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .dashboard-outline-button:hover {
          border-color: #b8d8cf;
          background: #eaf5f2;
        }

        .performance-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          border: 1px solid #e5ece9;
          border-radius: 12px;
          overflow: hidden;
        }

        .performance-item {
          min-width: 0;
          padding: 16px 12px;
          text-align: center;
          border-right: 1px solid #e5ece9;
        }

        .performance-item:last-child {
          border-right: 0;
        }

        .performance-icon {
          width: 32px;
          height: 32px;
          margin: 0 auto 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #eaf5f2;
          color: #00695c;
          font-size: 8px;
          font-weight: 900;
        }

        .performance-item strong {
          display: block;
          color: #17322c;
          font-size: 20px;
          line-height: 1;
        }

        .performance-item span {
          display: block;
          margin-top: 5px;
          color: #7b8d87;
          font-size: 9px;
          line-height: 1.3;
        }

        .attention-list {
          border-top: 1px solid #edf1ef;
        }

        .attention-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 13px 0;
          border-bottom: 1px solid #edf1ef;
          text-decoration: none;
        }

        .attention-row:last-child {
          border-bottom: 0;
        }

        .attention-row-left {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }

        .attention-dot {
          width: 31px;
          height: 31px;
          flex: 0 0 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #f2f7f5;
          color: #00695c;
          font-size: 8px;
          font-weight: 900;
        }

        .attention-row-left div:last-child {
          min-width: 0;
        }

        .attention-row-left strong {
          display: block;
          color: #25423a;
          font-size: 11px;
        }

        .attention-row-left span {
          display: block;
          margin-top: 3px;
          color: #8a9a95;
          font-size: 9px;
        }

        .attention-number {
          color: #00695c;
          font-size: 18px;
        }

        .dashboard-quick-actions {
          margin-bottom: 18px;
        }

        .quick-action-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 11px;
        }

        .quick-action {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          padding: 13px;
          border: 1px solid #e2eae7;
          border-radius: 11px;
          background: #fafcfb;
          color: inherit;
          text-decoration: none;
          transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            background 0.2s ease;
        }

        .quick-action:hover {
          transform: translateY(-2px);
          border-color: #b8d8cf;
          background: #ffffff;
        }

        .quick-action-icon {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #eaf5f2;
          color: #00695c;
          font-size: 8px;
          font-weight: 900;
        }

        .quick-action > div:nth-child(2) {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
        }

        .quick-action strong {
          color: #25423a;
          font-size: 11px;
        }

        .quick-action div span {
          margin-top: 2px;
          color: #8a9a95;
          font-size: 9px;
        }

        .quick-action > span:last-child {
          color: #8bc63f;
          font-size: 16px;
          font-weight: 800;
        }

        .dashboard-admin-note {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 4px 2px 10px;
          color: #6b7f78;
          font-size: 10px;
        }

        .dashboard-admin-note strong {
          color: #17483f;
        }

        @media (max-width: 1100px) {
          .dashboard-kpi-grid,
          .dashboard-secondary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .dashboard-two-column {
            grid-template-columns: 1fr;
          }

          .quick-action-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .dashboard-header {
            align-items: flex-start;
            flex-direction: column;
            padding: 20px;
          }

          .dashboard-refresh {
            width: 100%;
          }

          .dashboard-month-strip {
            align-items: flex-start;
            flex-direction: column;
          }

          .dashboard-month-metrics {
            width: 100%;
          }

          .performance-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .performance-item:nth-child(2) {
            border-right: 0;
          }

          .performance-item:nth-child(-n + 2) {
            border-bottom: 1px solid #e5ece9;
          }
        }

        @media (max-width: 560px) {
          .dashboard-kpi-grid,
          .dashboard-secondary-grid,
          .quick-action-grid {
            grid-template-columns: 1fr;
          }

          .dashboard-header-left {
            align-items: flex-start;
          }

          .dashboard-avatar {
            width: 46px;
            height: 46px;
            flex-basis: 46px;
          }

          .dashboard-header h1 {
            font-size: 22px;
          }

          .dashboard-month-metrics {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .dashboard-month-metrics > div:nth-child(3) {
            border-left: 0;
          }

          .dashboard-card {
            padding: 16px;
          }

          .dashboard-card-header {
            flex-direction: column;
          }

          .dashboard-outline-button {
            width: 100%;
            text-align: center;
          }
        }

      `}</style>
    </main>
  );
}