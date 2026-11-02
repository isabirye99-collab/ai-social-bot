"use client";

import { FormEvent,useCallback,useEffect,useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Partner={id:string;name:string;category:string|null;status:string;primary_contact_name:string|null;primary_contact_email:string|null;primary_contact_phone:string|null;strategic_objective:string|null;estimated_value:number|null;currency:string;start_date:string|null;end_date:string|null;next_action:string|null;next_action_date:string|null;notes:string|null};
type Contact={id:string;full_name:string;job_title:string|null;email:string|null;phone:string|null;is_primary:boolean;notes:string|null};
type Agreement={id:string;agreement_title:string;agreement_type:string;reference_number:string|null;expiry_date:string|null;status:string;document_url:string|null};
type Activity={id:string;activity_title:string;activity_type:string;planned_date:string|null;completed_date:string|null;status:string;outcome:string|null;target_beneficiaries:number|null;actual_beneficiaries:number|null};
const brand="#106053",card:React.CSSProperties={background:"#fff",border:"1px solid #e4ebe6",borderRadius:13,padding:18};
const field:React.CSSProperties={display:"block",width:"100%",boxSizing:"border-box",marginTop:6,minHeight:40,padding:"8px 10px",border:"1px solid #dce5df",borderRadius:8,background:"#fff",color:"#173d34"};
const primary:React.CSSProperties={border:0,borderRadius:8,padding:"9px 13px",background:brand,color:"#fff",fontWeight:800,cursor:"pointer"};
const secondary:React.CSSProperties={border:"1px solid #d9e4dd",borderRadius:8,padding:"8px 12px",background:"#fff",color:brand,fontWeight:750,cursor:"pointer"};
export default function PartnershipDetailPage(){
 const {id}=useParams<{id:string}>();const supabase=createClient();
 const [partner,setPartner]=useState<Partner|null>(null);const [contacts,setContacts]=useState<Contact[]>([]);const [agreements,setAgreements]=useState<Agreement[]>([]);const [activities,setActivities]=useState<Activity[]>([]);
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [showContact,setShowContact]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [contact,setContact]=useState({full_name:"",job_title:"",email:"",phone:"",notes:"",is_primary:false});
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  const [p,c,a,x]=await Promise.all([
   supabase.from("partnerships").select("*").eq("id",id).single(),
   supabase.from("partnership_contacts").select("id,full_name,job_title,email,phone,is_primary,notes").eq("partnership_id",id).order("is_primary",{ascending:false}).order("full_name"),
   supabase.from("partnership_agreements").select("id,agreement_title,agreement_type,reference_number,expiry_date,status,document_url").eq("partnership_id",id).order("expiry_date"),
   supabase.from("partnership_activities").select("id,activity_title,activity_type,planned_date,completed_date,status,outcome,target_beneficiaries,actual_beneficiaries").eq("partnership_id",id).order("planned_date",{ascending:false})
  ]);
  const failure=p.error||c.error||a.error||x.error;
  if(failure)setError(failure.message);else{setPartner(p.data as Partner);setContacts((c.data||[]) as Contact[]);setAgreements((a.data||[]) as Agreement[]);setActivities((x.data||[]) as Activity[]);}
  setLoading(false);
 },[id,supabase]);
 useEffect(()=>{void load();},[load]);
 async function savePartner(e:FormEvent){e.preventDefault();if(!partner)return;setSaving(true);setError("");setNotice("");
  const patch={name:partner.name.trim(),category:partner.category,status:partner.status,primary_contact_name:partner.primary_contact_name,primary_contact_email:partner.primary_contact_email,primary_contact_phone:partner.primary_contact_phone,strategic_objective:partner.strategic_objective,estimated_value:partner.estimated_value,currency:partner.currency,start_date:partner.start_date,end_date:partner.end_date,next_action:partner.next_action,next_action_date:partner.next_action_date,notes:partner.notes,updated_at:new Date().toISOString()};
  const {error:e1}=await supabase.from("partnerships").update(patch).eq("id",id);
  if(e1)setError(e1.message);else{setNotice("Partnership details saved.");await load();}setSaving(false);
 }
 async function addContact(e:FormEvent){e.preventDefault();setSaving(true);setError("");setNotice("");
  const {data:{user}}=await supabase.auth.getUser();
  if(contact.is_primary){const {error:clearError}=await supabase.from("partnership_contacts").update({is_primary:false,updated_at:new Date().toISOString()}).eq("partnership_id",id);if(clearError){setError(clearError.message);setSaving(false);return;}}
  const {error:insertError}=await supabase.from("partnership_contacts").insert({partnership_id:id,full_name:contact.full_name.trim(),job_title:contact.job_title||null,email:contact.email||null,phone:contact.phone||null,notes:contact.notes||null,is_primary:contact.is_primary,created_by:user?.id||null});
  if(insertError)setError(insertError.message);else{setNotice("Partner contact added.");setContact({full_name:"",job_title:"",email:"",phone:"",notes:"",is_primary:false});setShowContact(false);await load();}setSaving(false);
 }
 async function makePrimary(person:Contact){setSaving(true);setError("");const {error:e1}=await supabase.from("partnership_contacts").update({is_primary:false,updated_at:new Date().toISOString()}).eq("partnership_id",id);if(!e1){const {error:e2}=await supabase.from("partnership_contacts").update({is_primary:true,updated_at:new Date().toISOString()}).eq("id",person.id);if(e2)setError(e2.message);else{setNotice(person.full_name+" is now the primary contact.");await load();}}else setError(e1.message);setSaving(false);}
 async function openDocument(path:string){const {data,error:e1}=await supabase.storage.from("partnership-documents").createSignedUrl(path,60);if(e1)setError(e1.message);else if(data?.signedUrl)window.open(data.signedUrl,"_blank","noopener,noreferrer");}
 if(loading)return <main style={{padding:28,color:"#173d34"}}>Loading partnership record…</main>;
 if(!partner)return <main style={{padding:28,color:"#173d34"}}><Link href="/partnerships" style={{color:brand}}>← Partnerships</Link><div role="alert" style={{...card,marginTop:14,color:"#a32828"}}>{error||"Partnership record not found."}</div></main>;
 const set = <K extends keyof Partner,>(key:K,value:Partner[K])=>setPartner(current=>current?{...current,[key]:value}:current);
 const textField=(label:string,key:keyof Partner,type="text")=><label style={{fontSize:12,fontWeight:750,color:"#52665b"}}>{label}<input type={type} value={String(partner[key]??"")} onChange={e=>set(key,(type==="number"?(e.target.value===""?null:Number(e.target.value)):e.target.value||null) as Partner[typeof key])} style={field}/></label>;
 return <main style={{padding:"28px clamp(16px,3vw,34px) 48px",color:"#173d34",maxWidth:1450,margin:"0 auto"}}>
  <Link href="/partnerships" style={{color:brand,fontSize:12,fontWeight:750,textDecoration:"none"}}>← Partnerships register</Link>
  <header style={{display:"flex",justifyContent:"space-between",gap:14,flexWrap:"wrap",margin:"14px 0 18px"}}><div><div style={{fontSize:11,color:brand,fontWeight:850,letterSpacing:1.3}}>PARTNER PROFILE</div><h1 style={{fontSize:28,fontWeight:850,margin:"6px 0"}}>{partner.name}</h1><div style={{fontSize:12,color:"#718078"}}>{partner.category||"Uncategorised"} · {partner.status.replaceAll("_"," ")}</div></div><Link href="/partnerships/agreements" style={{...secondary,textDecoration:"none",alignSelf:"center"}}>Agreements & Activities</Link></header>
  {notice&&<div style={{...card,background:"#eff9f1",color:"#17643f",marginBottom:12}}>{notice}</div>}{error&&<div role="alert" style={{...card,borderColor:"#f2cccc",color:"#a32828",marginBottom:12}}>{error}</div>}
  <form onSubmit={savePartner} style={{...card,marginBottom:14}}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:14}}><h2 style={{fontSize:17,fontWeight:850,margin:0}}>Organisation details</h2><button disabled={saving} style={primary}>{saving?"Saving…":"Save changes"}</button></div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}>
    {textField("Organisation name","name")}
    <label style={{fontSize:12,fontWeight:750,color:"#52665b"}}>Category<select value={partner.category||"Other"} onChange={e=>set("category",e.target.value)} style={field}>{["Academic","Government","Healthcare","Corporate","NGO / Development","International","Professional Association","Media","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label style={{fontSize:12,fontWeight:750,color:"#52665b"}}>Status<select value={partner.status} onChange={e=>set("status",e.target.value)} style={field}>{["prospect","engaging","negotiation","active","on_hold","expired","closed"].map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></label>
    {textField("Primary contact name","primary_contact_name")}{textField("Primary contact email","primary_contact_email","email")}{textField("Primary contact phone","primary_contact_phone","tel")}
    {textField("Start date","start_date","date")}{textField("End / renewal date","end_date","date")}{textField("Estimated value","estimated_value","number")}{textField("Currency","currency")}
    {textField("Next action","next_action")}{textField("Next action date","next_action_date","date")}
    <label style={{gridColumn:"1/-1",fontSize:12,fontWeight:750,color:"#52665b"}}>Strategic objective<textarea rows={2} value={partner.strategic_objective||""} onChange={e=>set("strategic_objective",e.target.value||null)} style={{...field,minHeight:75}}/></label>
    <label style={{gridColumn:"1/-1",fontSize:12,fontWeight:750,color:"#52665b"}}>Internal notes<textarea rows={3} value={partner.notes||""} onChange={e=>set("notes",e.target.value||null)} style={{...field,minHeight:90}}/></label>
   </div>
  </form>
  <section style={{...card,marginBottom:14}}>
   <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:12}}><div><h2 style={{fontSize:17,fontWeight:850,margin:0}}>Partner contacts</h2><p style={{fontSize:11,color:"#819087",margin:"4px 0 0"}}>Maintain several contacts and identify the main relationship contact.</p></div><button onClick={()=>setShowContact(v=>!v)} style={primary}>+ Add contact</button></div>
   {showContact&&<form onSubmit={addContact} style={{background:"#f7faf8",borderRadius:10,padding:14,marginBottom:12}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
    <label style={{fontSize:12,fontWeight:700}}>Full name *<input required value={contact.full_name} onChange={e=>setContact({...contact,full_name:e.target.value})} style={field}/></label>
    <label style={{fontSize:12,fontWeight:700}}>Job title<input value={contact.job_title} onChange={e=>setContact({...contact,job_title:e.target.value})} style={field}/></label>
    <label style={{fontSize:12,fontWeight:700}}>Email<input type="email" value={contact.email} onChange={e=>setContact({...contact,email:e.target.value})} style={field}/></label>
    <label style={{fontSize:12,fontWeight:700}}>Phone<input value={contact.phone} onChange={e=>setContact({...contact,phone:e.target.value})} style={field}/></label>
    <label style={{gridColumn:"1/-1",fontSize:12,fontWeight:700}}>Notes<input value={contact.notes} onChange={e=>setContact({...contact,notes:e.target.value})} style={field}/></label>
   </div><label style={{display:"flex",gap:8,alignItems:"center",fontSize:12,marginTop:12}}><input type="checkbox" checked={contact.is_primary} onChange={e=>setContact({...contact,is_primary:e.target.checked})}/> Set as primary contact</label><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:12}}><button type="button" style={secondary} onClick={()=>setShowContact(false)}>Cancel</button><button disabled={saving} style={primary}>{saving?"Saving…":"Save contact"}</button></div></form>}
   {contacts.length===0?<p style={{fontSize:12,color:"#819087"}}>No additional contact records yet. The legacy primary contact is shown in Organisation details above.</p>:<div style={{display:"grid",gap:9}}>{contacts.map(person=><div key={person.id} style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",borderTop:"1px solid #edf1ee",paddingTop:10}}><div><div style={{fontWeight:800,fontSize:13}}>{person.full_name} {person.is_primary&&<span style={{fontSize:10,color:"#17643f"}}>· PRIMARY</span>}</div><div style={{fontSize:11,color:"#718078"}}>{person.job_title||"Role not recorded"} · {person.email||"No email"} · {person.phone||"No phone"}</div>{person.notes&&<div style={{fontSize:11,color:"#819087",marginTop:3}}>{person.notes}</div>}</div>{!person.is_primary&&<button disabled={saving} onClick={()=>void makePrimary(person)} style={secondary}>Make primary</button>}</div>)}</div>}
  </section>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14}}>
   <section style={card}><h2 style={{fontSize:17,fontWeight:850,margin:"0 0 12px"}}>Agreements & MoUs ({agreements.length})</h2>{agreements.length===0?<p style={{fontSize:12,color:"#819087"}}>No agreements linked to this partner yet.</p>:agreements.map(a=><div key={a.id} style={{borderTop:"1px solid #edf1ee",padding:"10px 0"}}><div style={{fontSize:13,fontWeight:800}}>{a.agreement_title}</div><div style={{fontSize:11,color:"#718078",marginTop:3}}>{a.agreement_type} · {a.status.replaceAll("_"," ")} · Expires {a.expiry_date||"not set"}</div>{a.document_url&&<button onClick={()=>void openDocument(a.document_url!)} style={{...secondary,marginTop:7}}>Open document</button>}</div>)}<Link href="/partnerships/agreements" style={{display:"inline-block",marginTop:8,color:brand,fontSize:12,fontWeight:800}}>Manage agreements →</Link></section>
   <section style={card}><h2 style={{fontSize:17,fontWeight:850,margin:"0 0 12px"}}>Activities & outcomes ({activities.length})</h2>{activities.length===0?<p style={{fontSize:12,color:"#819087"}}>No activities recorded yet.</p>:activities.map(a=><div key={a.id} style={{borderTop:"1px solid #edf1ee",padding:"10px 0"}}><div style={{fontSize:13,fontWeight:800}}>{a.activity_title}</div><div style={{fontSize:11,color:"#718078",marginTop:3}}>{a.activity_type} · {a.status.replaceAll("_"," ")} · {a.planned_date||"Date not set"}</div>{a.outcome&&<div style={{fontSize:11,color:"#61736a",marginTop:4}}>{a.outcome}</div>}<div style={{fontSize:10,color:"#819087",marginTop:3}}>Beneficiaries: {a.actual_beneficiaries??"—"} actual / {a.target_beneficiaries??"—"} target</div></div>)}<Link href="/partnerships/agreements" style={{display:"inline-block",marginTop:8,color:brand,fontSize:12,fontWeight:800}}>Manage activities →</Link></section>
  </div>
 </main>;
}
