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

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profileData) {
        throw new Error("Your CRM profile could not be found.");
      }

      const currentProfile = profileData as Profile;

      setProfile(currentProfile);

      const isSalesperson = currentProfile.role === "salesperson";

      /*
       * SALESPEOPLE
       *
       * Only retrieve records assigned to the logged-in user.
       *
       * ADMIN / SUPER ADMIN / OTHER ROLES
       *
       * Retrieve all records available to their role.
       */
      let leadsQuery = supabase
        .from("leads")
        .select(
          "id,assigned_to,status,next_follow_up_at,created_at"
        );

      let admissionsQuery = supabase
        .from("admissions")
        .select("id,assigned_to,stage,created_at");

      let opportunitiesQuery = supabase
        .from("opportunities")
        .select("id,assigned_to,value,status,probability");

      let tasksQuery = supabase
        .from("tasks")
        .select("id,assigned_to,due_at,status");

      if (isSalesperson) {
        leadsQuery = leadsQuery.eq("assigned_to", user.id);

        admissionsQuery = admissionsQuery.eq(
          "assigned_to",
          user.id
        );

        opportunitiesQuery = opportunitiesQuery.eq(
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
        throw new Error(firstError.error.message);
      }

      setLeads((l.data || []) as Lead[]);
      setAdmissions((a.data || []) as Admission[]);
      setOpportunities((o.data || []) as Opportunity[]);
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
        (x.status || "").toLowerCase() === "open"
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

      const status = (x.status || "").toLowerCase();

      if (
        ["converted", "lost", "unqualified"].includes(
          status
        )
      ) {
        return false;
      }

      return (
        new Date(x.next_follow_up_at) <= endToday
      );
    }).length;

    const tasksToday = tasks.filter((x) => {
      if (!x.due_at) return false;

      const status = (
        x.status || ""
      ).toLowerCase();

      if (
        ["completed", "cancelled"].includes(status)
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
          <div
            className="ciu-card"
            style={{ padding: 24 }}
          >
            Loading dashboard...
          </div>
        </div>
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

  const kpis = [
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
    },

    {
      label: isSalesperson
        ? "My Interested"
        : "Interested",
      value: stats.interested,
      note: "Qualified leads",
      href: "/leads",
    },

    {
      label: isSalesperson
        ? "My Open Deals"
        : "Open Deals",
      value: stats.openDeals,
      note: "Active opportunities",
      href: "/pipeline",
    },

    {
      label: isSalesperson
        ? "My Forecast"
        : "Forecast",
      value: money(stats.forecast),
      note: "Weighted pipeline",
    },

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
      href: "/leads",
    },
  ];

  return (
    <main className="ciu-page">
      <div className="ciu-page-inner">

        <div className="ciu-hero">
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1>{dashboardTitle}</h1>

              <p>
                {dashboardSubtitle}
              </p>

              {profile && (
                <div
                  style={{
                    marginTop: 7,
                    fontSize: 12,
                    fontWeight: 600,
                    opacity: 0.82,
                  }}
                >
                  {profile.full_name ||
                    "CRM User"}{" "}
                  ·{" "}
                  {roleLabel(profile.role)}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={async () => {
                setRefreshing(true);
                await loadDashboard();
              }}
              disabled={refreshing}
              className="ciu-btn"
            >
              {refreshing
                ? "↻ Refreshing..."
                : "↻ Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 18,
              padding: 12,
              borderRadius: 10,
              background: "#fff3f2",
              border:
                "1px solid #f3c9c5",
              color: "#9b332b",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <div className="ciu-kpis">
          {kpis.map((k) =>
            k.href ? (
              <Link
                key={k.label}
                href={k.href}
                className="ciu-kpi"
              >
                <div className="ciu-kpi-label">
                  {k.label}
                </div>

                <div
                  className="ciu-kpi-value"
                  style={{
                    fontSize:
                      k.label.includes(
                        "Forecast"
                      )
                        ? 18
                        : 24,
                  }}
                >
                  {k.value}
                </div>

                <div className="ciu-kpi-note">
                  {k.note}
                </div>
              </Link>
            ) : (
              <div
                key={k.label}
                className="ciu-kpi"
              >
                <div className="ciu-kpi-label">
                  {k.label}
                </div>

                <div
                  className="ciu-kpi-value"
                  style={{ fontSize: 18 }}
                >
                  {k.value}
                </div>

                <div className="ciu-kpi-note">
                  {k.note}
                </div>
              </div>
            )
          )}
        </div>

        <div className="ciu-strip">
          <strong
            style={{ color: "#17483f" }}
          >
            {isSalesperson
              ? "My activity this month:"
              : "This month:"}
          </strong>{" "}
          {stats.newLeads} new leads ·{" "}
          {stats.interested} interested ·{" "}
          {stats.enrolled} enrolled ·{" "}
          {stats.tasksToday} tasks due today
        </div>

        <div
          className="ciu-card"
          style={{ marginBottom: 18 }}
        >
          <div className="ciu-card-head">
            <div>
              <h2>
                {isSalesperson
                  ? "My Performance"
                  : "Performance Overview"}
              </h2>

              <span>
                {isSalesperson
                  ? "Your current activity and conversion performance."
                  : "Current CRM activity and conversion performance."}
              </span>
            </div>

            <Link
              href="/reports"
              className="ciu-btn ciu-btn-light"
            >
              View Reports →
            </Link>
          </div>

          <div className="ciu-attention">
            <div className="ciu-attention-item">
              <strong>
                {stats.completedTasks}
              </strong>

              <span>
                Tasks completed
              </span>
            </div>

            <div className="ciu-attention-item">
              <strong>
                {stats.tasksToday}
              </strong>

              <span>
                Tasks due today
              </span>
            </div>

            <div className="ciu-attention-item">
              <strong>
                {stats.followUps}
              </strong>

              <span>
                Follow-ups due
              </span>
            </div>

            <div className="ciu-attention-item">
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
        </div>

        <div className="ciu-card">
          <div className="ciu-card-head">
            <div>
              <h2>
                Today's Attention
              </h2>

              <span>
                {isSalesperson
                  ? "Your items that need action now."
                  : "Items that need action now."}
              </span>
            </div>
          </div>

          <div className="ciu-attention">
            <div className="ciu-attention-item">
              <strong>
                {stats.followUps}
              </strong>

              <span>
                Follow-ups due
              </span>
            </div>

            <div className="ciu-attention-item">
              <strong>
                {stats.tasksToday}
              </strong>

              <span>
                Tasks due today
              </span>
            </div>

            <div className="ciu-attention-item">
              <strong>
                {stats.interested}
              </strong>

              <span>
                Interested leads
              </span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div
            style={{
              marginTop: 16,
              fontSize: 11,
              color: "#6b7f78",
            }}
          >
            Showing organization-wide CRM
            performance.
          </div>
        )}

      </div>
    </main>
  );
}