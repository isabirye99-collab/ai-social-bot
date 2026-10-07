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

      const failed = [p, l, a, t].find((x) => x.error);

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

    const rows = profiles
      .filter((profile) => {
        if (currentRole === "salesperson") {
          return profile.id === currentUserId;
        }

        return true;
      })
      .map((profile) => {
        const staffLeads = leads.filter(
          (x) =>
            x.assigned_to === profile.id &&
            inPeriod(x.created_at, start, end)
        );

        const staffAdmissions = admissions.filter(
          (x) =>
            x.assigned_to === profile.id &&
            inPeriod(x.created_at, start, end)
        );

        const activities = tasks.filter(
          (x) =>
            x.assigned_to === profile.id &&
            inPeriod(x.created_at, start, end)
        );

        const completedTasks = tasks.filter(
          (x) =>
            x.assigned_to === profile.id &&
            x.status === "completed" &&
            inPeriod(
              x.completed_at || x.created_at,
              start,
              end
            )
        );

        const calls = activities.filter(
          (x) => (x.task_type || "").toLowerCase() === "call"
        ).length;

        const followUps = activities.filter((x) =>
          ["call", "whatsapp", "email"].includes(
            (x.task_type || "").toLowerCase()
          )
        ).length;

        const interested = staffLeads.filter(
          (x) => x.status === "qualified"
        ).length;

        const applications = staffAdmissions.filter((x) =>
          [
            "application started",
            "application submitted",
            "admitted",
            "acceptance paid",
            "enrolled",
          ].includes((x.stage || "").toLowerCase())
        ).length;

        const submitted = staffAdmissions.filter((x) =>
          [
            "application submitted",
            "admitted",
            "acceptance paid",
            "enrolled",
          ].includes((x.stage || "").toLowerCase())
        ).length;

        const admitted = staffAdmissions.filter((x) =>
          [
            "admitted",
            "acceptance paid",
            "enrolled",
          ].includes((x.stage || "").toLowerCase())
        ).length;

        const acceptancePaid = staffAdmissions.filter((x) =>
          ["acceptance paid", "enrolled"].includes(
            (x.stage || "").toLowerCase()
          )
        ).length;

        const enrolled = staffAdmissions.filter(
          (x) =>
            (x.stage || "").toLowerCase() === "enrolled"
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

    const totalEnrolled = rows.reduce(
      (sum, row) => sum + row.enrolled,
      0
    );

    return {
      rows,
      totalLeads,
      totalCalls: rows.reduce(
        (sum, row) => sum + row.calls,
        0
      ),
      totalFollowUps: rows.reduce(
        (sum, row) => sum + row.followUps,
        0
      ),
      totalInterested: rows.reduce(
        (sum, row) => sum + row.interested,
        0
      ),
      totalApplications: rows.reduce(
        (sum, row) => sum + row.applications,
        0
      ),
      totalSubmitted: rows.reduce(
        (sum, row) => sum + row.submitted,
        0
      ),
      totalAdmitted: rows.reduce(
        (sum, row) => sum + row.admitted,
        0
      ),
      totalAcceptancePaid: rows.reduce(
        (sum, row) => sum + row.acceptancePaid,
        0
      ),
      totalEnrolled,
      totalCompletedTasks: rows.reduce(
        (sum, row) => sum + row.completedTasks,
        0
      ),
      totalConversion: totalLeads
        ? Math.round(
            (totalEnrolled / totalLeads) * 1000
          ) / 10
        : 0,
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

  if (loading) {
    return (
      <main style={{ padding: 32 }}>
        <div
          className="crm-card"
          style={{ padding: 24 }}
        >
          Loading performance report...
        </div>
      </main>
    );
  }

  return (
    <main className="ciu-page">
      <div className="ciu-page-inner">
        <div>
          <div
            className="ciu-hero"
            style={{ marginBottom: 18 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <h1
                  style={{
                    margin: 0,
                    fontSize: 28,
                    fontWeight: 800,
                  }}
                >
                  {isSalesperson
                    ? "My Performance Report"
                    : "Staff Performance Reports"}
                </h1>

                <p
                  style={{
                    margin: "6px 0 0",
                    color: "rgba(255,255,255,.78)",
                    fontSize: 13,
                  }}
                >
                  {isSalesperson
                    ? "Track your admissions, leads and follow-up performance by day, week or month."
                    : "Track admissions and follow-up performance by day, week or month."}
                </p>
              </div>

              <div
                className="ciu-toolbar"
                style={{
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <select
                  value={period}
                  onChange={(e) =>
                    setPeriod(
                      e.target.value as Period
                    )
                  }
                  className="ciu-select"
                >
                  <option value="day">Per Day</option>
                  <option value="week">Per Week</option>
                  <option value="month">Per Month</option>
                </select>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) =>
                    setSelectedDate(e.target.value)
                  }
                  className="ciu-select"
                />

                <button
                  type="button"
                  onClick={async () => {
                    setRefreshing(true);
                    await loadReport();
                  }}
                  disabled={refreshing}
                  className="ciu-btn"
                >
                  {refreshing
                    ? "Refreshing..."
                    : "Refresh"}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginBottom: 18,
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

          <div className="ciu-period-card">
            <div>
              <strong>
                {period === "day"
                  ? "Daily"
                  : period === "week"
                  ? "Weekly"
                  : "Monthly"}{" "}
                {isSalesperson
                  ? "Personal Performance"
                  : "Performance"}
              </strong>

              <div
                style={{
                  color: "#64748b",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                {report.start.toLocaleDateString(
                  "en-UG"
                )}{" "}
                –{" "}
                {report.end.toLocaleDateString(
                  "en-UG"
                )}
              </div>
            </div>

            <span
              style={{
                color: "#64748b",
                fontSize: 13,
              }}
            >
              {isSalesperson
                ? "Your performance"
                : `${report.rows.length} active staff`}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: 14,
              marginBottom: 18,
            }}
          >
            {report.rows.map((row) => (
              <div
                key={row.id}
                className="ciu-staff-card"
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong
                      style={{
                        fontSize: 14,
                        color: "#17322c",
                      }}
                    >
                      {row.name}
                    </strong>

                    <div
                      style={{
                        fontSize: 10,
                        color: "#6b7f78",
                        marginTop: 3,
                      }}
                    >
                      {isSalesperson
                        ? "Your performance for the selected period"
                        : "Performance for selected period"}
                    </div>
                  </div>

                  <div className="ciu-staff-conversion">
                    {row.conversion}%
                  </div>
                </div>

                <div
                  className="ciu-staff-metrics"
                  style={{
                    gridTemplateColumns:
                      "repeat(7,minmax(72px,1fr))",
                    overflowX: "auto",
                  }}
                >
                  <div>
                    <strong>{row.leads}</strong>
                    <span>Leads</span>
                  </div>

                  <div>
                    <strong>{row.calls}</strong>
                    <span>Calls</span>
                  </div>

                  <div>
                    <strong>{row.followUps}</strong>
                    <span>Follow-ups</span>
                  </div>

                  <div>
                    <strong>{row.interested}</strong>
                    <span>Interested</span>
                  </div>

                  <div>
                    <strong>{row.admitted}</strong>
                    <span>Admitted</span>
                  </div>

                  <div>
                    <strong>{row.enrolled}</strong>
                    <span>Enrolled</span>
                  </div>

                  <div>
                    <strong>
                      {row.completedTasks}
                    </strong>
                    <span>Tasks Done</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="ciu-card">
            <div className="ciu-card-head">
              <div>
                <h2 style={{ margin: 0 }}>
                  {isSalesperson
                    ? "My Performance"
                    : "Staff Performance"}
                </h2>

                <span>
                  {isSalesperson
                    ? "Detailed summary of your work and admissions results."
                    : "Summary of work and admissions results for each person."}
                </span>
              </div>
            </div>

            <div className="ciu-report-table-wrap">
              <table className="ciu-report-table">
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
                          <strong>{row.name}</strong>
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
                          <strong>
                            {row.enrolled}
                          </strong>
                        </td>

                        <td>{row.completedTasks}</td>
                        <td>{row.conversion}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={12}
                        style={{
                          textAlign: "center",
                          padding: 30,
                        }}
                      >
                        No performance records found
                        for the selected period.
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
          </div>

          <p
            style={{
              marginTop: 12,
              color: "#6b7f78",
              fontSize: 11,
            }}
          >
            Activity counts use records created or
            completed in the selected period. Admission
            counts use the current stage of admission
            records created in that period.
          </p>
        </div>
      </div>
    </main>
  );
}