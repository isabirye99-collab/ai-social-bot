"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VerifyCodePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedToken = token.trim().replace(/\s/g, "");

    if (!normalizedEmail || !normalizedToken) {
      setError("Enter your email address and verification code.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedToken,
        type: "email",
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      setMessage("Email verified. Redirecting you to set your new password...");

      router.replace("/set-password");
      router.refresh();
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f4f7f6",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 440,
          padding: 32,
          borderRadius: 16,
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 12px 35px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h1 style={{ margin: "0 0 8px", color: "#173b32", fontSize: 26 }}>
          Verify your email
        </h1>

        <p style={{ margin: "0 0 24px", color: "#64748b", lineHeight: 1.6 }}>
          Enter the email address used for your CRM account and the one-time
          verification code sent to your inbox.
        </p>

        <form onSubmit={handleVerify} style={{ display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 7, fontWeight: 600, fontSize: 13 }}>
            Email address
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                border: "1px solid #cbd5e1",
                borderRadius: 8,
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 7, fontWeight: 600, fontSize: 13 }}>
            Verification code
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Enter the code from your email"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                letterSpacing: 2,
              }}
            />
          </label>

          {error && (
            <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>
              {error}
            </p>
          )}

          {message && (
            <p role="status" style={{ margin: 0, color: "#166534", fontSize: 13 }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: 12,
              border: 0,
              borderRadius: 8,
              background: loading ? "#94a3b8" : "#176b52",
              color: "#ffffff",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Verifying..." : "Verify email"}
          </button>
        </form>

        <p style={{ margin: "20px 0 0", fontSize: 12, color: "#64748b" }}>
          If you cannot find the code, check your spam folder or contact your
          CRM administrator.
        </p>
      </section>
    </main>
  );
}