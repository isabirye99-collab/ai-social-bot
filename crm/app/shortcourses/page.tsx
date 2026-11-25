"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Phone, MessageCircle, Plus, Search, RefreshCw, BookOpen, Users, ClipboardCheck, CalendarClock, X, Save, Download, Trash2 } from "lucide-react";

type Course = { id: string; title: string; course_code: string | null; description: string | null; category: string | null; duration: string | null; delivery_mode: string; venue: string | null; fee_amount: number | null; currency: string; start_date: string | null; end_date: string | null; application_deadline: string | null; status: string; public_visible: boolean; created_at: string };
type Applicant = { id: string; application_number: number; course_id: string; first_name: string; last_name: string; phone: string; email: string | null; date_of_birth: string | null; gender: string | null; nationality: string | null; highest_qualification: string | null; qualification_details: string | null; source: string | null; expected_outcome: string | null; application_status: string; attendance_status: string; assigned_to: string | null; last_contacted_at: string | null; last_feedback: string | null; next_follow_up_at: string | null; registration_date: string | null; first_class_date: string | null; application_date: string | null; application_fee_amount: number; payment_method: string | null; payment_status: string; payment_reference: string | null; payment_proof_path: string | null; submitted_at: string; created_at: string };
type Staff = { id: string; full_name: string | null; role: string; is_active: boolean };
type Activity = { id: string; application_id: string; activity_type: string; outcome: string | null; notes: string | null; next_follow_up_at: string | null; created_at: string };
const statuses = ["new", "contacted", "qualified", "registered", "waitlisted", "not_eligible", "withdrawn", "completed"];
const attendanceStatuses = ["not_started", "attending", "irregular", "not_attending", "completed", "withdrawn"];
const label = (v: string) => v.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
const dateLabel = (v?: string | null) => v ? new Date(v).toLocaleDateString() : "—";
const input: React.CSSProperties = { width: "100%", border: "1px solid #d7e4dc", borderRadius: 9, padding: "10px 12px", color: "#18392b", background: "#fff", fontSize: 13 };
const button: React.CSSProperties = { border: "1px solid #d4e3da", borderRadius: 9, padding: "9px 12px", fontSize: 12, fontWeight: 700, background: "#fff", color: "#185642", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };

export default function ShortCoursesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [courses, setCourses] = useState<Course[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState("applicants");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [activityType, setActivityType] = useState("call");
  const [activityOutcome, setActivityOutcome] = useState("Reached");
  const [activityNotes, setActivityNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceValue, setAttendanceValue] = useState("present");
  const [attendanceNotes, setAttendanceNotes] = useState("");
  const blankCourse = { title: "", course_code: "", description: "", category: "", duration: "", delivery_mode: "In person", venue: "", fee_amount: "", currency: "UGX", start_date: "", end_date: "", application_deadline: "", status: "draft", public_visible: false };
  const [courseForm, setCourseForm] = useState(blankCourse);

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      setUserId(auth.user?.id || null);
      const [courseRes, staffRes] = await Promise.all([
        supabase.from("short_courses").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name,role,is_active").eq("is_active", true).order("full_name"),
      ]);
      if (courseRes.error) throw courseRes.error;
      if (staffRes.error) throw staffRes.error;
      setCourses((courseRes.data || []) as Course[]);
      setStaff((staffRes.data || []) as Staff[]);
      const all: Applicant[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error: e } = await supabase.from("short_course_applications").select("*").order("application_date", { ascending: false, nullsFirst: false }).range(from, from + 999);
        if (e) throw e;
        all.push(...((data || []) as Applicant[]));
        if (!data || data.length < 1000) break;
      }
      setApplicants(all);
      const { data: acts, error: ae } = await supabase.from("short_course_activities").select("*").order("created_at", { ascending: false }).limit(500);
      if (ae) throw ae;
      setActivities((acts || []) as Activity[]);
    } catch (e: any) { setError(e?.message || "Unable to load short-course records. Check that your account has Short Courses access."); }
    finally { setLoading(false); }
  }, [supabase]);
  useEffect(() => { void loadAll(); }, [loadAll]);

  const selected = applicants.find((a) => a.id === selectedId) || null;
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const filtered = useMemo(() => applicants.filter((a) => {
    const q = search.trim().toLowerCase();
    const match = !q || [a.first_name, a.last_name, a.phone, a.email, String(a.application_number), a.nationality].some((v) => String(v || "").toLowerCase().includes(q));
    return match && (courseFilter === "all" || a.course_id === courseFilter) && (statusFilter === "all" || a.application_status === statusFilter);
  }), [applicants, search, courseFilter, statusFilter]);
  const activeCourses = courses.filter((c) => c.status === "active");
  const followUps = applicants.filter((a) => a.next_follow_up_at && new Date(a.next_follow_up_at) <= new Date() && !["completed", "withdrawn"].includes(a.application_status));
  const stats = [
    { label: "Applications", value: applicants.length, icon: Users, hint: "All recorded applicants" },
    { label: "Active short courses", value: activeCourses.length, icon: BookOpen, hint: "Accepting applications" },
    { label: "Follow-ups due", value: followUps.length, icon: CalendarClock, hint: "Needs coordinator action" },
    { label: "Attending classes", value: applicants.filter((a) => a.attendance_status === "attending").length, icon: ClipboardCheck, hint: "Marked as attending" },
  ];
  const startNewCourse = () => { setEditingCourseId(null); setCourseForm({ ...blankCourse }); setShowCourseForm(true); setError(""); setNotice(""); };
  const editCourse = (c: Course) => {
    setEditingCourseId(c.id);
    setCourseForm({ title: c.title, course_code: c.course_code || "", description: c.description || "", category: c.category || "", duration: c.duration || "", delivery_mode: c.delivery_mode, venue: c.venue || "", fee_amount: c.fee_amount == null ? "" : String(c.fee_amount), currency: c.currency || "UGX", start_date: c.start_date || "", end_date: c.end_date || "", application_deadline: c.application_deadline || "", status: c.status, public_visible: c.public_visible });
    setShowCourseForm(true); setError(""); setNotice("");
  };
  const saveCourse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!courseForm.title.trim()) { setError("Enter the short-course title."); return; }
    setSaving(true); setError(""); setNotice("");
    const payload: any = { title: courseForm.title.trim(), course_code: courseForm.course_code.trim() || null, description: courseForm.description.trim() || null, category: courseForm.category.trim() || null, duration: courseForm.duration.trim() || null, delivery_mode: courseForm.delivery_mode, venue: courseForm.venue.trim() || null, fee_amount: courseForm.fee_amount ? Number(courseForm.fee_amount) : null, currency: courseForm.currency, start_date: courseForm.start_date || null, end_date: courseForm.end_date || null, application_deadline: courseForm.application_deadline || null, status: courseForm.status, public_visible: courseForm.public_visible, updated_by: userId, updated_at: new Date().toISOString() };
    if (!editingCourseId) payload.created_by = userId;
    try {
      const result = editingCourseId ? await supabase.from("short_courses").update(payload).eq("id", editingCourseId) : await supabase.from("short_courses").insert(payload);
      if (result.error) throw result.error;
      setShowCourseForm(false); setNotice(editingCourseId ? "Short course updated." : "Short course created."); await loadAll();
    } catch (e: any) { setError(e?.message || "Could not save the course."); }
    finally { setSaving(false); }
  };
  const deleteCourse = async (course: Course) => {
    const linkedCount = applicants.filter((a) => a.course_id === course.id).length;
    if (linkedCount > 0) {
      setError(`Cannot delete "${course.title}" because it has ${linkedCount} linked application(s). Close the course instead to preserve applicant history.`);
      setNotice("");
      return;
    }
    const confirmed = window.confirm(`Delete the course "${course.title}"? This cannot be undone.`);
    if (!confirmed) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const { error: deleteError } = await supabase.from("short_courses").delete().eq("id", course.id);
      if (deleteError) throw deleteError;
      setNotice(`Deleted course: ${course.title}`);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Could not delete this course. It may be protected by database permissions or linked records.");
    } finally {
      setSaving(false);
    }
  };
  const openPaymentProof = async () => {
    if (!selected?.payment_proof_path) return;
    setError(""); setNotice("");
    try {
      const { data, error: proofError } = await supabase.storage.from("short-course-payment-proofs").createSignedUrl(selected.payment_proof_path, 120);
      if (proofError) throw proofError;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) { setError(e?.message || "Could not open the payment proof. Check your Short Courses access."); }
  };
  const saveApplicant = async (changes: Partial<Applicant>, activity?: { type: string; outcome: string; notes: string; next?: string }) => {
    if (!selected) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const { error: ue } = await supabase.from("short_course_applications").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", selected.id);
      if (ue) throw ue;
      if (activity) {
        const { error: ae } = await supabase.from("short_course_activities").insert({ application_id: selected.id, activity_type: activity.type, outcome: activity.outcome, notes: activity.notes || null, next_follow_up_at: activity.next || null, created_by: userId });
        if (ae) throw ae;
      }
      setNotice("Applicant record saved."); await loadAll();
    } catch (e: any) { setError(e?.message || "Could not save applicant changes."); }
    finally { setSaving(false); }
  };
  const logActivity = async () => {
    if (!selected || (!activityNotes.trim() && !activityOutcome.trim())) return;
    const next = followUp ? new Date(followUp).toISOString() : undefined;
    await saveApplicant({ last_contacted_at: new Date().toISOString(), last_feedback: activityNotes.trim() || activityOutcome, next_follow_up_at: next || null }, { type: activityType, outcome: activityOutcome, notes: activityNotes.trim(), next });
    setActivityNotes(""); setFollowUp("");
  };
  const recordAttendance = async () => {
    if (!selected) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const { error: ae } = await supabase.from("short_course_attendance").upsert({ application_id: selected.id, session_date: attendanceDate, attendance_status: attendanceValue, notes: attendanceNotes.trim() || null, recorded_by: userId }, { onConflict: "application_id,session_date" });
      if (ae) throw ae;
      const summary = attendanceValue === "present" ? "attending" : attendanceValue === "absent" ? "not_attending" : attendanceValue === "late" ? "irregular" : selected.attendance_status;
      const { error: ue } = await supabase.from("short_course_applications").update({ attendance_status: summary, updated_at: new Date().toISOString() }).eq("id", selected.id);
      if (ue) throw ue;
      setNotice("Attendance saved."); setAttendanceNotes(""); await loadAll();
    } catch (e: any) { setError(e?.message || "Could not record attendance."); }
    finally { setSaving(false); }
  };
  const exportCsv = () => {
    const rows = filtered.map((a) => [a.application_number, a.first_name, a.last_name, a.phone, a.email || "", courseById.get(a.course_id)?.title || "", a.application_status, a.attendance_status, a.application_date || a.submitted_at, a.source || "", staff.find((s) => s.id === a.assigned_to)?.full_name || "", a.last_feedback || "", a.application_fee_amount || 10000, a.payment_method || "", a.payment_status || "not_submitted", a.payment_reference || ""]);
    const csv = [["Application No.","First Name","Last Name","Phone","Email","Course","Application Status","Attendance","Application Date","Source","Assigned To","Last Feedback","Application Fee UGX","Payment Method","Payment Status","Payment Reference"], ...rows].map((r) => r.map((v) => '"' + String(v ?? "").replaceAll('"','""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = "ciu-short-course-applications.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const whatsappUrl = (phone: string) => { const d = phone.replace(/\D/g, ""); return "https://wa.me/" + (d.startsWith("0") ? "256" + d.slice(1) : d); };

  return <main style={{ padding: "clamp(16px,2.5vw,30px)", color: "#18392b", background: "#f7faf8", minHeight: "100vh" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
      <div><div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".13em", textTransform: "uppercase", color: "#679078" }}>CIU · Student recruitment</div><h1 style={{ fontSize: 28, lineHeight: 1.15, margin: "6px 0", fontWeight: 850, letterSpacing: "-.035em" }}>Short Courses</h1><p style={{ margin: 0, color: "#6a7c71", fontSize: 13 }}>Manage course enquiries, applicant follow-up, registration and class attendance in one workspace.</p></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a href="/short-courses/apply" target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none" }}>Public application link ↗</a><button onClick={() => void loadAll()} style={button}><RefreshCw size={14}/> Refresh</button><button onClick={exportCsv} style={button}><Download size={14}/> Export list</button><button onClick={startNewCourse} style={{ ...button, color: "#fff", background: "#00695c", borderColor: "#00695c" }}><Plus size={14}/> Add short course</button></div>
    </div>
    {error && <div style={{ padding: 12, borderRadius: 10, background: "#fff1f0", border: "1px solid #fecaca", color: "#991b1b", marginBottom: 14, fontSize: 13 }}>{error}</div>}
    {notice && <div style={{ padding: 12, borderRadius: 10, background: "#effaf1", border: "1px solid #bbf7d0", color: "#166534", marginBottom: 14, fontSize: 13 }}>{notice}</div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 20 }}>
      {stats.map((item) => { const Icon = item.icon; return <div key={item.label} style={{ background: "#fff", border: "1px solid #e0ebe4", borderRadius: 14, padding: 16 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 12, color: "#718379", fontWeight: 650 }}>{item.label}</span><Icon size={17} color="#4d8b6a"/></div><div style={{ fontSize: 29, fontWeight: 850, marginTop: 8 }}>{loading ? "…" : item.value.toLocaleString()}</div><div style={{ fontSize: 11, color: "#91a097", marginTop: 4 }}>{item.hint}</div></div>; })}
    </div>
    <div style={{ display: "flex", gap: 6, padding: 5, borderRadius: 12, background: "#eaf2ed", width: "fit-content", maxWidth: "100%", marginBottom: 16, flexWrap: "wrap" }}>
      {[["applicants","Applicants"],["followups","Follow-ups"],["courses","Course catalogue"]].map(([id, name]) => <button key={id} onClick={() => setTab(id)} style={{ ...button, borderColor: tab === id ? "#fff" : "transparent", background: tab === id ? "#fff" : "transparent" }}>{name}</button>)}
    </div>
    {tab === "courses" ? <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 14 }}>
      {courses.map((c) => <article key={c.id} style={{ background: "#fff", border: "1px solid #e0ebe4", borderRadius: 14, padding: 18 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 800, color: "#5d8b6c" }}>{c.category || "Short course"}</span><span style={{ fontSize: 10, borderRadius: 20, padding: "4px 8px", background: c.status === "active" ? "#e7f8eb" : "#f1f5f2" }}>{label(c.status)}</span></div><h3 style={{ fontSize: 17, fontWeight: 800, margin: "10px 0 6px" }}>{c.title}</h3><p style={{ fontSize: 12, color: "#6b7b72", lineHeight: 1.6 }}>{c.description || "Add a description for applicants."}</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, color: "#6a7c71" }}><div><b>Duration</b><br/>{c.duration || "Not set"}</div><div><b>Mode</b><br/>{c.delivery_mode}</div><div><b>Start</b><br/>{dateLabel(c.start_date)}</div><div><b>Fee</b><br/>{c.fee_amount == null ? "Not set" : c.currency + " " + Number(c.fee_amount).toLocaleString()}</div></div><div style={{ marginTop: 15, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontSize: 10, color: c.public_visible && c.status === "active" ? "#16803d" : "#829087" }}>{c.public_visible && c.status === "active" ? "Visible publicly" : "Not visible publicly"}</span><div style={{ display: "flex", gap: 6 }}><button style={button} onClick={() => editCourse(c)}>Edit course</button><button type="button" disabled={saving} title="Delete course (only when no applicants are linked)" style={{ ...button, color: "#a12b25", borderColor: "#f1c8c5" }} onClick={() => void deleteCourse(c)}><Trash2 size={13}/> Delete</button></div></div></article>)}
      {!courses.length && <div style={{ background: "#fff", border: "1px dashed #cbdcd1", borderRadius: 14, padding: 28, color: "#738278", gridColumn: "1/-1", textAlign: "center" }}>No short courses yet. Select Add short course to create the first one.</div>}
    </section> : <section style={{ display: "grid", gridTemplateColumns: selected ? "minmax(0,1.2fr) minmax(330px,.8fr)" : "1fr", gap: 14, alignItems: "start" }}>
      <div style={{ minWidth: 0, background: "#fff", border: "1px solid #e0ebe4", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 8, padding: 14, borderBottom: "1px solid #e9f0eb", flexWrap: "wrap" }}><div style={{ flex: "1 1 190px", position: "relative" }}><Search size={15} style={{ position: "absolute", left: 11, top: 11, color: "#819187" }}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email or application no." style={{ ...input, paddingLeft: 34 }}/></div><select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} style={{ ...input, width: "auto", minWidth: 150 }}><option value="all">All short courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...input, width: "auto", minWidth: 130 }}><option value="all">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
        <div style={{ padding: "10px 14px", color: "#7a8a80", fontSize: 11, borderBottom: "1px solid #edf2ee" }}>{tab === "followups" ? followUps.length + " follow-ups due" : filtered.length + " applicant records"} · Click a row to open the full record</div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620, fontSize: 12 }}><thead><tr style={{ background: "#f8fbf9", color: "#77877d", textAlign: "left" }}>{["Applicant","Course","Contact","Status","Attendance","Assigned"].map((h) => <th key={h} style={{ padding: "11px 12px", fontSize: 10, textTransform: "uppercase" }}>{h}</th>)}</tr></thead><tbody>
          {(tab === "followups" ? followUps.filter((a) => (!search || [a.first_name,a.last_name,a.phone,a.email].some((v) => String(v||"").toLowerCase().includes(search.toLowerCase()))) && (courseFilter === "all" || a.course_id === courseFilter)) : filtered).map((a) => <tr key={a.id} onClick={() => setSelectedId(a.id)} style={{ cursor: "pointer", background: selectedId === a.id ? "#eff8f1" : "#fff", borderTop: "1px solid #edf2ee" }}><td style={{ padding: 12, fontWeight: 750 }}>{a.first_name} {a.last_name}<div style={{ fontSize: 10, color: "#8b9a90", fontWeight: 500 }}>SC-{a.application_number}</div></td><td style={{ padding: 12, maxWidth: 170 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{courseById.get(a.course_id)?.title || "Course not found"}</div><div style={{ fontSize: 10, color: "#91a097" }}>{dateLabel(a.application_date || a.submitted_at)}</div></td><td style={{ padding: 12, whiteSpace: "nowrap" }}>{a.phone}<div style={{ fontSize: 10, color: "#8b9a90" }}>{a.email || "No email"}</div></td><td style={{ padding: 12 }}><span style={{ borderRadius: 20, background: "#edf4ef", padding: "4px 7px", whiteSpace: "nowrap", fontSize: 10 }}>{label(a.application_status)}</span></td><td style={{ padding: 12, whiteSpace: "nowrap" }}>{label(a.attendance_status)}</td><td style={{ padding: 12 }}>{staff.find((s) => s.id === a.assigned_to)?.full_name || "Unassigned"}</td></tr>)}
          {!loading && !(tab === "followups" ? followUps.length : filtered.length) && <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "#84938a" }}>No records match these filters.</td></tr>}
        </tbody></table></div>
      </div>
      {selected && <aside style={{ minWidth: 0, background: "#fff", border: "1px solid #dce9e1", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: 18, background: "linear-gradient(130deg,#edf7ef,#fff)", borderBottom: "1px solid #e2ece5" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><div style={{ fontSize: 10, color: "#6d8c78", fontWeight: 800 }}>APPLICANT SC-{selected.application_number}</div><h2 style={{ margin: "6px 0 4px", fontSize: 21, fontWeight: 850 }}>{selected.first_name} {selected.last_name}</h2><p style={{ margin: 0, fontSize: 12, color: "#6c7c72" }}>{courseById.get(selected.course_id)?.title || "Short course"}</p></div><button onClick={() => setSelectedId(null)} style={{ ...button, padding: 6 }}><X size={15}/></button></div><div style={{ display: "flex", gap: 8, marginTop: 14 }}><a href={"tel:" + selected.phone} style={{ ...button, textDecoration: "none" }}><Phone size={14}/> Call</a><a href={whatsappUrl(selected.phone)} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none", color: "#167447" }}><MessageCircle size={14}/> WhatsApp</a></div></div>
        <div style={{ padding: 16, display: "grid", gap: 14, maxHeight: "75vh", overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 11 }}><div><div style={{ color: "#819187" }}>Phone</div><b>{selected.phone}</b></div><div><div style={{ color: "#819187" }}>Email</div><b style={{ overflowWrap: "anywhere" }}>{selected.email || "—"}</b></div><div><div style={{ color: "#819187" }}>Nationality</div><b>{selected.nationality || "—"}</b></div><div><div style={{ color: "#819187" }}>Qualification</div><b>{selected.highest_qualification || "—"}</b></div><div><div style={{ color: "#819187" }}>Source</div><b>{selected.source || "Website"}</b></div><div><div style={{ color: "#819187" }}>Application date</div><b>{dateLabel(selected.application_date || selected.submitted_at)}</b></div></div>
          {selected.expected_outcome && <div style={{ padding: 10, borderRadius: 9, background: "#f8fbf9", fontSize: 12 }}><b>What they want from the course</b><p style={{ margin: "5px 0 0", color: "#65776b" }}>{selected.expected_outcome}</p></div>}
          <div style={{ border: "1px solid #d9e8dc", borderRadius: 11, padding: 12, background: "#f7fbf8", display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
              <div><div style={{ fontSize: 12, fontWeight: 850 }}>Application fee payment</div><div style={{ fontSize: 11, color: "#6e8174", marginTop: 3 }}>UGX {Number(selected.application_fee_amount || 10000).toLocaleString()} · {selected.payment_method || "Method not recorded"}</div></div>
              <span style={{ borderRadius: 20, padding: "4px 8px", fontSize: 10, fontWeight: 800, background: selected.payment_status === "verified" ? "#e2f5e8" : selected.payment_status === "rejected" ? "#fff0ef" : "#fff5d9", color: selected.payment_status === "verified" ? "#17663a" : selected.payment_status === "rejected" ? "#a52b24" : "#886016" }}>{label(selected.payment_status || "not_submitted")}</span>
            </div>
            {selected.payment_reference && <div style={{ fontSize: 11 }}><b>Transaction reference:</b> {selected.payment_reference}</div>}
            {selected.payment_proof_path ? <button type="button" onClick={() => void openPaymentProof()} style={{ ...button, justifyContent: "center" }}>View proof of payment</button> : <div style={{ fontSize: 11, color: "#9b5b20" }}>No payment proof attached.</div>}
            <div><label style={{ display: "block", fontSize: 11, fontWeight: 800, marginBottom: 5 }}>Verify payment</label><select value={selected.payment_status || "not_submitted"} onChange={(e) => void saveApplicant({ payment_status: e.target.value })} style={input}>{[["not_submitted","Not submitted"],["pending_verification","Pending verification"],["verified","Verified"],["rejected","Rejected"]].map(([v,t]) => <option key={v} value={v}>{t}</option>)}</select></div>
          </div>
          <div><label style={{ display: "block", fontSize: 11, fontWeight: 800, marginBottom: 5 }}>Application status</label><select value={selected.application_status} onChange={(e) => void saveApplicant({ application_status: e.target.value })} style={input}>{statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
          <div><label style={{ display: "block", fontSize: 11, fontWeight: 800, marginBottom: 5 }}>Assigned coordinator</label><select value={selected.assigned_to || ""} onChange={(e) => void saveApplicant({ assigned_to: e.target.value || null })} style={input}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.id} · {s.role}</option>)}</select></div>
          <div><label style={{ display: "block", fontSize: 11, fontWeight: 800, marginBottom: 5 }}>Class attendance status</label><select value={selected.attendance_status} onChange={(e) => void saveApplicant({ attendance_status: e.target.value })} style={input}>{attendanceStatuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
          <div style={{ borderTop: "1px solid #e8f0eb", paddingTop: 13 }}><h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 850 }}>Log a call or follow-up</h3><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}><select value={activityType} onChange={(e) => setActivityType(e.target.value)} style={input}>{["call","whatsapp","email","meeting","feedback","other"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select><select value={activityOutcome} onChange={(e) => setActivityOutcome(e.target.value)} style={input}>{["Reached","No answer","Call back","Interested","Not interested","Registered","Other"].map((s) => <option key={s}>{s}</option>)}</select></div><textarea value={activityNotes} onChange={(e) => setActivityNotes(e.target.value)} rows={3} placeholder="Record what the student said, questions, concerns or feedback…" style={{ ...input, resize: "vertical", marginBottom: 8 }}/><label style={{ display: "block", fontSize: 11, fontWeight: 750, marginBottom: 5 }}>Next follow-up (optional)</label><input type="datetime-local" value={followUp} onChange={(e) => setFollowUp(e.target.value)} style={{ ...input, marginBottom: 8 }}/><button disabled={saving} onClick={() => void logActivity()} style={{ ...button, background: "#00695c", color: "#fff", borderColor: "#00695c", width: "100%", justifyContent: "center" }}><Save size={14}/>{saving ? "Saving…" : "Save feedback & follow-up"}</button></div>
          <div style={{ borderTop: "1px solid #e8f0eb", paddingTop: 13 }}><h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 850 }}>Record class attendance</h3><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}><input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} style={input}/><select value={attendanceValue} onChange={(e) => setAttendanceValue(e.target.value)} style={input}>{["present","absent","late","excused"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div><textarea value={attendanceNotes} onChange={(e) => setAttendanceNotes(e.target.value)} rows={2} placeholder="Attendance note (optional)" style={{ ...input, resize: "vertical", marginBottom: 8 }}/><button disabled={saving} onClick={() => void recordAttendance()} style={{ ...button, width: "100%", justifyContent: "center" }}><ClipboardCheck size={14}/>{saving ? "Saving…" : "Save attendance"}</button></div>
          <div style={{ borderTop: "1px solid #e8f0eb", paddingTop: 13 }}><h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 850 }}>Recent contact history</h3>{activities.filter((a) => a.application_id === selected.id).slice(0, 8).map((a) => <div key={a.id} style={{ padding: "9px 0", borderBottom: "1px solid #edf2ee" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontSize: 11 }}>{label(a.activity_type)} · {a.outcome || "Logged"}</b><span style={{ fontSize: 10, color: "#84938a" }}>{dateLabel(a.created_at)}</span></div>{a.notes && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7b72", whiteSpace: "pre-wrap" }}>{a.notes}</p>}{a.next_follow_up_at && <div style={{ fontSize: 10, color: "#98702a", marginTop: 4 }}>Follow-up: {new Date(a.next_follow_up_at).toLocaleString()}</div>}</div>)}{!activities.some((a) => a.application_id === selected.id) && <p style={{ fontSize: 11, color: "#89978e" }}>No contact history recorded yet.</p>}</div>
        </div>
      </aside>}
    </section>}
    {showCourseForm && <div role="dialog" aria-modal="true" aria-label="Short course form" style={{ position: "fixed", inset: 0, background: "rgba(16,39,28,.38)", zIndex: 50, display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}><form onSubmit={saveCourse} style={{ width: "min(760px,100%)", maxHeight: "92vh", overflowY: "auto", borderRadius: 16, background: "#fff", padding: 22, boxShadow: "0 24px 80px rgba(0,0,0,.18)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}><div><h2 style={{ margin: 0, fontSize: 21, fontWeight: 850 }}>{editingCourseId ? "Edit short course" : "Add a short course"}</h2><p style={{ margin: "5px 0 0", fontSize: 12, color: "#718278" }}>Set course details and decide whether it appears on the public application page.</p></div><button type="button" onClick={() => setShowCourseForm(false)} style={{ ...button, padding: 6 }}><X size={15}/></button></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 750 }}>Course title *<input required value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} style={{ ...input, marginTop: 5 }}/></label>
        <label style={{ fontSize: 11, fontWeight: 750 }}>Course code<input value={courseForm.course_code} onChange={(e) => setCourseForm({ ...courseForm, course_code: e.target.value })} style={{ ...input, marginTop: 5 }}/></label>
        <label style={{ fontSize: 11, fontWeight: 750 }}>Category<input value={courseForm.category} onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })} style={{ ...input, marginTop: 5 }}/></label>
        <label style={{ fontSize: 11, fontWeight: 750 }}>Duration<input value={courseForm.duration} onChange={(e) => setCourseForm({ ...courseForm, duration: e.target.value })} placeholder="e.g. 5 days / 6 weeks" style={{ ...input, marginTop: 5 }}/></label>
        <label style={{ fontSize: 11, fontWeight: 750 }}>Delivery mode<select value={courseForm.delivery_mode} onChange={(e) => setCourseForm({ ...courseForm, delivery_mode: e.target.value })} style={{ ...input, marginTop: 5 }}>{["In person","Online","Hybrid"].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label style={{ fontSize: 11, fontWeight: 750 }}>Venue<input value={courseForm.venue} onChange={(e) => setCourseForm({ ...courseForm, venue: e.target.value })} style={{ ...input, marginTop: 5 }}/></label>
        <label style={{ fontSize: 11, fontWeight: 750 }}>Course fee<input type="number" min="0" value={courseForm.fee_amount} onChange={(e) => setCourseForm({ ...courseForm, fee_amount: e.target.value })} style={{ ...input, marginTop: 5 }}/></label>
        <label style={{ fontSize: 11, fontWeight: 750 }}>Currency<select value={courseForm.currency} onChange={(e) => setCourseForm({ ...courseForm, currency: e.target.value })} style={{ ...input, marginTop: 5 }}>{["UGX","USD","KES","TZS"].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label style={{ fontSize: 11, fontWeight: 750 }}>Start date<input type="date" value={courseForm.start_date} onChange={(e) => setCourseForm({ ...courseForm, start_date: e.target.value })} style={{ ...input, marginTop: 5 }}/></label>
        <label style={{ fontSize: 11, fontWeight: 750 }}>End date<input type="date" value={courseForm.end_date} onChange={(e) => setCourseForm({ ...courseForm, end_date: e.target.value })} style={{ ...input, marginTop: 5 }}/></label>
        <label style={{ fontSize: 11, fontWeight: 750 }}>Application deadline<input type="date" value={courseForm.application_deadline} onChange={(e) => setCourseForm({ ...courseForm, application_deadline: e.target.value })} style={{ ...input, marginTop: 5 }}/></label>
        <label style={{ fontSize: 11, fontWeight: 750 }}>Status<select value={courseForm.status} onChange={(e) => setCourseForm({ ...courseForm, status: e.target.value })} style={{ ...input, marginTop: 5 }}>{["draft","active","closed","completed"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></label>
      </div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 750, marginTop: 12 }}>Course description<textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} rows={3} style={{ ...input, marginTop: 5, resize: "vertical" }}/></label>
      <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, fontSize: 12, fontWeight: 750 }}><input type="checkbox" checked={courseForm.public_visible} onChange={(e) => setCourseForm({ ...courseForm, public_visible: e.target.checked })}/> Show this course on the public application page</label>
      <div style={{ display: "flex", justifyContent: "end", gap: 8, marginTop: 20 }}><button type="button" onClick={() => setShowCourseForm(false)} style={button}>Cancel</button><button disabled={saving} type="submit" style={{ ...button, background: "#00695c", color: "#fff", borderColor: "#00695c" }}><Save size={14}/>{saving ? "Saving…" : "Save course"}</button></div>
    </form></div>}
  </main>;
}
