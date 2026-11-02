import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const allowedOrigins = new Set(["https://crm.ciu.ac.ug","https://ciu.ac.ug","https://www.ciu.ac.ug","http://localhost:3000","http://127.0.0.1:3000"]);
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://crm.ciu.ac.ug",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
const randomDigits = () => { const b = new Uint32Array(1); crypto.getRandomValues(b); return String(b[0] % 1_000_000).padStart(6,"0"); };
const randomToken = () => { const b = new Uint8Array(32); crypto.getRandomValues(b); return Array.from(b,x=>x.toString(16).padStart(2,"0")).join(""); };
async function hash(value: string) { const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)); return Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,"0")).join(""); }
const allowedChanges = new Set(["gender","student_no","program","faculty","graduation_year","work_email","phone","whatsapp","linkedin","city","nationality","employment_status","employer","job_title","industry","profile_bio","career_interests","allow_email","allow_sms","allow_whatsapp"]);

Deno.serve(async (req: Request) => {
  const origin=req.headers.get("origin");
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders(origin)});
  if(req.method!=="POST") return json({error:"Method not allowed."},405,origin);
  if(origin && !allowedOrigins.has(origin)) return json({error:"Origin not allowed."},403,origin);
  const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resend=Deno.env.get("RESEND_API_KEY"), from=Deno.env.get("ALUMNI_UPDATE_FROM"), pepper=Deno.env.get("ALUMNI_UPDATE_OTP_PEPPER");
  if(!url||!key||!resend||!from||!pepper) return json({error:"The alumni update service is awaiting email configuration. Please contact the CIU Alumni Office."},503,origin);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const body=await req.json(), action=String(body.action||""), email=String(body.email||"").trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254) return json({error:"Enter a valid email address."},400,origin);
    if(action==="request_code") {
      const hourAgo=new Date(Date.now()-3600000).toISOString();
      const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
      const ipHash=await hash(ip+":"+pepper);
      const [byEmail,byIp,match]=await Promise.all([
        db.from("alumni_update_verifications").select("id",{count:"exact",head:true}).eq("email",email).gte("created_at",hourAgo),
        db.from("alumni_update_verifications").select("id",{count:"exact",head:true}).eq("request_ip_hash",ipHash).gte("created_at",hourAgo),
        db.rpc("lookup_alumni_for_public_update",{p_email:email}),
      ]);
      if(byEmail.error||byIp.error||match.error) throw new Error("Unable to process verification.");
      const matchCount=Number(match.data?.match_count||0);
      if((byEmail.count||0)>=3||(byIp.count||0)>=10||matchCount===0) return json({message:"If this email matches a CIU alumni record, a verification code will be sent shortly."},200,origin);
      const code=randomDigits(), codeHash=await hash(email+":"+code+":"+pepper);
      const {error:insertError}=await db.from("alumni_update_verifications").insert({email,code_hash:codeHash,expires_at:new Date(Date.now()+600000).toISOString(),request_ip_hash:ipHash});
      if(insertError) throw insertError;
      const mail=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+resend,"Content-Type":"application/json"},body:JSON.stringify({from,to:[email],subject:"Your CIU Alumni Information Update code",text:"Your CIU Alumni Information Update verification code is "+code+". It expires in 10 minutes. If you did not request it, ignore this email.",html:"<p>Your CIU Alumni Information Update verification code is:</p><p style=\"font-size:28px;font-weight:700;letter-spacing:6px\">"+code+"</p><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p>"})});
      if(!mail.ok){await db.from("alumni_update_verifications").delete().eq("email",email).eq("code_hash",codeHash);throw new Error("Email delivery failed. Please try again later.");}
      return json({message:"If this email matches a CIU alumni record, a verification code will be sent shortly."},200,origin);
    }
    if(action==="verify_code") {
      const code=String(body.code||"").trim();
      if(!/^\d{6}$/.test(code)) return json({error:"Enter the six-digit code sent to your email."},400,origin);
      const {data:challenge,error}=await db.from("alumni_update_verifications").select("id,code_hash,expires_at,attempts,used_at").eq("email",email).is("used_at",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(error) throw error;
      if(!challenge||new Date(challenge.expires_at).getTime()<=Date.now()||challenge.attempts>=5) return json({error:"The code has expired or is no longer valid. Request a new code."},400,origin);
      if(await hash(email+":"+code+":"+pepper)!==challenge.code_hash){await db.from("alumni_update_verifications").update({attempts:challenge.attempts+1}).eq("id",challenge.id);return json({error:"The verification code is incorrect."},400,origin);}
      const sessionToken=randomToken();
      const {error:updateError}=await db.from("alumni_update_verifications").update({verified_token_hash:await hash(sessionToken+":"+pepper),verified_expires_at:new Date(Date.now()+1800000).toISOString(),attempts:5}).eq("id",challenge.id);
      if(updateError) throw updateError;
      const {data:lookup,error:profileError}=await db.rpc("lookup_alumni_for_public_update",{p_email:email});
      if(profileError) throw profileError;
      if(Number(lookup?.match_count||0)===0) return json({error:"No alumni record matches this email. Please contact the CIU Alumni Office."},404,origin);
      if(Number(lookup?.match_count||0)>1) return json({error:"This email matches multiple alumni records. The Alumni Office must resolve the duplicates before an update can be submitted."},409,origin);
      return json({sessionToken,profile:lookup.profile},200,origin);
    }
    if(action==="submit_update") {
      const sessionToken=String(body.sessionToken||""), changes=body.changes;
      if(sessionToken.length<32||!changes||typeof changes!=="object"||Array.isArray(changes)) return json({error:"Your verification session or submitted information is invalid."},400,origin);
      const keys=Object.keys(changes);
      if(!keys.length||keys.some(k=>!allowedChanges.has(k))) return json({error:"The update contains fields that cannot be changed online."},400,origin);
      const {data,error}=await db.rpc("submit_alumni_update_from_public_link",{p_token_hash:await hash(sessionToken+":"+pepper),p_changes:changes});
      if(error) throw error;
      return json({message:"Thank you. Your information has been submitted to the CIU Alumni Office for review.",requestId:data},200,origin);
    }
    return json({error:"Unknown request."},400,origin);
  } catch(e) { console.error("alumni-update",e); return json({error:e instanceof Error?e.message:"Unable to process your request."},500,origin); }
});
