"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Candidate={id:string;alumni_id:string;full_name:string;work_email:string|null;phone:string|null;whatsapp:string|null;student_no:string|null;program:string|null;graduation_year:number|null;duplicate_review_status:string;duplicate_of:string|null;match_type:string;match_value:string;match_count:number};
const card:React.CSSProperties={background:"#fff",border:"1px solid #e4ebe6",borderRadius:13,padding:16};
const primary:React.CSSProperties={border:0,borderRadius:7,padding:"8px 11px",background:"#106053",color:"#fff",fontSize:11,fontWeight:800,cursor:"pointer"};
const secondary:React.CSSProperties={border:"1px solid #d9e4dd",borderRadius:7,padding:"8px 11px",background:"#fff",color:"#106053",fontSize:11,fontWeight:800,cursor:"pointer"};
export default function AlumniDuplicatesPage(){
 const supabase=createClient();const [rows,setRows]=useState<Candidate[]>([]);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState("");const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");const {data,error:qError}=await supabase.from("alumni_duplicate_candidates").select("*").order("match_type").order("match_value").order("full_name").limit(3000);if(qError)setError(qError.message);else setRows((data||[]) as Candidate[]);setLoading(false);},[supabase]);
 useEffect(()=>{void load();},[load]);
 const groups=useMemo(()=>{const map=new Map<string,Candidate[]>();for(const row of rows){const key=row.match_type+"|"+row.match_value;map.set(key,[...(map.get(key)||[]),row]);}return [...map.entries()].map(([key,items])=>({key,items})).filter(g=>g.items.some(x=>x.duplicate_review_status==="unreviewed"));},[rows]);
 async function update(item:Candidate,status:"not_duplicate"|"confirmed_duplicate",canonicalId?:string){
  if(status==="confirmed_duplicate"&&(!canonicalId||canonicalId===item.id)){setError("Choose another record to keep as the primary record.");return;}
  setBusy(item.id);setError("");setNotice("");
  const {data:{user}}=await supabase.auth.getUser();
  const {error:uError}=await supabase.from("alumni").update({duplicate_review_status:status,duplicate_of:status==="confirmed_duplicate"?canonicalId:null,duplicate_reviewed_at:new Date().toISOString(),duplicate_reviewed_by:user?.id||null,updated_at:new Date().toISOString()}).eq("id",item.id);
  if(uError)setError(uError.message);else{setNotice(status==="confirmed_duplicate"?"Record confirmed as a duplicate and linked to the primary record. The record is retained for audit; no data was deleted.":"Record marked as a separate alumnus.");await load();}
  setBusy("");
 }
 return <main style={{padding:"28px clamp(16px,3vw,34px) 48px",color:"#173d34"}}>
  <Link href="/alumni" style={{color:"#106053",fontSize:12,fontWeight:750,textDecoration:"none"}}>← Alumni directory</Link>
  <header style={{margin:"14px 0 20px"}}><div style={{fontSize:11,color:"#106053",fontWeight:850,letterSpacing:1.3}}>DATA QUALITY</div><h1 style={{fontSize:28,fontWeight:850,margin:"6px 0"}}>Duplicate Records</h1><p style={{fontSize:13,color:"#718078",margin:0}}>Review possible matches by email, student number and phone. Similar records are never deleted automatically.</p></header>
  {notice&&<div style={{...card,color:"#17643f",background:"#eff9f1",marginBottom:12}}>{notice}</div>}{error&&<div role="alert" style={{...card,color:"#a32828",borderColor:"#f2cccc",marginBottom:12}}>{error}</div>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:14}}>
   <div style={card}><div style={{fontSize:11,color:"#718078"}}>Potential match groups</div><div style={{fontSize:27,fontWeight:850}}>{groups.length.toLocaleString()}</div></div>
   <div style={card}><div style={{fontSize:11,color:"#718078"}}>Candidate records</div><div style={{fontSize:27,fontWeight:850}}>{rows.length.toLocaleString()}</div></div>
   <div style={card}><div style={{fontSize:11,color:"#718078"}}>Awaiting review</div><div style={{fontSize:27,fontWeight:850}}>{rows.filter(x=>x.duplicate_review_status==="unreviewed").length.toLocaleString()}</div></div>
  </div>
  <section style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:14}}><div><h2 style={{fontSize:17,fontWeight:850,margin:0}}>Possible duplicate groups</h2><p style={{fontSize:11,color:"#819087",margin:"4px 0 0"}}>Showing up to 3,000 candidate rows. Review each group carefully before marking records.</p></div><button onClick={()=>void load()} style={secondary}>Refresh</button></div>
   {loading?<p style={{padding:20,color:"#819087"}}>Checking alumni records…</p>:groups.length===0?<p style={{padding:20,textAlign:"center",color:"#819087"}}>No unreviewed duplicate groups were found in the loaded records.</p>:<div style={{display:"grid",gap:14}}>
    {groups.map(group=><article key={group.key} style={{border:"1px solid #e7eee9",borderRadius:11,padding:14}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:10}}><div style={{fontWeight:850,textTransform:"capitalize"}}>{group.items[0].match_type} match <span style={{fontSize:11,color:"#718078",fontWeight:500}}>· {group.items.length} records</span></div><code style={{fontSize:11,color:"#718078",overflowWrap:"anywhere"}}>{group.items[0].match_value}</code></div>
      <div style={{display:"grid",gap:9}}>{group.items.map(item=><div key={item.id} style={{display:"grid",gridTemplateColumns:"minmax(180px,1.4fr) minmax(150px,1fr) minmax(190px,1.2fr)",gap:10,alignItems:"center",padding:"10px 0",borderTop:"1px solid #edf1ee"}}>
        <div><div style={{fontWeight:800,fontSize:13}}>{item.full_name}</div><div style={{fontSize:10,color:"#819087"}}>{item.alumni_id} · {item.program||"Programme not recorded"} {item.graduation_year?"· "+item.graduation_year:""}</div></div>
        <div style={{fontSize:11,color:"#61736a",overflowWrap:"anywhere"}}>{item.work_email||"No email"}<br/>{item.phone||item.whatsapp||"No phone"}<br/>Student No: {item.student_no||"—"}</div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:10,fontWeight:800,color:item.duplicate_review_status==="unreviewed"?"#855b0a":"#17643f"}}>{item.duplicate_review_status.replaceAll("_"," ")}</span>
          {item.duplicate_review_status==="unreviewed"&&<><select aria-label={"Primary record for "+item.full_name} id={"primary-"+item.id} style={{maxWidth:150,border:"1px solid #dce5df",borderRadius:7,padding:7,fontSize:10}} defaultValue=""><option value="">Keep which record?</option>{group.items.filter(x=>x.id!==item.id).map(x=><option key={x.id} value={x.id}>{x.full_name} · {x.alumni_id}</option>)}</select><button disabled={busy===item.id} style={primary} onClick={()=>{const el=document.getElementById("primary-"+item.id) as HTMLSelectElement|null;void update(item,"confirmed_duplicate",el?.value);}}>Confirm duplicate</button><button disabled={busy===item.id} style={secondary} onClick={()=>void update(item,"not_duplicate")}>Not duplicate</button></>}
        </div>
      </div>)}</div>
    </article>)}
   </div>}
  </section>
 </main>;
}
