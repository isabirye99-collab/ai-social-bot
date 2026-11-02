"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AlumniProfile = {
  id: string; alumni_id: string; student_no: string | null; full_name: string; gender: string | null;
  work_email: string | null; phone: string | null; whatsapp: string | null; linkedin: string | null;
  city: string | null; nationality: string | null; program: string | null; faculty: string | null;
  graduation_year: number | null; employment_status: string | null; employer: string | null;
  job_title: string | null; industry: string | null; mentor: boolean; volunteer: boolean;
  business_owner: boolean; membership_status: string | null; whatsapp_group: boolean;
  linkedin_follower: boolean; engagement_score: number | null; verification_status: string;
  missing_fields: string[] | null; profile_bio: string | null; career_interests: string | null;
  allow_email: boolean; allow_sms: boolean; allow_whatsapp: boolean; source_import: string;
  last_verified_at: string | null; created_at: string; updated_at: string;
};

const brand = "#106053";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e4ebe6", borderRadius: 14, padding: 20, boxShadow: "0 4px 16px rgba(20,54,39,.035)" };
const field: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, minHeight: 40, padding: "9px 10px", border: "1px solid #dce5df", borderRadius: 8, background: "#fff", color: "#173d34", font: "inherit" };
const primary: React.CSSProperties = { border: 0, borderRadius: 8, padding: "10px 15px", background: brand, color: "#fff", fontWeight: 750, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #d9e4dd", borderRadius: 8, padding: "9px 13px", background: "#fff", color: brand, fontWeight: 700, cursor: "pointer" };
const missingKeys = ["phone","work_email","student_no","program","graduation_year","faculty","city","linkedin","employment_status","employer","job_title","industry"] as const;

export default function AlumniProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const supabase = createClient();
  const [profile, setProfile] = useState<AlumniProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("alumni").select("*").eq("id", id).single();
    if (queryError) setError(queryError.message);
    else setProfile(data as AlumniProfile);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { void load(); }, [load]);

  function change<K extends keyof AlumniProfile>(key: K, value: AlumniProfile[K]) {
    setProfile(current => current ? { ...current, [key]: value } : current);
  }

  function calculateMissing(record: AlumniProfile) {
    return missingKeys.filter(key => {
      if (key === "phone") return !record.phone?.trim() && !record.whatsapp?.trim();
      const value = record[key];
      return value == null || String(value).trim() === "";
    });
  }

  async function save() {
    if (!profile) return;
    setSaving(true); setError(""); setNotice("");
    const missing = calculateMissing(profile);
    const hasContact = Boolean(profile.work_email?.trim() || profile.phone?.trim() || profile.whatsapp?.trim());
    const nextStatus = missing.length === 0
      ? (profile.verification_status === "verified" ? "verified" : "needs_review")
      : hasContact ? "needs_review" : "contact_required";
    const patch = {
      student_no: profile.student_no, full_name: profile.full_name.trim(), gender: profile.gender,
      work_email: profile.work_email, phone: profile.phone, whatsapp: profile.whatsapp, linkedin: profile.linkedin,
      city: profile.city, nationality: profile.nationality, program: profile.program, faculty: profile.faculty,
      graduation_year: profile.graduation_year, employment_status: profile.employment_status,
      employer: profile.employer, job_title: profile.job_title, industry: profile.industry,
      mentor: profile.mentor, volunteer: profile.volunteer, business_owner: profile.business_owner,
      membership_status: profile.membership_status, whatsapp_group: profile.whatsapp_group,
      linkedin_follower: profile.linkedin_follower, engagement_score: profile.engagement_score,
      profile_bio: profile.profile_bio, career_interests: profile.career_interests,
      allow_email: profile.allow_email, allow_sms: profile.allow_sms, allow_whatsapp: profile.allow_whatsapp,
      missing_fields: missing, verification_status: nextStatus, updated_at: new Date().toISOString()
    };
    const { error: saveError } = await supabase.from("alumni").update(patch).eq("id", profile.id);
    if (saveError) setError(saveError.message);
    else { setNotice("Alumni profile saved. Missing fields and verification status have been recalculated."); await load(); }
    setSaving(false);
  }

  async function verify() {
    if (!profile) return;
    const missing = calculateMissing(profile);
    if (missing.length) { setError("This profile still has missing required fields: " + missing.join(", ")); return; }
    setSaving(true); setError(""); setNotice("");
    const now = new Date().toISOString();
    const { error: verifyError } = await supabase.from("alumni").update({
      verification_status: "verified", missing_fields: [], last_verified_at: now, updated_at: now
    }).eq("id", profile.id);
    if (verifyError) setError(verifyError.message);
    else { setNotice("Profile verified successfully."); await load(); }
    setSaving(false);
  }

  const textInput = (label: string, key: keyof AlumniProfile, type = "text") => (
    <label style={{ display: "block", fontSize: 12, fontWeight: 750, color: "#52665b" }}>{label}
      <input type={type} value={String(profile?.[key] ?? "")} onChange={e => change(key, (type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value || null) as AlumniProfile[typeof key])} style={field} />
    </label>
  );
  const selectInput = (label: string, key: "employment_status" | "membership_status" | "gender", options: string[]) => (
    <label style={{ display: "block", fontSize: 12, fontWeight: 750, color: "#52665b" }}>{label}
      <select value={profile?.[key] || ""} onChange={e => change(key, (e.target.value || null) as AlumniProfile[typeof key])} style={field}>
        <option value="">Not recorded</option>{options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
  const toggle = (label: string, key: keyof AlumniProfile) => (
    <label key={String(key)} style={{ display: "inline-flex", alignItems: "center", gap: 8, margin: "5px 18px 5px 0", fontSize: 12, color: "#52665b" }}>
      <input type="checkbox" checked={Boolean(profile?.[key])} onChange={e => change(key, e.target.checked as AlumniProfile[typeof key])} />{label}
    </label>
  );

  return <main style={{ padding: "28px clamp(16px,3vw,34px) 48px", color: "#173d34", maxWidth: 1400, margin: "0 auto" }}>
    <Link href="/alumni" style={{ color: brand, fontSize: 12, fontWeight: 750, textDecoration: "none" }}>← Back to Alumni Directory</Link>
    {loading ? <section style={{ ...card, marginTop: 16 }}>Loading alumni profile…</section> : error && !profile ? <section role="alert" style={{ ...card, marginTop: 16, color: "#a32828" }}>{error}</section> : profile ? <>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", margin: "16px 0 20px" }}>
        <div><div style={{ color: brand, fontSize: 11, fontWeight: 800, letterSpacing: 1.4 }}>ALUMNI RECORD · {profile.alumni_id}</div><h1 style={{ margin: "6px 0", fontSize: 28, fontWeight: 850 }}>{profile.full_name}</h1><p style={{ margin: 0, color: "#718078", fontSize: 13 }}>{profile.program || "Programme not recorded"}{profile.graduation_year ? " · Class of " + profile.graduation_year : ""}{profile.faculty ? " · " + profile.faculty : ""}</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><span style={{ alignSelf: "center", padding: "7px 10px", borderRadius: 20, background: profile.verification_status === "verified" ? "#e7f5ec" : "#fff4d9", color: profile.verification_status === "verified" ? "#17643f" : "#855b0a", fontSize: 11, fontWeight: 800, textTransform: "capitalize" }}>{profile.verification_status.replaceAll("_"," ")}</span><button onClick={() => void load()} style={secondary}>Refresh</button></div>
      </header>
      {notice && <div style={{ ...card, marginBottom: 12, color: "#17643f", background: "#eff9f1" }}>{notice}</div>}
      {error && <div role="alert" style={{ ...card, marginBottom: 12, color: "#a32828", borderColor: "#f2cccc" }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginBottom: 16 }}>
        {[["Alumni ID",profile.alumni_id],["Student number",profile.student_no || "Not recorded"],["Contact channels",[profile.work_email,profile.phone,profile.whatsapp].filter(Boolean).length + " recorded"],["Last verified",profile.last_verified_at ? new Date(profile.last_verified_at).toLocaleDateString() : "Not yet verified"]].map(([label,value]) => <div key={String(label)} style={card}><div style={{ color: "#718078", fontSize: 11, fontWeight: 750 }}>{label}</div><div style={{ fontSize: 16, fontWeight: 850, marginTop: 6, overflowWrap: "anywhere" }}>{value}</div></div>)}
      </div>
      <section style={{ ...card, marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 850 }}>Personal & academic information</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 13 }}>
          {textInput("Full name", "full_name")}{textInput("Student number", "student_no")}{selectInput("Gender", "gender", ["Female","Male","Other","Prefer not to say"])}{textInput("Nationality", "nationality")}{textInput("Programme", "program")}{textInput("Faculty", "faculty")}{textInput("Graduation year", "graduation_year", "number")}
        </div>
      </section>
      <section style={{ ...card, marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 850 }}>Contact information</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 13 }}>
          {textInput("Work / personal email", "work_email", "email")}{textInput("Phone number", "phone")}{textInput("WhatsApp number", "whatsapp")}{textInput("City / location", "city")}{textInput("LinkedIn profile URL", "linkedin")}
        </div>
      </section>
      <section style={{ ...card, marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 850 }}>Career & engagement</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 13 }}>
          {selectInput("Employment status", "employment_status", ["Employed","Self-employed","Unemployed","Seeking employment","Student","Retired"])}{textInput("Employer / organisation", "employer")}{textInput("Job title", "job_title")}{textInput("Industry", "industry")}{textInput("Membership status", "membership_status")}{textInput("Engagement score", "engagement_score", "number")}
        </div>
        <div style={{ marginTop: 15, borderTop: "1px solid #edf1ee", paddingTop: 12 }}><div style={{ fontSize: 12, fontWeight: 800, marginBottom: 7 }}>Alumni involvement</div>{toggle("Available as mentor", "mentor")}{toggle("Volunteer", "volunteer")}{toggle("Business owner", "business_owner")}{toggle("WhatsApp group member", "whatsapp_group")}{toggle("LinkedIn follower", "linkedin_follower")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 13, marginTop: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 750, color: "#52665b" }}>Professional bio<textarea rows={3} value={profile.profile_bio || ""} onChange={e => change("profile_bio", e.target.value || null)} style={{ ...field, minHeight: 90 }} /></label>
          <label style={{ fontSize: 12, fontWeight: 750, color: "#52665b" }}>Career interests<textarea rows={3} value={profile.career_interests || ""} onChange={e => change("career_interests", e.target.value || null)} style={{ ...field, minHeight: 90 }} /></label>
        </div>
      </section>
      <section style={{ ...card, marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 850 }}>Communication preferences</h2>
        {toggle("Email updates permitted", "allow_email")}{toggle("SMS updates permitted", "allow_sms")}{toggle("WhatsApp updates permitted", "allow_whatsapp")}
        <p style={{ color: "#819087", fontSize: 11, margin: "9px 0 0" }}>Respect these preferences before sending alumni communications.</p>
      </section>
      <section style={{ ...card, marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 850 }}>Profile completeness</h2>
        {(() => { const missing = calculateMissing(profile); return <><p style={{ margin: "0 0 9px", color: missing.length ? "#855b0a" : "#17643f", fontSize: 13, fontWeight: 750 }}>{missing.length} required field(s) still missing</p>{missing.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{missing.map(key => <span key={key} style={{ padding: "5px 8px", borderRadius: 7, background: "#fff4d9", color: "#855b0a", fontSize: 11 }}>{key.replaceAll("_"," ")}</span>)}</div> : <p style={{ color: "#17643f", fontSize: 12 }}>All tracked profile fields are complete.</p>}</>; })()}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 15 }}>
          <div style={{ color: "#819087", fontSize: 11 }}>Source: {profile.source_import || "CIU Alumni Database"} · Updated {new Date(profile.updated_at).toLocaleString()}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button disabled={saving} onClick={() => void save()} style={primary}>{saving ? "Saving…" : "Save changes"}</button><button disabled={saving || calculateMissing(profile).length > 0} onClick={() => void verify()} style={{ ...secondary, opacity: calculateMissing(profile).length > 0 ? .5 : 1 }}>Mark verified</button></div>
        </div>
      </section>
    </> : null}
  </main>;
}
