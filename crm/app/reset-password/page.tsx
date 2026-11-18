"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function verifyRecoverySession() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError || !data.session) {
        setError("This reset link is invalid or has expired. Request a new password-reset link.");
        setReady(false);
        return;
      }
      setReady(true);
    }
    void verifyRecoverySession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        setReady(true);
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [supabase]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 10) {
      setError("Use at least 10 characters for your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError("The password could not be updated. Your reset link may have expired; request a new one and try again.");
      return;
    }
    setDone(true);
    await supabase.auth.signOut();
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "linear-gradient(145deg,#f5faf6,#edf5ef)", fontFamily: "Inter,Arial,sans-serif", color: "#173b2b" }}>
      <section style={{ width: "100%", maxWidth: 440, background: "#fff", border: "1px solid #dce9e0", borderRadius: 20, padding: 30, boxShadow: "0 18px 55px rgba(23,59,43,.08)" }}>
        <div style={{ width: 54, height: 54, display: "grid", placeItems: "center", background: "#f0f7f2", borderRadius: 14, marginBottom: 22 }}>
          <img src="/ciu-seal-color.svg" alt="Clarke International University" style={{ width: 42, height: 42, objectFit: "contain" }} />
        </div>
        <p style={{ margin: "0 0 8px", color: "#688074", fontSize: 11, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase" }}>Secure staff access</p>
        <h1 style={{ margin: "0 0 8px", fontSize: 28, letterSpacing: "-.04em" }}>Choose a new password</h1>
        {done ? (
          <div role="status" style={{ marginTop: 20, padding: 16, background: "#eff8f1", border: "1px solid #d2e9d8", borderRadius: 12, lineHeight: 1.6, fontSize: 14 }}>
            Your password has been updated. Please sign in with your new password.
            <p style={{ marginBottom: 0 }}><Link href="/login" style={{ color: "#00695c", fontWeight: 800 }}>Go to sign in</Link></p>
          </div>
        ) : !ready ? (
          <div role="alert" style={{ marginTop: 20, padding: 16, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, lineHeight: 1.6, fontSize: 14 }}>{error || "Checking your secure reset link…" }{error && <p style={{ marginBottom: 0 }}><Link href="/forgot-password" style={{ color: "#00695c", fontWeight: 800 }}>Request another link</Link></p>}</div>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 20 }}>
            <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 700 }}>New password
              <input required minLength={10} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" style={{ width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #ccdcd2", borderRadius: 10, fontSize: 14, color: "#173b2b" }} />
            </label>
            <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 700 }}>Confirm new password
              <input required minLength={10} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter the password again" style={{ width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #ccdcd2", borderRadius: 10, fontSize: 14, color: "#173b2b" }} />
            </label>
            {error && <p role="alert" style={{ margin: 0, color: "#b42318", fontSize: 13 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ border: 0, borderRadius: 10, background: "#00695c", color: "#fff", padding: "13px 16px", fontWeight: 800, cursor: loading ? "wait" : "pointer" }}>{loading ? "Updating…" : "Update password"}</button>
          </form>
        )}
        <p style={{ margin: "22px 0 0", fontSize: 13 }}><Link href="/login" style={{ color: "#00695c", fontWeight: 700, textDecoration: "none" }}>← Back to sign in</Link></p>
      </section>
    </main>
  );
}
