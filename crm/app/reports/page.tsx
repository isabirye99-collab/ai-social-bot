"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Lead={id:string;status:string|null;source_id:string|null;created_at:string|null;product_service:string|null};
type Admission={id:string;stage:string|null;program:string|null;tuition_fee:number|null;tuition_paid:number|null;acceptance_paid:number|null;created_at:string|null};
type Opportunity={id:string;title:string;value:number|null;status:string|null;probability:number|null;stage_id:string|null;created_at:string|null};
type Stage={id:string;name:string;probability:number|null;is_won:boolean|null;is_lost:boolean|null};

function money(v:number){return `UGX ${Math.round(v||0).toLocaleString("en-UG")}`;}

export default function Reports(){
 const supabase=createClient();
 const [leads,setLeads]=useState<Lead[]>([]);
 const [admissions,setAdmissions]=useState<Admission[]>([]);
 const [opportunities,setOpportunities]=useState<Opportunity[]>([]);
 const [stages,setStages]=useState<Stage[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");

 async function load(){
  setLoading(true); setError("");
  const [l,a,o,s]=await Promise.all([
   supabase.from("leads").select("id,status,source_id,created_at,product_service"),
   supabase.from("admissions").select("id,stage,program,tuition_fee,tuition_paid,acceptance_paid,created_at"),
   supabase.from("opportunities").select("id,title,value,status,probability,stage_id,created_at"),
   supabase.from("pipeline_stages").select("id,name,probability,is_won,is_lost").order("position",{ascending:true})
  ]);
  const first=[l,a,o,s].find(x=>x.error);
  if(first?.error){setError(first.error.message);}
  setLeads((l.data||[]) as Lead[]);
  setAdmissions((a.data||[]) as Admission[]);
  setOpportunities((o.data||[]) as Opportunity[]);
  setStages((s.data||[]) as Stage[]);
  setLoading(false);
 }

 useEffect(()=>{load();},[]);

 const metrics=useMemo(()=>{
  const converted=leads.filter(x=>["converted"].includes((x.status||"").toLowerCase())).length;
  const conversion=leads.length?Math.round(converted/leads.length*1000)/10:0;
  const open=opportunities.filter(x=>(x.status||"").toLowerCase()==="open");
  const forecast=open.reduce((sum,x)=>sum+Number(x.value||0)*(Number(x.probability||0)/100),0);
  const won=open.length?0:0;
  const tuition=admissions.reduce((s,x)=>s+Number(x.tuition_paid||0)+Number(x.acceptance_paid||0),0);
  return {conversion,forecast,tuition,open:open.length,converted};
 },[leads,admissions,opportunities]);

 const stageRows=useMemo(()=>stages.map(stage=>{
  const count=opportunities.filter(o=>o.stage_id===stage.id).length;
  const value=opportunities.filter(o=>o.stage_id===stage.id).reduce((s,o)=>s+Number(o.value||0),0);
  return {stage,count,value};
 }),[stages,opportunities]);

 const programRows=useMemo(()=>{
  const map=new Map<string,{count:number;paid:number}>();
  admissions.forEach(a=>{const key=a.program||"Unspecified";const x=map.get(key)||{count:0,paid:0};x.count++;x.paid+=Number(a.tuition_paid||0)+Number(a.acceptance_paid||0);map.set(key,x);});
  return [...map.entries()].sort((a,b)=>b[1].count-a[1].count).slice(0,10);
 },[admissions]);

 function exportReport(){
  const rows=[
   ["Metric","Value"],
   ["Total Leads",leads.length],
   ["Converted Leads",metrics.converted],
   ["Lead Conversion",`${metrics.conversion}%`],
   ["Open Opportunities",metrics.open],
   ["Weighted Sales Forecast",metrics.forecast],
   ["Admissions Fees/Tuition Paid",metrics.tuition],
   [],
   ["Programme","Admissions","Paid"],
   ...programRows.map(([name,x])=>[name,x.count,x.paid])
  ];
  const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="ciu-crm-report.csv"; a.click(); URL.revokeObjectURL(url);
 }

 return <>
  <div className="crm-page-heading">
   <div><h1>Reports & Analytics</h1><p>Live performance reports from your CRM data.</p></div>
   <div style={{display:"flex",gap:10}}>
    <button type="button" onClick={load} disabled={loading} className="crm-btn secondary">{loading?"Refreshing...":"Refresh"}</button>
    <button type="button" onClick={exportReport} className="crm-btn" style={{display:"inline-flex",visibility:"visible",opacity:1}}>Export CSV</button>
   </div>
  </div>
  {error&&<div style={{marginBottom:16,padding:12,borderRadius:8,background:"#fef2f2",color:"#b91c1c",border:"1px solid #fecaca"}}>{error}</div>}
  <div className="crm-kpis">
   <div className="crm-kpi"><span className="crm-kpi-label">Lead Conversion</span><div className="crm-kpi-value">{metrics.conversion}%</div><span className="crm-kpi-change">{metrics.converted} converted</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Weighted Forecast</span><div className="crm-kpi-value">{money(metrics.forecast)}</div><span className="crm-kpi-change">{metrics.open} open deals</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Collected</span><div className="crm-kpi-value">{money(metrics.tuition)}</div><span className="crm-kpi-change">Admission payments</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Admissions</span><div className="crm-kpi-value">{admissions.length}</div><span className="crm-kpi-change">All admission records</span></div>
  </div>
  <div className="crm-grid crm-grid-2">
   <div className="crm-card"><div className="crm-card-header"><h2>Pipeline Performance</h2><span>Live</span></div><div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Stage</th><th>Deals</th><th>Value</th></tr></thead><tbody>{stageRows.length?stageRows.map(x=><tr key={x.stage.id}><td><strong>{x.stage.name}</strong></td><td>{x.count}</td><td>{money(x.value)}</td></tr>):<tr><td colSpan={3}>No pipeline data.</td></tr>}</tbody></table></div></div>
   <div className="crm-card"><div className="crm-card-header"><h2>Programme Performance</h2><span>Admissions</span></div><div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Programme</th><th>Students</th><th>Paid</th></tr></thead><tbody>{programRows.length?programRows.map(([name,x])=><tr key={name}><td><strong>{name}</strong></td><td>{x.count}</td><td>{money(x.paid)}</td></tr>):<tr><td colSpan={3}>No admission data.</td></tr>}</tbody></table></div></div>
  </div>
  <div className="crm-card"><div className="crm-card-header"><h2>Lead Status Breakdown</h2><span>{leads.length} total</span></div><div className="crm-card-body" style={{display:"grid",gap:12}}>{Object.entries(leads.reduce<Record<string,number>>((m,l)=>{const k=l.status||"unknown";m[k]=(m[k]||0)+1;return m;},{})).sort((a,b)=>b[1]-a[1]).map(([status,count])=><div key={status} style={{display:"grid",gridTemplateColumns:"180px 1fr 50px",gap:10,alignItems:"center",fontSize:13}}><strong style={{textTransform:"capitalize"}}>{status.replaceAll("_"," ")}</strong><div style={{height:9,borderRadius:99,background:"#e5e7eb",overflow:"hidden"}}><div style={{height:"100%",width:`${leads.length?count/leads.length*100:0}%`,background:"#2563eb"}}/></div><span>{count}</span></div>)}</div></div>
 </>
}