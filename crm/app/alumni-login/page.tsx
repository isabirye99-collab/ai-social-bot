"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AlumniLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setNotice("");
    if (mode === "signup") {
      if (password.length < 8) { setError("Please use a password with at least 8 characters."); setLoading(false); return; }
      const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (authError) { setError(authError.message); setLoading(false); return; }
      if (data.session) { router.replace("/alumni-portal"); router.refresh(); return; }
      setNotice("Your account has been created. Check your email to confirm your address, then sign in and claim your CIU alumni profile.");
      setMode("signin"); setLoading(false); return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) { setError(authError.message); setLoading(false); return; }
    router.replace("/alumni-portal"); router.refresh();
  }

  return <main style={{ minHeight:"100vh",display:"grid",placeItems:"center",padding:20,background:"#f3f7f4",color:"#173d34" }}>
    <section style={{ width:"100%",maxWidth:440,background:"#fff",border:"1px solid #e0e9e3",borderRadius:18,boxShadow:"0 20px 55px rgba(20,54,39,.08)",overflow:"hidden" }}>
      <div style={{height:6,background:"linear-gradient(90deg,#106053,#8dc642)"}}/>
      <div style={{padding:32}}>
        <div style={{width:58,height:58,borderRadius:15,display:"grid",placeItems:"center",background:"#edf6ef",color:"#106053",fontSize:20,fontWeight:900}}>CIU</div>
        <h1 style={{fontSize:25,fontWeight:850,margin:"20px 0 6px"}}>Alumni Portal</h1>
        <p style={{fontSize:13,color:"#74847b",margin:"0 0 24px"}}>{mode === "signin" ? "Sign in to update your profile and stay connected with Clarke International University." : "Create an account using the email address recorded in your CIU alumni record."}</p>
        <form onSubmit={submit} style={{display:"grid",gap:14}}>
          <label style={{fontSize:12,fontWeight:700}}>Email address<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} style={field}/></label>
          <label style={{fontSize:12,fontWeight:700}}>Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label>
          {error&&<div role="alert" style={{padding:10,borderRadius:8,background:"#fff0f0",color:"#a32828",fontSize:12}}>{error}</div>}{notice&&<div role="status" style={{padding:10,borderRadius:8,background:"#edf8f0",color:"#17643f",fontSize:12}}>{notice}</div>}
          <button disabled={loading} style={{border:0,borderRadius:9,padding:13,background:"#106053",color:"#fff",fontWeight:800,cursor:"pointer"}}>{loading?"Please wait…":mode === "signin"?"Sign in to Alumni Portal":"Create Alumni Account"}</button>
        </form>
        <p style={{fontSize:12,color:"#74847b",marginTop:16}}>{mode === "signin" ? "New to the portal?" : "Already have an account?"} <button type="button" onClick={()=>{setMode(mode === "signin" ? "signup" : "signin");setError("");setNotice("");}} style={{border:0,background:"transparent",color:"#106053",fontWeight:800,cursor:"pointer",padding:0}}>{mode === "signin" ? "Create an account" : "Sign in"}</button></p>
        <p style={{fontSize:11,color:"#84928b",marginTop:10}}>Your email must match the contact email held in CIU’s alumni database. After signing in, you will be asked to enter your Alumni ID to securely claim your profile. If your email is missing or outdated, contact the Alumni Office.</p>
        <Link href="/login" style={{display:"block",marginTop:18,color:"#106053",fontSize:12,fontWeight:700,textDecoration:"none"}}>← CIU staff login</Link>
      </div>
    </section>
  </main>;
}
const field: React.CSSProperties={display:"block",width:"100%",boxSizing:"border-box",marginTop:6,height:43,padding:"0 11px",border:"1px solid #dce5df",borderRadius:8,color:"#173d34",background:"#fff"};
