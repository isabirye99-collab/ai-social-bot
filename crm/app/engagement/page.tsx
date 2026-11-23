"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
type Contact = { id:string; full_name:string; phone:string; email:string|null; program:string|null; source:string; created_at:string };
type Staff = { id:string; full_name:string; role:string; is_active:boolean };
type Lead = { id:string; name:string; phone:string|null; ciu_number:string|null; assigned_to:string|null; next_follow_up_at:string|null; intake_year:number|null; intake_month:number|null };
type Interaction = { id:string; contact_id:string; lead_id:string|null; task_id:string|null; channel:string; reason:string; response:string; notes:string|null; outcome:string; assigned_to:string|null; follow_up_at:string|null; contacted_at:string; contact?:Contact; assigned_name?:string; lead?:Lead|null };
const blankContact = { full_name:"", phone:"", email:"", program:"", source:"call_centre" };
const blankInteraction = { contact_id:"", lead_id:"", person_name:"", person_phone:"", channel:"outgoing_call", reason:"Programme inquiry", response:"pending", notes:"", outcome:"in_progress", follow_up_at:"", assigned_to:"" };
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";
const channels = [{value:"incoming_call",label:"Incoming call"},{value:"outgoing_call",label:"Outgoing call"},{value:"incoming_whatsapp",label:"Incoming WhatsApp"},{value:"outgoing_whatsapp",label:"Outgoing WhatsApp"}];
const reasons = ["Programme inquiry","Tuition fees","Admission requirements","Application follow-up","School outreach","Application status","Complaints or support","Other"];
const responses = [{value:"pending",label:"Awaiting response"},{value:"answered",label:"Answered / replied"},{value:"interested",label:"Interested"},{value:"callback",label:"Asked for a callback"},{value:"no_answer",label:"No answer"},{value:"not_interested",label:"Not interested"},{value:"wrong_number",label:"Wrong number"}];
const outcomes = [{value:"in_progress",label:"In progress"},{value:"interested",label:"Interested"},{value:"applied",label:"Applied"},{value:"admitted",label:"Admitted"},{value:"enrolled",label:"Enrolled"},{value:"dropped",label:"Dropped"},{value:"resolved",label:"Resolved"}];

export default function EngagementPage() {
 const [contacts,setContacts]=useState<Contact[]>([]);
 const [interactions,setInteractions]=useState<Interaction[]>([]);
 const [staff,setStaff]=useState<Staff[]>([]);
 const [leads,setLeads]=useState<Lead[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [search,setSearch]=useState("");
 const [showContact,setShowContact]=useState(false);
 const [contactForm,setContactForm]=useState(blankContact);
 const [form,setForm]=useState(blankInteraction);
 const [editing,setEditing]=useState<string|null>(null);
 async function load(){
  setLoading(true); setError("");
  try {
   const [c,i,p,l]=await Promise.all([
    supabase.from("engagement_contacts").select("id,full_name,phone,email,program,source,created_at").order("created_at",{ascending:false}),
    supabase.from("engagement_interactions").select("id,contact_id,lead_id,task_id,channel,reason,response,notes,outcome,assigned_to,follow_up_at,contacted_at").order("contacted_at",{ascending:false}),
    supabase.from("profiles").select("id,full_name,role,is_active").eq("is_active",true).order("full_name"),
    supabase.from("leads").select("id,name,phone,ciu_number,assigned_to,next_follow_up_at,intake_year,intake_month").order("name").limit(5000)
   ]);
   if(c.error) throw c.error; if(i.error) throw i.error; if(p.error) throw p.error; if(l.error) throw l.error;
   const cs=(c.data||[]) as Contact[]; setContacts(cs);
   const activeStaff=(p.data||[]) as Staff[]; setStaff(activeStaff);
   const leadRows=(l.data||[]) as Lead[]; setLeads(leadRows);
   const leadsById=new Map(leadRows.map(x=>[x.id,x]));
   const byId=new Map(cs.map(x=>[x.id,x]));
   const staffById=new Map(activeStaff.map(x=>[x.id,x.full_name]));
   setInteractions(((i.data||[]) as Interaction[]).map(x=>({...x,contact:byId.get(x.contact_id),assigned_name:x.assigned_to?staffById.get(x.assigned_to)||"Inactive or unavailable staff":"Unassigned"})));
  } catch(e){setError(e instanceof Error?e.message:"Unable to load engagement records.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 const filtered=useMemo(()=>interactions.filter(x=>[x.contact?.full_name,x.contact?.phone,x.reason,x.notes,x.response,x.outcome].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())),[interactions,search]);
 const stats=useMemo(()=>({
  interactions:interactions.length,
  calls:interactions.filter(x=>x.channel.includes("call")).length,
  whatsapp:interactions.filter(x=>x.channel.includes("whatsapp")).length,
  replied:interactions.filter(x=>["answered","interested","callback"].includes(x.response)).length,
  followups:interactions.filter(x=>x.follow_up_at && new Date(x.follow_up_at)>=new Date() && x.outcome!=="resolved" && x.outcome!=="dropped").length,
  interested:interactions.filter(x=>x.outcome==="interested").length
 }),[interactions]);
 async function saveContact(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setSaving(true);setError("");setSuccess("");
  try{
   const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Please sign in again.");
   const {data,error}=await supabase.from("engagement_contacts").insert({...contactForm,created_by:user.id}).select("id").single();
   if(error)throw error;
   setContactForm(blankContact);setShowContact(false);setForm(v=>({...v,contact_id:data.id}));
   setSuccess("Contact added. Now log the call or WhatsApp interaction.");await load();
  }catch(e){setError(e instanceof Error?e.message:"Could not save contact.");}finally{setSaving(false);}
 }
 async function saveInteraction(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setSaving(true);setError("");setSuccess("");
  try{
   const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Please sign in again.");
   const phone=form.person_phone.trim();
   if(!form.person_name.trim() || !phone) throw new Error("Enter the person's name and phone number.");
   let contactId=form.contact_id;
   const existingContact=await supabase.from("engagement_contacts").select("id").eq("phone",phone).maybeSingle();
   if(existingContact.error) throw existingContact.error;
   if(existingContact.data){
    contactId=existingContact.data.id;
    const updatedContact=await supabase.from("engagement_contacts").update({full_name:form.person_name.trim()}).eq("id",contactId);
    if(updatedContact.error) throw updatedContact.error;
   } else {
    const source=form.channel.includes("whatsapp")?"whatsapp":"call_centre";
    const newContact=await supabase.from("engagement_contacts").insert({full_name:form.person_name.trim(),phone,source,created_by:user.id}).select("id").single();
    if(newContact.error) throw newContact.error;
    contactId=newContact.data.id;
   }
   const selectedLead=leads.find(x=>x.id===form.lead_id);
   const followUpAt=form.follow_up_at?new Date(form.follow_up_at).toISOString():null;
   const payload={contact_id:contactId,lead_id:form.lead_id||null,channel:form.channel,reason:form.reason,response:form.response,notes:form.notes.trim()||null,outcome:form.outcome,assigned_to:form.assigned_to||user.id,follow_up_at:followUpAt};
   let interactionId=editing;
   let existingTaskId:string|null=null;
   if(editing){
    const current=interactions.find(x=>x.id===editing);
    existingTaskId=current?.task_id||null;
    const result=await supabase.from("engagement_interactions").update(payload).eq("id",editing);
    if(result.error)throw result.error;
   } else {
    const result=await supabase.from("engagement_interactions").insert({...payload,contacted_at:new Date().toISOString(),created_by:user.id}).select("id").single();
    if(result.error)throw result.error;
    interactionId=result.data.id;
   }
   if(selectedLead){
    const leadUpdate=await supabase.from("leads").update({assigned_to:form.assigned_to||user.id,next_follow_up_at:followUpAt,follow_up_status:followUpAt?"scheduled":"pending"}).eq("id",selectedLead.id);
    if(leadUpdate.error)throw leadUpdate.error;
   }
   if(selectedLead && followUpAt){
    const taskPayload={title:`${form.channel.includes("whatsapp")?"WhatsApp":"Call"} follow-up: ${selectedLead.name}`,description:[form.reason,form.notes.trim()].filter(Boolean).join(" — ")||"Follow up from Call Centre & WhatsApp.",task_type:form.channel.includes("whatsapp")?"whatsapp":"call",lead_id:selectedLead.id,assigned_to:form.assigned_to||user.id,due_at:followUpAt,status:"pending",priority:"medium",created_by:user.id,intake_year:selectedLead.intake_year,intake_month:selectedLead.intake_month};
    let taskId=existingTaskId;
    if(taskId){
     const updateTask=await supabase.from("tasks").update(taskPayload).eq("id",taskId).select("id").maybeSingle();
     if(updateTask.error)throw updateTask.error;
     if(!updateTask.data)taskId=null;
    }
    if(!taskId){
     const insertTask=await supabase.from("tasks").insert(taskPayload).select("id").single();
     if(insertTask.error)throw insertTask.error;
     taskId=insertTask.data.id;
    }
    if(interactionId){const linkTask=await supabase.from("engagement_interactions").update({task_id:taskId}).eq("id",interactionId);if(linkTask.error)throw linkTask.error;}
   }
   setForm(blankInteraction);setEditing(null);setSuccess(editing?"Interaction updated.":"Interaction logged.");await load();
  }catch(e){setError(e instanceof Error?e.message:"Could not save interaction.");}finally{setSaving(false);}
 }
 async function remove(id:string){if(!window.confirm("Delete this interaction record?"))return;const {error}=await supabase.from("engagement_interactions").delete().eq("id",id);if(error)setError(error.message);else{setSuccess("Interaction deleted.");await load();}}
 return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
  <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">CIU · Engagement</p><h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Call Centre & WhatsApp</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Keep a continuous record of calls, WhatsApp conversations, responses and follow-ups.</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>setShowContact(v=>!v)} className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-800">+ Add contact</button><button onClick={()=>{setEditing(null);setForm(blankInteraction);document.getElementById("engagement-log")?.scrollIntoView({behavior:"smooth"});}} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white">+ Log interaction</button></div></header>
  {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}{success&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}
  <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[{label:"Interactions logged",value:stats.interactions},{label:"Calls",value:stats.calls},{label:"WhatsApp",value:stats.whatsapp},{label:"Responses received",value:stats.replied},{label:"Interested outcomes",value:stats.interested}].map(x=><div key={x.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">{x.label}</p><p className="mt-2 text-2xl font-bold text-emerald-900">{x.value.toLocaleString()}</p></div>)}</section>
  {showContact&&<form onSubmit={saveContact} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Add person contacted</h2><button type="button" onClick={()=>setShowContact(false)} className="text-sm text-slate-500">Cancel</button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Full name *<input required className={inputClass+" mt-1"} value={contactForm.full_name} onChange={e=>setContactForm({...contactForm,full_name:e.target.value})}/></label><label className="text-sm font-medium">Phone number *<input required type="tel" className={inputClass+" mt-1"} value={contactForm.phone} onChange={e=>setContactForm({...contactForm,phone:e.target.value})}/></label><label className="text-sm font-medium">Email (optional)<input type="email" className={inputClass+" mt-1"} value={contactForm.email} onChange={e=>setContactForm({...contactForm,email:e.target.value})}/></label><label className="text-sm font-medium">Programme of interest<input className={inputClass+" mt-1"} value={contactForm.program} onChange={e=>setContactForm({...contactForm,program:e.target.value})}/></label><label className="text-sm font-medium sm:col-span-2">Contact source<select className={inputClass+" mt-1"} value={contactForm.source} onChange={e=>setContactForm({...contactForm,source:e.target.value})}><option value="call_centre">School call centre</option><option value="whatsapp">WhatsApp</option><option value="school_outreach">School outreach</option><option value="other">Other</option></select></label></div><button disabled={saving} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving?"Saving…":"Save contact"}</button></form>}
  <form id="engagement-log" onSubmit={saveInteraction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><div><h2 className="font-bold text-slate-900">{editing?"Update interaction":"Log a call or WhatsApp interaction"}</h2><p className="mt-1 text-xs text-slate-500">Each repeat contact should be logged as a separate interaction.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Link to existing CRM lead (optional)<select className={inputClass+" mt-1"} value={form.lead_id} onChange={e=>{const lead=leads.find(x=>x.id===e.target.value);setForm({...form,lead_id:e.target.value,person_name:lead?.name||form.person_name,person_phone:lead?.phone||form.person_phone,assigned_to:lead?.assigned_to||form.assigned_to});}}><option value="">No existing lead — log contact only</option>{leads.map(x=><option key={x.id} value={x.id}>{x.name}{x.ciu_number?" · CIU "+x.ciu_number:""}{x.phone?" · "+x.phone:""}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">Choose a lead to link the interaction to the student record. Assigning a linked lead updates its owner.</span></label><label className="text-sm font-medium">Person name *<input required className={inputClass+" mt-1"} placeholder="Type the person’s name" value={form.person_name} onChange={e=>setForm({...form,person_name:e.target.value})}/></label><label className="text-sm font-medium">Phone number *<input required type="tel" className={inputClass+" mt-1"} placeholder="Type phone number" value={form.person_phone} onChange={e=>setForm({...form,person_phone:e.target.value})}/></label><label className="text-sm font-medium">Channel *<select className={inputClass+" mt-1"} value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})}>{channels.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label><label className="text-sm font-medium">Reason for contact *<select className={inputClass+" mt-1"} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}>{reasons.map(x=><option key={x}>{x}</option>)}</select></label><label className="text-sm font-medium">Response *<select className={inputClass+" mt-1"} value={form.response} onChange={e=>setForm({...form,response:e.target.value})}>{responses.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label><label className="text-sm font-medium">Outcome *<select className={inputClass+" mt-1"} value={form.outcome} onChange={e=>setForm({...form,outcome:e.target.value})}>{outcomes.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label><label className="text-sm font-medium">Assign to staff member *<select required className={inputClass+" mt-1"} value={form.assigned_to} onChange={e=>setForm({...form,assigned_to:e.target.value})}><option value="">Select a staff member</option>{staff.map(x=><option key={x.id} value={x.id}>{x.full_name} ({x.role.replace("_"," ")})</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">Choose the person responsible for the next contact.</span></label><label className="text-sm font-medium">Follow-up date (optional)<input type="datetime-local" className={inputClass+" mt-1"} value={form.follow_up_at} onChange={e=>setForm({...form,follow_up_at:e.target.value})}/></label><label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Conversation notes<textarea rows={3} className={inputClass+" mt-1"} placeholder="What did they say? What information was shared? What should happen next?" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label></div><div className="flex flex-wrap gap-2"><button disabled={saving} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving?"Saving…":editing?"Save changes":"Save interaction"}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setForm(blankInteraction);}} className="rounded-xl border px-4 py-2.5 text-sm">Cancel edit</button>}</div></form>
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">Interaction history</h2><p className="text-xs text-slate-500">Search by name, phone number, reason or outcome.</p></div><input className={inputClass+" sm:max-w-xs"} placeholder="Search interactions…" value={search} onChange={e=>setSearch(e.target.value)}/></div>{loading?<p className="p-6 text-sm text-slate-500">Loading records…</p>:filtered.length===0?<p className="p-6 text-sm text-slate-500">No interactions found. Add a contact and log the first interaction.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Date","Person / phone","Assigned staff","Channel","Reason","Response","Outcome","Follow-up","Actions"].map(x=><th key={x} className="px-4 py-3 font-semibold">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(x=><tr key={x.id} className="align-top"><td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(x.contacted_at).toLocaleString("en-UG",{dateStyle:"medium",timeStyle:"short"})}</td><td className="px-4 py-3"><p className="font-semibold text-slate-900">{x.contact?.full_name||"Unknown"}</p><p className="text-xs text-slate-500">{x.contact?.phone}</p>{x.lead&&<p className="mt-1 text-xs font-semibold text-emerald-800">CRM lead{x.lead.ciu_number?" · CIU "+x.lead.ciu_number:""}</p>}</td><td className="px-4 py-3"><p className="font-medium text-slate-800">{x.assigned_name||"Unassigned"}</p></td><td className="px-4 py-3">{channels.find(c=>c.value===x.channel)?.label||x.channel}</td><td className="px-4 py-3">{x.reason}<p className="mt-1 max-w-[220px] whitespace-normal text-xs text-slate-500">{x.notes}</p></td><td className="px-4 py-3">{responses.find(c=>c.value===x.response)?.label||x.response}</td><td className="px-4 py-3">{outcomes.find(c=>c.value===x.outcome)?.label||x.outcome}</td><td className="px-4 py-3 text-xs">{x.follow_up_at?new Date(x.follow_up_at).toLocaleString("en-UG",{dateStyle:"medium",timeStyle:"short"}):"—"}</td><td className="px-4 py-3"><div className="flex gap-2"><button className="font-semibold text-emerald-800" onClick={()=>{setEditing(x.id);setForm({contact_id:x.contact_id,lead_id:x.lead_id||"",person_name:x.contact?.full_name||"",person_phone:x.contact?.phone||"",channel:x.channel,reason:x.reason,response:x.response,notes:x.notes||"",outcome:x.outcome,follow_up_at:x.follow_up_at?new Date(x.follow_up_at).toISOString().slice(0,16):"",assigned_to:x.assigned_to||""});document.getElementById("engagement-log")?.scrollIntoView({behavior:"smooth"});}}>Edit</button><button className="font-semibold text-red-700" onClick={()=>void remove(x.id)}>Delete</button></div></td></tr>)}</tbody></table></div>}</section>
 </main>;
}
