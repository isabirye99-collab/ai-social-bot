"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id:string; alumni_id:string; full_name:string; program:string|null; faculty:string|null;
  graduation_year:number|null; work_email:string|null; phone:string|null; whatsapp:string|null;
  linkedin:string|null; city:string|null; nationality:string|null; employment_status:string|null;
  employer:string|null; job_title:string|null; industry:string|null; profile_bio:string|null;
  career_interests:string|null; allow_email:boolean; allow_sms:boolean; allow_whatsapp:boolean;
};

const field:React.CSSProperties={display:"block",width:"100%",boxSizing:"border-box",marginTop:6,height:41,padding:"0 10px",border:"1px solid #dce5df",borderRadius:8,color:"#173d34",background:"#fff"};
const card:React.CSSProperties={background:"#fff",border:"1px solid #e4ebe6",borderRadius:14,padding:20};

export default function AlumniPortalPage(){
  const supabase=createClient(); const router=useRouter();
  const [profile,setProfile]=useState<Profile|null>(null);
  const [events,setEvents]=useState<any[]>([]);
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const [needsClaim,setNeedsClaim]=useState(false); const [claimId,setClaimId]=useState(""); const [claiming,setClaiming]=useState(false);
  const [referral,setReferral]=useState({name:"",phone:"",email:"",program:"",intake:"",notes:""});
  const [referralSaving,setReferralSaving]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if(authError||!user)throw new Error("Please sign in to continue.");
      const {data:account,error:accountError}=await supabase.from("alumni_accounts").select("alumni_id").eq("auth_user_id",user.id).maybeSingle();
      if(accountError)throw accountError;
      if(!account){setNeedsClaim(true);setProfile(null);setLoading(false);return;}
      setNeedsClaim(false);
      const [alumniResult,eventResult]=await Promise.all([
        supabase.from("alumni").select("*").eq("id",account.alumni_id).single(),
        supabase.from("alumni_events").select("id,title,description,event_type,venue,starts_at,registration_deadline").eq("status","published").gte("starts_at",new Date().toISOString()).order("starts_at").limit(6)
      ]);
      if(alumniResult.error)throw alumniResult.error;if(eventResult.error)throw eventResult.error;
      setProfile(alumniResult.data as Profile);setEvents(eventResult.data||[]);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load your alumni profile.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load()},[load]);

  async function claimProfile(){
    setClaiming(true);setError("");setMessage("");
    try{
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if(authError||!user)throw new Error("Please sign in again.");
      if(!claimId.trim())throw new Error("Enter your CIU Alumni ID.");
      const {error:claimError}=await supabase.rpc("claim_alumni_profile",{p_alumni_id:claimId.trim()});
      if(claimError)throw claimError;
      setNeedsClaim(false);setMessage("Your alumni profile has been securely linked.");await load();
    }catch(e){setError(e instanceof Error?e.message:"Unable to link your alumni profile.");}
    finally{setClaiming(false);}
  }
  async function save(){
    if(!profile)return;setSaving(true);setMessage("");setError("");
    const changes={
      work_email:profile.work_email,phone:profile.phone,whatsapp:profile.whatsapp,linkedin:profile.linkedin,
      city:profile.city,employment_status:profile.employment_status,employer:profile.employer,
      job_title:profile.job_title,industry:profile.industry,profile_bio:profile.profile_bio,
      career_interests:profile.career_interests,allow_email:profile.allow_email,allow_sms:profile.allow_sms,
      allow_whatsapp:profile.allow_whatsapp
    };
    const {error:saveError}=await supabase.rpc("submit_alumni_profile_update",{p_changes:changes});
    if(saveError)setError(saveError.message);else setMessage("Your changes have been submitted to the CIU Alumni Office for review.");
    setSaving(false);
  }
  async function register(eventId:string){
    if(!profile)return;setMessage("");setError("");
    const {data:registrationStatus,error:regError}=await supabase.rpc("register_alumni_event",{p_event_id:eventId});
    if(regError)setError(regError.message);
    else setMessage(registrationStatus==="waitlisted"?"The event is currently full. You have been added to the waitlist.":"Your event registration has been confirmed.");
  }
  async function submitReferral(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setReferralSaving(true);setMessage("");setError("");
    const {error:referralError}=await supabase.rpc("submit_alumni_referral",{
      p_referred_student_name:referral.name,
      p_referred_student_phone:referral.phone||null,
      p_referred_student_email:referral.email||null,
      p_program:referral.program||null,
      p_intake:referral.intake||null,
      p_notes:referral.notes||null
    });
    if(referralError)setError(referralError.message);
    else{setMessage("Thank you. Your referral has been submitted to the CIU Admissions team.");setReferral({name:"",phone:"",email:"",program:"",intake:"",notes:""});}
    setReferralSaving(false);
  }
  async function signOut(){await supabase.auth.signOut();router.replace("/alumni-login");router.refresh();}

  return <main style={{minHeight:"100vh",background:"#f4f8f5",color:"#173d34",padding:"26px clamp(16px,4vw,48px) 50px"}}>
    <header style={{maxWidth:1100,margin:"0 auto 24px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:48,height:48,display:"grid",placeItems:"center",borderRadius:13,background:"#106053",color:"#fff",fontWeight:900}}>CIU</div><div><div style={{fontSize:11,color:"#106053",fontWeight:800,letterSpacing:1}}>CLARKE INTERNATIONAL UNIVERSITY</div><div style={{fontSize:20,fontWeight:850}}>Alumni Portal</div></div></div>
      <button onClick={signOut} style={{border:"1px solid #d7e2da",background:"#fff",borderRadius:8,padding:"9px 13px",color:"#106053",fontWeight:700,cursor:"pointer"}}>Sign out</button>
    </header>
    <div style={{maxWidth:1100,margin:"0 auto"}}>
      {loading?<div style={card}>Loading your alumni profile…</div>:needsClaim?<div style={{...card,maxWidth:560,margin:"0 auto"}}><h1 style={{fontSize:22,fontWeight:850,margin:"0 0 8px"}}>Link your CIU alumni profile</h1><p style={{fontSize:13,color:"#718078",lineHeight:1.6}}>Enter the Alumni ID shown on your CIU alumni record. For security, the email address you used to sign in must match the email recorded by the Alumni Office.</p>{error&&<div role="alert" style={{padding:10,background:"#fff0f0",color:"#a32828",borderRadius:8,fontSize:12,marginBottom:12}}>{error}</div>}<label style={label}>CIU Alumni ID<input value={claimId} onChange={e=>setClaimId(e.target.value)} placeholder="e.g. CIU-ALM-00001" style={field}/></label><button disabled={claiming} onClick={()=>void claimProfile()} style={{marginTop:14,border:0,background:"#106053",color:"#fff",padding:"11px 15px",borderRadius:8,fontWeight:800}}>{claiming?"Verifying…":"Verify and link my profile"}</button><p style={{fontSize:11,color:"#87958d",marginTop:14}}>If your email address is missing or outdated in CIU records, contact the Alumni Office to update it before claiming your profile.</p><button onClick={signOut} style={{marginTop:8,border:"1px solid #d7e2da",background:"#fff",color:"#106053",padding:"9px 12px",borderRadius:8}}>Sign out</button></div>:error&&!profile?<div style={{...card,borderColor:"#f2cccc",color:"#a32828"}}>{error}<button onClick={signOut} style={{display:"block",marginTop:14,border:0,background:"#106053",color:"#fff",padding:"9px 12px",borderRadius:8}}>Sign out</button></div>:profile?<>
        <div style={{...card,background:"linear-gradient(120deg,#106053,#17483e)",color:"#fff",marginBottom:18}}>
          <div style={{fontSize:11,letterSpacing:1.2,color:"#d6e9c7",fontWeight:800}}>WELCOME BACK</div><h1 style={{fontSize:27,fontWeight:850,margin:"8px 0 4px"}}>{profile.full_name}</h1><div style={{fontSize:13,color:"#e0eee5"}}>{profile.program||"CIU Graduate"} {profile.graduation_year?"· Class of "+profile.graduation_year:""} · {profile.alumni_id}</div>
        </div>
        {message&&<div style={{...card,marginBottom:14,color:"#17643f",background:"#eff9f1"}}>{message}</div>}{error&&<div style={{...card,marginBottom:14,color:"#a32828",borderColor:"#f2cccc"}}>{error}</div>}
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) minmax(280px,1fr)",gap:18,alignItems:"start"}}>
          <section style={card}>
            <h2 style={{fontSize:18,fontWeight:850,margin:"0 0 5px"}}>My profile</h2><p style={{fontSize:12,color:"#819087",margin:"0 0 18px"}}>Keep your contact and career details current so CIU can stay connected.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
              <label style={label}>Email<input type="email" value={profile.work_email||""} onChange={e=>setProfile({...profile,work_email:e.target.value})} style={field}/></label>
              <label style={label}>Phone<input value={profile.phone||""} onChange={e=>setProfile({...profile,phone:e.target.value})} style={field}/></label>
              <label style={label}>WhatsApp<input value={profile.whatsapp||""} onChange={e=>setProfile({...profile,whatsapp:e.target.value})} style={field}/></label>
              <label style={label}>LinkedIn profile<input value={profile.linkedin||""} onChange={e=>setProfile({...profile,linkedin:e.target.value})} style={field}/></label>
              <label style={label}>City / Location<input value={profile.city||""} onChange={e=>setProfile({...profile,city:e.target.value})} style={field}/></label>
              <label style={label}>Employment status<input value={profile.employment_status||""} onChange={e=>setProfile({...profile,employment_status:e.target.value})} style={field}/></label>
              <label style={label}>Employer<input value={profile.employer||""} onChange={e=>setProfile({...profile,employer:e.target.value})} style={field}/></label>
              <label style={label}>Job title<input value={profile.job_title||""} onChange={e=>setProfile({...profile,job_title:e.target.value})} style={field}/></label>
              <label style={label}>Industry<input value={profile.industry||""} onChange={e=>setProfile({...profile,industry:e.target.value})} style={field}/></label>
              <label style={{...label,gridColumn:"1 / -1"}}>Short professional bio<textarea rows={3} value={profile.profile_bio||""} onChange={e=>setProfile({...profile,profile_bio:e.target.value})} style={{...field,height:"auto",padding:10}}/></label>
              <label style={{...label,gridColumn:"1 / -1"}}>Career interests / opportunities<textarea rows={3} value={profile.career_interests||""} onChange={e=>setProfile({...profile,career_interests:e.target.value})} style={{...field,height:"auto",padding:10}}/></label>
            </div>
            <div style={{borderTop:"1px solid #edf1ee",marginTop:18,paddingTop:15}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:10}}>Communication preferences</div>
              {([["allow_email","Email updates"],["allow_sms","SMS updates"],["allow_whatsapp","WhatsApp updates"]] as const).map(([key,title])=><label key={key} style={{display:"inline-flex",alignItems:"center",gap:7,marginRight:18,fontSize:12,color:"#4e6258"}}><input type="checkbox" checked={profile[key]} onChange={e=>setProfile({...profile,[key]:e.target.checked})}/>{title}</label>)}
            </div>
            <button disabled={saving} onClick={save} style={{marginTop:18,border:0,borderRadius:9,padding:"11px 17px",background:"#106053",color:"#fff",fontWeight:800,cursor:"pointer"}}>{saving?"Saving…":"Save my profile"}</button>
          </section>
          <aside style={{display:"grid",gap:16}}>
            <section style={card}><h2 style={{fontSize:17,fontWeight:850,margin:"0 0 12px"}}>Upcoming alumni events</h2>{events.length===0?<p style={{fontSize:12,color:"#819087"}}>There are no published upcoming events at the moment.</p>:events.map(ev=><div key={ev.id} style={{padding:"12px 0",borderTop:"1px solid #edf1ee"}}><div style={{fontWeight:800,fontSize:13}}>{ev.title}</div><div style={{fontSize:11,color:"#819087",marginTop:4}}>{new Date(ev.starts_at).toLocaleString()} {ev.venue?"· "+ev.venue:""}</div>{ev.description&&<p style={{fontSize:12,color:"#64756c"}}>{ev.description}</p>}<button onClick={()=>void register(ev.id)} style={{border:"1px solid #cddfd3",background:"#f5faf6",color:"#106053",borderRadius:7,padding:"7px 10px",fontSize:11,fontWeight:800}}>Register</button></div>)}</section>
            <section style={card}>
              <h2 style={{fontSize:16,fontWeight:850,margin:"0 0 7px"}}>Refer a prospective student</h2>
              <p style={{fontSize:12,color:"#74847b",lineHeight:1.6}}>Recommend someone who may be interested in studying at CIU. The Admissions team will follow up.</p>
              <form onSubmit={submitReferral} style={{display:"grid",gap:9}}>
                <label style={label}>Student full name *<input required value={referral.name} onChange={e=>setReferral({...referral,name:e.target.value})} style={field}/></label>
                <label style={label}>Phone number<input value={referral.phone} onChange={e=>setReferral({...referral,phone:e.target.value})} style={field}/></label>
                <label style={label}>Email address<input type="email" value={referral.email} onChange={e=>setReferral({...referral,email:e.target.value})} style={field}/></label>
                <label style={label}>Programme of interest<input value={referral.program} onChange={e=>setReferral({...referral,program:e.target.value})} style={field}/></label>
                <label style={label}>Intake<input value={referral.intake} onChange={e=>setReferral({...referral,intake:e.target.value})} placeholder="e.g. February 2027" style={field}/></label>
                <label style={label}>Additional notes<textarea rows={2} value={referral.notes} onChange={e=>setReferral({...referral,notes:e.target.value})} style={{...field,height:"auto",padding:10}}/></label>
                <button disabled={referralSaving} style={{border:0,borderRadius:8,padding:"10px 13px",background:"#106053",color:"#fff",fontWeight:800}}>{referralSaving?"Submitting…":"Submit referral"}</button>
              </form>
            </section>
            <section style={card}><h2 style={{fontSize:16,fontWeight:850,margin:"0 0 7px"}}>Stay connected</h2><p style={{fontSize:12,color:"#74847b",lineHeight:1.6}}>Update your career progress, volunteer as a mentor, share opportunities and take part in CIU alumni activities.</p><div style={{fontSize:11,color:"#87958d"}}>For corrections to your academic details, please contact the CIU Alumni Office.</div></section>
          </aside>
        </div>
      </>:null}
    </div>
  </main>;
}
const label:React.CSSProperties={fontSize:12,fontWeight:700,color:"#52665b"};
