"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, CheckCircle2, ArrowRight, ShieldCheck } from "lucide-react";

type Course = { id: string; title: string; description: string | null; duration: string | null; delivery_mode: string; venue: string | null; fee_amount: number | null; currency: string; start_date: string | null; application_deadline: string | null };

const field: React.CSSProperties = { width: "100%", padding: "12px 13px", border: "1px solid #d5e3da", borderRadius: 10, background: "#fff", color: "#18392b", fontSize: 14, boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 750, color: "#335746", marginBottom: 6 };

export default function ShortCourseApplicationPage() {
  const supabase = useMemo(() => createClient(), []);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "", date_of_birth: "", gender: "", nationality: "", highest_qualification: "", qualification_details: "", source: "Website", expected_outcome: "" });

  useEffect(() => {
    let alive = true;
    async function loadCourses() {
      try {
        const { data, error: e } = await supabase.from("short_courses").select("id,title,description,duration,delivery_mode,venue,fee_amount,currency,start_date,application_deadline").eq("status", "active").eq("public_visible", true).order("title");
        if (e) throw e;
        const open = (data || []).filter((c: Course) => !c.application_deadline || c.application_deadline >= new Date().toISOString().slice(0, 10));
        if (alive) { setCourses(open as Course[]); if (open.length === 1) setCourseId(open[0].id); }
      } catch (e: any) { if (alive) setError(e?.message || "Courses could not be loaded. Please try again later."); }
      finally { if (alive) setLoading(false); }
    }
    void loadCourses();
    return () => { alive = false; };
  }, [supabase]);

  const chosenCourse = courses.find((c) => c.id === courseId);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    if (!courseId) { setError("Please select a short course."); setSaving(false); return; }
    if (!paymentMethod) { setError("Please choose ABSA Bank or MTN MoMo."); setSaving(false); return; }
    if (!proofFile) { setError("Please attach proof of payment to continue."); setSaving(false); return; }
    if (proofFile.size > 5 * 1024 * 1024) { setError("Proof of payment must be 5 MB or smaller."); setSaving(false); return; }
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(proofFile.type)) { setError("Attach a JPG, PNG, WEBP image or PDF document."); setSaving(false); return; }
    let uploadedPath = "";
    try {
      const safeName = proofFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      uploadedPath = crypto.randomUUID() + "/" + safeName;
      const { error: uploadError } = await supabase.storage.from("short-course-payment-proofs").upload(uploadedPath, proofFile, { upsert: false, contentType: proofFile.type });
      if (uploadError) throw uploadError;
      const { error: e } = await supabase.rpc("submit_short_course_application", {
        p_course_id: courseId,
        p_first_name: form.first_name.trim(),
        p_last_name: form.last_name.trim(),
        p_phone: form.phone.trim(),
        p_email: form.email.trim() || null,
        p_date_of_birth: form.date_of_birth || null,
        p_gender: form.gender || null,
        p_nationality: form.nationality.trim() || null,
        p_highest_qualification: form.highest_qualification || null,
        p_qualification_details: form.qualification_details.trim() || null,
        p_source: form.source || "Website",
        p_expected_outcome: form.expected_outcome.trim() || null,
        p_payment_method: paymentMethod,
        p_payment_reference: paymentReference.trim() || null,
        p_payment_proof_path: uploadedPath,
      });
      if (e) throw e;
      setSubmitted(true);
    } catch (e: any) {
      if (uploadedPath) { try { await supabase.storage.from("short-course-payment-proofs").remove([uploadedPath]); } catch {} }
      setError(e?.message || "We could not submit your application. Please try again.");
    } finally { setSaving(false); }
  }

  return <main style={{ minHeight: "100vh", background: "#f6faf7", color: "#173b2b", fontFamily: "Inter, Arial, sans-serif" }}>
    <header style={{ background: "#fff", borderBottom: "1px solid #e1ebe4", padding: "18px clamp(18px,5vw,70px)", display: "flex", alignItems: "center", gap: 14 }}>
      <img src="/ciu-seal-color.svg" alt="Clarke International University" style={{ width: 52, height: 52, objectFit: "contain" }}/>
      <div><div style={{ fontSize: 16, fontWeight: 850 }}>Clarke International University</div><div style={{ fontSize: 11, color: "#6f8577", marginTop: 3 }}>Short Courses · Lead · Innovate · Transform</div></div>
    </header>
    <section style={{ padding: "clamp(28px,5vw,62px) 18px 70px", maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 30, alignItems: "start" }}>
        <div style={{ paddingTop: 8 }}>
          <div style={{ display: "inline-flex", gap: 7, alignItems: "center", borderRadius: 30, background: "#e7f4e9", color: "#1e6b4d", padding: "7px 11px", fontSize: 11, fontWeight: 800 }}><BookOpen size={14}/> PROFESSIONAL DEVELOPMENT</div>
          <h1 style={{ fontSize: "clamp(30px,4vw,46px)", lineHeight: 1.08, letterSpacing: "-.04em", margin: "18px 0 14px", fontWeight: 900 }}>Build practical skills. <span style={{ color: "#74a92c" }}>Make a difference.</span></h1>
          <p style={{ color: "#62766a", fontSize: 15, lineHeight: 1.8, maxWidth: 470 }}>Explore CIU short courses designed to strengthen professional knowledge and practical skills. Choose a course and submit your details; our Short Courses Coordinator will follow up with you.</p>
          <div style={{ display: "flex", gap: 10, alignItems: "start", marginTop: 24, color: "#5d7768", fontSize: 12, lineHeight: 1.6 }}><ShieldCheck size={18} color="#45855b" style={{ flexShrink: 0, marginTop: 1 }}/> Your contact details will be used by CIU to follow up on your short-course enquiry and application.</div>
          <div style={{ marginTop: 30, display: "grid", gap: 10 }}>
            {courses.slice(0, 4).map((c) => <div key={c.id} style={{ border: "1px solid #e0ebe3", borderRadius: 12, background: "#fff", padding: 14 }}><div style={{ fontSize: 13, fontWeight: 800 }}>{c.title}</div><div style={{ fontSize: 11, color: "#778a7e", marginTop: 5 }}>{[c.duration, c.delivery_mode, c.start_date ? "Starts " + new Date(c.start_date).toLocaleDateString() : ""].filter(Boolean).join(" · ")}</div></div>)}
            {!loading && !courses.length && <div style={{ padding: 15, borderRadius: 12, border: "1px dashed #cbdccf", color: "#718278", fontSize: 12 }}>There are no courses currently accepting online applications. Please check back soon or contact CIU.</div>}
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e0ebe4", borderRadius: 20, padding: "clamp(20px,3vw,32px)", boxShadow: "0 16px 45px rgba(27,70,46,.07)" }}>
          {submitted ? <div style={{ textAlign: "center", padding: "32px 8px" }}><div style={{ width: 58, height: 58, margin: "0 auto 18px", borderRadius: 30, display: "grid", placeItems: "center", background: "#e7f7eb", color: "#22834d" }}><CheckCircle2 size={30}/></div><h2 style={{ fontSize: 25, fontWeight: 900, margin: "0 0 10px" }}>Thank you for applying!</h2><p style={{ fontSize: 14, color: "#65796c", lineHeight: 1.8 }}>Your short-course application has been received by Clarke International University. Our coordinator will contact you using the details you provided.</p><button onClick={() => { setSubmitted(false); setForm({ first_name: "", last_name: "", phone: "", email: "", date_of_birth: "", gender: "", nationality: "", highest_qualification: "", qualification_details: "", source: "Website", expected_outcome: "" }); setCourseId(courses.length === 1 ? courses[0].id : ""); setPaymentMethod(""); setPaymentReference(""); setProofFile(null); }} style={{ marginTop: 12, border: 0, borderRadius: 10, padding: "12px 16px", color: "#fff", background: "#00695c", fontWeight: 800, cursor: "pointer" }}>Submit another application</button></div> : <>
            <h2 style={{ fontSize: 23, fontWeight: 900, margin: "0 0 6px" }}>Apply for a short course</h2><p style={{ fontSize: 12, color: "#75867b", margin: "0 0 22px", lineHeight: 1.6 }}>Complete the form below. Fields marked * are required.</p>
            {error && <div style={{ background: "#fff1f0", border: "1px solid #fecaca", color: "#991b1b", padding: 11, borderRadius: 9, marginBottom: 13, fontSize: 12 }}>{error}</div>}
            <form onSubmit={submit} style={{ display: "grid", gap: 13 }}>
              <div><label style={labelStyle}>Short course *</label><select required value={courseId} onChange={(e) => setCourseId(e.target.value)} style={field}><option value="">{loading ? "Loading available courses…" : "Select a course"}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>{chosenCourse && <p style={{ margin: "6px 0 0", color: "#74877a", fontSize: 11 }}>{chosenCourse.description || ""}{chosenCourse.fee_amount != null ? " Fee: " + chosenCourse.currency + " " + Number(chosenCourse.fee_amount).toLocaleString() : ""}</p>}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div><label style={labelStyle}>First name *</label><input required value={form.first_name} onChange={(e) => update("first_name", e.target.value)} autoComplete="given-name" style={field}/></div><div><label style={labelStyle}>Last name *</label><input required value={form.last_name} onChange={(e) => update("last_name", e.target.value)} autoComplete="family-name" style={field}/></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div><label style={labelStyle}>Phone number *</label><input required value={form.phone} onChange={(e) => update("phone", e.target.value)} type="tel" autoComplete="tel" placeholder="+256…" style={field}/></div><div><label style={labelStyle}>Email address</label><input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" autoComplete="email" style={field}/></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div><label style={labelStyle}>Date of birth</label><input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} style={field}/></div><div><label style={labelStyle}>Gender</label><select value={form.gender} onChange={(e) => update("gender", e.target.value)} style={field}><option value="">Select</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></div></div>
              <div><label style={labelStyle}>Nationality</label><input value={form.nationality} onChange={(e) => update("nationality", e.target.value)} style={field}/></div>
              <div><label style={labelStyle}>Highest academic qualification</label><select value={form.highest_qualification} onChange={(e) => update("highest_qualification", e.target.value)} style={field}><option value="">Select qualification</option>{["O-Level","A-Level","Certificate","Diploma","Bachelors Degree","Postgraduate Diploma","Masters Degree","PhD","Other"].map((q) => <option key={q}>{q}</option>)}</select></div>
              <div><label style={labelStyle}>Qualification details / institution</label><textarea rows={2} value={form.qualification_details} onChange={(e) => update("qualification_details", e.target.value)} style={{ ...field, resize: "vertical" }}/></div>
              <div><label style={labelStyle}>What would you like to get out of this course?</label><textarea rows={3} value={form.expected_outcome} onChange={(e) => update("expected_outcome", e.target.value)} style={{ ...field, resize: "vertical" }}/></div>
              <div><label style={labelStyle}>Where did you learn about CIU?</label><select value={form.source} onChange={(e) => update("source", e.target.value)} style={field}>{["Website","Facebook","TikTok","Instagram","WhatsApp","Google","Billboard","Referral","Employer / organisation","Other"].map((s) => <option key={s}>{s}</option>)}</select></div>
              <div style={{ border: "1px solid #d8e9d9", borderRadius: 12, background: "#f5faf5", padding: 15, marginBottom: 2 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#185642", marginBottom: 8 }}>Application Fee: UGX 10,000</div>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#536b5c" }}>Make payment using either of the options below, then attach your payment proof.</p>
                <div style={{ background: "#fff", border: "1px solid #e0ebe3", borderRadius: 9, padding: 11, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 850 }}>ABSA Bank · UGX Account</div>
                  <div style={{ fontSize: 12, marginTop: 5 }}>Account Number: <strong>6000164850</strong></div>
                  <div style={{ fontSize: 12, marginTop: 3 }}>Account Name: <strong>Clarke International University</strong></div>
                </div>
                <div style={{ background: "#fff", border: "1px solid #e0ebe3", borderRadius: 9, padding: 11 }}>
                  <div style={{ fontSize: 12, fontWeight: 850 }}>MTN MoMo</div>
                  <div style={{ fontSize: 12, marginTop: 5 }}>Account Number: <strong>594845</strong></div>
                  <div style={{ fontSize: 12, marginTop: 3 }}>Account Name: <strong>Clarke International University</strong></div>
                </div>
              </div>
              <div><label style={labelStyle}>Payment method used *</label><select required value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={field}><option value="">Choose payment method</option><option value="ABSA Bank">ABSA Bank</option><option value="MTN MoMo">MTN MoMo</option></select></div>
              <div><label style={labelStyle}>Payment transaction/reference number (if available)</label><input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Enter transaction reference" style={field}/></div>
              <div><label style={labelStyle}>Attach proof of payment * (JPG, PNG, WEBP or PDF; max 5 MB)</label><input required type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] || null)} style={{ ...field, padding: 9 }}/><p style={{ margin: "5px 0 0", fontSize: 11, color: "#718278" }}>{proofFile ? "Selected: " + proofFile.name : "Upload a screenshot, photo or PDF receipt. Your payment will be marked pending verification."}</p></div>
              <button disabled={saving || loading || !courses.length} type="submit" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, border: 0, borderRadius: 11, padding: "14px 16px", color: "#fff", background: saving || !courses.length ? "#8ca99a" : "#00695c", fontWeight: 850, cursor: saving ? "wait" : "pointer" }}>{saving ? "Submitting application…" : "Submit application"} <ArrowRight size={16}/></button>
              <p style={{ margin: 0, color: "#91a097", fontSize: 10, lineHeight: 1.5, textAlign: "center" }}>By submitting, you consent to CIU contacting you about this short course.</p>
            </form>
          </>}
        </div>
      </div>
    </section>
    <footer style={{ padding: "18px", borderTop: "1px solid #e1ebe4", background: "#fff", textAlign: "center", color: "#819187", fontSize: 11 }}>Clarke International University · Lead · Innovate · Transform</footer>
  </main>;
}
