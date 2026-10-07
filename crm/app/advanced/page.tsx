"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Tab = "overview" | "activity" | "performance" | "revenue" | "schools" | "agents" | "campaigns" | "scoring" | "search";

type Profile = { id: string; full_name: string | null; role: string | null; is_active: boolean | null };
type Lead = { id: string; name: string | null; phone: string | null; email: string | null; score: number | null; status: string | null; assigned_to: string | null; next_follow_up_at: string | null; created_at: string | null };
type Activity = { id: string; type: string; subject: string; description: string | null; activity_at: string; created_by: string | null; lead_id: string | null };
type Admission = { id: string; full_names: string; program: string; stage: string | null; application_fee: number | null; application_paid: number | null; acceptance_fee: number | null; acceptance_paid: number | null; tuition_fee: number | null; tuition_paid: number | null; assigned_to: string | null; created_at: string | null };
type Payment = { id: string; admission_id: string; payment_type: string; amount: number | null; payment_date: string | null; reference: string | null };
type Organization = { id: string; name: string; industry: string | null; phone: string | null; email: string | null; city: string | null; country: string | null; assigned_to: string | null };
type Agent = { id: string; name: string; organization_name: string | null; phone: string | null; email: string | null; location: string | null; commission_type: string; commission_value: number; status: string; notes: string | null; assigned_to: string | null };
type Campaign = { id: string; name: string; channel: string | null; start_date: string | null; end_date: string | null; budget: number | null };
type CampaignLead = { campaign_id: string; lead_id: string };

const money = (n: number) => new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(Number(n || 0));
const date = (v: string | null) => v ? new Date(v).toLocaleDateString("en-UG", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const dateTime = (v: string | null) => v ? new Date(v).toLocaleString("en-UG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function Card({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  return <section style={{ background:"#fff", border:"1px solid #dfe9e5", borderRadius:18, padding:20, boxShadow:"0 8px 24px rgba(15,61,52,.05)" }}>
    {title && <div style={{ marginBottom:16 }}><h2 style={{ margin:0, fontSize:18, color:"#123c34" }}>{title}</h2>{subtitle && <p style={{ margin:"5px 0 0", color:"#6b7f78", fontSize:13 }}>{subtitle}</p>}</div>}
    {children}
  </section>;
}
function Stat({ label, value, note }: { label:string; value:string|number; note:string }) {
  return <div style={{ background:"#f7faf9", border:"1px solid #e4eeeb", borderRadius:14, padding:16 }}><div style={{ color:"#6b7f78", fontSize:12 }}>{label}</div><strong style={{ display:"block", fontSize:24, color:"#123c34", marginTop:5 }}>{value}</strong><span style={{ color:"#80918c", fontSize:11 }}>{note}</span></div>;
}
function Button({ children, onClick, type="button", disabled=false }: { children:React.ReactNode; onClick?:()=>void; type?:"button"|"submit"; disabled?:boolean }) {
  return <button type={type} onClick={onClick} disabled={disabled} style={{ border:0, borderRadius:10, padding:"9px 13px", background:"#00695c", color:"#fff", fontWeight:700, cursor:disabled?"not-allowed":"pointer", opacity:disabled?.65:1 }}>{children}</button>;
}
function Input({ value, onChange, placeholder, type="text" }: { value:string; onChange:(v:string)=>void; placeholder?:string; type?:string }) {
  return <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type} style={{ width:"100%", boxSizing:"border-box", border:"1px solid #d7e3df", borderRadius:10, padding:"10px 12px", outline:"none" }} />;
}

export default function AdvancedPage() {
  const [tab,setTab]=useState<Tab>("overview");
  const [role,setRole]=useState("");
  const [userId,setUserId]=useState("");
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [leads,setLeads]=useState<Lead[]>([]);
  const [activities,setActivities]=useState<Activity[]>([]);
  const [admissions,setAdmissions]=useState<Admission[]>([]);
  const [payments,setPayments]=useState<Payment[]>([]);
  const [organizations,setOrganizations]=useState<Organization[]>([]);
  const [agents,setAgents]=useState<Agent[]>([]);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [campaignLeads,setCampaignLeads]=useState<CampaignLead[]>([]);
  const [notifications,setNotifications]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  const [activityForm,setActivityForm]=useState({type:"call",subject:"",description:"",lead_id:""});
  const [schoolForm,setSchoolForm]=useState({name:"",industry:"School",phone:"",email:"",city:"",country:"Uganda"});
  const [agentForm,setAgentForm]=useState({name:"",organization_name:"",phone:"",email:"",location:"",commission_type:"fixed",commission_value:"",status:"active",assigned_to:""});
  const [search,setSearch]=useState("");

  async function load() {
    try {
      setError("");
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(userError) throw userError;
      if(!user) throw new Error("You are not signed in.");
      setUserId(user.id);
      const {data:me,error:meError}=await supabase.from("profiles").select("id,full_name,role,is_active").eq("id",user.id).maybeSingle();
      if(meError) throw meError;
      const currentRole=me?.role||"";
      setRole(currentRole);
      const own=currentRole==="salesperson";
      const profilesQ=supabase.from("profiles").select("id,full_name,role,is_active").eq("is_active",true).order("full_name");
      const leadsQ=supabase.from("leads").select("id,name,phone,email,score,status,assigned_to,next_follow_up_at,created_at").order("score",{ascending:false});
      const activitiesQ=supabase.from("activities").select("id,type,subject,description,activity_at,created_by,lead_id").order("activity_at",{ascending:false}).limit(200);
      const admissionsQ=supabase.from("admissions").select("id,full_names,program,stage,application_fee,application_paid,acceptance_fee,acceptance_paid,tuition_fee,tuition_paid,assigned_to,created_at");
      const paymentsQ=supabase.from("admission_payments").select("id,admission_id,payment_type,amount,payment_date,reference").order("payment_date",{ascending:false});
      const orgQ=supabase.from("organizations").select("id,name,industry,phone,email,city,country,assigned_to").order("name");
      const agentQ=supabase.from("referral_agents").select("id,name,organization_name,phone,email,location,commission_type,commission_value,status,notes,assigned_to").order("name");
      const campaignQ=supabase.from("campaigns").select("id,name,channel,start_date,end_date,budget").order("created_at",{ascending:false});
      const campaignLeadQ=supabase.from("campaign_leads").select("campaign_id,lead_id");
      const noteQ=supabase.from("notifications").select("*").eq("recipient_id",user.id).order("created_at",{ascending:false}).limit(20);
      if(own){ leadsQ.eq("assigned_to",user.id); activitiesQ.eq("created_by",user.id); admissionsQ.eq("assigned_to",user.id); orgQ.eq("assigned_to",user.id); agentQ.eq("assigned_to",user.id); }
      const results=await Promise.all([profilesQ,leadsQ,activitiesQ,admissionsQ,paymentsQ,orgQ,agentQ,campaignQ,campaignLeadQ,noteQ]);
      const failed=results.find((r:any)=>r.error);
      if(failed?.error) throw failed.error;
      setProfiles((results[0].data||[]) as Profile[]);
      setLeads((results[1].data||[]) as Lead[]);
      setActivities((results[2].data||[]) as Activity[]);
      setAdmissions((results[3].data||[]) as Admission[]);
      setPayments((results[4].data||[]) as Payment[]);
      setOrganizations((results[5].data||[]) as Organization[]);
      setAgents((results[6].data||[]) as Agent[]);
      setCampaigns((results[7].data||[]) as Campaign[]);
      setCampaignLeads((results[8].data||[]) as CampaignLead[]);
      setNotifications(results[9].data||[]);
    } catch(e) { setError(e instanceof Error ? e.message : "Unable to load advanced CRM data."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{load();},[]);

  const stats=useMemo(()=>{
    const collected=payments.reduce((s,p)=>s+Number(p.amount||0),0);
    const due=admissions.reduce((s,a)=>s+Math.max(0,Number(a.application_fee||0)-Number(a.application_paid||0))+Math.max(0,Number(a.acceptance_fee||0)-Number(a.acceptance_paid||0))+Math.max(0,Number(a.tuition_fee||0)-Number(a.tuition_paid||0)),0);
    const enrolled=admissions.filter(a=>(a.stage||"").toLowerCase()==="enrolled").length;
    const high=leads.filter(l=>Number(l.score||0)>=70).length;
    const overdue=leads.filter(l=>l.next_follow_up_at && new Date(l.next_follow_up_at)<new Date() && !["converted","lost","unqualified"].includes((l.status||"").toLowerCase())).length;
    return {collected,due,enrolled,high,overdue};
  },[payments,admissions,leads]);

  const scoreBuckets=useMemo(()=>[
    ["Hot (70–100)",leads.filter(l=>Number(l.score||0)>=70)],
    ["Warm (40–69)",leads.filter(l=>Number(l.score||0)>=40&&Number(l.score||0)<70)],
    ["Cold (0–39)",leads.filter(l=>Number(l.score||0)<40)]
  ] as [string,Lead[]][],[leads]);

  const campaignMetrics=useMemo(()=>campaigns.map(c=>({c,count:campaignLeads.filter(x=>x.campaign_id===c.id).length})),[campaigns,campaignLeads]);

  const searchResults=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q) return {leads:[],schools:[],agents:[]};
    return {
      leads:leads.filter(l=>[l.name,l.phone,l.email,l.status].some(v=>(v||"").toLowerCase().includes(q))).slice(0,20),
      schools:organizations.filter(o=>[o.name,o.phone,o.email,o.city,o.industry].some(v=>(v||"").toLowerCase().includes(q))).slice(0,20),
      agents:agents.filter(a=>[a.name,a.organization_name,a.phone,a.email,a.location].some(v=>(v||"").toLowerCase().includes(q))).slice(0,20)
    };
  },[search,leads,organizations,agents]);

  async function saveActivity(e:FormEvent){
    e.preventDefault();
    if(!activityForm.subject.trim()) return setError("Activity subject is required.");
    setSaving(true); setError("");
    try {
      const {data:{user}}=await supabase.auth.getUser();
      const {error}=await supabase.from("activities").insert({type:activityForm.type,subject:activityForm.subject.trim(),description:activityForm.description.trim()||null,lead_id:activityForm.lead_id||null,created_by:user?.id||null});
      if(error) throw error;
      setActivityForm({type:"call",subject:"",description:"",lead_id:""}); await load();
    } catch(e){setError(e instanceof Error?e.message:"Unable to save activity.");} finally{setSaving(false);}
  }

  async function saveSchool(e:FormEvent){
    e.preventDefault(); if(!schoolForm.name.trim()) return setError("School name is required.");
    setSaving(true); setError("");
    try {
      const {error}=await supabase.from("organizations").insert({...schoolForm,assigned_to:userId});
      if(error) throw error;
      setSchoolForm({name:"",industry:"School",phone:"",email:"",city:"",country:"Uganda"}); await load();
    } catch(e){setError(e instanceof Error?e.message:"Unable to save institution.");} finally{setSaving(false);}
  }

  async function saveAgent(e:FormEvent){
    e.preventDefault(); if(!agentForm.name.trim()) return setError("Agent name is required.");
    setSaving(true); setError("");
    try {
      const {error}=await supabase.from("referral_agents").insert({...agentForm,commission_value:Number(agentForm.commission_value||0),assigned_to:agentForm.assigned_to||userId});
      if(error) throw error;
      setAgentForm({name:"",organization_name:"",phone:"",email:"",location:"",commission_type:"fixed",commission_value:"",status:"active",assigned_to:""}); await load();
    } catch(e){setError(e instanceof Error?e.message:"Unable to save referral agent.");} finally{setSaving(false);}
  }

  async function markRead(id:string){
    await supabase.from("notifications").update({is_read:true}).eq("id",id);
    setNotifications(n=>n.map(x=>x.id===id?{...x,is_read:true}:x));
  }

  async function createAlert(title:string,message:string,link:string){
    const {error}=await supabase.from("notifications").insert({recipient_id:userId,type:"alert",title,message,link});
    if(!error) await load();
  }

  const generateAlerts=async()=>{
    const alerts:Promise<void>[]=[];
    if(stats.overdue) alerts.push(createAlert("Follow-ups overdue",`${stats.overdue} lead(s) have follow-ups requiring attention.`,"/tasks"));
    if(stats.high) alerts.push(createAlert("Hot leads",`${stats.high} lead(s) have a score of 70 or higher.`,"/leads"));
    await Promise.all(alerts); alert("Alerts generated for your dashboard."); await load();
  };

  const tabs:[Tab,string][]=[["overview","Overview"],["activity","Communication"],["performance","Staff Performance"],["revenue","Revenue & Fees"],["schools","Schools"],["agents","Agents"],["campaigns","Campaigns"],["scoring","Lead Scoring"],["search","Global Search"]];

  if(loading) return <main className="ciu-page"><div className="ciu-page-inner"><Card><strong>Loading Phase 2 CRM...</strong><p style={{color:"#6b7f78"}}>Preparing communications, alerts, performance, revenue, institutions, agents, campaigns, scoring and search.</p></Card></div></main>;

  return <main className="ciu-page"><div className="ciu-page-inner">
    <section style={{background:"linear-gradient(135deg,#003f36,#00695c)",color:"#fff",borderRadius:20,padding:24,marginBottom:18}}>
      <div style={{fontSize:11,letterSpacing:1.5,opacity:.7,fontWeight:800}}>CIU CRM · PHASE 2</div>
      <h1 style={{margin:"7px 0 5px",fontSize:30}}>Advanced CRM Command Centre</h1>
      <p style={{margin:0,opacity:.82,maxWidth:850}}>Communication history, alerts, staff performance, fee intelligence, school partnerships, referral agents, campaign analytics, lead scoring and global search — connected to the existing admissions workflow.</p>
    </section>

    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>{tabs.map(([id,label])=><button key={id} onClick={()=>setTab(id)} style={{border:"1px solid #d8e4e0",background:tab===id?"#00695c":"#fff",color:tab===id?"#fff":"#31534b",padding:"9px 12px",borderRadius:10,fontWeight:700}}>{label}</button>)}</div>

    {error&&<div style={{background:"#fff1f2",border:"1px solid #fecdd3",color:"#9f1239",padding:13,borderRadius:12,marginBottom:16}}>{error}</div>}

    {tab==="overview"&&<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>
      <Stat label="Collected Fees" value={money(stats.collected)} note="Recorded admission payments"/>
      <Stat label="Outstanding Fees" value={money(stats.due)} note="Application + acceptance + tuition"/>
      <Stat label="Enrolled" value={stats.enrolled} note="Current admission records"/>
      <Stat label="Hot Leads" value={stats.high} note="Score 70–100"/>
      <Stat label="Overdue Follow-ups" value={stats.overdue} note="Needs attention"/>
      <Stat label="Unread Alerts" value={notifications.filter(n=>!n.is_read).length} note="Your notification centre"/>
    </div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16,marginTop:16}}>
      <Card title="Notifications & Alerts" subtitle="Persistent alerts for your signed-in CRM account."><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><Button onClick={generateAlerts}>Generate Current Alerts</Button></div>{notifications.length===0?<p style={{color:"#71827d"}}>No alerts yet. Generate current alerts to populate this centre.</p>:notifications.map(n=><div key={n.id} style={{padding:"11px 0",borderTop:"1px solid #edf2f0",opacity:n.is_read ? 0.65 : 1}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{n.title}</strong>{!n.is_read&&<button onClick={()=>markRead(n.id)} style={{border:0,background:"transparent",color:"#00695c",fontWeight:700}}>Mark read</button>}</div><div style={{fontSize:13,color:"#667872",marginTop:3}}>{n.message}</div><small style={{color:"#9aa9a4"}}>{dateTime(n.created_at)}</small></div>)}</Card>
      <Card title="Phase 2 Coverage" subtitle="The advanced layer is connected to existing CRM tables."><div style={{display:"grid",gap:10}}>{["Activities → calls, WhatsApp, email, meetings and notes","Notifications → personal alerts and follow-up warnings","Performance → staff leads, tasks, activities and enrolments","Revenue → payments, fee balances and admission value","Schools → organizations used as institutional partners","Agents → referral partner register and commissions","Campaigns → existing campaign and lead-import data","Lead Scoring → existing 0–100 lead score","Global Search → leads, schools and agents"].map(x=><div key={x} style={{padding:11,background:"#f7faf9",borderRadius:10,fontSize:13}}>✓ {x}</div>)}</div></Card>
    </div></>}

    {tab==="activity"&&<div style={{display:"grid",gridTemplateColumns:"minmax(280px,380px) 1fr",gap:16}}>
      <Card title="Log Communication" subtitle="Record calls, WhatsApp, email, meetings and notes against a lead."><form onSubmit={saveActivity} style={{display:"grid",gap:10}}><select value={activityForm.type} onChange={e=>setActivityForm({...activityForm,type:e.target.value})} style={{padding:10,border:"1px solid #d7e3df",borderRadius:10}}>{["call","whatsapp","email","meeting","note","proposal","other"].map(x=><option key={x}>{x}</option>)}</select><Input value={activityForm.subject} onChange={v=>setActivityForm({...activityForm,subject:v})} placeholder="Subject / outcome"/><textarea value={activityForm.description} onChange={e=>setActivityForm({...activityForm,description:e.target.value})} placeholder="Notes or conversation details" rows={5} style={{border:"1px solid #d7e3df",borderRadius:10,padding:10}}/><select value={activityForm.lead_id} onChange={e=>setActivityForm({...activityForm,lead_id:e.target.value})} style={{padding:10,border:"1px solid #d7e3df",borderRadius:10}}><option value="">No linked lead</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name||"Unnamed"}{l.phone?" · "+l.phone:""}</option>)}</select><Button type="submit" disabled={saving}>{saving?"Saving...":"Save Activity"}</Button></form></Card>
      <Card title="Communication History" subtitle={`${activities.length} recent activities`}><div style={{display:"grid",gap:8}}>{activities.map(a=><div key={a.id} style={{padding:12,border:"1px solid #e7efec",borderRadius:11}}><div style={{display:"flex",justifyContent:"space-between",gap:10}}><strong>{a.subject}</strong><span style={{fontSize:11,color:"#71827d"}}>{dateTime(a.activity_at)}</span></div><div style={{fontSize:12,color:"#00695c",fontWeight:700,marginTop:3}}>{a.type.toUpperCase()}</div>{a.description&&<div style={{fontSize:13,color:"#667872",marginTop:5}}>{a.description}</div>}</div>)}</div></Card>
    </div>}

    {tab==="performance"&&<Card title="Staff Performance" subtitle="Operational performance from leads, admissions and activities."><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Staff","Leads","Activities","Admissions","Enrolled"].map(h=><th key={h} style={{textAlign:"left",padding:10,borderBottom:"2px solid #e6efec",fontSize:12,color:"#61756e"}}>{h}</th>)}</tr></thead><tbody>{profiles.map(p=>{const ls=leads.filter(x=>x.assigned_to===p.id).length;const ac=activities.filter(x=>x.created_by===p.id).length;const ad=admissions.filter(x=>x.assigned_to===p.id).length;const en=admissions.filter(x=>x.assigned_to===p.id&&(x.stage||"").toLowerCase()==="enrolled").length;return <tr key={p.id}><td style={{padding:10}}><strong>{p.full_name||"Unnamed"}</strong><div style={{fontSize:11,color:"#82918c"}}>{p.role}</div></td><td>{ls}</td><td>{ac}</td><td>{ad}</td><td><strong style={{color:"#00695c"}}>{en}</strong></td></tr>})}</tbody></table></div></Card>}

    {tab==="revenue"&&<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,marginBottom:16}}><Stat label="Payments Recorded" value={money(stats.collected)} note={`${payments.length} payment records`}/><Stat label="Outstanding" value={money(stats.due)} note="Calculated fee balance"/><Stat label="Admissions" value={admissions.length} note="Records in admissions"/><Stat label="Average Payment" value={money(payments.length?stats.collected/payments.length:0)} note="Per payment record"/></div><Card title="Recent Fee Payments"><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Date","Student","Type","Amount","Reference"].map(h=><th key={h} style={{textAlign:"left",padding:10,borderBottom:"2px solid #e6efec",fontSize:12}}>{h}</th>)}</tr></thead><tbody>{payments.slice(0,50).map(p=>{const a=admissions.find(x=>x.id===p.admission_id);return <tr key={p.id}><td style={{padding:10}}>{date(p.payment_date)}</td><td>{a?.full_names||"—"}</td><td>{p.payment_type}</td><td><strong>{money(Number(p.amount||0))}</strong></td><td>{p.reference||"—"}</td></tr>})}</tbody></table></div></Card></>}

    {tab==="schools"&&<div style={{display:"grid",gridTemplateColumns:"minmax(280px,380px) 1fr",gap:16}}><Card title="Add School / Institution"><form onSubmit={saveSchool} style={{display:"grid",gap:10}}>{Object.entries(schoolForm).map(([k,v])=><Input key={k} value={v} onChange={x=>setSchoolForm({...schoolForm,[k]:x})} placeholder={k.replace("_"," ")}/>) }<Button type="submit" disabled={saving}>{saving?"Saving...":"Add Institution"}</Button></form></Card><Card title="School & Institution Register" subtitle="Powered by the existing organizations table."><div style={{display:"grid",gap:8}}>{organizations.map(o=><div key={o.id} style={{display:"flex",justifyContent:"space-between",gap:12,padding:12,border:"1px solid #e7efec",borderRadius:11}}><div><strong>{o.name}</strong><div style={{fontSize:12,color:"#71827d"}}>{o.industry||"Institution"} · {o.city||"—"} · {o.country||"Uganda"}</div></div><div style={{textAlign:"right",fontSize:12,color:"#61756e"}}>{o.phone||o.email||"No contact"}</div></div>)}</div></Card></div>}

    {tab==="agents"&&<div style={{display:"grid",gridTemplateColumns:"minmax(280px,400px) 1fr",gap:16}}><Card title="Add Referral Agent" subtitle="Track partners and commission arrangements."><form onSubmit={saveAgent} style={{display:"grid",gap:10}}>{[["name","Agent name"],["organization_name","Organization"],["phone","Phone"],["email","Email"],["location","Location"],["commission_value","Commission value"]].map(([k,p])=><Input key={k} value={(agentForm as any)[k]} onChange={x=>setAgentForm({...agentForm,[k]:x})} placeholder={p} type={k==="commission_value"?"number":"text"}/>)}<select value={agentForm.commission_type} onChange={e=>setAgentForm({...agentForm,commission_type:e.target.value})} style={{padding:10,border:"1px solid #d7e3df",borderRadius:10}}><option value="fixed">Fixed UGX</option><option value="percentage">Percentage</option></select><select value={agentForm.assigned_to} onChange={e=>setAgentForm({...agentForm,assigned_to:e.target.value})} style={{padding:10,border:"1px solid #d7e3df",borderRadius:10}}><option value="">Assign to me</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.full_name||p.id}</option>)}</select><Button type="submit" disabled={saving}>{saving?"Saving...":"Add Agent"}</Button></form></Card><Card title="Referral Partners"><div style={{display:"grid",gap:8}}>{agents.map(a=><div key={a.id} style={{padding:13,border:"1px solid #e7efec",borderRadius:11}}><div style={{display:"flex",justifyContent:"space-between"}}><strong>{a.name}</strong><span style={{fontSize:11,padding:"3px 7px",borderRadius:20,background:a.status==="active"?"#dcfce7":"#e5e7eb",color:"#166534"}}>{a.status}</span></div><div style={{fontSize:12,color:"#71827d",marginTop:4}}>{a.organization_name||"Independent"} · {a.location||"—"} · {a.phone||"No phone"}</div><div style={{fontSize:12,color:"#31534b",marginTop:6}}>Commission: {a.commission_type==="percentage"?a.commission_value+"%":money(a.commission_value)}</div></div>)}</div></Card></div>}

    {tab==="campaigns"&&<Card title="Campaign Performance" subtitle="Existing campaign records linked to imported leads."><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>{campaignMetrics.map(({c,count})=><div key={c.id} style={{padding:15,border:"1px solid #e5eeeb",borderRadius:13}}><strong>{c.name}</strong><div style={{color:"#71827d",fontSize:12,marginTop:5}}>{c.channel||"Unspecified"} · {date(c.start_date)} — {date(c.end_date)}</div><div style={{fontSize:24,fontWeight:800,color:"#00695c",marginTop:10}}>{count}</div><div style={{fontSize:11,color:"#82918c"}}>Linked leads · Budget {money(Number(c.budget||0))}</div></div>)}</div>{campaigns.length===0&&<p style={{color:"#71827d"}}>No campaigns found. Create campaigns from Marketing.</p>}</Card>}

    {tab==="scoring"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:16}}>{scoreBuckets.map(([label,items])=><Card key={label} title={label} subtitle={`${items.length} leads`}><div style={{display:"grid",gap:8}}>{items.slice(0,15).map(l=><div key={l.id} style={{display:"flex",justifyContent:"space-between",padding:10,background:"#f7faf9",borderRadius:10}}><div><strong>{l.name||"Unnamed"}</strong><div style={{fontSize:11,color:"#71827d"}}>{l.phone||l.email||"No contact"}</div></div><strong style={{color:"#00695c"}}>{l.score||0}</strong></div>)}</div></Card>)}</div>}

    {tab==="search"&&<Card title="Global Search" subtitle="Search the most important Phase 2 entities from one place."><div style={{maxWidth:650,marginBottom:18}}><Input value={search} onChange={setSearch} placeholder="Search student, phone, email, school, institution or referral agent..."/></div>{search&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}><Card title={`Leads (${searchResults.leads.length})`}><div style={{display:"grid",gap:7}}>{searchResults.leads.map(l=><div key={l.id} style={{padding:9,border:"1px solid #e7efec",borderRadius:9}}><strong>{l.name||"Unnamed"}</strong><div style={{fontSize:11,color:"#71827d"}}>{l.phone||l.email||"—"} · Score {l.score||0}</div></div>)}</div></Card><Card title={`Schools (${searchResults.schools.length})`}><div style={{display:"grid",gap:7}}>{searchResults.schools.map(o=><div key={o.id} style={{padding:9,border:"1px solid #e7efec",borderRadius:9}}><strong>{o.name}</strong><div style={{fontSize:11,color:"#71827d"}}>{o.city||"—"} · {o.phone||o.email||"—"}</div></div>)}</div></Card><Card title={`Agents (${searchResults.agents.length})`}><div style={{display:"grid",gap:7}}>{searchResults.agents.map(a=><div key={a.id} style={{padding:9,border:"1px solid #e7efec",borderRadius:9}}><strong>{a.name}</strong><div style={{fontSize:11,color:"#71827d"}}>{a.organization_name||"Independent"} · {a.phone||a.email||"—"}</div></div>)}</div></Card></div>}</Card>}
  </div></main>;
}
