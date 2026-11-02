"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AlumniEvent = {
  id: string; title: string; description: string | null; event_type: string | null;
  venue: string | null; starts_at: string; ends_at: string | null;
  registration_deadline: string | null; capacity: number | null; status: string;
};

type Registration = {
  id: string; registration_status: string; registered_at: string; checked_in_at: string | null;
  alumni: { full_name: string; alumni_id: string; work_email: string | null; phone: string | null } | null;
};

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e4ebe6", borderRadius: 14, padding: 18, boxShadow: "0 4px 16px rgba(20,54,39,.035)" };
const input: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, height: 40, padding: "0 10px", border: "1px solid #dce5df", borderRadius: 8, background: "#fff", color: "#173d34" };
const primary: React.CSSProperties = { border: 0, borderRadius: 8, padding: "10px 14px", background: "#106053", color: "#fff", fontWeight: 750, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #d9e4dd", borderRadius: 8, padding: "8px 11px", background: "#fff", color: "#106053", fontWeight: 700, cursor: "pointer" };

export default function AlumniEventsPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<AlumniEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<AlumniEvent | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [showAddAttendee, setShowAddAttendee] = useState(false);
  const [alumniSearch, setAlumniSearch] = useState("");
  const [alumniMatches, setAlumniMatches] = useState<{id:string;full_name:string;alumni_id:string;work_email:string|null;phone:string|null}[]>([]);
  const [selectedAlumniId, setSelectedAlumniId] = useState("");
  const [attendeeStatus, setAttendeeStatus] = useState("registered");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ title: "", description: "", event_type: "Networking", venue: "", starts_at: "", ends_at: "", registration_deadline: "", capacity: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("alumni_events").select("id,title,description,event_type,venue,starts_at,ends_at,registration_deadline,capacity,status").order("starts_at", { ascending: false }).limit(100);
    if (queryError) setError(queryError.message); else setEvents((data || []) as AlumniEvent[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function createEvent(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    const { error: saveError } = await supabase.from("alumni_events").insert({
      title: form.title.trim(), description: form.description || null, event_type: form.event_type,
      venue: form.venue || null, starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      registration_deadline: form.registration_deadline ? new Date(form.registration_deadline).toISOString() : null,
      capacity: form.capacity ? Number(form.capacity) : null, status: "draft"
    });
    if (saveError) setError(saveError.message);
    else {
      setNotice("Event saved as a draft. Publish it when the details are ready.");
      setShowForm(false);
      setForm({ title: "", description: "", event_type: "Networking", venue: "", starts_at: "", ends_at: "", registration_deadline: "", capacity: "" });
      await load();
    }
    setSaving(false);
  }

  async function setStatus(event: AlumniEvent, status: string) {
    setError(""); setNotice("");
    const { error: updateError } = await supabase.from("alumni_events").update({ status, updated_at: new Date().toISOString() }).eq("id", event.id);
    if (updateError) setError(updateError.message);
    else { setNotice("Event status updated."); await load(); }
  }

  async function openRegistrations(event: AlumniEvent) {
    setSelected(event); setRegistrations([]); setError("");
    const { data, error: queryError } = await supabase.from("alumni_event_registrations")
      .select("id,registration_status,registered_at,checked_in_at,alumni(full_name,alumni_id,work_email,phone)")
      .eq("event_id", event.id).order("registered_at", { ascending: true });
    if (queryError) setError(queryError.message);
    else setRegistrations((data || []) as unknown as Registration[]);
  }

  async function searchAlumni(event: FormEvent) {
    event.preventDefault(); setError(""); setAlumniMatches([]);
    const term = alumniSearch.trim();
    if (term.length < 2) { setError("Enter at least two characters to search alumni."); return; }
    const { data, error: searchError } = await supabase.from("alumni")
      .select("id,full_name,alumni_id,work_email,phone")
      .or("full_name.ilike.%"+term+"%,alumni_id.ilike.%"+term+"%,work_email.ilike.%"+term+"%")
      .neq("duplicate_review_status","merged").order("full_name").limit(20);
    if (searchError) setError(searchError.message);
    else setAlumniMatches((data || []) as typeof alumniMatches);
  }

  async function addAttendee() {
    if (!selected || !selectedAlumniId) { setError("Select an alumnus first."); return; }
    setSaving(true); setError(""); setNotice("");
    const { error: insertError } = await supabase.from("alumni_event_registrations").insert({
      event_id: selected.id, alumni_id: selectedAlumniId, registration_status: attendeeStatus
    });
    if (insertError) setError(insertError.message);
    else { setNotice("Alumnus added to the event register."); setShowAddAttendee(false); setSelectedAlumniId(""); setAlumniSearch(""); setAlumniMatches([]); await openRegistrations(selected); }
    setSaving(false);
  }

  async function updateRegistration(id: string, registration_status: string) {
    const patch = registration_status === "attended" ? { registration_status, checked_in_at: new Date().toISOString() } : { registration_status, checked_in_at: null };
    const { error: updateError } = await supabase.from("alumni_event_registrations").update(patch).eq("id", id);
    if (updateError) setError(updateError.message);
    else if (selected) await openRegistrations(selected);
  }

  const published = events.filter(e => e.status === "published").length;
  const drafts = events.filter(e => e.status === "draft").length;

  return <main style={{ padding: "28px clamp(16px,3vw,34px) 48px", color: "#173d34" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
      <div><Link href="/alumni" style={{ color: "#106053", fontSize: 12, fontWeight: 750, textDecoration: "none" }}>← Alumni directory</Link><div style={{ color: "#106053", fontSize: 11, fontWeight: 800, letterSpacing: 1.4, marginTop: 12 }}>ALUMNI ENGAGEMENT</div><h1 style={{ margin: "6px 0", fontSize: 28, fontWeight: 850 }}>Events & Attendance</h1><p style={{ margin: 0, color: "#718078", fontSize: 13 }}>Create alumni events, publish registration details and record attendance.</p></div>
      <button onClick={() => setShowForm(v => !v)} style={primary}>+ Create event</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 16 }}>
      {[["Total events", events.length], ["Published", published], ["Drafts", drafts]].map(([label, value]) => <div key={String(label)} style={card}><div style={{ color: "#718078", fontSize: 12, fontWeight: 700 }}>{label}</div><div style={{ fontSize: 29, fontWeight: 850, marginTop: 7 }}>{value}</div></div>)}
    </div>
    {notice && <div style={{ ...card, marginBottom: 12, color: "#17643f", background: "#eff9f1" }}>{notice}</div>}
    {error && <div role="alert" style={{ ...card, marginBottom: 12, color: "#a32828", borderColor: "#f2cccc" }}>{error}</div>}
    {showForm && <form onSubmit={createEvent} style={{ ...card, marginBottom: 16 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 850 }}>New alumni event</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Event title *<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={input} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Event type<select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} style={input}>{["Networking","Reunion","Career Fair","Mentorship","Fundraising","Professional Development","Webinar","Other"].map(x => <option key={x}>{x}</option>)}</select></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Venue / meeting link<input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} style={input} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Start date & time *<input required type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} style={input} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>End date & time<input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} style={input} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Registration deadline<input type="datetime-local" value={form.registration_deadline} onChange={e => setForm({ ...form, registration_deadline: e.target.value })} style={input} /></label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Capacity (leave blank for unlimited)<input type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} style={input} /></label>
        <label style={{ fontSize: 12, fontWeight: 700, gridColumn: "1 / -1" }}>Description<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...input, height: "auto", padding: 10 }} /></label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button type="button" style={secondary} onClick={() => setShowForm(false)}>Cancel</button><button disabled={saving} style={primary}>{saving ? "Saving…" : "Save draft"}</button></div>
    </form>}
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><h2 style={{ margin: 0, fontSize: 17, fontWeight: 850 }}>Event register</h2><button style={secondary} onClick={() => void load()}>Refresh</button></div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 850, borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: "#f4f8f5", textAlign: "left", color: "#61736a" }}>{["Event","Date & venue","Capacity","Status","Actions"].map(x => <th key={x} style={{ padding: 12 }}>{x}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={5} style={{ padding: 24, textAlign: "center" }}>Loading events…</td></tr> : events.length === 0 ? <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#819087" }}>No alumni events have been created yet.</td></tr> : events.map(event => <tr key={event.id} style={{ borderTop: "1px solid #edf1ee" }}>
          <td style={{ padding: 12 }}><div style={{ fontWeight: 800 }}>{event.title}</div><div style={{ color: "#87958d", marginTop: 3 }}>{event.event_type || "Event"}</div></td>
          <td style={{ padding: 12 }}>{new Date(event.starts_at).toLocaleString()}<div style={{ color: "#87958d", marginTop: 3 }}>{event.venue || "Venue to be confirmed"}</div></td>
          <td style={{ padding: 12 }}>{event.capacity ?? "Unlimited"}</td>
          <td style={{ padding: 12, textTransform: "capitalize" }}>{event.status.replaceAll("_", " ")}</td>
          <td style={{ padding: 12, display: "flex", flexWrap: "wrap", gap: 6 }}><button style={secondary} onClick={() => void openRegistrations(event)}>Registrations</button>{event.status === "draft" && <button style={primary} onClick={() => void setStatus(event, "published")}>Publish</button>}{event.status === "published" && <button style={secondary} onClick={() => void setStatus(event, "completed")}>Complete</button>}{event.status !== "cancelled" && event.status !== "completed" && <button style={{ ...secondary, color: "#a32828" }} onClick={() => void setStatus(event, "cancelled")}>Cancel</button>}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
    {selected && <section style={{ ...card, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><div><h2 style={{ margin: 0, fontSize: 17, fontWeight: 850 }}>Registrations: {selected.title}</h2><p style={{ margin: "4px 0 0", color: "#819087", fontSize: 12 }}>Staff can add alumni and record attendance. Alumni do not need portal accounts.</p></div><div style={{display:"flex",gap:8}}><button style={primary} onClick={()=>{setShowAddAttendee(v=>!v);setAlumniMatches([]);setSelectedAlumniId("");}}>+ Add attendee</button><button style={secondary} onClick={() => setSelected(null)}>Close</button></div></div>
      {showAddAttendee && <div style={{background:"#f7faf8",border:"1px solid #e7eee9",borderRadius:10,padding:14,marginTop:12}}>
        <form onSubmit={searchAlumni} style={{display:"flex",gap:8,flexWrap:"wrap"}}><input value={alumniSearch} onChange={e=>setAlumniSearch(e.target.value)} placeholder="Search by name, Alumni ID or email…" style={{flex:"1 1 240px",minWidth:180,border:"1px solid #dce5df",borderRadius:8,padding:"9px 11px"}}/><button style={secondary}>Search alumni</button></form>
        {alumniMatches.length>0&&<div style={{display:"grid",gap:6,marginTop:10}}>{alumniMatches.map(person=><button key={person.id} type="button" onClick={()=>setSelectedAlumniId(person.id)} style={{textAlign:"left",padding:10,borderRadius:8,border:selectedAlumniId===person.id?"2px solid #106053":"1px solid #dce5df",background:selectedAlumniId===person.id?"#edf6ef":"#fff",color:"#173d34"}}><strong style={{fontSize:12}}>{person.full_name}</strong><span style={{display:"block",fontSize:10,color:"#718078"}}>{person.alumni_id} · {person.work_email||person.phone||"No contact recorded"}</span></button>)}</div>}
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:10}}><label style={{fontSize:11,fontWeight:700}}>Registration status<select value={attendeeStatus} onChange={e=>setAttendeeStatus(e.target.value)} style={{marginLeft:7,border:"1px solid #dce5df",borderRadius:7,padding:8,background:"#fff"}}><option value="registered">Registered</option><option value="waitlisted">Waitlisted</option></select></label><button disabled={saving||!selectedAlumniId} onClick={()=>void addAttendee()} style={primary}>{saving?"Adding…":"Add to event"}</button><button type="button" style={secondary} onClick={()=>setShowAddAttendee(false)}>Cancel</button></div>
      </div>}
      <div style={{ overflowX: "auto", marginTop: 12 }}><table style={{ width: "100%", minWidth: 650, borderCollapse: "collapse", fontSize: 12 }}><thead><tr style={{ background: "#f4f8f5", textAlign: "left" }}>{["Alumnus","Contact","Registration","Attendance"].map(x => <th key={x} style={{ padding: 10 }}>{x}</th>)}</tr></thead>
        <tbody>{registrations.length === 0 ? <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#819087" }}>No registrations yet.</td></tr> : registrations.map(r => <tr key={r.id} style={{ borderTop: "1px solid #edf1ee" }}><td style={{ padding: 10, fontWeight: 750 }}>{r.alumni?.full_name || "Alumni"}<div style={{ color: "#87958d" }}>{r.alumni?.alumni_id || ""}</div></td><td style={{ padding: 10 }}>{r.alumni?.work_email || r.alumni?.phone || "—"}</td><td style={{ padding: 10, textTransform: "capitalize" }}>{r.registration_status}</td><td style={{ padding: 10 }}>{r.registration_status === "waitlisted" ? "Waitlisted" : <button style={r.registration_status === "attended" ? secondary : primary} onClick={() => void updateRegistration(r.id, r.registration_status === "attended" ? "registered" : "attended")}>{r.registration_status === "attended" ? "Undo check-in" : "Mark attended"}</button>}</td></tr>)}</tbody>
      </table></div>
    </section>}
  </main>;
}
