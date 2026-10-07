"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Lead = { id:string; status:string|null; next_follow_up_at:string|null; created_at:string|null };
type Admission = { id:string; stage:string|null; created_at:string|null };
type Opportunity = { id:string; value:number|null; status:string|null; probability:number|null };
type Task = { id:string; due_at:string|null; status:string|null };

const supabase=createClient();

function sameDay(a:Date,b:Date){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();}
function isThisMonth(value:string|null){if(!value)return false;const d=new Date(value),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth();}
function money(value:number){return new Intl.NumberFormat("en-UG",{style:"currency",currency:"UGX",maximumFractionDigits:0}).format(value||0);}

export default function DashboardPage(){
 const [leads,setLeads]=useState<Lead[]>([]),[admissions,setAdmissions]=useState<Admission[]>([]),[opportunities,setOpportunities]=useState<Opportunity[]>([]),[tasks,setTasks]=useState<Task[]>([]);
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState("");

 async function loadDashboard(){
  try{setError("");
   const [l,a,o,t]=await Promise.all([
    supabase.from("leads").select("id,status,next_follow_up_at,created_at"),
    supabase.from("admissions").select("id,stage,created_at"),
    supabase.from("opportunities").select("id,value,status,probability"),
    supabase.from("tasks").select("id,due_at,status")
   ]);
   const firstError=[l,a,o,t].find(x=>x.error); if(firstError?.error)throw new Error(firstError.error.message);
   setLeads((l.data||[]) as Lead[]);setAdmissions((a.data||[]) as Admission[]);setOpportunities((o.data||[]) as Opportunity[]);setTasks((t.data||[]) as Task[]);
  }catch(err){setError(err instanceof Error?err.message:"Unable to load dashboard.");}
  finally{setLoading(false);setRefreshing(false);}
 }
 useEffect(()=>{loadDashboard();},[]);

 const stats=useMemo(()=>{
  const now=new Date(),endToday=new Date(now);endToday.setHours(23,59,59,999);
  const openDeals=opportunities.filter(x=>(x.status||"").toLowerCase()==="open");
  const forecast=openDeals.reduce((s,x)=>s+Number(x.value||0)*(Number(x.probability??100)/100),0);
  const followUps=leads.filter(x=>{if(!x.next_follow_up_at)return false;const st=(x.status||"").toLowerCase();if(["converted","lost","unqualified"].includes(st))return false;return new Date(x.next_follow_up_at)<=endToday;}).length;
  const tasksToday=tasks.filter(x=>x.due_at&&!["completed","cancelled"].includes((x.status||"").toLowerCase())&&sameDay(new Date(x.due_at),now)).length;
  const interested=leads.filter(x=>(x.status||"").toLowerCase()==="qualified").length;
  const enrolled=admissions.filter(x=>(x.stage||"").toLowerCase()==="enrolled").length;
  return {leads:leads.length,interested,openDeals:openDeals.length,forecast,enrolled,followUps,tasksToday,newLeads:leads.filter(x=>isThisMonth(x.created_at)).length};
 },[leads,admissions,opportunities,tasks]);

 if(loading)return <main className="ciu-page"><div className="ciu-page-inner"><div className="ciu-card" style={{padding:24}}>Loading dashboard...</div></div></main>;

 const kpis=[
  {label:"Total Leads",value:stats.leads,note:"+"+stats.newLeads+" this month",href:"/leads"},
  {label:"Interested",value:stats.interested,note:"Qualified leads",href:"/leads"},
  {label:"Open Deals",value:stats.openDeals,note:"Active opportunities",href:"/pipeline"},
  {label:"Forecast",value:money(stats.forecast),note:"Weighted pipeline"},
  {label:"Enrolled",value:stats.enrolled,note:"Current admissions",href:"/customers"},
  {label:"Follow-ups",value:stats.followUps,note:stats.followUps?"Needs attention":"Nothing due",href:"/leads"}
 ];

 return <main className="ciu-page"><div className="ciu-page-inner">
  <div className="ciu-hero">
   <div style={{position:"relative",zIndex:1,display:"flex",justifyContent:"space-between",alignItems:"center",gap:18,flexWrap:"wrap"}}>
    <div><h1>Management Dashboard</h1><p>A focused view of admissions, pipeline and follow-up activity.</p></div>
    <button type="button" onClick={async()=>{setRefreshing(true);await loadDashboard();}} disabled={refreshing} className="ciu-btn">{refreshing?"↻ Refreshing...":"↻ Refresh"}</button>
   </div>
  </div>

  {error&&<div style={{marginBottom:18,padding:12,borderRadius:10,background:"#fff3f2",border:"1px solid #f3c9c5",color:"#9b332b",fontSize:12}}>{error}</div>}

  <div className="ciu-kpis">
   {kpis.map(k=>k.href?<Link key={k.label} href={k.href} className="ciu-kpi"><div className="ciu-kpi-label">{k.label}</div><div className="ciu-kpi-value" style={{fontSize:k.label==="Forecast"?18:24}}>{k.value}</div><div className="ciu-kpi-note">{k.note}</div></Link>:<div key={k.label} className="ciu-kpi"><div className="ciu-kpi-label">{k.label}</div><div className="ciu-kpi-value" style={{fontSize:18}}>{k.value}</div><div className="ciu-kpi-note">{k.note}</div></div>)}
  </div>

  <div className="ciu-strip"><strong style={{color:"#17483f"}}>This month:</strong> {stats.newLeads} new leads · {stats.interested} interested · {stats.enrolled} enrolled · {stats.tasksToday} tasks due today</div>

  <div className="ciu-card">
   <div className="ciu-card-head"><div><h2>Today's Attention</h2><span>Only the items that need action now.</span></div><Link href="/reports" className="ciu-btn ciu-btn-light">View Reports →</Link></div>
   <div className="ciu-attention">
    <div className="ciu-attention-item"><strong>{stats.followUps}</strong><span>Follow-ups due</span></div>
    <div className="ciu-attention-item"><strong>{stats.tasksToday}</strong><span>Tasks due today</span></div>
    <div className="ciu-attention-item"><strong>{stats.interested}</strong><span>Interested leads</span></div>
   </div>
  </div>
 </div></main>;
}
