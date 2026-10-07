"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Lead = {
  id: string;
  status: string | null;
  next_follow_up_at: string | null;
  created_at: string | null;
};

type Admission = {
  id: string;
  stage: string | null;
  created_at: string | null;
};

type Opportunity = {
  id: string;
  value: number | null;
  status: string | null;
  probability: number | null;
};

type Task = {
  id: string;
  due_at: string | null;
  status: string | null;
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
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function DashboardPage() {
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

      const [l, a, o, t] = await Promise.all([
        supabase.from("leads").select("id,status,next_follow_up_at,created_at"),
        supabase.from("admissions").select("id,stage,created_at"),
        supabase.from("opportunities").select("id,value,status,probability"),
        supabase.from("tasks").select("id,due_at,status"),
      ]);

      const firstError = [l, a, o, t].find((result) => result.error);
      if (firstError?.error) throw new Error(firstError.error.message);

      setLeads((l.data || []) as Lead[]);
      setAdmissions((a.data || []) as Admission[]);
      setOpportunities((o.data || []) as Opportunity[]);
      setTasks((t.data || []) as Task[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard.");
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
      (x) => (x.status || "").toLowerCase() === "open"
    );

    const forecast = openDeals.reduce(
      (sum, x) =>
        sum +
        Number(x.value || 0) * (Number(x.probability ?? 100) / 100),
      0
    );

    const followUps = leads.filter((lead) => {
      if (!lead.next_follow_up_at) return false;
      const status = (lead.status || "").toLowerCase();
      if (["converted", "lost", "unqualified"].includes(status)) return false;
      return new Date(lead.next_follow_up_at) <= endToday;
    }).length;

    const tasksToday = tasks.filter((task) => {
      if (!task.due_at) return false;
      if (["completed", "cancelled"].includes((task.status || "").toLowerCase())) {
        return false;
      }
      return sameDay(new Date(task.due_at), now);
    }).length;

    const interested = leads.filter(
      (lead) => (lead.status || "").toLowerCase() === "qualified"
    ).length;

    const enrolled = admissions.filter(
      (admission) => (admission.stage || "").toLowerCase() === "enrolled"
    ).length;

    return {
      leads: leads.length,
      interested,
      openDeals: openDeals.length,
      forecast,
      enrolled,
      followUps,
      tasksToday,
      newLeads: leads.filter((x) => isThisMonth(x.created_at)).length,
    };
  }, [leads, admissions, opportunities, tasks]);

  if (loading) {
    return (
      <main style={{ padding: 32 }}>
        <div className="crm-card" style={{ padding: 24 }}>Loading dashboard...</div>
      </main>
    );
  }

  return (
    <main style={{ padding: "28px 32px 48px", color: "#111827" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Dashboard</h1>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
              Quick view of today's CRM performance.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              setRefreshing(true);
              await loadDashboard();
            }}
            disabled={refreshing}
            className="crm-btn"
            style={{ visibility: "visible", opacity: 1 }}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: 12,
              borderRadius: 8,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <Link href="/leads" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="crm-kpi">
              <span className="crm-kpi-label">Total Leads</span>
              <div className="crm-kpi-value">{stats.leads}</div>
              <span className="crm-kpi-change">+{stats.newLeads} this month</span>
            </div>
          </Link>

          <Link href="/leads" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="crm-kpi">
              <span className="crm-kpi-label">Interested</span>
              <div className="crm-kpi-value">{stats.interested}</div>
              <span className="crm-kpi-change">Qualified leads</span>
            </div>
          </Link>

          <Link href="/pipeline" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="crm-kpi">
              <span className="crm-kpi-label">Open Deals</span>
              <div className="crm-kpi-value">{stats.openDeals}</div>
              <span className="crm-kpi-change">Active opportunities</span>
            </div>
          </Link>

          <div className="crm-kpi">
            <span className="crm-kpi-label">Forecast</span>
            <div className="crm-kpi-value" style={{ fontSize: 20 }}>{money(stats.forecast)}</div>
            <span className="crm-kpi-change">Weighted pipeline</span>
          </div>

          <Link href="/customers" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="crm-kpi">
              <span className="crm-kpi-label">Enrolled</span>
              <div className="crm-kpi-value">{stats.enrolled}</div>
              <span className="crm-kpi-change">Current admissions</span>
            </div>
          </Link>

          <Link href="/leads" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="crm-kpi">
              <span className="crm-kpi-label">Follow-ups</span>
              <div className="crm-kpi-value">{stats.followUps}</div>
              <span className="crm-kpi-change">
                {stats.followUps ? "Needs attention" : "Nothing due"}
              </span>
            </div>
          </Link>
        </div>

        <div
          className="crm-card"
          style={{
            padding: "16px 20px",
            marginBottom: 18,
            fontSize: 14,
            color: "#475569",
          }}
        >
          <strong style={{ color: "#111827" }}>This month:</strong>{" "}
          {stats.newLeads} new leads · {stats.interested} interested ·{" "}
          {stats.enrolled} enrolled · {stats.tasksToday} tasks due today
        </div>

        <div className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2 style={{ margin: 0 }}>Today's Attention</h2>
              <span>Only the items that need action now.</span>
            </div>
            <Link href="/reports" className="crm-btn secondary" style={{ textDecoration: "none" }}>
              View Reports
            </Link>
          </div>
          <div className="crm-card-body">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                gap: 12,
              }}
            >
              <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 8 }}>
                <strong>{stats.followUps}</strong>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                  Follow-ups due
                </div>
              </div>
              <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 8 }}>
                <strong>{stats.tasksToday}</strong>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                  Tasks due today
                </div>
              </div>
              <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 8 }}>
                <strong>{stats.interested}</strong>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                  Interested leads
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
