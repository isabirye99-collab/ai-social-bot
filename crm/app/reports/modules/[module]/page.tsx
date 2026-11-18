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
  leads: { title: "Lead & Recruitment Report", description: "Lead records created in the selected reporting period.", table: "leads", permission: "leads", columns: ["id", "created_at", "status", "assigned_to", "product_service"], dateColumn: "created_at", statusColumn: "status" },
  tasks: { title: "Tasks & Productivity Report", description: "Task creation, ownership and completion status for the selected period.", table: "tasks", permission: "tasks", columns: ["id", "created_at", "status", "assigned_to", "task_type", "completed_at"], dateColumn: "created_at", statusColumn: "status" },
  partnerships: { title: "Partnerships Report", description: "Partner records and relationship status.", table: "partnerships", permission: "partnerships", columns: ["id", "created_at", "name", "category", "status"], dateColumn: "created_at", statusColumn: "status" },
  alumni: { title: "Alumni Relations Report", description: "Alumni profile records and verification status.", table: "alumni", permission: "alumni", columns: ["id", "created_at", "full_name", "program", "graduation_year", "verification_status", "employment_status"], dateColumn: "created_at", statusColumn: "verification_status" },
  pipeline: { title: "Admissions Pipeline Report", description: "Admissions records and their current stage.", table: "admissions", permission: "pipeline", columns: ["id", "created_at", "stage", "assigned_to", "lead_id"], dateColumn: "created_at", statusColumn: "stage" },
  customers: { title: "Customer Records Report", description: "Enrolled student records are managed through the admissions pipeline.", table: "admissions", permission: "customers", columns: ["id", "created_at", "stage", "assigned_to", "lead_id"], dateColumn: "created_at", statusColumn: "stage" },
  strategy: { title: "Strategy & Intake Report", description: "Annual strategy plans and the reporting year they cover.", table: "strategy_plans", permission: "strategy", columns: ["id", "strategy_year", "updated_at"], dateColumn: "updated_at" },
  marketing: { title: "Marketing Activity Report", description: "Campaigns, channels, dates and recorded campaign budgets.", table: "campaigns", permission: "marketing", columns: ["id", "name", "channel", "start_date", "end_date", "budget", "currency", "created_at"], dateColumn: "created_at" },
};
const supabase = createClient();
const titles: Record<string, string> = { id: "Record ID", created_at: "Created", updated_at: "Last Updated", status: "Status", assigned_to: "Assigned To", product_service: "Programme / Product", task_type: "Task Type", completed_at: "Completed", name: "Name", category: "Category", full_name: "Alumnus", program: "Programme", graduation_year: "Graduation Year", verification_status: "Verification", employment_status: "Employment", stage: "Stage", lead_id: "Lead ID", strategy_year: "Strategy Year", channel: "Channel", start_date: "Campaign Start", end_date: "Campaign End", budget: "Budget", currency: "Currency" };
function csvCell(value: unknown) { const text = value == null ? "" : String(value); return '"' + text.replace(/"/g, '""') + '"'; }
function day(value: Date) { return value.toISOString().slice(0, 10); }

export default function ModuleReportPage() {
  const params = useParams<{ module: string }>();
  const router = useRouter();
  const moduleKey = String(params.module || "");
  const config = configs[moduleKey];
  const [profile, setProfile] = useState<Profile | null>(null);
  const [records, setRecords] = useState<ReportRecord[]>([]);
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
      let query = supabase.from(config.table).select(config.columns.join(",")).gte(config.dateColumn, fromDate + "T00:00:00").lte(config.dateColumn, toDate + "T23:59:59").order(config.dateColumn, { ascending: false }).limit(1000);
      if (moduleKey === "strategy") query = supabase.from(config.table).select(config.columns.join(",")).gte("strategy_year", Number(fromDate.slice(0, 4))).lte("strategy_year", Number(toDate.slice(0, 4))).order("strategy_year", { ascending: false }).limit(1000);
      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      setRecords((data || []) as ReportRecord[]);
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
        if (active) setProfile(data as Profile | null);
      } catch (e) { if (active) { setError(e instanceof Error ? e.message : "Unable to verify your report access."); setLoading(false); } }
    }
    void loadProfile();
    return () => { active = false; };
  }, [router]);
  useEffect(() => { if (profile && config && modules.includes(config.permission)) void load(); else if (profile) setLoading(false); }, [profile, config, modules, load]);
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const record of records) { const status = config?.statusColumn ? String(record[config.statusColumn] || "Not set") : "All records"; counts[status] = (counts[status] || 0) + 1; }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [records, config]);
  function exportCsv() {
    if (!config) return;
    const csv = [config.columns.map(c => titles[c] || c).map(csvCell).join(","), ...records.map(record => config.columns.map(c => csvCell(record[c])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = "ciu-" + moduleKey + "-report-" + fromDate + "-to-" + toDate + ".csv"; a.click(); URL.revokeObjectURL(url);
  }
  if (!config) return <main className="ciu-page" style={{ padding: 28 }}><h1>Report not found</h1><Link href="/reports">Return to Reports Centre</Link></main>;
  if (!loading && profile && !modules.includes(config.permission)) return <main className="ciu-page" style={{ padding: 28, color: "#173d34" }}><h1>Access restricted</h1><p>Your account does not have permission to view this module report.</p><Link href="/reports">Return to Reports Centre</Link></main>;
  const panel: React.CSSProperties = { background: "#fff", border: "1px solid #e1eae4", borderRadius: 14, padding: 18 };
  return <main className="ciu-page" style={{ padding: "26px clamp(14px,3vw,32px) 44px", color: "#173d34" }}>
    <div style={{ marginBottom: 18 }}><Link href="/reports" style={{ color: "#16715b", fontSize: 12, fontWeight: 800, textDecoration: "none" }}>← Reports Centre</Link><div style={{ marginTop: 16, color: "#16715b", fontSize: 10, fontWeight: 850, letterSpacing: 1.5 }}>MODULE REPORTS</div><h1 style={{ margin: "7px 0", fontSize: "clamp(25px,3vw,34px)", fontWeight: 850 }}>{config.title}</h1><p style={{ margin: 0, color: "#718078", fontSize: 13 }}>{config.description}</p></div>
    <section style={{ ...panel, display: "flex", flexWrap: "wrap", alignItems: "end", gap: 12, marginBottom: 16 }}>
      <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 800 }}>From date<input type="date" value={fromDate} max={toDate} onChange={e => setFromDate(e.target.value)} style={{ padding: 10, border: "1px solid #d9e5dd", borderRadius: 8, color: "#173d34" }} /></label>
      <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 800 }}>To date<input type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)} style={{ padding: 10, border: "1px solid #d9e5dd", borderRadius: 8, color: "#173d34" }} /></label>
      <button onClick={() => void load()} disabled={loading} style={{ padding: "11px 15px", border: 0, borderRadius: 8, background: "#106053", color: "#fff", fontWeight: 800, cursor: "pointer" }}>{loading ? "Loading…" : "Refresh report"}</button>
      <button onClick={exportCsv} disabled={!records.length} style={{ padding: "11px 15px", border: "1px solid #cbded1", borderRadius: 8, background: "#f4faf5", color: "#106053", fontWeight: 800, cursor: "pointer" }}>Export CSV</button>
    </section>
    {error && <div role="alert" style={{ ...panel, borderColor: "#f0c7c7", color: "#a12e2e", marginBottom: 16 }}>Could not load this report: {error}</div>}
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
      <div style={panel}><div style={{ color: "#718078", fontSize: 11, fontWeight: 800 }}>RECORDS IN PERIOD</div><div style={{ fontSize: 30, fontWeight: 850, marginTop: 7 }}>{records.length.toLocaleString()}</div><div style={{ fontSize: 11, color: "#718078", marginTop: 5 }}>Showing up to 1,000 matching records</div></div>
      {statusCounts.slice(0, 3).map(([status, count]) => <div key={status} style={panel}><div style={{ color: "#718078", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>{status}</div><div style={{ fontSize: 25, fontWeight: 850, marginTop: 7 }}>{count.toLocaleString()}</div></div>)}
    </section>
    <section style={{ ...panel, padding: 0, overflow: "hidden" }}><div style={{ padding: 16, borderBottom: "1px solid #e5eee8", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}><strong style={{ fontSize: 14 }}>Report records</strong><span style={{ fontSize: 11, color: "#718078" }}>{fromDate} – {toDate}</span></div>
      {loading ? <div style={{ padding: 24, color: "#718078" }}>Loading report records…</div> : records.length ? <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%", minWidth: 650, fontSize: 12 }}><thead><tr>{config.columns.map(col => <th key={col} style={{ textAlign: "left", padding: 12, background: "#f3f8f4", color: "#526d60", whiteSpace: "nowrap" }}>{titles[col] || col}</th>)}</tr></thead><tbody>{records.map((record, index) => <tr key={String(record.id ?? index)}>{config.columns.map(col => <td key={col} style={{ padding: 12, borderTop: "1px solid #edf2ee", whiteSpace: "nowrap" }}>{record[col] == null ? "—" : String(record[col])}</td>)}</tr>)}</tbody></table></div> : <div style={{ padding: 24, color: "#718078" }}>No records were found for this period. If you expected data, check the selected dates and your database access.</div>}
    </section>
    <p style={{ color: "#7a8981", fontSize: 10, lineHeight: 1.6, marginTop: 12 }}>This report shows up to 1,000 records and reflects the permissions enforced by your account and database policies. Export includes the records currently loaded.</p>
  </main>;
}
