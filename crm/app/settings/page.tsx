"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Preferences={email:boolean;followups:boolean;reports:boolean;marketing:boolean};
const DEFAULTS:Preferences={email:true,followups:true,reports:true,marketing:true};
const LOGO_KEY="ciu_crm_logo";
const LOGO_NAME_KEY="ciu_crm_logo_name";
const PREFS_KEY="ciu_crm_preferences";

export default function Settings(){
 const supabase=createClient();
 const [email,setEmail]=useState("");
 const [role,setRole]=useState("");
 const [logo,setLogo]=useState("");
 const [logoName,setLogoName]=useState("");
 const [prefs,setPrefs]=useState<Preferences>(DEFAULTS);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [saved,setSaved]=useState(false);
 const [error,setError]=useState("");

 useEffect(()=>{let active=true;
  (async()=>{
   try{
    const {data:auth}=await supabase.auth.getUser(); const user=auth.user;
    if(!user)throw new Error("You are not signed in.");
    if(active)setEmail(user.email||"");
    const [p,s]=await Promise.all([
     supabase.from("profiles").select("role").eq("id",user.id).maybeSingle(),
     supabase.from("crm_settings").select("logo_data_url,logo_name,preferences").eq("id",1).maybeSingle()
    ]);
    if(p.error)throw p.error; if(s.error)throw s.error; if(!active)return;
    setRole(p.data?.role||"");
    if(s.data){
     const next={...DEFAULTS,...((s.data.preferences||{}) as Partial<Preferences>)};
     setLogo(s.data.logo_data_url||"");setLogoName(s.data.logo_name||"");setPrefs(next);
     try{localStorage.setItem(LOGO_KEY,s.data.logo_data_url||"");localStorage.setItem(LOGO_NAME_KEY,s.data.logo_name||"");localStorage.setItem(PREFS_KEY,JSON.stringify(next));}catch{}
    }else{
     try{setLogo(localStorage.getItem(LOGO_KEY)||"");setLogoName(localStorage.getItem(LOGO_NAME_KEY)||"");const raw=localStorage.getItem(PREFS_KEY);if(raw)setPrefs({...DEFAULTS,...JSON.parse(raw)});}catch{}
    }
   }catch(e){console.error(e);if(active)setError(e instanceof Error?e.message:"Unable to load CRM settings.");}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[]);

 function handleLogoChange(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0]; if(!file)return;
  if(file.size>1024*1024){setError("Please choose a logo smaller than 1 MB.");return;}
  if(!["image/png","image/jpeg","image/webp","image/svg+xml"].includes(file.type)){setError("Please choose a PNG, JPG, WEBP or SVG logo.");return;}
  const reader=new FileReader();
  reader.onload=()=>{const value=String(reader.result||"");if(!value){setError("Unable to read the logo.");return;}setLogo(value);setLogoName(file.name);setSaved(false);setError("");};
  reader.onerror=()=>setError("Unable to read the selected logo.");
  reader.readAsDataURL(file);
 }

 function toggle(key:keyof Preferences){setPrefs(p=>({...p,[key]:!p[key]}));setSaved(false);}

 async function saveChanges(){
  if(saving)return;
  setSaving(true);setSaved(false);setError("");
  try{
   const {data:auth}=await supabase.auth.getUser(); const user=auth.user;
   if(!user)throw new Error("You are not signed in.");
   const {error:saveError}=await supabase.from("crm_settings").upsert({
    id:1,logo_data_url:logo||null,logo_name:logoName||null,preferences:prefs,updated_by:user.id,updated_at:new Date().toISOString()
   },{onConflict:"id"});
   if(saveError)throw saveError;
   const {data:check,error:checkError}=await supabase.from("crm_settings").select("logo_data_url,logo_name,preferences").eq("id",1).maybeSingle();
   if(checkError)throw checkError;if(!check)throw new Error("Settings were not found after saving.");
   const savedLogo=check.logo_data_url||"";const savedName=check.logo_name||"";
   const savedPrefs={...DEFAULTS,...((check.preferences||{}) as Partial<Preferences>)};
   setLogo(savedLogo);setLogoName(savedName);setPrefs(savedPrefs);
   try{localStorage.setItem(LOGO_KEY,savedLogo);localStorage.setItem(LOGO_NAME_KEY,savedName);localStorage.setItem(PREFS_KEY,JSON.stringify(savedPrefs));}catch{}
   window.dispatchEvent(new CustomEvent("ciu-crm-logo-updated",{detail:{logoDataUrl:savedLogo,logoName:savedName}}));
   setSaved(true);
  }catch(e){console.error(e);setError(e instanceof Error?e.message:"Unable to save CRM settings.");}
  finally{setSaving(false);}
 }

 const items:[keyof Preferences,string,string][]=[
  ["email","Email notifications","Keep email notification preferences enabled."],
  ["followups","Lead follow-up reminders","Highlight due and overdue follow-ups."],
  ["reports","Weekly performance reports","Keep reporting preferences enabled."],
  ["marketing","Marketing alerts","Keep campaign and lead-capture alerts enabled."]
 ];

 return <>
  <div className="crm-page-heading"><div><h1>Settings</h1><p>Configure your CRM and organization preferences.</p></div></div>
  <div className="crm-card" style={{marginBottom:18,border:"1px solid #cfe5de"}}><div className="crm-card-body" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap",padding:"16px 20px",background:"#f7fbf9"}}>
   <div><strong style={{display:"block",fontSize:14,color:"#17322c"}}>Save your changes</strong><span style={{display:"block",fontSize:11,color:"#64748b",marginTop:4}}>Logo and CRM preferences are saved centrally.</span></div>
   <button type="button" onClick={saveChanges} disabled={saving||loading} className="crm-btn" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minHeight:42,minWidth:150,padding:"0 20px",background:saving?"#94a3b8":"#00695c",color:"#fff",border:"1px solid #004d40",borderRadius:9,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>{saving?"Saving...":saved?"Saved ✓":"Save Changes"}</button>
  </div></div>
  {error&&<div style={{marginBottom:16,padding:12,borderRadius:8,background:"#fef2f2",color:"#b91c1c",border:"1px solid #fecaca"}}>{error}</div>}
  <div className="crm-card" style={{marginBottom:18,border:"1px solid #cfe5de"}}><div className="crm-card-header"><div><h2>CRM Logo</h2><span>Choose the logo displayed in the CRM sidebar.</span></div></div><div className="crm-card-body"><div style={{display:"flex",alignItems:"center",gap:24,flexWrap:"wrap"}}>
   <div style={{width:220,height:110,borderRadius:14,background:"#fff",border:"1px solid #cfe5de",display:"grid",placeItems:"center",padding:12,overflow:"hidden"}}>{logo?<img key={logo} src={logo} alt="CRM logo preview" style={{width:"100%",height:"100%",objectFit:"contain"}}/>:<strong style={{fontSize:28,color:"#00695c"}}>CIU</strong>}</div>
   <div><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoChange}/><div style={{fontSize:11,color:"#64748b",marginTop:8}}>{logoName||"PNG, JPG, WEBP or SVG · maximum 1 MB"}</div>{logo&&<div style={{marginTop:7,fontSize:12,fontWeight:700,color:"#00695c"}}>Logo loaded ✓</div>}</div>
  </div></div></div>
  <div className="crm-grid crm-grid-2">
   <div className="crm-card"><div className="crm-card-header"><h2>Organization</h2><span>Current CRM profile</span></div><div className="crm-card-body" style={{display:"grid",gap:14}}>
    <div className="crm-stat-box"><span>Organization Name</span><strong style={{fontSize:14}}>Clarke International University</strong></div>
    <div className="crm-stat-box"><span>CRM Name</span><strong style={{fontSize:14}}>CIU Business CRM</strong></div>
    <div className="crm-stat-box"><span>Default Currency</span><strong style={{fontSize:14}}>UGX — Ugandan Shilling</strong></div>
    <div className="crm-stat-box"><span>Signed-in Account</span><strong style={{fontSize:14}}>{email||"Authenticated user"}</strong></div>
    <div className="crm-stat-box"><span>Access Level</span><strong style={{fontSize:14,textTransform:"capitalize"}}>{role?role.replaceAll("_"," "):"Loading..."}</strong></div>
   </div></div>
   <div className="crm-card"><div className="crm-card-header"><h2>Preferences</h2><span>Saved centrally in the CRM</span></div><div className="crm-card-body" style={{display:"grid",gap:2}}>
    {items.map(([key,label,help])=><label key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,padding:"14px 0",borderBottom:"1px solid var(--border)",fontSize:13,cursor:"pointer"}}><div><strong>{label}</strong><div style={{fontSize:11,color:"#64748b",marginTop:3}}>{help}</div></div><input type="checkbox" checked={prefs[key]} onChange={()=>toggle(key)} style={{width:18,height:18}}/></label>)}
   </div></div>
  </div>
  <div className="crm-card" style={{marginTop:18}}><div className="crm-card-header"><h2>CRM Configuration</h2></div><div className="crm-card-body"><div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14}}>
   <div className="crm-stat-box"><span>Lead Statuses</span><strong>Managed in Leads</strong></div><div className="crm-stat-box"><span>Pipeline</span><strong>Managed in Pipeline</strong></div><div className="crm-stat-box"><span>Campaigns</span><strong>Managed in Marketing</strong></div>
  </div></div></div>
 </>;
}
