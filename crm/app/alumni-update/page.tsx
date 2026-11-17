"use client";

import { FormEvent, useState } from "react";

type Profile = {
  full_name?: string | null; alumni_id?: string | null; student_no?: string | null;
  work_email?: string | null; phone?: string | null; whatsapp?: string | null;
  program?: string | null; faculty?: string | null; graduation_year?: number | null;
  gender?: string | null; linkedin?: string | null; city?: string | null; nationality?: string | null;
  employment_status?: string | null; employer?: string | null; job_title?: string | null;
  industry?: string | null; profile_bio?: string | null; career_interests?: string | null;
  allow_email?: boolean; allow_sms?: boolean; allow_whatsapp?: boolean;
};
const fields: {key: keyof Profile; label: string; type?: string}[] = [
  {key:"student_no",label:"Student number"},{key:"gender",label:"Gender"},{key:"program",label:"Programme"},
  {key:"faculty",label:"Faculty"},{key:"graduation_year",label:"Graduation year",type:"number"},
  {key:"phone",label:"Phone number",type:"tel"},{key:"whatsapp",label:"WhatsApp number",type:"tel"},
  {key:"linkedin",label:"LinkedIn profile URL",type:"url"},{key:"city",label:"City / location"},
  {key:"nationality",label:"Nationality"},{key:"employment_status",label:"Employment status"},
  {key:"employer",label:"Employer / organisation"},{key:"job_title",label:"Job title"},{key:"industry",label:"Industry"},
];
const input: React.CSSProperties = {width:"100%",boxSizing:"border-box",height:42,border:"1px solid #d8e4dc",borderRadius:8,padding:"0 11px",fontSize:14,color:"#173d34",background:"#fff"};
const label: React.CSSProperties = {display:"block",fontSize:12,fontWeight:700,color:"#52665b"};
const button: React.CSSProperties = {border:0,borderRadius:8,padding:"12px 16px",background:"#106053",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer"};
const endpoint = (process.env.NEXT_PUBLIC_SUPABASE_URL || "") + "/functions/v1/alumni-update";

export default function AlumniUpdatePage() {
 const [email,setEmail]=useState(""); const [code,setCode]=useState(""); const [stage,setStage]=useState<"email"|"code"|"edit"|"done">("email");
 const [token,setToken]=useState(""); const [profile,setProfile]=useState<Profile>({});
 const [bio,setBio]=useState(""); const [interests,setInterests]=useState("");
 const [preferences,setPreferences]=useState({allow_email:true,allow_sms:true,allow_whatsapp:true});
 const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [notice,setNotice]=useState("");
 async function call(body: Record<string,unknown>) {
   const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   const result=await response.json().catch(()=>({error:"The service returned an invalid response."}));
   if(!response.ok) throw new Error(result.error||"Unable to process your request.");
   return result;
 }
 async function requestCode(e:FormEvent) {
   e.preventDefault();setBusy(true);setError("");setNotice("");
   try {const result=await call({action:"request_code",email:email.trim()});setNotice(result.message||"If this email matches a CIU alumni record, a verification code will be sent shortly.");setStage("code");}
   catch(err){setError(err instanceof Error?err.message:"Unable to request a code.");}
   finally{setBusy(false);}
 }
 async function verifyCode(e:FormEvent) {
   e.preventDefault();setBusy(true);setError("");setNotice("");
   try {
     const result=await call({action:"verify_code",email:email.trim(),code:code.trim()});
     const p=(result.profile||{}) as Profile;setToken(result.sessionToken);setProfile(p);setBio(p.profile_bio||"");setInterests(p.career_interests||"");
     setPreferences({allow_email:p.allow_email??true,allow_sms:p.allow_sms??true,allow_whatsapp:p.allow_whatsapp??true});setStage("edit");
   } catch(err){setError(err instanceof Error?err.message:"Verification failed.");}
   finally{setBusy(false);}
 }
 function setField(key:keyof Profile,value:string) {
   setProfile(current=>({...current,[key]:key==="graduation_year"?(value===""?null:Number(value)):value}));
 }
 async function submit(e:FormEvent) {
   e.preventDefault();setBusy(true);setError("");setNotice("");
   const changes:Record<string,unknown>={...profile,profile_bio:bio,career_interests:interests,...preferences};
   delete changes.id;delete changes.full_name;delete changes.alumni_id;
   try {const result=await call({action:"submit_update",email:email.trim(),sessionToken:token,changes});setNotice(result.message||"Your update has been submitted for review.");setStage("done");}
   catch(err){setError(err instanceof Error?err.message:"Unable to submit your update.");}
   finally{setBusy(false);}
 }
 return <main style={{minHeight:"100vh",background:"#f4f8f5",padding:"34px 16px",color:"#173d34",fontFamily:"Inter,ui-sans-serif,system-ui,sans-serif"}}>
  <div style={{maxWidth:760,margin:"0 auto"}}>
   <header style={{textAlign:"center",marginBottom:22}}><div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:52,height:52,borderRadius:14,background:"#106053",color:"#fff",fontSize:22,fontWeight:900}}>CIU</div><p style={{fontSize:11,fontWeight:850,letterSpacing:1.4,color:"#106053",margin:"14px 0 5px"}}>CLARKE INTERNATIONAL UNIVERSITY</p><h1 style={{fontSize:29,fontWeight:850,margin:"0 0 8px"}}>Alumni Information Update</h1><p style={{fontSize:14,lineHeight:1.6,color:"#718078",margin:0}}>Keep your alumni profile current. For your protection, we’ll verify your email before showing your information.</p></header>
   <section style={{background:"#fff",border:"1px solid #e0e9e3",borderRadius:16,padding:"clamp(18px,4vw,30px)",boxShadow:"0 8px 28px rgba(20,54,39,.05)"}}>
    <div style={{display:"flex",gap:8,marginBottom:22}}>{["Verify email","Update details","Submit"].map((s,i)=><div key={s} style={{flex:1,borderTop:"3px solid "+((stage==="email"&&i===0)||(stage==="code"&&i===0)||(stage==="edit"&&i<2)||(stage==="done")?"#106053":"#e3ebe5"),paddingTop:8,fontSize:11,fontWeight:750,color:"#61736a"}}>{i+1}. {s}</div>)}</div>
    {error&&<div role="alert" style={{background:"#fff1f0",border:"1px solid #f3c8c5",color:"#9c2e28",borderRadius:9,padding:12,fontSize:13,marginBottom:14}}>{error}</div>}
    {notice&&<div role="status" style={{background:"#eef8f0",border:"1px solid #d4ebd9",color:"#17643f",borderRadius:9,padding:12,fontSize:13,marginBottom:14}}>{notice}</div>}
    {stage==="email"&&<form onSubmit={requestCode}><label style={label}>Email address on your CIU alumni record<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} style={{...input,marginTop:7}} placeholder="you@example.com"/></label><p style={{fontSize:12,lineHeight:1.6,color:"#718078"}}>If the email matches an alumni record, a one-time code will be sent. The code expires after 10 minutes.</p><button disabled={busy} style={button}>{busy?"Requesting…":"Send verification code"}</button></form>}
    {stage==="code"&&<form onSubmit={verifyCode}><label style={label}>Six-digit verification code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} style={{...input,marginTop:7,maxWidth:260,letterSpacing:5,fontSize:18}} placeholder="000000"/></label><p style={{fontSize:12,color:"#718078"}}>Check your inbox and spam folder. If you do not receive a code, wait before requesting another one.</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button disabled={busy} style={button}>{busy?"Verifying…":"Verify and continue"}</button><button type="button" onClick={()=>{setStage("email");setError("");setNotice("");}} style={{...button,background:"#fff",color:"#106053",border:"1px solid #d8e4dc"}}>Change email</button></div></form>}
    {stage==="edit"&&<form onSubmit={submit}><div style={{background:"#f4f8f5",borderRadius:10,padding:14,marginBottom:18}}><div style={{fontSize:11,color:"#718078",fontWeight:800}}>VERIFIED ALUMNI RECORD</div><div style={{fontSize:19,fontWeight:850,marginTop:4}}>{profile.full_name||"Alumni profile"}</div><div style={{fontSize:12,color:"#718078",marginTop:3}}>{profile.alumni_id||""} {profile.program?"· "+profile.program:""} {profile.graduation_year?"· "+profile.graduation_year:""}</div><p style={{fontSize:11,color:"#718078",margin:"8px 0 0"}}>Your name and Alumni ID are read-only here. Submitted changes are reviewed by the CIU Alumni Office before being applied.</p></div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>{fields.map(f=><label key={String(f.key)} style={label}>{f.label}<input type={f.type||"text"} value={String(profile[f.key]??"")} onChange={e=>setField(f.key,e.target.value)} style={{...input,marginTop:6}}/></label>)}
      <label style={{...label,gridColumn:"1 / -1"}}>Professional bio<textarea rows={3} value={bio} onChange={e=>setBio(e.target.value)} style={{...input,height:"auto",padding:10,marginTop:6}}/></label>
      <label style={{...label,gridColumn:"1 / -1"}}>Career interests<textarea rows={3} value={interests} onChange={e=>setInterests(e.target.value)} style={{...input,height:"auto",padding:10,marginTop:6}}/></label>
     </div>
     <div style={{borderTop:"1px solid #e7eee9",marginTop:20,paddingTop:15}}><div style={{fontSize:13,fontWeight:800,marginBottom:9}}>Communication preferences</div>{([{key:"allow_email",label:"Email updates"},{key:"allow_sms",label:"SMS updates"},{key:"allow_whatsapp",label:"WhatsApp updates"}] as const).map(p=><label key={p.key} style={{display:"inline-flex",alignItems:"center",gap:7,margin:"0 18px 10px 0",fontSize:12}}><input type="checkbox" checked={preferences[p.key]} onChange={e=>setPreferences(v=>({...v,[p.key]:e.target.checked}))}/>{p.label}</label>)}</div>
     <div style={{display:"flex",gap:9,marginTop:20,flexWrap:"wrap"}}><button disabled={busy} style={button}>{busy?"Submitting…":"Submit changes for review"}</button><button type="button" onClick={()=>{setStage("email");setToken("");setCode("");setError("");setNotice("For security, your verified session has been closed.");}} style={{...button,background:"#fff",color:"#106053",border:"1px solid #d8e4dc"}}>Cancel</button></div>
    </form>}
    {stage==="done"&&<div style={{textAlign:"center",padding:"20px 4px"}}><div style={{fontSize:42,color:"#17643f"}}>✓</div><h2 style={{fontSize:22,fontWeight:850,margin:"8px 0"}}>Thank you for keeping in touch</h2><p style={{fontSize:14,lineHeight:1.7,color:"#718078"}}>Your changes have been sent to the CIU Alumni Office for review. They will update your official profile after approval.</p><button onClick={()=>{setStage("email");setEmail("");setCode("");setToken("");setProfile({});setNotice("");setError("");}} style={button}>Close</button></div>}
   </section>
   <p style={{textAlign:"center",fontSize:11,color:"#819087",lineHeight:1.6,marginTop:16}}>Need help? Contact the CIU Alumni Office. Never share your verification code with anyone.</p>
  </div>
 </main>;
}
