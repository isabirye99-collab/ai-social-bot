"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Period = "day" | "week" | "month";

type Profile = {
  id: string;
  full_name: string | null;
  role?: string | null;
};

type Lead = {
  id: string;
  assigned_to: string | null;
  status: string | null;
  created_at: string | null;
};

type Admission = {
  id: string;
  assigned_to: string | null;
  stage: string | null;
  created_at: string | null;
};

type Task = {
  id: string;
  assigned_to: string | null;
  task_type: string | null;
  status: string | null;
  completed_at: string | null;
  created_at: string | null;
};

type ReportRow = {
  id: string;
  name: string;
  leads: number;
  calls: number;
  followUps: number;
  interested: number;
  applications: number;
  submitted: number;
  admitted: number;
  acceptancePaid: number;
  enrolled: number;
  completedTasks: number;
  conversion: number;
};

const supabase = createClient();

function getStart(period: Period, value: string) {
  const d = new Date(`${value}T00:00:00`);

  if (period === "day") {
    return d;
  }

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

  if (period === "day") {
    d.setDate(d.getDate() + 1);
  } else if (period === "week") {
    d.setDate(d.getDate() + 7);
  } else {
    d.setMonth(d.getMonth() + 1);
  }

  d.setMilliseconds(-1);

  return d;
}

function inPeriod(
  value: string | null,
  start: Date,
  end: Date
) {
  if (!value) return false;

  const d = new Date(value);

  return d >= start && d <= end;
}

function titleCase(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function periodLabel(period: Period) {
  if (period === "day") return "Daily";
  if (period === "week") return "Weekly";
  return "Monthly";
}

function formatDate(value: Date) {
  return value.toLocaleDateString("en-UG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("month");

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [currentUserId, setCurrentUserId] = useState("");
  const [currentRole, setCurrentRole] = useState("");

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

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("You are not signed in.");
      }

      setCurrentUserId(user.id);

      const { data: currentProfile, error: profileError } =
        await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message);
      }

      const role = currentProfile?.role || "";

      setCurrentRole(role);

      const isSalesperson = role === "salesperson";

      const profilesQuery = supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("is_active", true)
        .order("full_name");

      const leadsQuery = supabase
        .from("leads")
        .select("id,assigned_to,status,created_at");

      const admissionsQuery = supabase
        .from("admissions")
        .select("id,assigned_to,stage,created_at");

      const tasksQuery = supabase
        .from("tasks")
        .select(
          "id,assigned_to,task_type,status,completed_at,created_at"
        );

      if (isSalesperson) {
        leadsQuery.eq("assigned_to", user.id);
        admissionsQuery.eq("assigned_to", user.id);
        tasksQuery.eq("assigned_to", user.id);
      }

      const [p, l, a, t] = await Promise.all([
        profilesQuery,
        leadsQuery,
        admissionsQuery,
        tasksQuery,
      ]);

      const failed = [p, l, a, t].find((result) => result.error);

      if (failed?.error) {
        throw new Error(failed.error.message);
      }

      if (isSalesperson) {
        setProfiles(
          currentProfile
            ? [
                {
                  id: currentProfile.id,
                  full_name: currentProfile.full_name,
                  role: currentProfile.role,
                },
              ]
            : []
        );
      } else {
        setProfiles((p.data || []) as Profile[]);
      }

      setLeads((l.data || []) as Lead[]);
      setAdmissions((a.data || []) as Admission[]);
      setTasks((t.data || []) as Task[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load performance report."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, []);

  const report = useMemo(() => {
    const start = getStart(period, selectedDate);
    const end = getEnd(period, selectedDate);

    const rows: ReportRow[] = profiles
      .filter((profile) => {
        if (currentRole === "salesperson") {
          return profile.id === currentUserId;
        }

        return true;
      })
      .map((profile) => {
        const staffLeads = leads.filter(
          (lead) =>
            lead.assigned_to === profile.id &&
            inPeriod(lead.created_at, start, end)
        );

        const staffAdmissions = admissions.filter(
          (admission) =>
            admission.assigned_to === profile.id &&
            inPeriod(admission.created_at, start, end)
        );

        const staffTasks = tasks.filter(
          (task) =>
            task.assigned_to === profile.id &&
            inPeriod(task.created_at, start, end)
        );

        const completedTasks = tasks.filter(
          (task) =>
            task.assigned_to === profile.id &&
            task.status === "completed" &&
            inPeriod(
              task.completed_at || task.created_at,
              start,
              end
            )
        );

        const calls = staffTasks.filter(
          (task) =>
            (task.task_type || "").toLowerCase() === "call"
        ).length;

        const followUps = staffTasks.filter((task) =>
          ["call", "whatsapp", "email"].includes(
            (task.task_type || "").toLowerCase()
          )
        ).length;

        const interested = staffLeads.filter(
          (lead) =>
            (lead.status || "").toLowerCase() === "qualified"
        ).length;

        const applications = staffAdmissions.filter((admission) =>
          [
            "application started",
            "application submitted",
            "admitted",
            "acceptance paid",
            "enrolled",
          ].includes(
            (admission.stage || "").toLowerCase()
          )
        ).length;

        const submitted = staffAdmissions.filter((admission) =>
          [
            "application submitted",
            "admitted",
            "acceptance paid",
            "enrolled",
          ].includes(
            (admission.stage || "").toLowerCase()
          )
        ).length;

        const admitted = staffAdmissions.filter((admission) =>
          [
            "admitted",
            "acceptance paid",
            "enrolled",
          ].includes(
            (admission.stage || "").toLowerCase()
          )
        ).length;

        const acceptancePaid = staffAdmissions.filter(
          (admission) =>
            ["acceptance paid", "enrolled"].includes(
              (admission.stage || "").toLowerCase()
            )
        ).length;

        const enrolled = staffAdmissions.filter(
          (admission) =>
            (admission.stage || "").toLowerCase() ===
            "enrolled"
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
          conversion: staffLeads.length
            ? Math.round(
                (enrolled / staffLeads.length) * 1000
              ) / 10
            : 0,
        };
      });

    const totalLeads = rows.reduce(
      (sum, row) => sum + row.leads,
      0
    );

    const totalCalls = rows.reduce(
      (sum, row) => sum + row.calls,
      0
    );

    const totalFollowUps = rows.reduce(
      (sum, row) => sum + row.followUps,
      0
    );

    const totalInterested = rows.reduce(
      (sum, row) => sum + row.interested,
      0
    );

    const totalApplications = rows.reduce(
      (sum, row) => sum + row.applications,
      0
    );

    const totalSubmitted = rows.reduce(
      (sum, row) => sum + row.submitted,
      0
    );

    const totalAdmitted = rows.reduce(
      (sum, row) => sum + row.admitted,
      0
    );

    const totalAcceptancePaid = rows.reduce(
      (sum, row) => sum + row.acceptancePaid,
      0
    );

    const totalEnrolled = rows.reduce(
      (sum, row) => sum + row.enrolled,
      0
    );

    const totalCompletedTasks = rows.reduce(
      (sum, row) => sum + row.completedTasks,
      0
    );

    const totalConversion = totalLeads
      ? Math.round(
          (totalEnrolled / totalLeads) * 1000
        ) / 10
      : 0;

    return {
      rows,
      totalLeads,
      totalCalls,
      totalFollowUps,
      totalInterested,
      totalApplications,
      totalSubmitted,
      totalAdmitted,
      totalAcceptancePaid,
      totalEnrolled,
      totalCompletedTasks,
      totalConversion,
      start,
      end,
    };
  }, [
    period,
    selectedDate,
    profiles,
    leads,
    admissions,
    tasks,
    currentRole,
    currentUserId,
  ]);

  const isSalesperson = currentRole === "salesperson";

  const topPerformer = useMemo(() => {
    if (!report.rows.length) return null;

    return [...report.rows].sort(
      (a, b) =>
        b.enrolled - a.enrolled ||
        b.conversion - a.conversion ||
        b.leads - a.leads
    )[0];
  }, [report.rows]);

  if (loading) {
    return (
      <main className="ciu-page">
        <div className="ciu-page-inner">
          <div className="report-loading">
            <div className="loading-dot" />
            <strong>Loading performance report...</strong>
            <span>
              Preparing your admissions and activity
              performance.
            </span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="ciu-page">
      <div className="ciu-page-inner">
        <section className="report-hero">
          <div className="report-hero-content">
            <div>
              <div className="report-eyebrow">
                CIU BUSINESS DEVELOPMENT
              </div>

              <h1>
                {isSalesperson
                  ? "My Performance Report"
                  : "Staff Performance Reports"}
              </h1>

              <p>
                {isSalesperson
                  ? "Monitor your lead generation, follow-ups and admissions performance."
                  : "Monitor lead generation, staff activity and admissions performance across the team."}
              </p>
            </div>

            <div className="report-controls">
              <select
                value={period}
                onChange={(event) =>
                  setPeriod(
                    event.target.value as Period
                  )
                }
                className="report-select"
              >
                <option value="day">Per Day</option>
                <option value="week">Per Week</option>
                <option value="month">Per Month</option>
              </select>

              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  setSelectedDate(event.target.value)
                }
                className="report-select"
              />

              <button
                type="button"
                onClick={async () => {
                  setRefreshing(true);
                  await loadReport();
                }}
                disabled={refreshing}
                className="report-refresh"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="report-error">
            <strong>Unable to load report</strong>
            <span>{error}</span>
          </div>
        )}

        <section className="period-banner">
          <div>
            <span className="period-label">
              {periodLabel(period)}{" "}
              {isSalesperson
                ? "Personal Performance"
                : "Team Performance"}
            </span>

            <strong>
              {formatDate(report.start)}
              {" — "}
              {formatDate(report.end)}
            </strong>
          </div>

          <div className="period-meta">
            {isSalesperson
              ? "Your performance"
              : `${report.rows.length} active staff`}
          </div>
        </section>

        <section className="report-kpis">
          <div className="report-kpi">
            <span className="kpi-label">Leads</span>
            <strong>{report.totalLeads}</strong>
            <small>New leads in period</small>
          </div>

          <div className="report-kpi">
            <span className="kpi-label">Calls</span>
            <strong>{report.totalCalls}</strong>
            <small>Call activities</small>
          </div>

          <div className="report-kpi">
            <span className="kpi-label">Follow-ups</span>
            <strong>{report.totalFollowUps}</strong>
            <small>Call, WhatsApp & email</small>
          </div>

          <div className="report-kpi">
            <span className="kpi-label">Interested</span>
            <strong>{report.totalInterested}</strong>
            <small>Qualified prospects</small>
          </div>

          <div className="report-kpi">
            <span className="kpi-label">Applications</span>
            <strong>{report.totalApplications}</strong>
            <small>Application activity</small>
          </div>

          <div className="report-kpi">
            <span className="kpi-label">Admitted</span>
            <strong>{report.totalAdmitted}</strong>
            <small>Admissions reached</small>
          </div>

          <div className="report-kpi">
            <span className="kpi-label">Acceptance Paid</span>
            <strong>
              {report.totalAcceptancePaid}
            </strong>
            <small>Acceptance confirmed</small>
          </div>

          <div className="report-kpi report-kpi-primary">
            <span className="kpi-label">Enrolled</span>
            <strong>{report.totalEnrolled}</strong>
            <small>Successful enrolments</small>
          </div>

          <div className="report-kpi">
            <span className="kpi-label">Tasks Done</span>
            <strong>
              {report.totalCompletedTasks}
            </strong>
            <small>Completed tasks</small>
          </div>

          <div className="report-kpi report-kpi-conversion">
            <span className="kpi-label">Conversion</span>
            <strong>{report.totalConversion}%</strong>
            <small>Lead to enrolment</small>
          </div>
        </section>

        <section className="report-main-grid">
          <div className="ciu-card">
            <div className="ciu-card-head report-card-head">
              <div>
                <h2>Admissions Funnel</h2>
                <span>
                  Movement from applications to
                  successful enrolment.
                </span>
              </div>
            </div>

            <div className="funnel">
              <div className="funnel-row">
                <div>
                  <span>Leads</span>
                  <strong>{report.totalLeads}</strong>
                </div>
                <div className="funnel-bar">
                  <span style={{ width: "100%" }} />
                </div>
              </div>

              <div className="funnel-row">
                <div>
                  <span>Applications</span>
                  <strong>
                    {report.totalApplications}
                  </strong>
                </div>
                <div className="funnel-bar">
                  <span
                    style={{
                      width: `${
                        report.totalLeads
                          ? Math.min(
                              100,
                              (report.totalApplications /
                                report.totalLeads) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="funnel-row">
                <div>
                  <span>Submitted</span>
                  <strong>
                    {report.totalSubmitted}
                  </strong>
                </div>
                <div className="funnel-bar">
                  <span
                    style={{
                      width: `${
                        report.totalLeads
                          ? Math.min(
                              100,
                              (report.totalSubmitted /
                                report.totalLeads) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="funnel-row">
                <div>
                  <span>Admitted</span>
                  <strong>
                    {report.totalAdmitted}
                  </strong>
                </div>
                <div className="funnel-bar">
                  <span
                    style={{
                      width: `${
                        report.totalLeads
                          ? Math.min(
                              100,
                              (report.totalAdmitted /
                                report.totalLeads) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="funnel-row">
                <div>
                  <span>Acceptance Paid</span>
                  <strong>
                    {report.totalAcceptancePaid}
                  </strong>
                </div>
                <div className="funnel-bar">
                  <span
                    style={{
                      width: `${
                        report.totalLeads
                          ? Math.min(
                              100,
                              (report.totalAcceptancePaid /
                                report.totalLeads) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="funnel-row funnel-row-final">
                <div>
                  <span>Enrolled</span>
                  <strong>
                    {report.totalEnrolled}
                  </strong>
                </div>
                <div className="funnel-bar">
                  <span
                    style={{
                      width: `${
                        report.totalLeads
                          ? Math.min(
                              100,
                              (report.totalEnrolled /
                                report.totalLeads) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="ciu-card">
            <div className="ciu-card-head report-card-head">
              <div>
                <h2>Performance Highlight</h2>
                <span>
                  Strongest performer for the selected
                  period.
                </span>
              </div>
            </div>

            {topPerformer ? (
              <div className="highlight">
                <div className="highlight-avatar">
                  {topPerformer.name
                    .split(" ")
                    .map((part) => part.charAt(0))
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div className="highlight-name">
                  <strong>{topPerformer.name}</strong>

                  <span>
                    {isSalesperson
                      ? "Your current performance"
                      : "Top enrolment performance"}
                  </span>
                </div>

                <div className="highlight-stat">
                  <strong>
                    {topPerformer.enrolled}
                  </strong>
                  <span>Enrolled</span>
                </div>

                <div className="highlight-stat">
                  <strong>
                    {topPerformer.conversion}%
                  </strong>
                  <span>Conversion</span>
                </div>

                <div className="highlight-stat">
                  <strong>
                    {topPerformer.leads}
                  </strong>
                  <span>Leads</span>
                </div>
              </div>
            ) : (
              <div className="empty-highlight">
                No performance data available for the
                selected period.
              </div>
            )}

            <div className="mini-summary">
              <div>
                <span>Submitted</span>
                <strong>
                  {report.totalSubmitted}
                </strong>
              </div>

              <div>
                <span>Acceptance Paid</span>
                <strong>
                  {report.totalAcceptancePaid}
                </strong>
              </div>

              <div>
                <span>Tasks Completed</span>
                <strong>
                  {report.totalCompletedTasks}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section className="ciu-card report-table-card">
          <div className="ciu-card-head report-card-head">
            <div>
              <h2>
                {isSalesperson
                  ? "My Performance"
                  : "Staff Performance"}
              </h2>

              <span>
                {isSalesperson
                  ? "Detailed summary of your activity and admissions results."
                  : "Detailed performance summary for every active staff member."}
              </span>
            </div>
          </div>

          <div className="report-table-scroll">
            <table className="report-table">
              <thead>
                <tr>
                  <th>
                    {isSalesperson
                      ? "Performance"
                      : "Staff Member"}
                  </th>
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
                {report.rows.length ? (
                  report.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="staff-cell">
                          <div className="staff-avatar">
                            {row.name
                              .split(" ")
                              .map((part) =>
                                part.charAt(0)
                              )
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>

                          <strong>{row.name}</strong>
                        </div>
                      </td>

                      <td>{row.leads}</td>
                      <td>{row.calls}</td>
                      <td>{row.followUps}</td>
                      <td>{row.interested}</td>
                      <td>{row.applications}</td>
                      <td>{row.submitted}</td>
                      <td>{row.admitted}</td>
                      <td>{row.acceptancePaid}</td>

                      <td>
                        <strong className="enrolled-value">
                          {row.enrolled}
                        </strong>
                      </td>

                      <td>{row.completedTasks}</td>

                      <td>
                        <span className="conversion-badge">
                          {row.conversion}%
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={12}
                      className="empty-table"
                    >
                      No performance records found for
                      the selected period.
                    </td>
                  </tr>
                )}
              </tbody>

              <tfoot>
                <tr>
                  <td>
                    <strong>
                      {isSalesperson
                        ? "MY TOTAL"
                        : "TOTAL"}
                    </strong>
                  </td>

                  <td>
                    <strong>
                      {report.totalLeads}
                    </strong>
                  </td>

                  <td>
                    <strong>
                      {report.totalCalls}
                    </strong>
                  </td>

                  <td>
                    <strong>
                      {report.totalFollowUps}
                    </strong>
                  </td>

                  <td>
                    <strong>
                      {report.totalInterested}
                    </strong>
                  </td>

                  <td>
                    <strong>
                      {report.totalApplications}
                    </strong>
                  </td>

                  <td>
                    <strong>
                      {report.totalSubmitted}
                    </strong>
                  </td>

                  <td>
                    <strong>
                      {report.totalAdmitted}
                    </strong>
                  </td>

                  <td>
                    <strong>
                      {report.totalAcceptancePaid}
                    </strong>
                  </td>

                  <td>
                    <strong>
                      {report.totalEnrolled}
                    </strong>
                  </td>

                  <td>
                    <strong>
                      {report.totalCompletedTasks}
                    </strong>
                  </td>

                  <td>
                    <strong>
                      {report.totalConversion}%
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div className="report-note">
          <strong>Reporting note:</strong> Activity
          counts use records created or completed within
          the selected period. Admission counts are based
          on the current admission stage of records created
          within that period.
        </div>
      </div>

      <style jsx>{`
        .ciu-page {
          min-height: 100vh;
          background: #f5f8f7;
          padding: 24px;
        }

        .ciu-page-inner {
          max-width: 1500px;
          margin: 0 auto;
        }

        .report-hero {
          position: relative;
          overflow: hidden;
          border-radius: 18px;
          padding: 26px;
          margin-bottom: 18px;
          background: linear-gradient(
            135deg,
            #003f36 0%,
            #00695c 65%,
            #087d6d 100%
          );
          color: white;
          box-shadow: 0 12px 30px rgba(0, 77, 64, 0.12);
        }

        .report-hero::after {
          content: "";
          position: absolute;
          width: 260px;
          height: 260px;
          right: -90px;
          top: -130px;
          border-radius: 50%;
          background: rgba(139, 198, 63, 0.18);
        }

        .report-hero-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .report-eyebrow {
          margin-bottom: 7px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.4px;
          color: #bde48a;
        }

        .report-hero h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 800;
        }

        .report-hero p {
          margin: 8px 0 0;
          max-width: 650px;
          color: rgba(255, 255, 255, 0.78);
          font-size: 13px;
        }

        .report-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .report-select {
          min-height: 40px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 9px;
          padding: 0 12px;
          background: rgba(255, 255, 255, 0.12);
          color: white;
          outline: none;
          font-size: 13px;
        }

        .report-select option {
          color: #17322c;
          background: white;
        }

        .report-refresh {
          min-height: 40px;
          border: 0;
          border-radius: 9px;
          padding: 0 15px;
          background: #8bc63f;
          color: #17322c;
          font-weight: 800;
          cursor: pointer;
        }

        .report-refresh:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .report-error {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-bottom: 18px;
          padding: 13px 15px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 13px;
        }

        .period-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
          padding: 16px 18px;
          border: 1px solid #dfe9e5;
          border-radius: 12px;
          background: white;
          box-shadow: 0 4px 14px rgba(23, 50, 44, 0.04);
        }

        .period-banner > div:first-child {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .period-label {
          font-size: 11px;
          font-weight: 800;
          color: #00695c;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .period-banner strong {
          color: #17322c;
          font-size: 15px;
        }

        .period-meta {
          color: #6b7f78;
          font-size: 12px;
        }

        .report-kpis {
          display: grid;
          grid-template-columns: repeat(
            5,
            minmax(0, 1fr)
          );
          gap: 12px;
          margin-bottom: 18px;
        }

        .report-kpi {
          min-width: 0;
          padding: 17px;
          border: 1px solid #dfe9e5;
          border-radius: 13px;
          background: white;
          box-shadow: 0 4px 14px rgba(23, 50, 44, 0.04);
        }

        .report-kpi-primary {
          border-color: #b9d9c9;
          background: #eaf5f2;
        }

        .report-kpi-conversion {
          border-color: #d5e7b9;
          background: #eef7df;
        }

        .kpi-label {
          display: block;
          margin-bottom: 8px;
          color: #6b7f78;
          font-size: 11px;
          font-weight: 700;
        }

        .report-kpi strong {
          display: block;
          color: #17322c;
          font-size: 25px;
          line-height: 1;
          font-weight: 800;
        }

        .report-kpi-primary strong {
          color: #00695c;
        }

        .report-kpi-conversion strong {
          color: #4d7c18;
        }

        .report-kpi small {
          display: block;
          margin-top: 7px;
          color: #87958f;
          font-size: 10px;
          line-height: 1.3;
        }

        .report-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(
              0,
              0.75fr
            );
          gap: 18px;
          margin-bottom: 18px;
        }

        .ciu-card {
          overflow: hidden;
          border: 1px solid #dfe9e5;
          border-radius: 14px;
          background: white;
          box-shadow: 0 5px 16px rgba(23, 50, 44, 0.04);
        }

        .report-card-head {
          padding: 18px 20px;
          border-bottom: 1px solid #edf2f0;
        }

        .report-card-head h2 {
          margin: 0;
          color: #17322c;
          font-size: 16px;
          font-weight: 800;
        }

        .report-card-head span {
          display: block;
          margin-top: 4px;
          color: #7b8b85;
          font-size: 11px;
        }

        .funnel {
          padding: 18px 20px 20px;
        }

        .funnel-row {
          display: grid;
          grid-template-columns: 145px minmax(0, 1fr);
          align-items: center;
          gap: 14px;
          margin-bottom: 15px;
        }

        .funnel-row:last-child {
          margin-bottom: 0;
        }

        .funnel-row > div:first-child {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .funnel-row span {
          color: #6b7f78;
          font-size: 11px;
          font-weight: 700;
        }

        .funnel-row strong {
          color: #17322c;
          font-size: 14px;
        }

        .funnel-bar {
          height: 9px;
          overflow: hidden;
          border-radius: 20px;
          background: #edf3f0;
        }

        .funnel-bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #00695c;
        }

        .funnel-row-final .funnel-bar span {
          background: #8bc63f;
        }

        .highlight {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) repeat(
              3,
              auto
            );
          align-items: center;
          gap: 13px;
          padding: 20px;
        }

        .highlight-avatar,
        .staff-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border-radius: 50%;
          background: #eaf5f2;
          color: #00695c;
          font-weight: 800;
        }

        .highlight-avatar {
          width: 46px;
          height: 46px;
          font-size: 13px;
        }

        .highlight-name {
          min-width: 0;
        }

        .highlight-name strong {
          display: block;
          overflow: hidden;
          color: #17322c;
          font-size: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .highlight-name span {
          display: block;
          margin-top: 3px;
          color: #84928d;
          font-size: 10px;
        }

        .highlight-stat {
          min-width: 58px;
          text-align: right;
        }

        .highlight-stat strong {
          display: block;
          color: #00695c;
          font-size: 18px;
        }

        .highlight-stat span {
          display: block;
          margin-top: 2px;
          color: #87958f;
          font-size: 9px;
        }

        .empty-highlight {
          padding: 24px 20px;
          color: #87958f;
          font-size: 12px;
        }

        .mini-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          border-top: 1px solid #edf2f0;
          background: #edf2f0;
        }

        .mini-summary div {
          padding: 13px;
          background: white;
          text-align: center;
        }

        .mini-summary span {
          display: block;
          color: #87958f;
          font-size: 9px;
        }

        .mini-summary strong {
          display: block;
          margin-top: 3px;
          color: #17322c;
          font-size: 16px;
        }

        .report-table-card {
          margin-bottom: 12px;
        }

        .report-table-scroll {
          overflow-x: auto;
        }

        .report-table {
          width: 100%;
          min-width: 1100px;
          border-collapse: collapse;
        }

        .report-table th {
          padding: 12px 13px;
          border-bottom: 1px solid #dfe9e5;
          background: #f7faf9;
          color: #667872;
          font-size: 10px;
          font-weight: 800;
          text-align: left;
          white-space: nowrap;
        }

        .report-table td {
          padding: 13px;
          border-bottom: 1px solid #edf2f0;
          color: #41554f;
          font-size: 11px;
          white-space: nowrap;
        }

        .report-table tbody tr:hover {
          background: #fbfdfc;
        }

        .report-table tfoot td {
          border-bottom: 0;
          background: #eef7df;
          color: #365c16;
        }

        .staff-cell {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 170px;
        }

        .staff-avatar {
          width: 28px;
          height: 28px;
          font-size: 9px;
        }

        .staff-cell strong {
          color: #17322c;
        }

        .enrolled-value {
          color: #00695c;
        }

        .conversion-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 48px;
          padding: 4px 7px;
          border-radius: 20px;
          background: #eef7df;
          color: #4d7c18;
          font-size: 10px;
          font-weight: 800;
        }

        .empty-table {
          padding: 35px !important;
          color: #87958f !important;
          text-align: center;
        }

        .report-note {
          color: #71817b;
          font-size: 10px;
          line-height: 1.5;
        }

        .report-loading {
          display: flex;
          min-height: 220px;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 6px;
          border: 1px solid #dfe9e5;
          border-radius: 14px;
          background: white;
          color: #17322c;
        }

        .report-loading span {
          color: #87958f;
          font-size: 11px;
        }

        .loading-dot {
          width: 30px;
          height: 30px;
          margin-bottom: 5px;
          border: 3px solid #dcebe6;
          border-top-color: #00695c;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1200px) {
          .report-kpis {
            grid-template-columns: repeat(
              4,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 1000px) {
          .report-main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .ciu-page {
            padding: 14px;
          }

          .report-hero {
            padding: 20px;
          }

          .report-hero h1 {
            font-size: 23px;
          }

          .report-controls {
            width: 100%;
          }

          .report-select,
          .report-refresh {
            flex: 1;
            min-width: 0;
          }

          .report-kpis {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .period-banner {
            align-items: flex-start;
            flex-direction: column;
          }

          .highlight {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .highlight-stat {
            text-align: left;
          }

          .highlight-stat:nth-last-child(-n + 3) {
            grid-column: span 1;
          }

          .mini-summary {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .report-kpis {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .report-kpi {
            padding: 13px;
          }

          .report-kpi strong {
            font-size: 21px;
          }

          .funnel-row {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .funnel-row > div:first-child {
            justify-content: flex-start;
            gap: 12px;
          }
        }
      `}</style>
    </main>
  );
}