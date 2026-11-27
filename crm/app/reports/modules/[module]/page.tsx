"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ALL_CRM_MODULES, getEffectiveModules, type CrmModule } from "@/lib/permissions";

type Profile = { id: string; full_name: string | null; role: string | null; module_permissions: string[] | null };
type ReportRecord = Record<string, string | number | boolean | null>;
type ModuleConfig = { title: string; description: string; table: string; permission: CrmModule; columns: string[]; dateColumn: string; statusColumn?: string };

const configs: Record<string, ModuleConfig> = {
  leads: { title: "Lead & Recruitment Report", description: "Lead records created in the selected reporting period.", table: "leads", permission: "leads", columns: ["full_name", "created_at", "status", "assigned_to", "product_service"], dateColumn: "created_at", statusColumn: "status" },
  tasks: { title: "Tasks & Productivity Report", description: "Task creation, ownership and completion status for the selected period.", table: "tasks", permission: "tasks", columns: ["id", "created_at", "title", "status", "assigned_to", "task_type", "completed_at"], dateColumn: "created_at", statusColumn: "status" },
  partnerships: { title: "Partnerships Report", description: "Partner records and relationship status.", table: "partnerships", permission: "partnerships", columns: ["id", "created_at", "name", "category", "status"], dateColumn: "created_at", statusColumn: "status" },
  alumni: { title: "Alumni Relations Report", description: "Alumni profile records and verification status.", table: "alumni", permission: "alumni", columns: ["id", "created_at", "full_name", "program", "graduation_year", "verification_status", "employment_status"], dateColumn: "created_at", statusColumn: "verification_status" },
  pipeline: { title: "Admissions Pipeline Report", description: "Admissions records and their current stage.", table: "admissions", permission: "pipeline", columns: ["id", "created_at", "stage", "assigned_to", "lead_id"], dateColumn: "created_at", statusColumn: "stage" },
  customers: { title: "Customer Records Report", description: "Enrolled student records are managed through the admissions pipeline.", table: "admissions", permission: "customers", columns: ["id", "created_at", "stage", "assigned_to", "lead_id"], dateColumn: "created_at", statusColumn: "stage" },
  strategy: { title: "Strategy & Intake Report", description: "Annual strategy plans and the reporting year they cover.", table: "strategy_plans", permission: "strategy", columns: ["id", "strategy_year", "updated_at"], dateColumn: "updated_at" },
  marketing: { title: "Marketing Activity Report", description: "Campaigns, channels, dates and recorded campaign budgets.", table: "campaigns", permission: "marketing", columns: ["id", "name", "channel", "start_date", "end_date", "budget", "currency", "created_at"], dateColumn: "created_at" },
};
const supabase = createClient();
const titles: Record<string, string> = { full_name: "Student / Lead", id: "Reference", created_at: "Created", updated_at: "Last Updated", title: "Task", status: "Status", assigned_to: "Assigned To", product_service: "Programme / Product", task_type: "Task Type", completed_at: "Completed", name: "Name", category: "Category", program: "Programme", graduation_year: "Graduation Year", verification_status: "Verification", employment_status: "Employment", stage: "Stage", lead_id: "Lead", strategy_year: "Strategy Year", channel: "Channel", start_date: "Campaign Start", end_date: "Campaign End", budget: "Budget", currency: "Currency" };
function csvCell(value: unknown) { const text = value == null ? "" : String(value); return '"' + text.replace(/"/g, '""') + '"'; }
function columnTitle(col: string, moduleKey: string) { if (col === "full_name" && moduleKey === "alumni") return "Alumnus"; return titles[col] || col; }
function day(value: Date) { return value.toISOString().slice(0, 10); }

export default function ModuleReportPage() {
  const params = useParams<{ module: string }>();
  const router = useRouter();
  const moduleKey = String(params.module || "");
  const config = configs[moduleKey];
  const [profile, setProfile] = useState<Profile | null>(null);
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [pageNumber, setPageNumber] = useState(0);
  const pageSize = 100;
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [leadNames, setLeadNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState(() => day(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [toDate, setToDate] = useState(() => day(new Date()));
  const modules = useMemo(() => {
    const role = String(profile?.role || "").trim().toLowerCase().replace(/[ -]/g, "_");
    const effective = getEffectiveModules(role, profile?.module_permissions);
    if (effective.length || ["super_admin", "admin", "manager", "salesperson", "marketing", "finance", "viewer"].includes(role)) return effective;
    return (profile?.module_permissions || []).filter((item): item is CrmModule => ALL_CRM_MODULES.includes(item as CrmModule));
  }, [profile]);
  const load = useCallback(async () => {
    if (!config || !profile || !modules.includes(config.permission)) return;
    setLoading(true); setError("");
    try {
      const role = String(profile.role || "").trim().toLowerCase().replace(/[ -]/g, "_");
      const canViewTeam = ["super_admin", "admin", "manager"].includes(role);
      let query = (supabase as any).from(config.table).select(config.columns.join(",")).gte(config.dateColumn, fromDate + "T00:00:00").lte(config.dateColumn, toDate + "T23:59:59").order(config.dateColumn, { ascending: false });
      if (moduleKey === "strategy") query = (supabase as any).from(config.table).select(config.columns.join(",")).gte("strategy_year", Number(fromDate.slice(0, 4))).lte("strategy_year", Number(toDate.slice(0, 4))).order("strategy_year", { ascending: false });
      if (!canViewTeam && config.columns.includes("assigned_to")) query = query.eq("assigned_to", profile.id);
      const rows: ReportRecord[] = [];
      let offset = 0;
      while (true) {
        const { data: pageData, error: queryError } = await query.range(offset, offset + 999);
        if (queryError) throw queryError;
        const batch = (pageData || []) as ReportRecord[];
        rows.push(...batch);
        if (batch.length < 1000) break;
        offset += 1000;
      }
      const staffIds = [...new Set(rows.map(row => row.assigned_to).filter((value): value is string => typeof value === "string" && value.length > 0))];
      const leadIds = [...new Set(rows.map(row => row.lead_id).filter((value): value is string => typeof value === "string" && value.length > 0))];
      const [staffResult, leadResult] = await Promise.all([
        staffIds.length ? supabase.from("profiles").select("id,full_name").in("id", staffIds) : Promise.resolve({ data: [], error: null }),
        leadIds.length ? supabase.from("leads").select("id,full_name").in("id", leadIds) : Promise.resolve({ data: [], error: null }),
      ]);
      setStaffNames(Object.fromEntries((staffResult.data || []).map((item: any) => [item.id, item.full_name || "Unnamed staff member"])));
      setLeadNames(Object.fromEntries((leadResult.data || []).map((item: any) => [item.id, item.full_name || "Lead name unavailable"])));
      setRecords(rows);
      setPageNumber(0);
    } catch (e) { setRecords([]); setError(e instanceof Error ? e.message : "Unable to load this report. Check module access and database permissions."); }
    finally { setLoading(false); }
  }, [config, profile, modules, fromDate, toDate, moduleKey]);
  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!auth.user) { router.replace("/login"); return; }
        const { data, error: profileError } = await supabase.from("profiles").select("id,full_name,role,module_permissions").eq("id", auth.user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!data) {
          if (active) { setError("Your CRM profile could not be found. Please contact an administrator."); setLoading(false); }
          return;
        }
        if (active) setProfile(data as Profile);
      } catch (e) { if (active) { setError(e instanceof Error ? e.message : "Unable to verify your report access."); setLoading(false); } }
    }
    void loadProfile();
    return () => { active = false; };
  }, [router]);
  useEffect(() => { if (profile && config && modules.includes(config.permission)) void load(); else if (profile) setLoading(false); }, [profile, config, modules, load]);
  const visibleRecords = records.slice(pageNumber * pageSize, (pageNumber + 1) * pageSize);
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const record of records) { const status = config?.statusColumn ? String(record[config.statusColumn] || "Not set") : "All records"; counts[status] = (counts[status] || 0) + 1; }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [records, config]);
  function displayValue(record: ReportRecord, col: string) {
    const value = record[col];
    if (col === "assigned_to" && typeof value === "string") return staffNames[value] || "Unassigned / staff unavailable";
    if (col === "lead_id" && typeof value === "string") return leadNames[value] || "Lead name unavailable";
    if (col === "id" && typeof value === "string") return value.length > 12 ? value.slice(-8).toUpperCase() : value;
    if (value == null || value === "") return "—";
    return String(value);
  }
  function exportCsv() {
    if (!config) return;
    const csv = [config.columns.map(c => columnTitle(c, moduleKey)).map(csvCell).join(","), ...records.map(record => config.columns.map(c => csvCell(displayValue(record, c))).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = "ciu-" + moduleKey + "-report-" + fromDate + "-to-" + toDate + ".csv"; a.click(); URL.revokeObjectURL(url);
  }
  if (!config) return <main className="ciu-page" style={{ padding: 28 }}><h1>Report not found</h1><Link href="/reports">Return to Reports Centre</Link></main>;
  if (!loading && profile && !modules.includes(config.permission)) return <main className="ciu-page" style={{ padding: 28, color: "#173d34" }}><h1>Access restricted</h1><p>Your account does not have permission to view this module report.</p><Link href="/reports">Return to Reports Centre</Link></main>;
  const panel: React.CSSProperties = { background: "#fff", border: "1px solid #e1eae4", borderRadius: 14, padding: 18 };
  return <main className="ciu-page ciu-module-report" style={{ padding: "26px clamp(14px,3vw,32px) 44px", color: "#173d34" }}>
    <header className="ciu-hero ciu-module-report-hero" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}><div><div style={{ fontSize: 10, fontWeight: 850, letterSpacing: 1.5, color: "rgba(255,255,255,.78)" }}>MODULE REPORTS</div><h1 style={{ margin: "8px 0", fontSize: "clamp(25px,3vw,34px)", fontWeight: 850, color: "#fff" }}>{config.title}</h1><p style={{ margin: 0, color: "rgba(255,255,255,.82)", fontSize: 13 }}>{config.description}</p></div><Link href="/reports" style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,.4)", borderRadius: 9, padding: "10px 14px", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 12, fontWeight: 800, textDecoration: "none" }}>← Reports Centre</Link></header>
    <section style={{ ...panel, display: "flex", flexWrap: "wrap", alignItems: "end", gap: 12, marginBottom: 16 }}>
      <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 800 }}>From date<input type="date" value={fromDate} max={toDate} onChange={e => setFromDate(e.target.value)} style={{ padding: 10, border: "1px solid #d9e5dd", borderRadius: 8, color: "#173d34" }} /></label>
      <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 800 }}>To date<input type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)} style={{ padding: 10, border: "1px solid #d9e5dd", borderRadius: 8, color: "#173d34" }} /></label>
      <button onClick={() => void load()} disabled={loading} style={{ padding: "11px 15px", border: 0, borderRadius: 8, background: "#106053", color: "#fff", fontWeight: 800, cursor: "pointer" }}>{loading ? "Loading…" : "Refresh report"}</button>
      <button onClick={exportCsv} disabled={!records.length} style={{ padding: "11px 15px", border: "1px solid #cbded1", borderRadius: 8, background: "#f4faf5", color: "#106053", fontWeight: 800, cursor: "pointer" }}>Export CSV</button>
    </section>
    {error && <div role="alert" style={{ ...panel, borderColor: "#f0c7c7", color: "#a12e2e", marginBottom: 16 }}>Could not load this report: {error}</div>}
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
      <div style={panel}><div style={{ color: "#718078", fontSize: 11, fontWeight: 800 }}>RECORDS IN PERIOD</div><div style={{ fontSize: 30, fontWeight: 850, marginTop: 7 }}>{records.length.toLocaleString()}</div><div style={{ fontSize: 11, color: "#718078", marginTop: 5 }}>All matching records loaded</div></div>
      {statusCounts.slice(0, 3).map(([status, count]) => <div key={status} style={panel}><div style={{ color: "#718078", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>{status}</div><div style={{ fontSize: 25, fontWeight: 850, marginTop: 7 }}>{count.toLocaleString()}</div></div>)}
    </section>
    <section style={{ ...panel, padding: 0, overflow: "hidden" }}><div style={{ padding: 16, borderBottom: "1px solid #e5eee8", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}><strong style={{ fontSize: 14 }}>Report records</strong><span style={{ fontSize: 11, color: "#718078" }}>{fromDate} – {toDate}</span></div>
      {loading ? <div style={{ padding: 24, color: "#718078" }}>Loading report records…</div> : records.length ? <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%", minWidth: 650, fontSize: 12 }}><thead><tr>{config.columns.map(col => <th key={col} style={{ textAlign: "left", padding: 12, background: "#f3f8f4", color: "#526d60", whiteSpace: "nowrap" }}>{columnTitle(col, moduleKey)}</th>)}</tr></thead><tbody>{visibleRecords.map((record, index) => <tr key={String(record.id ?? (pageNumber * pageSize + index))}>{config.columns.map(col => <td key={col} style={{ padding: 12, borderTop: "1px solid #edf2ee", whiteSpace: "nowrap" }}>{displayValue(record, col)}</td>)}</tr>)}</tbody></table></div> : <div style={{ padding: 24, color: "#718078" }}>No records were found for this period. If you expected data, check the selected dates and your database access.</div>}
    </section>
    {!loading && records.length > pageSize && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 12, padding: "10px 2px" }}>
      <span style={{ color: "#718078", fontSize: 11 }}>Showing {(pageNumber * pageSize + 1).toLocaleString()}–{Math.min((pageNumber + 1) * pageSize, records.length).toLocaleString()} of {records.length.toLocaleString()} records</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" onClick={() => setPageNumber(value => Math.max(0, value - 1))} disabled={pageNumber === 0} style={{ padding: "8px 12px", border: "1px solid #cbded1", borderRadius: 8, background: "#fff", color: "#106053", fontWeight: 750, opacity: pageNumber === 0 ? .45 : 1 }}>Previous</button>
        <span style={{ color: "#526d60", fontSize: 11 }}>Page {pageNumber + 1} of {pageCount}</span>
        <button type="button" onClick={() => setPageNumber(value => Math.min(pageCount - 1, value + 1))} disabled={pageNumber >= pageCount - 1} style={{ padding: "8px 12px", border: "1px solid #cbded1", borderRadius: 8, background: "#fff", color: "#106053", fontWeight: 750, opacity: pageNumber >= pageCount - 1 ? .45 : 1 }}>Next</button>
      </div>
    </div>}
    <p style={{ color: "#7a8981", fontSize: 10, lineHeight: 1.6, marginTop: 12 }}>This report loads all matching records in pages so the totals and CSV export are not capped at 1,000 rows. The table displays 100 rows per page. Data visibility still follows your account permissions and database policies.</p>
    <style jsx>{` .ciu-module-report { font-family: inherit; } .ciu-module-report-hero { border-radius: 18px; box-shadow: 0 14px 34px rgba(0,77,64,.16); } .ciu-module-report section { border-color: #dfe9e5 !important; border-radius: 14px !important; box-shadow: 0 7px 24px rgba(28,58,49,.06); } .ciu-module-report button { font-family: inherit; } @media (max-width: 700px) { .ciu-module-report-hero { padding: 20px !important; } } `}</style>
  </main>;
}
