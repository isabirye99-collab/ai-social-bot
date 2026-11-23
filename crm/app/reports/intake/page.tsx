"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useIntakeSelection } from "@/lib/use-intake-selection";

type LeadRecord = { id: string; name: string | null; phone: string | null; email: string | null; status: string | null; follow_up_status: string | null; assigned_to: string | null; product_service: string | null; intake_year: number | null; intake_month: number | null; created_at: string | null };
type Staff = { id: string; full_name: string | null };
const supabase = createClient();
const intakeOptions = [{ value: "unassigned", label: "Needs intake assignment" }, { value: "2026-11", label: "November 2026" }, { value: "2027-2", label: "February 2027" }, { value: "2027-4", label: "April 2027" }, { value: "2027-8", label: "August 2027" }, { value: "2027-11", label: "November 2027" }, { value: "2028-2", label: "February 2028" }];
const styles: Record<string, React.CSSProperties> = { panel: { background: "#fff", border: "1px solid #e1eae4", borderRadius: 14, padding: 18 }, label: { color: "#718078", fontSize: 11, fontWeight: 800 } };

export default function IntakeReportPage() {
  const router = useRouter();
  const [selectedIntake, setSelectedIntake] = useIntakeSelection();
  const [rows, setRows] = useState<LeadRecord[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canViewTeam, setCanViewTeam] = useState(false);
  const [viewerName, setViewerName] = useState("");
  const selectedLabel = intakeOptions.find(item => item.value === selectedIntake)?.label || selectedIntake;
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) { router.replace("/login"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("id,full_name,role,module_permissions").eq("id", auth.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw new Error("Your CRM profile could not be found.");
      const role = String(profile.role || "").trim().toLowerCase().replace(/[ -]/g, "_");
      const teamAccess = ["super_admin", "admin", "manager"].includes(role);
      setCanViewTeam(teamAccess); setViewerName(profile.full_name || "Your account");
      let query = supabase.from("leads").select("id,name,phone,email,status,follow_up_status,assigned_to,product_service,intake_year,intake_month,created_at").order("created_at", { ascending: false }).limit(2000);
      if (selectedIntake === "unassigned") query = query.or("intake_year.is.null,intake_month.is.null");
      else { const [year, month] = selectedIntake.split("-").map(Number); query = query.eq("intake_year", year).eq("intake_month", month); }
      if (!teamAccess) query = query.eq("assigned_to", auth.user.id);
      const { data, error: leadsError } = await query;
      if (leadsError) throw leadsError;
      const records = (data || []) as LeadRecord[];
      const staffIds = [...new Set(records.map(item => item.assigned_to).filter((id): id is string => Boolean(id)))];
      if (staffIds.length) {
        const { data: staff, error: staffError } = await supabase.from("profiles").select("id,full_name").in("id", staffIds);
        if (staffError) throw staffError;
        setStaffNames(Object.fromEntries(((staff || []) as Staff[]).map(item => [item.id, item.full_name || "Unnamed staff member"])));
      } else setStaffNames({});
      setRows(records);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load the intake report."); setRows([]); }
    finally { setLoading(false); }
  }, [selectedIntake, router]);
  useEffect(() => { void load(); }, [load]);
  const fmtDate = (value: string | null) => value ? new Date(value).toLocaleDateString("en-UG", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const counts = { total: rows.length, interested: rows.filter(r => /interested|qualified/i.test(`${r.status || ""} ${r.follow_up_status || ""}`)).length, applied: rows.filter(r => /applied|application submitted|converted/i.test(`${r.status || ""} ${r.follow_up_status || ""}`)).length, admitted: rows.filter(r => /admitted/i.test(`${r.status || ""} ${r.follow_up_status || ""}`)).length, enrolled: rows.filter(r => /enrolled|registered/i.test(`${r.status || ""} ${r.follow_up_status || ""}`)).length };
  return <main className="ciu-page ciu-intake-report" style={{ padding: "26px clamp(14px,3vw,32px) 44px", color: "#173d34" }}>
    <header className="ciu-hero ciu-intake-report-hero" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}><div><div style={{ fontSize: 10, fontWeight: 850, letterSpacing: 1.5, color: "rgba(255,255,255,.78)" }}>INTAKE REPORT</div><h1 style={{ margin: "8px 0", fontSize: "clamp(25px,3vw,34px)", fontWeight: 850, color: "#fff" }}>Recruitment by intake</h1><p style={{ margin: 0, color: "rgba(255,255,255,.82)", fontSize: 13 }}>{canViewTeam ? "Review recruitment records assigned to the selected intake across the team." : `Showing recruitment records assigned to ${viewerName}.`}</p></div><Link href="/reports" style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,.4)", borderRadius: 9, padding: "10px 14px", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 12, fontWeight: 800, textDecoration: "none" }}>← Reports Centre</Link></header>
    <section style={{ ...styles.panel, display: "flex", alignItems: "end", flexWrap: "wrap", gap: 12, marginBottom: 16 }}><label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 800 }}>Select intake<select value={selectedIntake} onChange={e => setSelectedIntake(e.target.value)} style={{ minWidth: 220, padding: 11, border: "1px solid #d9e5dd", borderRadius: 8, color: "#173d34", background: "#fff" }}>{intakeOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button onClick={() => void load()} disabled={loading} style={{ padding: "11px 15px", border: 0, borderRadius: 8, background: "#106053", color: "#fff", fontWeight: 800, cursor: "pointer" }}>{loading ? "Loading…" : "Refresh report"}</button></section>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 16 }}>{Object.entries(counts).map(([label, count]) => <div key={label} style={styles.panel}><div style={{ ...styles.label, textTransform: "uppercase" }}>{label === "total" ? "Leads" : label}</div><div style={{ fontSize: 28, fontWeight: 850, marginTop: 7 }}>{count.toLocaleString()}</div></div>)}</section>
    {error && <div role="alert" style={{ ...styles.panel, borderColor: "#f0c7c7", color: "#a12e2e", marginBottom: 16 }}>Could not load this report: {error}</div>}
    <section style={{ ...styles.panel, padding: 0, overflow: "hidden" }}><div style={{ padding: 16, borderBottom: "1px solid #e5eee8", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}><strong>{selectedLabel} · Lead records</strong><span style={{ fontSize: 11, color: "#718078" }}>{rows.length.toLocaleString()} records</span></div>{loading ? <div style={{ padding: 24, color: "#718078" }}>Loading intake records…</div> : rows.length ? <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900, fontSize: 12 }}><thead><tr>{["Student / Lead", "Phone", "Email", "Programme / Product", "Status", "Assigned To", "Created"].map(label => <th key={label} style={{ textAlign: "left", padding: 12, background: "#f3f8f4", color: "#526d60", whiteSpace: "nowrap" }}>{label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id}><td style={{ padding: 12, borderTop: "1px solid #edf2ee" }}>{row.name || `Lead ${i + 1}`}</td><td style={{ padding: 12, borderTop: "1px solid #edf2ee" }}>{row.phone || "—"}</td><td style={{ padding: 12, borderTop: "1px solid #edf2ee" }}>{row.email || "—"}</td><td style={{ padding: 12, borderTop: "1px solid #edf2ee" }}>{row.product_service || "Not specified"}</td><td style={{ padding: 12, borderTop: "1px solid #edf2ee" }}>{row.follow_up_status || row.status || "Not set"}</td><td style={{ padding: 12, borderTop: "1px solid #edf2ee" }}>{row.assigned_to ? staffNames[row.assigned_to] || "Staff name unavailable" : "Unassigned"}</td><td style={{ padding: 12, borderTop: "1px solid #edf2ee", whiteSpace: "nowrap" }}>{fmtDate(row.created_at)}</td></tr>)}</tbody></table></div> : <div style={{ padding: 24, color: "#718078" }}>No leads found for {selectedLabel}. Check the intake assignment or choose another intake.</div>}</section>
    <p style={{ color: "#7a8981", fontSize: 10, lineHeight: 1.6, marginTop: 12 }}>This report is filtered to the selected intake. Staff-level accounts only see records assigned to their account; management roles can review team records.</p>
    <style jsx>{` .ciu-intake-report { font-family: inherit; } .ciu-intake-report-hero { border-radius: 18px; box-shadow: 0 14px 34px rgba(0,77,64,.16); } .ciu-intake-report section { border-color: #dfe9e5 !important; border-radius: 14px !important; box-shadow: 0 7px 24px rgba(28,58,49,.06); } .ciu-intake-report button, .ciu-intake-report select { font-family: inherit; } @media (max-width: 700px) { .ciu-intake-report-hero { padding: 20px !important; } } `}</style>
  </main>;
}