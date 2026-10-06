"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile={id:string;full_name:string|null;phone:string|null;role:string|null;is_active:boolean|null;avatar_url:string|null};
const ROLES=["super_admin","admin","manager","salesperson","marketing","finance","viewer"];

export default function Staff(){
 const supabase=createClient();
 const [staff,setStaff]=useState<Profile[]>([]);
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
 const [search,setSearch]=useState(""); const [editing,setEditing]=useState<Profile|null>(null);
 const [form,setForm]=useState({full_name:"",phone:"",role:"salesperson",is_active:true});

 async function load(){
  setLoading(true); const {data,error:e}=await supabase.from("profiles").select("id,full_name,phone,role,is_active,avatar_url").order("full_name",{ascending:true});
  if(e)setError(e.message); else setStaff((data||[]) as Profile[]); setLoading(false);
 }
 useEffect(()=>{load();},[]);

 const filtered=useMemo(()=>staff.filter(s=>{const q=search.trim().toLowerCase();return !q||[s.full_name,s.phone,s.role].filter(Boolean).join(" ").toLowerCase().includes(q);}),[staff,search]);
 const active=staff.filter(s=>s.is_active).length;
 const openEdit=(s:Profile)=>{setEditing(s);setForm({full_name:s.full_name||"",phone:s.phone||"",role:s.role||"salesperson",is_active:s.is_active!==false});setError("");};
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(!editing)return;setSaving(true);setError("");const {error:e2}=await supabase.from("profiles").update({full_name:form.full_name.trim()||null,phone:form.phone.trim()||null,role:form.role,is_active:form.is_active}).eq("id",editing.id);if(e2)setError(e2.message);else{setEditing(null);await load();}setSaving(false);};

 return <>
  <div className="crm-page-heading"><div><h1>Staff & Team</h1><p>Manage CRM staff profiles, roles and active status.</p></div><button type="button" onClick={load} className="crm-btn" style={{display:"inline-flex",visibility:"visible",opacity:1}}>{loading?"Refreshing...":"Refresh Staff"}</button></div>
  <div className="crm-kpis">
   <div className="crm-kpi"><span className="crm-kpi-label">Total Staff</span><div className="crm-kpi-value">{staff.length}</div><span className="crm-kpi-change">CRM profiles</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Active</span><div className="crm-kpi-value">{active}</div><span className="crm-kpi-change">Currently active</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Managers/Admins</span><div className="crm-kpi-value">{staff.filter(s=>["super_admin","admin","manager"].includes(s.role||"")).length}</div><span className="crm-kpi-change">Management access</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Inactive</span><div className="crm-kpi-value">{staff.length-active}</div><span className="crm-kpi-change">Needs review</span></div>
  </div>
  {error&&<div style={{marginBottom:16,padding:12,borderRadius:8,background:"#fef2f2",color:"#b91c1c",border:"1px solid #fecaca"}}>{error}</div>}
  <div className="crm-card"><div className="crm-card-header" style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><h2>Team Directory</h2><span>Edit existing authenticated profiles</span></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff..." style={{padding:"9px 12px",border:"1px solid #d1d5db",borderRadius:8,minWidth:220}}/></div>
   <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Staff Member</th><th>Phone</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{loading?<tr><td colSpan={5} style={{textAlign:"center",padding:30}}>Loading staff...</td></tr>:filtered.map(s=><tr key={s.id}><td><strong>{s.full_name||"Unnamed"}</strong></td><td>{s.phone||"—"}</td><td><span className="crm-badge">{(s.role||"viewer").replaceAll("_"," ")}</span></td><td><span className="crm-badge">{s.is_active?"Active":"Inactive"}</span></td><td><button type="button" onClick={()=>openEdit(s)} style={{display:"inline-flex",visibility:"visible",opacity:1,color:"#fff",background:"#2563eb",border:"1px solid #2563eb",padding:"7px 11px",borderRadius:7,fontWeight:600,cursor:"pointer"}}>Edit</button></td></tr>)}{!loading&&!filtered.length&&<tr><td colSpan={5} style={{textAlign:"center",padding:30}}>No staff found.</td></tr>}</tbody></table></div>
  </div>
  {editing&&<div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(15,23,42,.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><form onSubmit={save} style={{width:"100%",maxWidth:520,background:"#fff",borderRadius:14,padding:22,boxShadow:"0 20px 50px rgba(0,0,0,.2)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><div><h2 style={{margin:0}}>Edit Staff Profile</h2><p style={{margin:"5px 0 0",fontSize:12,color:"#64748b"}}>{editing.full_name||"Staff member"}</p></div><button type="button" onClick={()=>setEditing(null)} style={{border:"1px solid #e5e7eb",background:"#fff,borderRadius:8,width:36,height:36,cursor:"pointer"}}>×</button></div>
   <div style={{display:"grid",gap:14}}><label style={{fontSize:13,fontWeight:600}}>Full Name<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} style={{display:"block",width:"100%",height:42,marginTop:6,padding:"0 12px",border:"1px solid #d1d5db",borderRadius:8,boxSizing:"border-box"}}/></label><label style={{fontSize:13,fontWeight:600}}>Phone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} style={{display:"block",width:"100%",height:42,marginTop:6,padding:"0 12px",border:"1px solid #d1d5db",borderRadius:8,boxSizing:"border-box"}}/></label><label style={{fontSize:13,fontWeight:600}}>Role<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} style={{display:"block",width:"100%",height:42,marginTop:6,padding:"0 12px",border:"1px solid #d1d5db",borderRadius:8,background:"#fff"}}>{ROLES.map(r=><option key={r} value={r}>{r.replaceAll("_"," ")}</option>)}</select></label><label style={{display:"flex",gap:10,alignItems:"center",fontSize:13,fontWeight:600}}><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Active staff member</label></div>
   <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:22}}><button type="button" onClick={()=>setEditing(null)} className="crm-btn secondary">Cancel</button><button type="submit" disabled={saving} className="crm-btn" style={{display:"inline-flex",visibility:"visible",opacity:saving?.7:1}}>{saving?"Saving...":"Save Profile"}</button></div>
  </form></div>}
 </>
}