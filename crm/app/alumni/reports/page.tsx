"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Metric = { label: string; value: number; note: string };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e4ebe6", borderRadius: 14, padding: 18, boxShadow: "0 4px 16px rgba(20,54,39,.035)" };
const primary: React.CSSProperties = { border: 0, borderRadius: 8, padding: "10px 14px", background: "#106053", color: "#fff", fontWeight: 750, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #d9e4dd", borderRadius: 8, padding: "9px 12px", background: "#fff", color: "#106053", fontWeight: 750, cursor: "pointer" };
const field: React.CSSProperties = { border: "1px solid #dce5df", borderRadius: 8, padding: "9px 10px", background: "#fff", color: "#173d34" };
const dateOnly = (date: Date) => { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };
function rangeFor(preset: string) {
  const end = new Date(); const start = new Date(end);
  if (preset === "week") { const day = (start.getDay() + 6) % 7; start.setDate(start.getDate() - day); }
  else if (preset === "month") start.setDate(1);
  else if (preset === "year") { start.setMonth(0, 1); }
  return { start: dateOnly(start), end: dateOnly(end) };
}
function csvCell(value: unknown) { const text = String(value ?? ""); return '"' + text.replace(/"/g, '""') + '"'; }

export default function AlumniReportsPage() {
  const supabase = createClient();
  const initial = rangeFor("today");
  const [preset, setPreset] = useState("today");
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [breakdown, setBreakdown] = useState<{label:string;value:number}[]>([]);
  const [totalAlumni, setTotalAlumni] = useState(0);
  const [pendingAll, setPendingAll] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState("");

  const load = useCallback(async () => {
    if (!startDate || !endDate || startDate > endDate) { setError("Choose a valid date range."); return; }
    setLoading(true); setError("");
    const from = new Date(startDate + "T00:00:00").toISOString();
    const to = new Date(new Date(endDate + "T00:00:00").getTime() + 86400000).toISOString();
    const inRange = (query: any, column: string) => query.gte(column, from).lt(column, to);
    try {
      const requests = await Promise.all([
        supabase.from("alumni").select("id", {count:"exact",head:true}).neq("duplicate_review_status","confirmed_duplicate"),
        supabase.from("alumni_profile_updates").select("id",{count:"exact",head:true}).gte("created_at",from).lt("created_at",to),
        supabase.from("alumni_profile_updates").select("id",{count:"exact",head:true}).eq("review_status","pending"),
        supabase.from("alumni_profile_updates").select("id",{count:"exact",head:true}).eq("review_status","approved").gte("reviewed_at",from).lt("reviewed_at",to),
        supabase.from("alumni_profile_updates").select("id",{count:"exact",head:true}).eq("review_status","rejected").gte("reviewed_at",from).lt("reviewed_at",to),
        supabase.from("alumni").select("id",{count:"exact",head:true}).eq("verification_status","verified").gte("last_verified_at",from).lt("last_verified_at",to).neq("duplicate_review_status","confirmed_duplicate"),
        supabase.from("alumni_event_registrations").select("id",{count:"exact",head:true}).gte("registered_at",from).lt("registered_at",to),
        supabase.from("alumni_event_registrations").select("id",{count:"exact",head:true}).gte("checked_in_at",from).lt("checked_in_at",to),
        supabase.from("alumni_communications").select("id,channel,delivery_status",{count:"exact"}).gte("sent_at",from).lt("sent_at",to).limit(1000),
      ]);
      const failed = requests.find((r:any) => r.error);
      if (failed?.error) throw new Error(failed.error.message);
      const count = (i:number) => requests[i].count || 0;
      setTotalAlumni(count(0)); setPendingAll(count(2));
      const commRows = (requests[8].data || []) as {channel:string;delivery_status:string|null}[];
      const channels = new Map<string,number>();
      commRows.forEach(row => channels.set(row.channel || "Other",(channels.get(row.channel || "Other") || 0) + 1));
      setMetrics([
        {label:"Profile updates submitted",value:count(1),note:"Submissions created during this period"},
        {label:"Changes approved",value:count(3),note:"Reviewed and approved during this period"},
        {label:"Changes rejected",value:count(4),note:"Reviewed and rejected during this period"},
        {label:"Newly verified alumni",value:count(5),note:"Verification date falls in this period"},
        {label:"Event registrations",value:count(6),note:"Registrations created during this period"},
        {label:"Event attendance",value:count(7),note:"Recorded check-ins during this period"},
        {label:"Communications logged",value:count(8),note:"Outreach log entries, not necessarily messages sent by the CRM"},
        {label:"Pending change requests",value:count(2),note:"All-time requests awaiting review"},
      ]);
      setBreakdown([...channels.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value));
      setRefreshedAt(new Date().toLocaleString());
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load alumni reports. Check the database permissions and reporting fields."); }
    finally { setLoading(false); }
  }, [startDate,endDate,supabase]);

  useEffect(() => { void load(); }, [load]);

  function choosePreset(value:string) {
    setPreset(value);
    if (value !== "custom") { const range = rangeFor(value); setStartDate(range.start); setEndDate(range.end); }
  }
  function exportCsv() {
    const rows = [["CIU Alumni Report", "Value", "Notes"],["Report period", startDate + " to " + endDate, ""],["Total alumni records",totalAlumni,"Excludes confirmed duplicate records"],...metrics.map(m=>[m.label,m.value,m.note]),["Communication channel breakdown","",""],...breakdown.map(x=>[x.label,x.value,"Logged communication entries"])];
    const csv = rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
    const a = document.createElement("a"); a.href=url; a.download="ciu-alumni-report-"+startDate+"-to-"+endDate+".csv"; a.click(); URL.revokeObjectURL(url);
  }

  return <main className="ciu-alumni-reports" style={{padding:"28px clamp(16px,3vw,34px) 48px",color:"#173d34"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,flexWrap:"wrap",marginBottom:20}}>
      <div><Link href="/alumni" style={{color:"#106053",fontSize:12,fontWeight:750,textDecoration:"none"}}>← Alumni directory</Link><div style={{color:"#106053",fontSize:11,fontWeight:800,letterSpacing:1.4,marginTop:12}}>PERFORMANCE & ENGAGEMENT</div><h1 style={{margin:"6px 0",fontSize:28,fontWeight:850}}>Alumni Reports</h1><p style={{margin:0,color:"#718078",fontSize:13}}>Daily, weekly, monthly and custom-period reporting from recorded CRM activity.</p></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" style={secondary} onClick={()=>void load()}>Refresh report</button><button type="button" style={secondary} onClick={()=>window.print()}>Print / Save PDF</button><button type="button" style={primary} onClick={exportCsv} disabled={loading}>Export CSV</button></div>
    </div>
    <section style={{...card,marginBottom:16,background:"#f7faf8"}}>
      <div style={{fontSize:13,fontWeight:800,marginBottom:12}}>Reporting period</div>
      <div style={{display:"flex",gap:10,alignItems:"end",flexWrap:"wrap"}}>
        <label style={{display:"grid",gap:5,fontSize:11,fontWeight:750}}>Quick period<select value={preset} onChange={e=>choosePreset(e.target.value)} style={field}><option value="today">Today</option><option value="week">This week (Mon–today)</option><option value="month">This month</option><option value="year">This year</option><option value="custom">Custom range</option></select></label>
        <label style={{display:"grid",gap:5,fontSize:11,fontWeight:750}}>From<input type="date" value={startDate} onChange={e=>{setPreset("custom");setStartDate(e.target.value)}} style={field}/></label>
        <label style={{display:"grid",gap:5,fontSize:11,fontWeight:750}}>To<input type="date" value={endDate} onChange={e=>{setPreset("custom");setEndDate(e.target.value)}} style={field}/></label>
        <span style={{fontSize:12,color:"#718078",paddingBottom:9}}>Alumni records: <strong>{totalAlumni.toLocaleString()}</strong></span>
      </div>
    </section>
    {error && <div role="alert" style={{...card,marginBottom:14,borderColor:"#f2cccc",color:"#a32828"}}>{error}<div style={{fontSize:12,marginTop:5}}>No missing metric is silently treated as zero. Check that the report tables and permissions are available.</div></div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(205px,1fr))",gap:12,marginBottom:16}}>
      {metrics.map(m=><div key={m.label} style={card}><div style={{fontSize:12,fontWeight:750,color:"#66766e"}}>{m.label}</div><div style={{fontSize:30,fontWeight:850,marginTop:8,color:"#173d34"}}>{loading?"—":m.value.toLocaleString()}</div><div style={{fontSize:11,color:"#84928b",marginTop:5,lineHeight:1.5}}>{m.note}</div></div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
      <section style={card}><h2 style={{margin:"0 0 5px",fontSize:17,fontWeight:850}}>Communication channels</h2><p style={{margin:"0 0 14px",fontSize:12,color:"#718078"}}>Breakdown of communication records logged in the selected period.</p>{loading?<p>Loading…</p>:breakdown.length===0?<p style={{fontSize:12,color:"#819087"}}>No communication entries were logged in this period.</p>:breakdown.map(item=><div key={item.label} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"10px 0",borderBottom:"1px solid #edf1ee",fontSize:13}}><span>{item.label}</span><strong>{item.value.toLocaleString()}</strong></div>)}</section>
      <section style={card}><h2 style={{margin:"0 0 8px",fontSize:17,fontWeight:850}}>Reporting notes</h2><ul style={{paddingLeft:18,margin:0,color:"#66766e",fontSize:12,lineHeight:1.9}}><li>Total alumni excludes records marked as confirmed duplicates.</li><li>Submissions count update requests, not unique alumni; one alumnus may submit more than once.</li><li>Approval and rejection counts use the review timestamp.</li><li>Event attendance is based on recorded check-ins.</li><li>Communication counts represent log entries. Delivery and response rates require verified provider delivery and response data.</li></ul></section>
    </div>
    <p style={{fontSize:11,color:"#84928b",marginTop:14}}>{refreshedAt ? "Last refreshed: "+refreshedAt : "Report has not refreshed yet."} {pendingAll>0&&!loading ? pendingAll.toLocaleString()+" change requests are currently pending across all dates." : ""}</p>
    <style jsx global>{`@media print { nav, aside, button, a { display:none !important; } main.ciu-alumni-reports { padding:0 !important; } body { background:#fff !important; } }`}</style>
  </main>;
}
