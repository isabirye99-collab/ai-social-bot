"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Period = "day" | "week" | "month";

type Profile = {
  id: string;
  full_name: string | null;
  role?: string | null;
  module_permissions?: string[] | null;
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
  emails: number;
  whatsapp: number;
  meetings: number;
  contactActivities: number;
  followUps: number;
  interested: number;
  applications: number;
  submitted: number;
  admitted: number;
  acceptancePaid: number;
  enrolled: number;
  completedTasks: number;
  conversion: number;
  role: string;
  module_permissions?: string[] | null;
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
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("month");

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [viewerRole, setViewerRole] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [relationshipMetrics, setRelationshipMetrics] = useState({ alumniTotal: 0, alumniVerified: 0, alumniEmployed: 0, partnershipsTotal: 0, partnershipsActive: 0, partnershipsPipeline: 0, partnershipsRenewalWatch: 0 });

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

      const currentProfileQuery = supabase
        .from("profiles")
        .select("id,role")
        .eq("id", user.id)
        .maybeSingle();

      const profilesQuery = supabase
        .from("profiles")
        .select("id,full_name,role,module_permissions")
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

      const relationshipQueries = Promise.all([
        supabase.from("alumni").select("id", { count: "exact", head: true }),
        supabase.from("alumni").select("id", { count: "exact", head: true }).eq("verification_status", "verified"),
        supabase.from("alumni").select("id", { count: "exact", head: true }).eq("employment_status", "employed"),
        supabase.from("partnerships").select("id", { count: "exact", head: true }),
        supabase.from("partnerships").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("partnerships").select("id", { count: "exact", head: true }).in("status", ["prospect", "engaging", "negotiation"]),
        supabase.from("partnerships").select("id", { count: "exact", head: true }).gte("end_date", new Date().toISOString().slice(0, 10)).lte("end_date", (() => { const d = new Date(); d.setDate(d.getDate() + 90); return d.toISOString().slice(0, 10); })()),
      ]);

      const [currentProfile, p, l, a, t, relationshipResults] = await Promise.all([
        currentProfileQuery,
        profilesQuery,
        leadsQuery,
        admissionsQuery,
        tasksQuery,
        relationshipQueries,
      ]);

      const failed = [currentProfile, p, l, a, t, ...relationshipResults].find((result) => result.error);

      if (failed?.error) {
        throw new Error(failed.error.message);
      }

      const role = String(currentProfile.data?.role || "").trim().toLowerCase().replace(/[ -]/g, "_");
      if (!["super_admin", "admin", "manager", "salesperson", "marketing", "alumni_relations", "alumni_coordinator", "alumni_officer"].includes(role)) {
        router.replace("/dashboard");
        return;
      }
      setViewerRole(role);

      const eligibleProfiles = ((p.data || []) as Profile[]).filter((profile) => {
        const profileRole = String(profile.role || "").trim().toLowerCase().replace(/[ -]/g, "_");
        if (["admin", "super_admin", "manager"].includes(profileRole)) return false;
        const modules = Array.isArray(profile.module_permissions) ? profile.module_permissions : null;
        const isSalesperson = profileRole === "salesperson";
        const isAlumniRelations = [
          "alumni_relations", "alumni_coordinator", "alumni_officer",
        ].includes(profileRole) || modules?.includes("alumni") === true;
        const isPartnerships = modules?.includes("partnerships") === true ||
          (profileRole === "marketing" && modules === null);
        return isSalesperson || isAlumniRelations || isPartnerships;
      });

      const canViewTeam = ["manager", "admin", "super_admin"].includes(role);
      setProfiles(
        canViewTeam
          ? eligibleProfiles
          : eligibleProfiles.filter((profile) => profile.id === user.id)
      );

      setLeads((l.data || []) as Lead[]);
      setAdmissions((a.data || []) as Admission[]);
      setTasks((t.data || []) as Task[]);
      setRelationshipMetrics({ alumniTotal: relationshipResults[0].count || 0, alumniVerified: relationshipResults[1].count || 0, alumniEmployed: relationshipResults[2].count || 0, partnershipsTotal: relationshipResults[3].count || 0, partnershipsActive: relationshipResults[4].count || 0, partnershipsPipeline: relationshipResults[5].count || 0, partnershipsRenewalWatch: relationshipResults[6].count || 0 });
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
      .filter((profile) => !["admin", "super_admin"].includes((profile.role || "").toLowerCase()))
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

        const emails = staffTasks.filter((task) => (task.task_type || "").toLowerCase() === "email").length;
        const whatsapp = staffTasks.filter((task) => (task.task_type || "").toLowerCase() === "whatsapp").length;
        const meetings = staffTasks.filter((task) => (task.task_type || "").toLowerCase() === "meeting").length;
        const followUps = calls + emails + whatsapp;
        const contactActivities = calls + emails + whatsapp + meetings;

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
          role: String(profile.role || "").toLowerCase().replace(/[ -]/g, "_"),
          module_permissions: profile.module_permissions || null,
          leads: staffLeads.length,
          calls,
          emails,
          whatsapp,
          meetings,
          contactActivities,
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
  ]);

    const topPerformer = useMemo(() => {
    if (!report.rows.length) return null;

    return [...report.rows].sort(
      (a, b) =>
        b.enrolled - a.enrolled ||
        b.conversion - a.conversion ||
        b.leads - a.leads
    )[0];
  }, [report.rows]);

  const chartRows = useMemo(
    () => [...report.rows.filter((row) => row.role === "salesperson")].sort((a, b) => b.leads - a.leads).slice(0, 6),
    [report.rows]
  );
  const chartMaxLeads = Math.max(1, ...chartRows.map((row) => row.leads));


  const salesRows = report.rows.filter((row) => row.role === "salesperson");
  const alumniRows = report.rows.filter((row) =>
    ["alumni_relations", "alumni_coordinator", "alumni_officer"].includes(row.role) ||
    (row.module_permissions?.includes("alumni") && !row.module_permissions?.includes("partnerships"))
  );
  const partnershipRows = report.rows.filter((row) =>
    !salesRows.some((item) => item.id === row.id) &&
    !alumniRows.some((item) => item.id === row.id)
  );

  function downloadReport() {
    const quote = (value: unknown) => {
      const textValue = String(value ?? "");
      return '"' + textValue.replace(/"/g, '""') + '"';
    };
    const lines: unknown[][] = [
      ["CIU CRM Performance Report", periodLabel(period), formatDate(report.start) + " - " + formatDate(report.end)],
      [],
      ["SALES TEAM"],
      ["Staff Member", "Leads", "Calls", "Follow-ups", "Interested", "Applications", "Submitted", "Admitted", "Acceptance Paid", "Enrolled", "Tasks Done", "Conversion %"],
      ...salesRows.map((r) => [r.name, r.leads, r.calls, r.followUps, r.interested, r.applications, r.submitted, r.admitted, r.acceptancePaid, r.enrolled, r.completedTasks, r.conversion]),
      [],
      ["ALUMNI RELATIONS"],
      ["Staff Member", "Contact activities", "Calls", "Emails", "WhatsApp", "Meetings", "Tasks done"],
      ...alumniRows.map((r) => [r.name, r.contactActivities, r.calls, r.emails, r.whatsapp, r.meetings, r.completedTasks]),
      [],
      ["PARTNERSHIPS"],
      ["Staff Member", "Contact activities", "Calls", "Follow-ups", "Completed tasks"],
      ...partnershipRows.map((r) => [r.name, r.contactActivities, r.calls, r.emails, r.whatsapp, r.meetings, r.completedTasks]),
      [],
      ["RELATIONSHIP SUMMARY", "Value"],
      ["Total alumni", relationshipMetrics.alumniTotal],
      ["Verified alumni", relationshipMetrics.alumniVerified],
      ["Employed alumni", relationshipMetrics.alumniEmployed],
      ["Total partnerships", relationshipMetrics.partnershipsTotal],
      ["Active partnerships", relationshipMetrics.partnershipsActive],
      ["Partnership pipeline", relationshipMetrics.partnershipsPipeline],
      ["Renewals in next 90 days", relationshipMetrics.partnershipsRenewalWatch],
    ];
    const csv = "\uFEFF" + lines.map((line) => line.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ciu-crm-performance-report-" + selectedDate + ".csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

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
                {"Sales & Alumni Relations Report"}
              </h1>

              <p>
                {["manager", "admin", "super_admin"].includes(viewerRole) ? "Review sales team activity alongside alumni and partnership relationship metrics." : "Review your activity alongside alumni and partnership relationship metrics."}
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

              <button type="button" onClick={downloadReport} className="report-refresh">
                Download CSV
              </button>

              <button type="button" onClick={() => window.print()} className="report-print">
                Print
              </button>

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
              {["manager", "admin", "super_admin"].includes(viewerRole) ? "Team Performance" : "My Performance"}
            </span>

            <strong>
              {formatDate(report.start)}
              {" — "}
              {formatDate(report.end)}
            </strong>
          </div>

          <div className="period-meta">
            {["manager", "admin", "super_admin"].includes(viewerRole) ? `${report.rows.length} sales and alumni relations staff` : "Your individual performance report"}
          </div>
        </section>

        <section className="report-kpis report-overview-kpis" aria-label="CRM performance overview">
          <div className="report-kpi report-kpi-primary"><span className="kpi-label">Alumni</span><strong>{relationshipMetrics.alumniTotal.toLocaleString()}</strong><small>{relationshipMetrics.alumniVerified.toLocaleString()} verified profiles</small></div>
          <div className="report-kpi report-kpi-partnerships"><span className="kpi-label">Partnerships</span><strong>{relationshipMetrics.partnershipsTotal.toLocaleString()}</strong><small>{relationshipMetrics.partnershipsActive.toLocaleString()} active relationships</small></div>
          <div className="report-kpi report-kpi-conversion"><span className="kpi-label">Sales · Enrolments</span><strong>{salesRows.reduce((sum, row) => sum + row.enrolled, 0).toLocaleString()}</strong><small>Enrolments recorded for this period</small></div>
          <div className="report-kpi report-kpi-contacts"><span className="kpi-label">Contact Activities</span><strong>{report.rows.reduce((sum, row) => sum + row.contactActivities, 0).toLocaleString()}</strong><small>Calls, emails, WhatsApp and meetings</small></div>
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
                    {"Top enrolment performance"}
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

        <section className="report-visual-grid">
          <div className="ciu-card report-chart-card">
            <div className="ciu-card-head report-card-head"><div><h2>Activity by Team</h2><span>Logged contact activities during the selected period.</span></div></div>
            <div className="team-activity-chart">
              <div className="team-activity-row"><div className="team-activity-label"><strong>Alumni Relations</strong><span>{alumniRows.reduce((sum, row) => sum + row.contactActivities, 0).toLocaleString()} activities</span></div><div className="team-activity-track"><span className="team-activity-fill team-alumni" style={{ width: String(Math.min(100, alumniRows.reduce((sum, row) => sum + row.contactActivities, 0) / Math.max(1, report.rows.reduce((sum, row) => sum + row.contactActivities, 0)) * 100)) + "%" }} /></div><div className="team-activity-detail">Calls {alumniRows.reduce((sum, row) => sum + row.calls, 0)} · Emails {alumniRows.reduce((sum, row) => sum + row.emails, 0)} · WhatsApp {alumniRows.reduce((sum, row) => sum + row.whatsapp, 0)} · Meetings {alumniRows.reduce((sum, row) => sum + row.meetings, 0)}</div></div>
              <div className="team-activity-row"><div className="team-activity-label"><strong>Partnerships</strong><span>{partnershipRows.reduce((sum, row) => sum + row.contactActivities, 0).toLocaleString()} activities</span></div><div className="team-activity-track"><span className="team-activity-fill team-partnerships" style={{ width: String(Math.min(100, partnershipRows.reduce((sum, row) => sum + row.contactActivities, 0) / Math.max(1, report.rows.reduce((sum, row) => sum + row.contactActivities, 0)) * 100)) + "%" }} /></div><div className="team-activity-detail">Calls {partnershipRows.reduce((sum, row) => sum + row.calls, 0)} · Emails {partnershipRows.reduce((sum, row) => sum + row.emails, 0)} · WhatsApp {partnershipRows.reduce((sum, row) => sum + row.whatsapp, 0)} · Meetings {partnershipRows.reduce((sum, row) => sum + row.meetings, 0)}</div></div>
              <div className="team-activity-row"><div className="team-activity-label"><strong>Sales</strong><span>{salesRows.reduce((sum, row) => sum + row.contactActivities, 0).toLocaleString()} activities</span></div><div className="team-activity-track"><span className="team-activity-fill team-sales" style={{ width: String(Math.min(100, salesRows.reduce((sum, row) => sum + row.contactActivities, 0) / Math.max(1, report.rows.reduce((sum, row) => sum + row.contactActivities, 0)) * 100)) + "%" }} /></div><div className="team-activity-detail">Calls {salesRows.reduce((sum, row) => sum + row.calls, 0)} · Emails {salesRows.reduce((sum, row) => sum + row.emails, 0)} · WhatsApp {salesRows.reduce((sum, row) => sum + row.whatsapp, 0)} · Meetings {salesRows.reduce((sum, row) => sum + row.meetings, 0)}</div></div>
            </div>
          </div>
          <div className="ciu-card report-chart-card">
            <div className="ciu-card-head report-card-head"><div><h2>Key Highlights</h2><span>Quick overview for the selected period.</span></div></div>
            <div className="team-share-list">
              <div className="report-highlight-line"><span>Total contact activities</span><strong>{report.rows.reduce((sum, row) => sum + row.contactActivities, 0).toLocaleString()}</strong></div>
              <div className="report-highlight-line"><span>Sales enrolments</span><strong>{salesRows.reduce((sum, row) => sum + row.enrolled, 0).toLocaleString()}</strong></div>
              <div className="report-highlight-line"><span>Active partnerships</span><strong>{relationshipMetrics.partnershipsActive.toLocaleString()}</strong></div>
              <div className="report-highlight-line"><span>Verified alumni</span><strong>{relationshipMetrics.alumniVerified.toLocaleString()}</strong></div>
              <div className="report-chart-note">Contact activities are logged calls, emails, WhatsApp messages and meetings. They do not represent unique individuals contacted.</div>
            </div>
          </div>
        </section>
        <section className="ciu-card report-table-card">
          <div className="ciu-card-head report-card-head"><div><h2>Alumni Relations Activity</h2><span>Contact and follow-up activity for Alumni Relations staff in the selected period.</span></div></div>
          <div className="report-table-scroll"><table className="report-table">
            <thead><tr><th>Staff Member</th><th>Contact activities</th><th>Calls</th><th>Emails</th><th>WhatsApp</th><th>Meetings</th><th>Tasks done</th></tr></thead>
            <tbody>{alumniRows.length ? alumniRows.map((row) => <tr key={row.id}><td><div className="staff-cell"><div className="staff-avatar">{row.name.split(" ").map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase()}</div><strong>{row.name}</strong></div></td><td><strong>{row.contactActivities}</strong></td><td>{row.calls}</td><td>{row.emails}</td><td>{row.whatsapp}</td><td>{row.meetings}</td><td>{row.completedTasks}</td></tr>) : <tr><td colSpan={7}>No Alumni Relations activity recorded for this period.</td></tr>}</tbody>
          </table></div>
          <p style={{ padding: "0 18px 14px", color: "#64748b", fontSize: 12 }}>Contact activities are counted from call, WhatsApp and email tasks. They are logged activities, not a deduplicated count of unique people.</p>
        </section>
        <section className="ciu-card report-table-card">
          <div className="ciu-card-head report-card-head"><div><h2>Partnerships Activity</h2><span>Contact and follow-up activity for staff responsible for partnerships in the selected period.</span></div></div>
          <div className="report-table-scroll"><table className="report-table">
            <thead><tr><th>Staff Member</th><th>Contact activities</th><th>Calls</th><th>Follow-ups</th><th>Tasks done</th></tr></thead>
            <tbody>{partnershipRows.length ? partnershipRows.map((row) => <tr key={row.id}><td><div className="staff-cell"><div className="staff-avatar">{row.name.split(" ").map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase()}</div><strong>{row.name}</strong></div></td><td><strong>{row.followUps}</strong></td><td>{row.calls}</td><td>{row.followUps}</td><td>{row.completedTasks}</td></tr>) : <tr><td colSpan={7}>No Partnerships activity recorded for this period.</td></tr>}</tbody>
          </table></div>
          <p style={{ padding: "0 18px 14px", color: "#64748b", fontSize: 12 }}>Contact activities are counted from call, WhatsApp and email tasks. They are logged activities, not a deduplicated count of unique people.</p>
        </section>

        <section className="ciu-card report-table-card">
          <div className="ciu-card-head report-card-head">
            <div>
              <h2>
                {"Sales Team Performance"}
              </h2>

              <span>
                {"Detailed admissions and conversion performance for salespeople."}
              </span>
            </div>
          </div>

          <div className="report-table-scroll">
            <table className="report-table">
              <thead>
                <tr>
                  <th>
                    {"Staff Member"}
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
                {salesRows.length ? (
                  salesRows.map((row) => (
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
                      {"TEAM TOTAL"}
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
          border: 1px solid #e0e9e3;
          border-left: 5px solid #075442;
          border-radius: 16px;
          padding: 25px 27px;
          margin-bottom: 18px;
          background: #ffffff;
          color: #17211b;
          box-shadow: 0 8px 26px rgba(20, 50, 40, .045);
        }

        .report-hero::after {
          content: "";
          position: absolute;
          width: 210px;
          height: 210px;
          right: -90px;
          top: -115px;
          border-radius: 50%;
          background: #f0f7e7;
          pointer-events: none;
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
          color: #66806e;
        }

        .report-hero h1 {
          margin: 0;
          color: #17211b;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 850;
          letter-spacing: -.035em;
        }

        .report-hero p {
          margin: 8px 0 0;
          max-width: 650px;
          color: #78877f;
          font-size: 12px;
        }

        .report-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .report-select {
          min-height: 40px;
          border: 1px solid #dfe8e2;
          border-radius: 9px;
          padding: 0 12px;
          background: #f8faf8;
          color: #263b31;
          outline: none;
          font-size: 12px;
          font-weight: 650;
        }

        .report-select option {
          color: #17322c;
          background: white;
        }

        .report-refresh {
          min-height: 40px;
          border: 0;
          border-radius: 9px;
          padding: 0 16px;
          background: #075442;
          color: white;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: background .2s ease, transform .2s ease;
        }
        .report-refresh:hover:not(:disabled) {
          background: #0b6b53;
          transform: translateY(-1px);
        }

        .report-print { min-height: 40px; border: 1px solid #c8ded4; border-radius: 9px; padding: 0 16px; background: #fff; color: #075442; font-size: 12px; font-weight: 800; cursor: pointer; }
        .report-print:hover { background: #f1f8f4; }
        .report-visual-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr); gap: 18px; margin-bottom: 18px; }
        .team-activity-chart { padding: 22px; display: grid; gap: 22px; }
        .team-activity-row { display: grid; gap: 8px; }
        .team-activity-label { display: flex; justify-content: space-between; align-items: center; gap: 10px; color: #233b32; font-size: 12px; }
        .team-activity-label span { color: #647b70; font-variant-numeric: tabular-nums; }
        .team-activity-track { height: 11px; border-radius: 20px; overflow: hidden; background: #edf2ee; }
        .team-activity-fill { display: block; height: 100%; border-radius: inherit; }
        .team-alumni { background: #159b69; } .team-partnerships { background: #a3c84b; } .team-sales { background: #2587d8; }
        .team-activity-detail { color: #7b8b85; font-size: 10px; }
        .report-highlight-line { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid #edf2f0; color: #647b70; font-size: 12px; }
        .report-highlight-line strong { color: #075442; font-size: 15px; }
        .report-chart-note { padding: 10px 12px; border-radius: 8px; background: #f7faf8; color: #687c72; font-size: 10px; line-height: 1.5; }
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
          padding: 16px 19px;
          border: 1px solid #e0e9e3;
          border-left: 4px solid #65a82f;
          border-radius: 12px;
          background: white;
          box-shadow: 0 5px 18px rgba(20, 50, 40, .035);
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
          position: relative;
          min-width: 0;
          padding: 17px 17px 16px;
          border: 1px solid #e0e9e3;
          border-left: 3px solid #d6e5dc;
          border-radius: 12px;
          background: white;
          box-shadow: 0 5px 18px rgba(20, 50, 40, .035);
          transition: transform .2s ease, box-shadow .2s ease;
        }
        .report-kpi:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(20, 50, 40, .07);
        }

        .report-kpi-primary {
          border-color: #cfe3d7;
          border-left-color: #075442;
          background: #f3f8f4;
        }

        .report-kpi-conversion {
          border-color: #dce9c9;
          border-left-color: #65a82f;
          background: #f7faef;
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
          color: #17211b;
          font-size: 27px;
          line-height: 1;
          font-weight: 850;
          letter-spacing: -.04em;
          font-variant-numeric: tabular-nums;
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
          border: 1px solid #e0e9e3;
          border-radius: 15px;
          background: white;
          box-shadow: 0 8px 26px rgba(20, 50, 40, .045);
        }

        .report-card-head {
          padding: 19px 21px;
          border-bottom: 1px solid #edf1ef;
          background: #fff;
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
          height: 11px;
          overflow: hidden;
          border-radius: 20px;
          background: #edf2ee;
          box-shadow: inset 0 1px 2px rgba(23, 50, 44, .04);
        }

        .funnel-bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #075442, #2f8b69);
          transition: width .45s ease;
        }

        .funnel-row-final .funnel-bar span {
          background: linear-gradient(90deg, #65a82f, #9ad447);
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

        .report-chart-card { margin-bottom: 18px; }
        .chart-legend { display: flex; align-items: center; gap: 14px; color: #64748b; font-size: 11px; font-weight: 700; }
        .chart-legend span { display: inline-flex; align-items: center; gap: 6px; }
        .chart-legend i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
        .legend-leads { background: #0f766e; }
        .legend-enrolled { background: #84cc16; }
        .staff-chart { padding: 20px 21px 23px; display: grid; gap: 17px; }
        .staff-chart-row {
          display: grid;
          grid-template-columns: minmax(130px, 190px) minmax(0, 1fr) 58px;
          align-items: center;
          gap: 14px;
          padding: 10px 11px;
          border: 1px solid #edf1ef;
          border-radius: 10px;
          background: #fcfdfc;
        }
        .staff-chart-name { overflow: hidden; color: #34433b; font-size: 11px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
        .staff-chart-bars { display: grid; gap: 6px; }
        .staff-chart-track { height: 11px; overflow: hidden; border-radius: 20px; background: #edf2ee; }
        .staff-chart-track-small { height: 8px; }
        .staff-chart-track span { display: block; height: 100%; min-width: 0; border-radius: inherit; transition: width .4s ease; }
        .staff-chart-leads { background: linear-gradient(90deg, #075442, #3c9475); }
        .staff-chart-enrolled { background: linear-gradient(90deg, #65a82f, #a1d65c); }
        .staff-chart-values { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; font-variant-numeric: tabular-nums; }
        .staff-chart-values strong { color: #075442; }
        .staff-chart-values span { color: #65a82f; font-weight: 850; }


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

        @media print { .report-controls, .report-refresh, .report-print { display: none !important; } .ciu-page { padding: 0; background: #fff; } .ciu-card, .report-kpi, .report-hero, .period-banner { box-shadow: none; break-inside: avoid; } .report-table-scroll { overflow: visible; } .report-table { min-width: 0; } }
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
          .report-visual-grid { grid-template-columns: 1fr; }
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

          .staff-chart-row { grid-template-columns: minmax(85px, 110px) minmax(0, 1fr) 48px; gap: 8px; }
          .staff-chart-name { font-size: 10px; }
          .chart-legend { gap: 8px; font-size: 10px; }
          .staff-chart { padding: 14px; }
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