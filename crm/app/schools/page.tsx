"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type School = {
  id: string;
  school_name: string;
  school_type: string;
  district: string | null;
  region: string | null;
  address: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  estimated_s6_students: number;
  status: string;
  last_visit_date: string | null;
  next_visit_date: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

type SchoolForm = {
  school_name: string;
  school_type: string;
  district: string;
  region: string;
  address: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  estimated_s6_students: string;
  status: string;
  last_visit_date: string;
  next_visit_date: string;
  notes: string;
  assigned_to: string;
};

type Staff = { id: string; full_name: string | null; role: string | null };
type StudentContact = { id: string; school_id: string; student_name: string; contact: string; email: string | null; program: string; created_at: string; school?: { school_name: string } | null };
type StudentContactForm = { school_id: string; student_name: string; contact: string; email: string; program: string };
const EMPTY_STUDENT_FORM: StudentContactForm = { school_id: "", student_name: "", contact: "", email: "", program: "" };

const EMPTY_FORM: SchoolForm = {
  school_name: "", school_type: "Secondary", district: "", region: "",
  address: "", contact_person: "", contact_phone: "", contact_email: "",
  estimated_s6_students: "0", status: "Prospect", last_visit_date: "",
  next_visit_date: "", notes: "", assigned_to: "",
};
const STATUSES = ["Prospect", "Contacted", "Visit Planned", "Visited", "Partner", "Inactive"];
const TYPES = ["Secondary", "Primary", "International", "Technical/Vocational", "Other"];
const supabase = createClient();

function fieldClass() {
  return "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value + (value.length === 10 ? "T00:00:00" : ""));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [studentContacts, setStudentContacts] = useState<StudentContact[]>([]);
  const [studentForm, setStudentForm] = useState<StudentContactForm>(EMPTY_STUDENT_FORM);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [importingCsv, setImportingCsv] = useState(false);
  const [publicFormSchoolId, setPublicFormSchoolId] = useState("");
  const [form, setForm] = useState<SchoolForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: schoolRows, error: schoolError }, { data: staffRows, error: staffError }, { data: contactRows, error: contactError }] = await Promise.all([
        supabase.from("schools").select("*").order("updated_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name,role").eq("is_active", true).order("full_name"),
        supabase.from("school_student_contacts").select("id,school_id,student_name,contact,email,program,created_at,school:schools(school_name)").order("created_at", { ascending: false }),
      ]);
      if (schoolError) throw schoolError;
      if (staffError) throw staffError;
      setSchools((schoolRows || []) as School[]);
      setStaff((staffRows || []) as Staff[]);
      if (contactError) throw contactError;
      setStudentContacts((contactRows || []) as unknown as StudentContact[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load the School Database.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleSchools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schools.filter((school) => {
      const matchesStatus = statusFilter === "All statuses" || school.status === statusFilter;
      const matchesSearch = !q || [
        school.school_name, school.district, school.region, school.contact_person,
        school.contact_phone, school.contact_email,
      ].some((value) => (value || "").toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [schools, search, statusFilter]);

  const stats = useMemo(() => ({
    total: schools.length,
    prospects: schools.filter(s => s.status === "Prospect").length,
    visits: schools.filter(s => s.status === "Visit Planned").length,
    partners: schools.filter(s => s.status === "Partner").length,
    students: schools.reduce((sum, s) => sum + (Number(s.estimated_s6_students) || 0), 0),
  }), [schools]);

  function setValue<K extends keyof SchoolForm>(key: K, value: SchoolForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function startNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function startEdit(school: School) {
    setEditingId(school.id);
    setForm({
      school_name: school.school_name || "",
      school_type: school.school_type || "Secondary",
      district: school.district || "", region: school.region || "", address: school.address || "",
      contact_person: school.contact_person || "", contact_phone: school.contact_phone || "",
      contact_email: school.contact_email || "", estimated_s6_students: String(school.estimated_s6_students ?? 0),
      status: school.status || "Prospect", last_visit_date: school.last_visit_date || "",
      next_visit_date: school.next_visit_date || "", notes: school.notes || "",
      assigned_to: school.assigned_to || "",
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  async function saveSchool(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again before saving.");
      const payload = {
        school_name: form.school_name.trim(),
        school_type: form.school_type,
        district: form.district.trim() || null,
        region: form.region.trim() || null,
        address: form.address.trim() || null,
        contact_person: form.contact_person.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        estimated_s6_students: Math.max(0, Number.parseInt(form.estimated_s6_students || "0", 10) || 0),
        status: form.status,
        last_visit_date: form.last_visit_date || null,
        next_visit_date: form.next_visit_date || null,
        notes: form.notes.trim() || null,
        assigned_to: form.assigned_to || user.id,
        updated_at: new Date().toISOString(),
      };
      const result = editingId
        ? await supabase.from("schools").update(payload).eq("id", editingId)
        : await supabase.from("schools").insert({ ...payload, created_by: user.id });
      if (result.error) throw result.error;
      setSuccess(editingId ? "School record updated." : "School added to the database.");
      setShowForm(false); setEditingId(null); setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save the school record.");
    } finally {
      setSaving(false);
    }
  }

  async function saveStudentContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again before saving.");
      const payload = { school_id: studentForm.school_id, student_name: studentForm.student_name.trim(), contact: studentForm.contact.trim(), email: studentForm.email.trim() || null, program: studentForm.program.trim(), updated_at: new Date().toISOString() };
      const result = editingStudentId ? await supabase.from("school_student_contacts").update(payload).eq("id", editingStudentId) : await supabase.from("school_student_contacts").insert({ ...payload, created_by: user.id });
      if (result.error) throw result.error;
      setSuccess(editingStudentId ? "Student contact updated." : "Student contact added.");
      setShowStudentForm(false); setEditingStudentId(null); setStudentForm(EMPTY_STUDENT_FORM); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save student contact."); }
    finally { setSaving(false); }
  }
  function editStudentContact(contact: StudentContact) {
    setEditingStudentId(contact.id); setStudentForm({ school_id: contact.school_id, student_name: contact.student_name, contact: contact.contact, email: contact.email || "", program: contact.program }); setShowStudentForm(true); setError(""); setSuccess("");
  }
  function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) { row.push(cell.trim()); cell = ""; }
      else if ((ch === "\n" || ch === "\r") && !quoted) {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell.trim()); cell = "";
        if (row.some(value => value.length)) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell.trim());
    if (row.some(value => value.length)) rows.push(row);
    return rows;
  }

  async function importStudentCsv(file?: File) {
    if (!file) return;
    setImportingCsv(true); setError(""); setSuccess("");
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) throw new Error("The CSV is empty or has no student rows.");
      const headers = parsed[0].map(value => value.toLowerCase().replace(/[ _-]+/g, ""));
      const findColumn = (...names: string[]) => headers.findIndex(h => names.includes(h));
      const schoolCol = findColumn("school", "schoolname");
      const nameCol = findColumn("studentname", "name", "fullname");
      const contactCol = findColumn("contact", "phone", "telephone", "phonenumber");
      const emailCol = findColumn("email", "emailaddress");
      const programCol = findColumn("program", "programme", "course");
      if ([schoolCol, nameCol, contactCol, programCol].some(i => i < 0)) {
        throw new Error("CSV headers must include School name, Student name, Contact and Program. Email is optional.");
      }
      const schoolLookup = new Map(schools.map(s => [s.school_name.trim().toLowerCase(), s]));
      const rows = parsed.slice(1);
      const payload = rows.map((row, index) => {
        const school = schoolLookup.get((row[schoolCol] || "").trim().toLowerCase());
        const student_name = (row[nameCol] || "").trim();
        const contact = (row[contactCol] || "").trim();
        const program = (row[programCol] || "").trim();
        if (!school || !student_name || !contact || !program) {
          throw new Error("CSV row " + (index + 2) + " has a missing required value or a school name that does not match the School Database.");
        }
        return { school_id: school.id, student_name, contact, email: emailCol >= 0 ? ((row[emailCol] || "").trim() || null) : null, program };
      });
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again before importing.");
      for (let i = 0; i < payload.length; i += 100) {
        const { error: insertError } = await supabase.from("school_student_contacts").insert(payload.slice(i, i + 100).map(row => ({ ...row, created_by: user.id })));
        if (insertError) throw insertError;
      }
      setSuccess("Imported " + payload.length + " student contacts successfully.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to import the CSV.");
    } finally {
      setImportingCsv(false);
    }
  }

  async function copyStudentFormLink() {
    if (!publicFormSchoolId) { setError("Select a secondary school first to create its student form link."); return; }
    const school = schools.find(s => s.id === publicFormSchoolId);
    if (!school) return;
    const url = window.location.origin + "/school-student-registration?school_id=" + encodeURIComponent(school.id) + "&school_name=" + encodeURIComponent(school.school_name);
    try {
      await navigator.clipboard.writeText(url);
      setSuccess("Phone registration link copied for " + school.school_name + ". You can share it by WhatsApp or display it as a QR code.");
    } catch {
      setSuccess("Student form link: " + url);
    }
  }

  async function deleteStudentContact(contact: StudentContact) {
    if (!window.confirm("Delete student contact for " + contact.student_name + "?")) return;
    const { error: deleteError } = await supabase.from("school_student_contacts").delete().eq("id", contact.id);
    if (deleteError) { setError(deleteError.message); return; } setSuccess("Student contact deleted."); await load();
  }

  async function deleteSchool(school: School) {
    if (!window.confirm("Delete the record for " + school.school_name + "? This cannot be undone.")) return;
    setError(""); setSuccess("");
    const { error: deleteError } = await supabase.from("schools").delete().eq("id", school.id);
    if (deleteError) { setError(deleteError.message); return; }
    setSuccess("School record deleted.");
    await load();
  }

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Recruitment & Outreach</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">School Database</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Maintain school contacts, plan outreach visits and estimate potential student recruitment.</p>
        </div>
        <button onClick={startNew} className="inline-flex items-center justify-center rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900">+ Add school</button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          { label: "Schools", value: stats.total },
          { label: "Prospects", value: stats.prospects },
          { label: "Visits planned", value: stats.visits },
          { label: "Partners", value: stats.partners },
          { label: "Estimated S6 students", value: stats.students.toLocaleString("en-UG") },
        ].map(item => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{item.value}</p>
        </div>)}
      </section>

      {showForm && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-slate-900">{editingId ? "Edit school" : "Add a school"}</h2><p className="mt-1 text-sm text-slate-500">Record the school and its outreach contact details.</p></div>
          <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">Cancel</button>
        </div>
        <form onSubmit={saveSchool} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1.5 text-sm font-medium text-slate-700">School name *<input required maxLength={180} className={fieldClass()} value={form.school_name} onChange={e => setValue("school_name", e.target.value)} /></label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">School type<select className={fieldClass()} value={form.school_type} onChange={e => setValue("school_type", e.target.value)}>{TYPES.map(v => <option key={v}>{v}</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">Outreach status<select className={fieldClass()} value={form.status} onChange={e => setValue("status", e.target.value)}>{STATUSES.map(v => <option key={v}>{v}</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">District<input className={fieldClass()} value={form.district} onChange={e => setValue("district", e.target.value)} /></label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">Region<input className={fieldClass()} value={form.region} onChange={e => setValue("region", e.target.value)} /></label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">Estimated S6 students<input type="number" min="0" step="1" className={fieldClass()} value={form.estimated_s6_students} onChange={e => setValue("estimated_s6_students", e.target.value)} /></label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">Contact person<input className={fieldClass()} value={form.contact_person} onChange={e => setValue("contact_person", e.target.value)} /></label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">Contact phone<input type="tel" className={fieldClass()} value={form.contact_phone} onChange={e => setValue("contact_phone", e.target.value)} /></label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">Contact email<input type="email" className={fieldClass()} value={form.contact_email} onChange={e => setValue("contact_email", e.target.value)} /></label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">Last visit<input type="date" className={fieldClass()} value={form.last_visit_date} onChange={e => setValue("last_visit_date", e.target.value)} /></label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">Next visit<input type="date" min={form.last_visit_date || undefined} className={fieldClass()} value={form.next_visit_date} onChange={e => setValue("next_visit_date", e.target.value)} /></label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">Assigned staff<select className={fieldClass()} value={form.assigned_to} onChange={e => setValue("assigned_to", e.target.value)}><option value="">Assign to me</option>{staff.map(person => <option key={person.id} value={person.id}>{person.full_name || "Unnamed staff"}{person.role ? " · " + person.role.replaceAll("_", " ") : ""}</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2 xl:col-span-3">Address<textarea rows={2} className={fieldClass()} value={form.address} onChange={e => setValue("address", e.target.value)} /></label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2 xl:col-span-3">Notes<textarea rows={3} className={fieldClass()} value={form.notes} onChange={e => setValue("notes", e.target.value)} /></label>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : editingId ? "Save changes" : "Save school"}</button></div>
        </form>
      </section>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">Secondary school student contacts</h2><p className="mt-1 text-xs text-slate-500">Add contacts manually, import a CSV, or share a phone-friendly registration link with students.</p></div><div className="flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">{importingCsv ? "Importing CSV…" : "Upload CSV"}<input type="file" accept=".csv,text/csv" className="sr-only" disabled={importingCsv} onChange={e => { void importStudentCsv(e.target.files?.[0]); e.currentTarget.value = ""; }} /></label><button onClick={() => { setEditingStudentId(null); setStudentForm(EMPTY_STUDENT_FORM); setShowStudentForm(v => !v); }} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white">+ Add student contact</button></div></div><div className="grid grid-cols-1 gap-2 border-b border-slate-100 bg-emerald-50/50 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm font-semibold text-slate-800">Field registration link</p><p className="mt-1 text-xs text-slate-600">Choose a secondary school, then copy a link students can open on their phones. They do not need a CRM account.</p></div><div className="flex gap-2"><select aria-label="School for student registration link" className={fieldClass()} value={publicFormSchoolId} onChange={e => setPublicFormSchoolId(e.target.value)}><option value="">Select secondary school</option>{schools.filter(s => s.school_type.toLowerCase() === "secondary").map(s => <option key={s.id} value={s.id}>{s.school_name}</option>)}</select><button type="button" onClick={() => void copyStudentFormLink()} className="shrink-0 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800">Copy link</button></div></div><div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">CSV columns: School name, Student name, Contact, Email (optional), Program. School names must match existing records.
        {showStudentForm && <form onSubmit={saveStudentContact} className="grid grid-cols-1 gap-4 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1.5 text-sm font-medium text-slate-700">School name *<select required className={fieldClass()} value={studentForm.school_id} onChange={e => setStudentForm(v => ({...v, school_id:e.target.value}))}><option value="">Select secondary school</option>{schools.filter(s => s.school_type === "Secondary").map(s => <option key={s.id} value={s.id}>{s.school_name}</option>)}</select></label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">Student name *<input required className={fieldClass()} value={studentForm.student_name} onChange={e => setStudentForm(v => ({...v, student_name:e.target.value}))} /></label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">Contact / phone *<input required type="tel" className={fieldClass()} value={studentForm.contact} onChange={e => setStudentForm(v => ({...v, contact:e.target.value}))} /></label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">Email<input type="email" className={fieldClass()} value={studentForm.email} onChange={e => setStudentForm(v => ({...v, email:e.target.value}))} /></label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">Program *<input required placeholder="e.g. Bachelor of Nursing" className={fieldClass()} value={studentForm.program} onChange={e => setStudentForm(v => ({...v, program:e.target.value}))} /></label>
          <div className="flex items-end gap-2"><button disabled={saving} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : editingStudentId ? "Save changes" : "Save student"}</button><button type="button" onClick={() => {setShowStudentForm(false); setEditingStudentId(null);}} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">Cancel</button></div>
        </form>}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">{studentContacts.length} student contacts</p><input aria-label="Search student contacts" placeholder="Search student, school, contact, program…" className={fieldClass() + " sm:min-w-80"} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} /></div>
        {(() => { const q = studentSearch.trim().toLowerCase(); const rows = studentContacts.filter(s => [s.student_name,s.contact,s.email,s.program,s.school?.school_name].some(v => (v || "").toLowerCase().includes(q))); return rows.length ? <div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">School name</th><th className="px-4 py-3">Student name</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Program</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(student => <tr key={student.id} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-medium">{student.school?.school_name || schools.find(s => s.id === student.school_id)?.school_name || "—"}</td><td className="px-4 py-3">{student.student_name}</td><td className="px-4 py-3">{student.contact}</td><td className="px-4 py-3">{student.email || "—"}</td><td className="px-4 py-3">{student.program}</td><td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => editStudentContact(student)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold">Edit</button><button onClick={() => void deleteStudentContact(student)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600">Delete</button></div></td></tr>)}</tbody></table></div> : <div className="p-8 text-center text-sm text-slate-500">No student contacts found. Add a contact to get started.</div>; })()}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><h2 className="font-bold text-slate-900">Schools and outreach contacts</h2><p className="mt-1 text-xs text-slate-500">{visibleSchools.length} of {schools.length} records</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input aria-label="Search schools" placeholder="Search school, district, contact…" className={fieldClass() + " sm:min-w-64"} value={search} onChange={e => setSearch(e.target.value)} />
            <select aria-label="Filter by outreach status" className={fieldClass() + " sm:min-w-40"} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>All statuses</option>{STATUSES.map(v => <option key={v}>{v}</option>)}</select>
            <button onClick={() => void load()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Refresh</button>
          </div>
        </div>
        {loading ? <div className="p-12 text-center text-sm text-slate-500">Loading school records…</div> : visibleSchools.length === 0 ? <div className="p-12 text-center"><p className="font-semibold text-slate-700">No schools found</p><p className="mt-1 text-sm text-slate-500">Add a school or change your search filters.</p></div> : <div className="overflow-x-auto">
          <table className="min-w-[950px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-semibold">School</th><th className="px-5 py-3 font-semibold">Location</th><th className="px-5 py-3 font-semibold">Contact</th><th className="px-5 py-3 font-semibold">S6 estimate</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Next visit</th><th className="px-5 py-3 font-semibold">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSchools.map(school => <tr key={school.id} className="hover:bg-slate-50/70">
                <td className="px-5 py-4"><p className="font-semibold text-slate-900">{school.school_name}</p><p className="mt-1 text-xs text-slate-500">{school.school_type}</p></td>
                <td className="px-5 py-4 text-slate-600">{[school.district, school.region].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-5 py-4"><p className="font-medium text-slate-700">{school.contact_person || "No contact recorded"}</p><p className="mt-1 text-xs text-slate-500">{school.contact_phone || school.contact_email || "—"}</p></td>
                <td className="px-5 py-4 tabular-nums text-slate-700">{Number(school.estimated_s6_students || 0).toLocaleString("en-UG")}</td>
                <td className="px-5 py-4"><span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{school.status}</span></td>
                <td className="px-5 py-4 text-slate-600">{dateLabel(school.next_visit_date)}</td>
                <td className="px-5 py-4"><div className="flex items-center gap-2"><button onClick={() => startEdit(school)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white">Edit</button><button onClick={() => void deleteSchool(school)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button></div></td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </section>
    </main>
  );
}
