"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setLoading(false);
    if (requestError) {
      setError("We could not process the request right now. Please try again or contact your CRM administrator.");
      return;
    }
    setSubmitted(true);
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "linear-gradient(145deg,#f5faf6,#edf5ef)", fontFamily: "Inter,Arial,sans-serif", color: "#173b2b" }}>
      <section style={{ width: "100%", maxWidth: 440, background: "#fff", border: "1px solid #dce9e0", borderRadius: 20, padding: 30, boxShadow: "0 18px 55px rgba(23,59,43,.08)" }}>
        <div style={{ width: 54, height: 54, display: "grid", placeItems: "center", background: "#f0f7f2", borderRadius: 14, marginBottom: 22 }}>
          <img src="/ciu-seal-color.svg" alt="Clarke International University" style={{ width: 42, height: 42, objectFit: "contain" }} />
        </div>
        <p style={{ margin: "0 0 8px", color: "#688074", fontSize: 11, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase" }}>Secure staff access</p>
        <h1 style={{ margin: "0 0 8px", fontSize: 28, letterSpacing: "-.04em" }}>Reset your password</h1>
        {submitted ? (
          <div role="status" style={{ marginTop: 20, padding: 16, background: "#eff8f1", border: "1px solid #d2e9d8", borderRadius: 12, lineHeight: 1.6, fontSize: 14 }}>
            If an account exists for that email address, a password-reset link will be sent. Check your inbox and spam folder.
          </div>
        ) : (
          <>
            <p style={{ color: "#64756d", fontSize: 14, lineHeight: 1.6, margin: "0 0 22px" }}>Enter the email address linked to your CIU CRM account. We will send instructions to reset your password.</p>
            <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
              <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 700 }}>Email address
                <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@ciu.ac.ug" style={{ width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #ccdcd2", borderRadius: 10, fontSize: 14, color: "#173b2b" }} />
              </label>
              {error && <p role="alert" style={{ margin: 0, color: "#b42318", fontSize: 13 }}>{error}</p>}
              <button type="submit" disabled={loading} style={{ border: 0, borderRadius: 10, background: "#00695c", color: "#fff", padding: "13px 16px", fontWeight: 800, cursor: loading ? "wait" : "pointer" }}>{loading ? "Sending…" : "Send reset link"}</button>
            </form>
          </>
        )}
        <p style={{ margin: "22px 0 0", fontSize: 13 }}><Link href="/login" style={{ color: "#00695c", fontWeight: 700, textDecoration: "none" }}>← Back to sign in</Link></p>
      </section>
    </main>
  );
}
