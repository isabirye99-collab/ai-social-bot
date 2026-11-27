"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Profile = { id: string; full_name: string | null; role: string | null; is_active: boolean | null };
type Interaction = { id: string; lead_id: string | null; channel: string | null; response: string | null; outcome: string | null; assigned_to: string | null; contacted_at: string | null; created_by: string | null };
type CalendarDay = { calendar_date: string; title: string; day_type: "public_holiday" | "ciu_closure" | "working_day"; is_active: boolean };
type Absence = { salesperson_id: string; absence_date: string; day_fraction: number; status: string };

const supabase = createClient();
const managementRoles = ["super_admin", "admin", "manager"];

function eatDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") values[part.type] = part.value;
  return `${values.year}-${values.month}-${values.day}`;
}
function dateBoundsEAT(day: string) {
  const start = new Date(`${day}T00:00:00+03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}
function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export default function ContactPerformanceReportPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => eatDateKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.replace("/login"); return; }
      const { data: current, error: profileError } = await supabase.from("profiles").select("id,full_name,role,is_active").eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!current) { router.replace("/dashboard"); return; }
      const currentProfile = current as Profile;
      if (!managementRoles.includes(currentProfile.role || "") && currentProfile.role !== "salesperson") {
        setProfile(currentProfile);
        setError("This report is available to salespeople and authorised management only.");
        return;
      }
      setProfile(currentProfile);
      const { start, end } = dateBoundsEAT(selectedDate);
      const management = managementRoles.includes(currentProfile.role || "");
      const [staffResult, interactionResult, calendarResult, absenceResult] = await Promise.all([
        supabase.from("profiles").select("id,full_name,role,is_active").eq("is_active", true).eq("role", "salesperson").order("full_name"),
        supabase.from("engagement_interactions").select("id,lead_id,channel,response,outcome,assigned_to,contacted_at,created_by").gte("contacted_at", start).lt("contacted_at", end).order("contacted_at", { ascending: false }).range(0, 9999),
        supabase.from("ciu_working_calendar").select("calendar_date,title,day_type,is_active").eq("calendar_date", selectedDate),
        supabase.from("salesperson_absence_requests").select("salesperson_id,absence_date,day_fraction,status").eq("absence_date", selectedDate).eq("status", "approved"),
      ]);
      for (const result of [staffResult, interactionResult, calendarResult, absenceResult]) if (result.error) throw result.error;
      setStaff(((staffResult.data || []) as Profile[]).filter(person => management || person.id === user.id));
      setInteractions((interactionResult.data || []) as Interaction[]);
      setCalendar((calendarResult.data || []) as CalendarDay[]);
      setAbsences((absenceResult.data || []) as Absence[]);
      setRefreshedAt(new Intl.DateTimeFormat("en-UG", { timeZone: "Africa/Kampala", dateStyle: "medium", timeStyle: "short" }).format(new Date()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load contact performance. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [router, selectedDate]);

  useEffect(() => { void load(); }, [load]);

  const report = useMemo(() => {
    const override = calendar.find(day => day.calendar_date === selectedDate && day.is_active);
    const weekday = new Date(`${selectedDate}T12:00:00Z`).getUTCDay();
    const workingDay = override ? override.day_type === "working_day" : weekday !== 0 && weekday !== 6;
    const visibleStaffIds = new Set(staff.map(person => person.id));
    const qualifying = interactions.filter(item => {
      const channel = (item.channel || "").trim().toLowerCase();
      const response = (item.response || "").trim().toLowerCase();
      const outcome = (item.outcome || "").trim().toLowerCase();
      const creditedTo = item.created_by || item.assigned_to;
      return channel === "outgoing_call" && response === "answered" && outcome !== "wrong number" && Boolean(item.lead_id) && Boolean(creditedTo) && visibleStaffIds.has(creditedTo as string);
    });
    const rows = staff.map(person => {
      const credited = qualifying.filter(item => (item.created_by || item.assigned_to) === person.id);
      const unique = new Set(credited.map(item => item.lead_id)).size;
      const absence = Math.min(1, absences.filter(item => item.salesperson_id === person.id).reduce((sum, item) => sum + Number(item.day_fraction || 0), 0));
      const target = workingDay ? Math.max(0, Math.round(50 * (1 - absence))) : 0;
      return { ...person, contacted: unique, answeredCalls: credited.length, target, absence, status: target === 0 ? "No target today" : unique >= target ? "Target achieved" : unique > 0 ? "Below target" : "No qualifying calls" };
    }).sort((a, b) => b.contacted - a.contacted || (a.full_name || "").localeCompare(b.full_name || ""));
    return { rows, qualifyingCalls: qualifying.length, workingDay, holiday: override?.title || "", uniqueStudents: new Set(qualifying.map(item => item.lead_id)).size };
  }, [staff, interactions, calendar, absences, selectedDate]);

  const exportCsv = () => {
    const rows = [
      ["CIU Salesperson Contact Performance"],
      ["Report date (East Africa Time)", selectedDate],
      ["Working day", report.workingDay ? "Yes" : "No"],
      ["Calendar note", report.holiday || ""],
      ["Generated at (EAT)", refreshedAt],
      [],
      ["Salesperson", "Unique students reached", "Answered calls", "Adjusted target", "Approved absence fraction", "Status"],
      ...report.rows.map(person => [person.full_name || "Salesperson", person.contacted, person.answeredCalls, person.target, person.absence, person.status]),
    ];
    const csv = rows.map(row => row.map((cell: string | number) => csvCell(cell)).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ciu-salesperson-contact-performance-${selectedDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <main className="ciu-page" style={{ padding: "28px clamp(16px,3vw,34px) 48px", color: "#173d34" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, fontSize: 12 }}><Link href="/reports" style={{ color: "#176849", textDecoration: "none", fontWeight: 750 }}>Reports Centre</Link><span style={{ color: "#8b9a91" }}>/</span><span>Salesperson Contact Performance</span></div>
    <header style={{ background: "#fff", border: "1px solid #dfe9e3", borderRadius: 16, padding: "22px clamp(16px,3vw,28px)", marginBottom: 18, boxShadow: "0 5px 20px rgba(19,62,45,.035)" }}>
      <div style={{ color: "#16715b", fontSize: 10, fontWeight: 850, letterSpacing: 1.7 }}>CLARKE INTERNATIONAL UNIVERSITY · REPORTS</div>
      <h1 style={{ margin: "9px 0", fontSize: "clamp(25px,3vw,34px)", fontWeight: 850 }}>Salesperson Contact Performance</h1>
      <p style={{ maxWidth: 800, margin: 0, color: "#65796d", fontSize: 13, lineHeight: 1.7 }}>Measures unique students reached through answered outgoing phone calls. Each student counts once per salesperson per day and is credited to the staff member who recorded the call. The standard target is 50 on an official working day, adjusted proportionately for approved absence.</p>
      <div style={{ display: "flex", alignItems: "end", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
        <label style={{ display: "grid", gap: 6, color: "#4e665a", fontSize: 11, fontWeight: 800 }}>REPORT DATE (EAT)<input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} style={{ border: "1px solid #cbded1", borderRadius: 8, padding: "10px 12px", color: "#173d34", font: "inherit" }} /></label>
        <button type="button" onClick={() => void load()} disabled={loading} style={{ border: 0, borderRadius: 8, padding: "11px 15px", background: "#106053", color: "#fff", fontWeight: 800, cursor: loading ? "wait" : "pointer" }}>{loading ? "Refreshing…" : "Refresh report"}</button>
        <button type="button" onClick={exportCsv} disabled={loading || report.rows.length === 0} style={{ border: "1px solid #bfd8c8", borderRadius: 8, padding: "10px 14px", background: "#fff", color: "#176849", fontWeight: 800, cursor: loading || report.rows.length === 0 ? "not-allowed" : "pointer" }}>Export CSV for Excel</button>
      </div>
    </header>
    {error && <div role="alert" style={{ background: "#fff8f7", border: "1px solid #f0ceca", color: "#922d25", padding: 14, borderRadius: 10, marginBottom: 16 }}>{error}</div>}
    {loading ? <div style={{ background: "#fff", border: "1px solid #dfe9e3", borderRadius: 12, padding: 22 }}>Loading contact performance…</div> : !error && <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12, marginBottom: 18 }}>
        {[{ label: "Salespeople in report", value: report.rows.length }, { label: "Unique students reached", value: report.uniqueStudents }, { label: "Answered calls qualifying", value: report.qualifyingCalls }, { label: "Working day", value: report.workingDay ? "Yes" : "No" }].map(item => <div key={item.label} style={{ background: "#fff", border: "1px solid #dfe9e3", borderRadius: 12, padding: 16 }}><div style={{ color: "#708278", fontSize: 11 }}>{item.label}</div><div style={{ marginTop: 8, fontSize: 26, fontWeight: 850, color: "#145848" }}>{item.value}</div></div>)}
      </div>
      <section style={{ background: "#fff", border: "1px solid #dfe9e3", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", background: "#f0f8f3", borderBottom: "1px solid #dce9e1", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}><h2 style={{ margin: 0, fontSize: 16, fontWeight: 850 }}>Daily target attainment</h2><span style={{ color: "#61776a", fontSize: 11 }}>{report.holiday ? `Calendar: ${report.holiday}` : report.workingDay ? "Official working day" : "Weekend / non-working day"} · Updated {refreshedAt}</span></div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 690 }}>
          <thead><tr style={{ textAlign: "left", color: "#52665a", fontSize: 11, background: "#fbfdfb" }}>{["Salesperson", "Unique students", "Answered calls", "Adjusted target", "Progress", "Status"].map(label => <th key={label} style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8e3" }}>{label}</th>)}</tr></thead>
          <tbody>{report.rows.map(person => { const pct = person.target > 0 ? Math.min(100, Math.round(person.contacted / person.target * 100)) : 0; return <tr key={person.id}><td style={{ padding: 12, borderBottom: "1px solid #eef2ef", fontSize: 12, fontWeight: 750 }}>{person.full_name || "Salesperson"}</td><td style={{ padding: 12, borderBottom: "1px solid #eef2ef", fontSize: 12 }}>{person.contacted}</td><td style={{ padding: 12, borderBottom: "1px solid #eef2ef", fontSize: 12 }}>{person.answeredCalls}</td><td style={{ padding: 12, borderBottom: "1px solid #eef2ef", fontSize: 12 }}>{person.target}{person.absence > 0 ? <div style={{ color: "#718078", fontSize: 10 }}>{Math.round(person.absence * 100)}% approved absence</div> : null}</td><td style={{ padding: 12, borderBottom: "1px solid #eef2ef", minWidth: 120 }}><div style={{ height: 7, background: "#e8efe9", borderRadius: 999, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "#15803d" : "#8bc63f", borderRadius: 999 }} /></div><div style={{ marginTop: 5, fontSize: 10, color: "#61776a" }}>{person.target ? `${pct}%` : "N/A"}</div></td><td style={{ padding: 12, borderBottom: "1px solid #eef2ef", fontSize: 11, fontWeight: 750, color: person.status === "Target achieved" ? "#15803d" : "#6b7280" }}>{person.status}</td></tr>; })}</tbody>
        </table></div>
        {!report.rows.length && <div style={{ padding: 18, color: "#718078", fontSize: 12 }}>No active salesperson records are available for this report.</div>}
      </section>
      <p style={{ color: "#718078", fontSize: 11, lineHeight: 1.7, marginTop: 14 }}>Counts include only outgoing calls marked Answered, with a linked lead and a recorded staff attribution. Wrong Number outcomes are excluded. A zero target indicates a non-working day or a fully approved absence; it is not treated as a failed target.</p>
    </>}
  </main>;
}
