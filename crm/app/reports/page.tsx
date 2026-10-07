"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Period = "day" | "week" | "month";
type Profile = { id: string; full_name: string | null };
type Lead = { id: string; assigned_to: string | null; status: string | null; created_at: string | null };
type Admission = { id: string; assigned_to: string | null; stage: string | null; created_at: string | null };
type Task = {
  id: string;
  assigned_to: string | null;
  task_type: string | null;
  status: string | null;
  completed_at: string | null;
  created_at: string | null;
};

const supabase = createClient();

function getStart(period: Period, value: string) {
  const d = new Date(value + "T00:00:00");
  if (period === "day") return d;
  if (period === "week") {
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d;
  }
  d.setDate(1);
  return d;
}

function getEnd(period: Period, value: string) {
  const d = getStart(period, value);
  if (period === "day") d.setDate(d.getDate() + 1);
  else if (period === "week") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  d.setMilliseconds(-1);
  return d;
}

function inPeriod(value: string | null, start: Date, end: Date) {
  if (!value) return false;
  const d = new Date(value);
  return d >= start && d <= end;
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadReport() {
    try {
      setError("");
      const [p, l, a, t] = await Promise.all([
        supabase.from("profiles").select("id,full_name").eq("is_active", true).order("full_name"),
        supabase.from("leads").select("id,assigned_to,status,created_at"),
        supabase.from("admissions").select("id,assigned_to,stage,created_at"),
        supabase.from("tasks").select("id,assigned_to,task_type,status,completed_at,created_at"),
      ]);
      const failed = [p, l, a, t].find((x) => x.error);
      if (failed?.error) throw new Error(failed.error.message);
      setProfiles((p.data || []) as Profile[]);
      setLeads((l.data || []) as Lead[]);
      setAdmissions((a.data || []) as Admission[]);
      setTasks((t.data || []) as Task[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load performance report.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadReport(); }, []);

  const report = useMemo(() => {
    const start = getStart(period, selectedDate);
    const end = getEnd(period, selectedDate);

    const rows = profiles.map((profile) => {
      const staffLeads = leads.filter(
        (x) => x.assigned_to === profile.id && inPeriod(x.created_at, start, end)
      );
      const staffAdmissions = admissions.filter(
        (x) => x.assigned_to === profile.id && inPeriod(x.created_at, start, end)
      );
      const activities = tasks.filter(
        (x) => x.assigned_to === profile.id && inPeriod(x.created_at, start, end)
      );
      const completedTasks = tasks.filter(
        (x) =>
          x.assigned_to === profile.id &&
          x.status === "completed" &&
          inPeriod(x.completed_at || x.created_at, start, end)
      );

      const calls = activities.filter((x) => x.task_type === "call").length;
      const followUps = activities.filter((x) =>
        ["call", "whatsapp", "email"].includes((x.task_type || "").toLowerCase())
      ).length;
      const interested = staffLeads.filter((x) => x.status === "qualified").length;

      const applications = staffAdmissions.filter((x) =>
        ["application started", "application submitted", "admitted", "acceptance paid", "enrolled"]
          .includes((x.stage || "").toLowerCase())
      ).length;
      const submitted = staffAdmissions.filter((x) =>
        ["application submitted", "admitted", "acceptance paid", "enrolled"]
          .includes((x.stage || "").toLowerCase())
      ).length;
      const admitted = staffAdmissions.filter((x) =>
        ["admitted", "acceptance paid", "enrolled"].includes((x.stage || "").toLowerCase())
      ).length;
      const acceptancePaid = staffAdmissions.filter((x) =>
        ["acceptance paid", "enrolled"].includes((x.stage || "").toLowerCase())
      ).length;
      const enrolled = staffAdmissions.filter(
        (x) => (x.stage || "").toLowerCase() === "enrolled"
      ).length;

      return {
        id: profile.id,
        name: profile.full_name || "Unnamed Staff",
        leads: staffLeads.length,
        calls,
        followUps,
        interested,
        applications,
        submitted,
        admitted,
        acceptancePaid,
        enrolled,
        completedTasks: completedTasks.length,
        conversion: staffLeads.length ? Math.round((enrolled / staffLeads.length) * 1000) / 10 : 0,
      };
    });

    const totalLeads = rows.reduce((s, x) => s + x.leads, 0);
    const totalEnrolled = rows.reduce((s, x) => s + x.enrolled, 0);

    return {
      rows,
      totalLeads,
      totalCalls: rows.reduce((s, x) => s + x.calls, 0),
      totalFollowUps: rows.reduce((s, x) => s + x.followUps, 0),
      totalInterested: rows.reduce((s, x) => s + x.interested, 0),
      totalApplications: rows.reduce((s, x) => s + x.applications, 0),
      totalSubmitted: rows.reduce((s, x) => s + x.submitted, 0),
      totalAdmitted: rows.reduce((s, x) => s + x.admitted, 0),
      totalAcceptancePaid: rows.reduce((s, x) => s + x.acceptancePaid, 0),
      totalEnrolled,
      totalCompletedTasks: rows.reduce((s, x) => s + x.completedTasks, 0),
      totalConversion: totalLeads ? Math.round((totalEnrolled / totalLeads) * 1000) / 10 : 0,
      start,
      end,
    };
  }, [period, selectedDate, profiles, leads, admissions, tasks]);

  if (loading) {
    return <main style={{ padding: 32 }}><div className="crm-card" style={{ padding: 24 }}>Loading performance report...</div></main>;
  }

  return (
    <main style={{ padding: "28px 32px 48px", color: "#111827" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Performance Reports</h1>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
              Staff performance summary by day, week or month.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              style={{ minHeight: 40, padding: "0 12px", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff" }}
            >
              <option value="day">Per Day</option>
              <option value="week">Per Week</option>
              <option value="month">Per Month</option>
            </select>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ minHeight: 40, padding: "0 12px", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff" }}
            />
            <button
              type="button"
              onClick={async () => { setRefreshing(true); await loadReport(); }}
              disabled={refreshing}
              className="crm-btn"
              style={{ visibility: "visible", opacity: 1 }}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 18, padding: 12, borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
            {error}
          </div>
        )}

        <div className="crm-card" style={{ padding: "16px 20px", marginBottom: 18, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <strong>{period === "day" ? "Daily" : period === "week" ? "Weekly" : "Monthly"} Performance</strong>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
              {report.start.toLocaleDateString("en-UG")} – {report.end.toLocaleDateString("en-UG")}
            </div>
          </div>
          <span style={{ color: "#64748b", fontSize: 13 }}>{report.rows.length} active staff</span>
        </div>

        <div className="crm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="crm-card-header" style={{ padding: "18px 20px" }}>
            <div>
              <h2 style={{ margin: 0 }}>Staff Performance</h2>
              <span>Summary of work and admissions results for each person.</span>
            </div>
          </div>
          <div className="crm-table-wrap">
            <table className="crm-table" style={{ minWidth: 1250 }}>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Leads</th>
                  <th>Calls</th>
                  <th>Follow-ups</th>
                  <th>Interested</th>
                  <th>Applications</th>
                  <th>Submitted</th>
                  <th>Admitted</th>
                  <th>Acceptance Paid</th>
                  <th>Enrolled</th>
                  <th>Tasks Done</th>
                  <th>Conversion</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length ? report.rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.name}</strong></td>
                    <td>{row.leads}</td>
                    <td>{row.calls}</td>
                    <td>{row.followUps}</td>
                    <td>{row.interested}</td>
                    <td>{row.applications}</td>
                    <td>{row.submitted}</td>
                    <td>{row.admitted}</td>
                    <td>{row.acceptancePaid}</td>
                    <td><strong>{row.enrolled}</strong></td>
                    <td>{row.completedTasks}</td>
                    <td>{row.conversion}%</td>
                  </tr>
                )) : (
                  <tr><td colSpan={12} style={{ textAlign: "center", padding: 30 }}>No active staff found.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>TOTAL</strong></td>
                  <td><strong>{report.totalLeads}</strong></td>
                  <td><strong>{report.totalCalls}</strong></td>
                  <td><strong>{report.totalFollowUps}</strong></td>
                  <td><strong>{report.totalInterested}</strong></td>
                  <td><strong>{report.totalApplications}</strong></td>
                  <td><strong>{report.totalSubmitted}</strong></td>
                  <td><strong>{report.totalAdmitted}</strong></td>
                  <td><strong>{report.totalAcceptancePaid}</strong></td>
                  <td><strong>{report.totalEnrolled}</strong></td>
                  <td><strong>{report.totalCompletedTasks}</strong></td>
                  <td><strong>{report.totalConversion}%</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <p style={{ marginTop: 12, color: "#64748b", fontSize: 12 }}>
          Activity counts use records created or completed in the selected period. Admission counts use the current stage of admission records created in that period.
        </p>
      </div>
    </main>
  );
}
