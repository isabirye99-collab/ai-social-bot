"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AlumniProfile = {
  id:string; alumni_id:string; full_name:string; gender:string|null; student_no:string|null; program:string|null; faculty:string|null; graduation_year:number|null; work_email:string|null; phone:string|null; whatsapp:string|null;
  linkedin:string|null; city:string|null; nationality:string|null; employment_status:string|null; employer:string|null;
  job_title:string|null; industry:string|null; profile_bio:string|null; career_interests:string|null;
  allow_email:boolean; allow_sms:boolean; allow_whatsapp:boolean;
};
const brand="#106053";
const field:React.CSSProperties={display:"block",width:"100%",boxSizing:"border-box",marginTop:6,minHeight:42,padding:"9px 11px",border:"1px solid #dce5df",borderRadius:8,color:"#173d34",background:"#fff",font:"inherit"};
const label:React.CSSProperties={display:"block",fontSize:12,fontWeight:750,color:"#52665b"};
const card:React.CSSProperties={background:"#fff",border:"1px solid #e4ebe6",borderRadius:16,padding:24,boxShadow:"0 12px 36px rgba(20,54,39,.06)"};

export default function AlumniUpdatePage(){
  const supabase=createClient();
  const [email,setEmail]=useState("");
  const [code,setCode]=useState("");
  const [step,setStep]=useState<"email"|"code"|"profile"|"done">("email");
  const [profile,setProfile]=useState<AlumniProfile|null>(null);
  const [sessionToken,setSessionToken]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function call(action:string,body:Record<string,unknown>={}){
    const {data,error:invokeError}=await supabase.functions.invoke("alumni-update",{body:{action,email:email.trim().toLowerCase(),...body}});
    if(invokeError){
      const e=invokeError as Error & {context?:Response};
      if(e.context){try{const payload=await e.context.clone().json();throw new Error(payload.error||payload.message||e.message);}catch(inner){if(inner instanceof Error && inner.message!==e.message)throw inner;}}
      throw new Error(e.message||"Unable to contact the alumni update service.");
    }
    if(data?.error)throw new Error(data.error);
    return data;
  }
  async function requestCode(e:FormEvent){
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try{const data=await call("request_code");setNotice(data.message||"If this email matches a CIU alumni record, a verification code will be sent shortly.");setStep("code");}
    catch(err){setError(err instanceof Error?err.message:"Unable to send the verification code.");}
    finally{setBusy(false);}
  }
  async function verifyCode(e:FormEvent){
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try{const data=await call("verify_code",{code});setProfile(data.profile as AlumniProfile);setSessionToken(data.sessionToken);setStep("profile");}
    catch(err){setError(err instanceof Error?err.message:"Unable to verify your email.");}
    finally{setBusy(false);}
  }
  function change<K extends keyof AlumniProfile>(key:K,value:AlumniProfile[K]){
    setProfile(current=>current?{...current,[key]:value}:current);
  }
  async function submit(e:FormEvent){
    e.preventDefault();if(!profile)return;setBusy(true);setError("");setNotice("");
    const changes={
      gender:profile.gender,student_no:profile.student_no,program:profile.program,faculty:profile.faculty,graduation_year:profile.graduation_year,work_email:profile.work_email,phone:profile.phone,whatsapp:profile.whatsapp,linkedin:profile.linkedin,
      city:profile.city,nationality:profile.nationality,employment_status:profile.employment_status,
      employer:profile.employer,job_title:profile.job_title,industry:profile.industry,
      profile_bio:profile.profile_bio,career_interests:profile.career_interests,
      allow_email:profile.allow_email,allow_sms:profile.allow_sms,allow_whatsapp:profile.allow_whatsapp
    };
    try{const data=await call("submit_update",{sessionToken,changes});setNotice(data.message||"Your changes have been submitted for review.");setStep("done");setProfile(null);setSessionToken("");}
    catch(err){setError(err instanceof Error?err.message:"Unable to submit your changes.");}
    finally{setBusy(false);}
  }
  const input=(title:string,key:keyof AlumniProfile,type="text")=><label style={label}>{title}<input type={type} value={String(profile?.[key]??"")} onChange={e=>change(key,(type==="number"?(e.target.value===""?null:Number(e.target.value)):e.target.value||null) as AlumniProfile[typeof key])} style={field}/></label>;
  return <main style={{minHeight:"100vh",background:"#f3f7f4",padding:"36px 16px 60px",color:"#173d34"}}>
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <header style={{display:"flex",alignItems:"center",gap:13,marginBottom:22}}>
        <div style={{width:54,height:54,borderRadius:14,background:brand,color:"#fff",display:"grid",placeItems:"center",fontWeight:900,fontSize:19}}>CIU</div>
        <div><div style={{fontSize:11,fontWeight:850,letterSpacing:1.2,color:brand}}>CLARKE INTERNATIONAL UNIVERSITY</div><div style={{fontSize:21,fontWeight:850}}>Alumni Information Update</div></div>
      </header>
      <section style={card}>
        {step!=="done"&&<><div style={{fontSize:11,fontWeight:850,color:brand,letterSpacing:1.1}}>KEEP IN TOUCH WITH CIU</div><h1 style={{fontSize:25,fontWeight:850,margin:"7px 0"}}>Update your alumni details</h1><p style={{fontSize:13,color:"#718078",lineHeight:1.65,margin:"0 0 20px"}}>Use this secure form to update your contact and professional information in the Clarke International University alumni register. You do not need to create a password or alumni portal account.</p></>}
        {error&&<div role="alert" style={{padding:12,borderRadius:9,background:"#fff1f1",color:"#a32828",fontSize:12,marginBottom:14}}>{error}</div>}
        {notice&&<div role="status" style={{padding:12,borderRadius:9,background:"#eff9f1",color:"#17643f",fontSize:12,marginBottom:14}}>{notice}</div>}
        {step==="email"&&<form onSubmit={requestCode} style={{display:"grid",gap:14}}><label style={label}>Email address currently held by CIU<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} style={field} placeholder="name@example.com"/></label><button disabled={busy} style={{border:0,borderRadius:9,padding:13,background:brand,color:"#fff",fontWeight:800,cursor:"pointer"}}>{busy?"Sending…":"Send verification code"}</button></form>}
        {step==="code"&&<form onSubmit={verifyCode} style={{display:"grid",gap:14}}><div style={{fontSize:13,color:"#52665b"}}>Enter the six-digit code sent to <strong>{email}</strong>. The code expires after 10 minutes.</div><label style={label}>Verification code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} style={{...field,letterSpacing:7,fontSize:20,maxWidth:240}} placeholder="000000"/></label><button disabled={busy||code.length!==6} style={{border:0,borderRadius:9,padding:13,background:brand,color:"#fff",fontWeight:800}}>{busy?"Verifying…":"Verify email and continue"}</button><button type="button" onClick={()=>{setStep("email");setCode("");setError("");setNotice("");}} style={{border:0,background:"transparent",color:brand,fontWeight:750,cursor:"pointer"}}>Use a different email address</button></form>}
        {step==="profile"&&profile&&<form onSubmit={submit} style={{display:"grid",gap:14}}>
          <div style={{padding:13,borderRadius:10,background:"#f3f8f4"}}><div style={{fontSize:10,color:"#718078",fontWeight:800}}>MATCHED CIU ALUMNI RECORD</div><div style={{fontSize:18,fontWeight:850,marginTop:4}}>{profile.full_name}</div><div style={{fontSize:11,color:"#718078",marginTop:3}}>{profile.alumni_id} · {profile.work_email}</div></div>
          <p style={{fontSize:12,color:"#718078",margin:0}}>Please review and update the information below. Your changes will only be applied after the Alumni Office approves them. If you change your email address, the new address may need separate confirmation.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:13}}>
            {input("Gender","gender")}{input("Student number","student_no")}{input("Programme","program")}{input("Faculty","faculty")}{input("Graduation year","graduation_year","number")}{input("Email address","work_email","email")}{input("Phone number","phone","tel")}{input("WhatsApp number","whatsapp","tel")}{input("LinkedIn profile","linkedin","url")}{input("City / location","city")}{input("Nationality","nationality")}{input("Employment status","employment_status")}{input("Employer / organisation","employer")}{input("Job title","job_title")}{input("Industry","industry")}
          </div>
          <label style={label}>Professional bio<textarea rows={3} value={profile.profile_bio||""} onChange={e=>change("profile_bio",e.target.value||null)} style={{...field,minHeight:90}}/></label>
          <label style={label}>Career interests<textarea rows={3} value={profile.career_interests||""} onChange={e=>change("career_interests",e.target.value||null)} style={{...field,minHeight:90}}/></label>
          <div style={{borderTop:"1px solid #edf1ee",paddingTop:13}}><div style={{fontSize:12,fontWeight:850,marginBottom:8}}>Communication preferences</div>{([["allow_email","Email updates"],["allow_sms","SMS updates"],["allow_whatsapp","WhatsApp updates"]] as const).map(([key,title])=><label key={key} style={{display:"inline-flex",alignItems:"center",gap:7,marginRight:18,fontSize:12}}><input type="checkbox" checked={Boolean(profile[key])} onChange={e=>change(key,e.target.checked)}/>{title}</label>)}</div>
          <button disabled={busy} style={{border:0,borderRadius:9,padding:13,background:brand,color:"#fff",fontWeight:850,cursor:"pointer"}}>{busy?"Submitting…":"Submit updates for review"}</button>
          <div style={{fontSize:11,color:"#87958d"}}>Your verification session expires after 30 minutes. For a different email address or a duplicate-record issue, contact the CIU Alumni Office.</div>
        </form>}
        {step==="done"&&<div style={{textAlign:"center",padding:"24px 8px"}}><div style={{width:58,height:58,borderRadius:50,background:"#e8f5eb",color:"#17643f",display:"grid",placeItems:"center",margin:"0 auto 14px",fontSize:28}}>✓</div><h1 style={{fontSize:23,fontWeight:850,margin:"0 0 8px"}}>Thank you for updating your details</h1><p style={{fontSize:13,color:"#718078",lineHeight:1.6}}>{notice} The Alumni Office will review your submission before updating the official register.</p><button onClick={()=>{setEmail("");setCode("");setNotice("");setStep("email");}} style={{marginTop:12,border:0,borderRadius:8,padding:"10px 14px",background:brand,color:"#fff",fontWeight:800}}>Update another record</button></div>}
      </section>
      <p style={{textAlign:"center",fontSize:11,color:"#87958d",marginTop:16}}>Clarke International University · Alumni Office</p>
    </div>
  </main>;
}
