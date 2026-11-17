"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

function RegistrationForm() {
  const params = useSearchParams();
  const schoolId = params.get("school_id") || "";
  const schoolName = params.get("school_name") || "your school";
  const [form, setForm] = useState({ student_name: "", contact: "", email: "", program: "" });
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function update(key: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (website) { setSubmitted(true); return; }
    if (!schoolId) { setError("This registration link is incomplete. Please ask the CIU outreach representative for a new link."); return; }
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from("school_student_contacts").insert({
        school_id: schoolId,
        student_name: form.student_name.trim(),
        contact: form.contact.trim(),
        email: form.email.trim() || null,
        program: form.program.trim(),
        created_by: null,
      });
      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not submit your details. Please try again or tell the outreach representative.");
    } finally {
      setSaving(false);
    }
  }

  const input = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";
  if (submitted) return <main className="flex min-h-screen items-center justify-center bg-emerald-50 px-4 py-10"><section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-sm"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl font-bold text-emerald-800">✓</div><h1 className="text-2xl font-bold text-slate-900">Thank you!</h1><p className="mt-3 text-sm leading-6 text-slate-600">Your details have been submitted to Clarke International University. Our team may contact you about your programme of interest.</p></section></main>;

  return <main className="min-h-screen bg-slate-50 px-3 py-6 sm:px-5 sm:py-10">
    <div className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-emerald-800 px-5 py-7 text-white sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Clarke International University</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">Student Interest Form</h1><p className="mt-2 text-sm leading-6 text-emerald-50">Complete this short form to tell us which programme you are interested in. It works on your phone and takes about a minute.</p><p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">{schoolName}</p></div>
      <form onSubmit={submit} className="space-y-5 p-5 sm:p-8">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="block text-sm font-semibold text-slate-700">Full name *<input required maxLength={180} autoComplete="name" className={input} value={form.student_name} onChange={e => update("student_name", e.target.value)} placeholder="Enter your full name" /></label>
        <label className="block text-sm font-semibold text-slate-700">Phone / WhatsApp number *<input required type="tel" inputMode="tel" autoComplete="tel" minLength={5} maxLength={40} className={input} value={form.contact} onChange={e => update("contact", e.target.value)} placeholder="+256…" /></label>
        <label className="block text-sm font-semibold text-slate-700">Email address <span className="font-normal text-slate-400">(optional)</span><input type="email" maxLength={254} autoComplete="email" className={input} value={form.email} onChange={e => update("email", e.target.value)} placeholder="you@example.com" /></label>
        <label className="block text-sm font-semibold text-slate-700">Programme you are interested in *<input required maxLength={180} className={input} value={form.program} onChange={e => update("program", e.target.value)} placeholder="e.g. Bachelor of Nursing Science" /></label>
        <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"><label>Leave this field empty<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label></div>
        <button disabled={saving || !schoolId} className="w-full rounded-xl bg-emerald-800 px-5 py-4 text-base font-bold text-white shadow-sm hover:bg-emerald-900 disabled:opacity-60">{saving ? "Submitting…" : "Submit my details"}</button>
        <p className="text-center text-xs leading-5 text-slate-500">By submitting, you agree that the CIU outreach and admissions team may contact you about your programme interest.</p>
      </form>
    </div>
  </main>;
}

export default function SchoolStudentRegistrationPage() {
  return <Suspense fallback={<main className="p-8 text-center text-slate-600">Loading student form…</main>}><RegistrationForm /></Suspense>;
}
