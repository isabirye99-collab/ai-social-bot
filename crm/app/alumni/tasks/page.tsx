"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Profile = { id: string; full_name: string };
type Alumnus = { id: string; full_name: string; alumni_id: string };
type Task = { id: string; alumni_id: string | null; title: string; task_type: string; priority: string; status: string; due_date: string | null; outcome: string | null; notes: string | null; assigned_to: string | null; created_at: string; completed_at: string | null };
const brand = "#106053";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e4ebe6", borderRadius: 14, padding: 18, boxShadow: "0 4px 16px rgba(20,54,39,.035)" };
const field: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 11px", border: "1px solid #dce5df", borderRadius: 8, background: "#fff", color: "#173d34", minHeight: 40 };
const primary: React.CSSProperties = { border: 0, borderRadius: 8, padding: "10px 14px", background: brand, color: "#fff", fontWeight: 750, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #d9e4dd", borderRadius: 8, padding: "8px 11px", background: "#fff", color: brand, fontWeight: 750, cursor: "pointer" };
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export default function AlumniTasksPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [alumni, setAlumni] = useState<Alumnus[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", task_type: "call", priority: "normal", due_date: today(), alumni_id: "", assigned_to: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [taskResult, profileResult, alumniResult, authResult] = await Promise.all([
      supabase.from("alumni_work_tasks").select("id,alumni_id,title,task_type,priority,status,due_date,outcome,notes,assigned_to,created_at,completed_at").order("due_date", { ascending: true, nullsFirst: false }).limit(1000),
      supabase.from("profiles").select("id,full_name").eq("is_active", true).order("full_name").limit(500),
      supabase.from("alumni").select("id,full_name,alumni_id").neq("duplicate_review_status", "confirmed_duplicate").order("full_name").limit(1000),
      supabase.auth.getUser()
    ]);
    if (taskResult.error) setError(taskResult.error.message);
    else setTasks((taskResult.data || []) as Task[]);
    if (profileResult.error) setError(profileResult.error.message);
    else {
      const people = (profileResult.data || []) as Profile[];
      setProfiles(people);
      const vivian = people.find(p => /vivian/i.test(p.full_name) && /kayaga/i.test(p.full_name));
      if (vivian) setForm(old => ({ ...old, assigned_to: old.assigned_to || vivian.id }));
    }
    if (alumniResult.error) setError(alumniResult.error.message);
    else setAlumni((alumniResult.data || []) as Alumnus[]);
    setUserId(authResult.data.user?.id || "");
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    open: tasks.filter(t => t.status === "open").length,
    overdue: tasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date < today()).length,
    progress: tasks.filter(t => t.status === "in_progress").length,
    completed: tasks.filter(t => t.status === "completed").length
  }), [tasks]);
  const shown = useMemo(() => tasks.filter(t => {
    const matchesFilter = filter === "all" || (filter === "active" ? t.status === "open" || t.status === "in_progress" : filter === "overdue" ? t.status !== "completed" && t.status !== "cancelled" && !!t.due_date && t.due_date < today() : t.status === filter);
    const q = search.trim().toLowerCase();
    const person = alumni.find(a => a.id === t.alumni_id);
    return matchesFilter && (!q || t.title.toLowerCase().includes(q) || (person?.full_name || "").toLowerCase().includes(q) || (person?.alumni_id || "").toLowerCase().includes(q));
  }), [tasks, filter, search, alumni]);

  async function createTask(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    if (!form.title.trim()) { setError("Enter a task title."); setSaving(false); return; }
    const payload = { title: form.title.trim(), task_type: form.task_type, priority: form.priority, due_date: form.due_date || null, alumni_id: form.alumni_id || null, assigned_to: form.assigned_to || null, notes: form.notes.trim() || null, created_by: userId || null };
    const { error: saveError } = await supabase.from("alumni_work_tasks").insert(payload);
    if (saveError) setError(saveError.message);
    else {
      setNotice("Alumni follow-up task created and assigned.");
      const defaultAssignee = profiles.find(p => /vivian/i.test(p.full_name) && /kayaga/i.test(p.full_name));
      setForm({ title: "", task_type: "call", priority: "normal", due_date: today(), alumni_id: "", assigned_to: defaultAssignee?.id || "", notes: "" });
      await load();
    }
    setSaving(false);
  }

  async function updateTask(task: Task, patch: Partial<Task>) {
    setError(""); setNotice("");
    const completed = patch.status === "completed";
    const { error: updateError } = await supabase.from("alumni_work_tasks").update({ ...patch, updated_at: new Date().toISOString(), ...(completed ? { completed_at: new Date().toISOString() } : {}) }).eq("id", task.id);
    if (updateError) setError(updateError.message);
    else { setNotice("Task updated."); await load(); }
  }

  const personName = (id: string | null) => profiles.find(p => p.id === id)?.full_name || "Unassigned";
  const alumniName = (id: string | null) => { const a = alumni.find(x => x.id === id); return a ? a.full_name + " · " + a.alumni_id : "General alumni task"; };

  return <main className="ciu-page ciu-consistent-workspace" style={{ padding: "28px clamp(16px,3vw,34px) 48px", color: "#173d34" }}>
    <Link href="/alumni" style={{ color: brand, fontSize: 12, fontWeight: 750, textDecoration: "none" }}>← Alumni directory</Link>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", margin: "14px 0 20px" }}>
      <div><div style={{ color: brand, fontSize: 11, fontWeight: 800, letterSpacing: 1.4 }}>ALUMNI RELATIONS</div><h1 style={{ margin: "6px 0", fontSize: 28, fontWeight: 850 }}>Daily Work & Follow-ups</h1><p style={{ margin: 0, color: "#718078", fontSize: 13 }}>Track alumni outreach, assign responsibility and account for completed work.</p></div>
      <button style={secondary} onClick={() => void load()}>Refresh tasks</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 14 }}>
      {[["Open tasks",counts.open],["Overdue",counts.overdue],["In progress",counts.progress],["Completed",counts.completed]].map(([label,value]) => <div key={String(label)} style={card}><div style={{ fontSize: 12, color: "#718078", fontWeight: 700 }}>{label}</div><div style={{ marginTop: 7, fontSize: 27, color: String(label)==="Overdue" && Number(value)>0 ? "#b45309" : brand, fontWeight: 850 }}>{Number(value).toLocaleString()}</div></div>)}
    </div>
    {notice && <div role="status" style={{ ...card, marginBottom: 12, color: "#17643f", background: "#eff9f1" }}>{notice}</div>}
    {error && <div role="alert" style={{ ...card, marginBottom: 12, color: "#a32828", borderColor: "#f2cccc" }}>{error}</div>}
    <form onSubmit={createTask} style={{ ...card, marginBottom: 14 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 850 }}>Create an alumni follow-up</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Task title<input required value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="e.g. Call alumnus to update employment details" style={field}/></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Alumnus (optional)<select value={form.alumni_id} onChange={e => setForm({...form,alumni_id:e.target.value})} style={field}><option value="">General alumni task</option>{alumni.map(a=><option key={a.id} value={a.id}>{a.full_name} · {a.alumni_id}</option>)}</select></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Task type<select value={form.task_type} onChange={e => setForm({...form,task_type:e.target.value})} style={field}>{[["call","Call"],["email","Email"],["meeting","Meeting"],["profile_review","Profile review"],["event_follow_up","Event follow-up"],["mentorship","Mentorship"],["referral","Referral"],["follow_up","General follow-up"],["other","Other"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Priority<select value={form.priority} onChange={e => setForm({...form,priority:e.target.value})} style={field}>{[["low","Low"],["normal","Normal"],["high","High"],["urgent","Urgent"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Due date<input type="date" value={form.due_date} onChange={e => setForm({...form,due_date:e.target.value})} style={field}/></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Assign to<select value={form.assigned_to} onChange={e => setForm({...form,assigned_to:e.target.value})} style={field}><option value="">Unassigned</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select><span style={{ display:"block",fontWeight:400,color:"#718078",fontSize:10,marginTop:4 }}>Default assignee is Vivian Kayaga, Alumni Relations Officer.</span></label>
      </div>
      <label style={{ display:"block",marginTop:12,fontSize:12,fontWeight:700 }}>Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} placeholder="Context, contact objective or preparation notes" style={{...field,resize:"vertical"}}/></label>
      <button type="submit" disabled={saving} style={{...primary,marginTop:12,opacity:saving?.65:1}}>{saving ? "Saving…" : "Create task"}</button>
    </form>
    <section style={card}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:14 }}><div><h2 style={{margin:0,fontSize:17,fontWeight:850}}>Task register</h2><p style={{margin:"4px 0 0",fontSize:12,color:"#718078"}}>Review ownership, due dates and outcomes. Tasks are stored separately from alumni records.</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search task, alumnus or Alumni ID" style={{...field,marginTop:0,maxWidth:320}}/></div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>{[["active","Active"],["overdue","Overdue"],["completed","Completed"],["cancelled","Cancelled"],["all","All tasks"]].map(([v,l])=><button key={v} onClick={()=>setFilter(v)} style={{...secondary,background:filter===v?"#eaf4ed":"#fff",borderColor:filter===v?brand:"#d9e4dd"}}>{l}</button>)}</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:850,fontSize:12}}><thead><tr style={{textAlign:"left",background:"#f4f8f5",color:"#61736a"}}>{["Task","Alumnus","Owner","Priority","Due date","Status","Action"].map(x=><th key={x} style={{padding:11}}>{x}</th>)}</tr></thead><tbody>
        {loading?<tr><td colSpan={7} style={{padding:22,textAlign:"center"}}>Loading tasks…</td></tr>:shown.length===0?<tr><td colSpan={7} style={{padding:22,textAlign:"center",color:"#718078"}}>No tasks match this view yet. Create a follow-up above to begin.</td></tr>:shown.map(t=><tr key={t.id} style={{borderTop:"1px solid #edf1ee"}}>
          <td style={{padding:11,minWidth:180}}><strong>{t.title}</strong><div style={{marginTop:4,color:"#718078"}}>{t.task_type.replaceAll("_"," ")}</div>{t.notes&&<div style={{marginTop:4,color:"#718078",maxWidth:260}}>{t.notes}</div>}</td>
          <td style={{padding:11,minWidth:150}}>{alumniName(t.alumni_id)}</td><td style={{padding:11}}>{personName(t.assigned_to)}</td>
          <td style={{padding:11}}><span style={{fontWeight:750,color:t.priority==="urgent"||t.priority==="high"?"#a34116":brand}}>{t.priority}</span></td>
          <td style={{padding:11,whiteSpace:"nowrap",color:t.status!=="completed"&&t.due_date&&t.due_date<today()?"#b45309":"inherit"}}>{t.due_date||"—"}</td>
          <td style={{padding:11}}><select aria-label={"Status for "+t.title} value={t.status} onChange={e=>void updateTask(t,{status:e.target.value})} style={{...field,margin:0,minWidth:125,padding:"6px 8px",minHeight:34}}>{[["open","Open"],["in_progress","In progress"],["completed","Completed"],["cancelled","Cancelled"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td>
          <td style={{padding:11}}><button style={secondary} onClick={()=>{const outcome=window.prompt("Record the contact outcome or next step:",t.outcome||"");if(outcome!==null)void updateTask(t,{outcome});}}>Log outcome</button>{t.outcome&&<div style={{marginTop:5,maxWidth:180,color:"#718078"}}>{t.outcome}</div>}</td>
        </tr>)}
      </tbody></table></div>
    </section>
  </main>;
}
