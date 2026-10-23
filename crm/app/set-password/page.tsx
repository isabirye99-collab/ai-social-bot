"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function checkInvitation() {
      const { data, error: authError } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !data.user) {
        setError(
          "Your session is missing or has expired. Return to the login page and sign in with your temporary credentials, or contact your CRM administrator."
        );
      } else {
        setUserEmail(data.user.email || "");
      }

      setChecking(false);
    }

    void checkInvitation();

    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 10) {
      setError("Choose a password with at least 10 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      const response = await fetch(
        "/api/auth/complete-password-change",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          result.error ||
            "Your password was saved, but account setup could not be completed. Please try again or contact your administrator."
        );
        return;
      }

      setSuccess("Password saved successfully. Opening your CRM…");

      window.setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 800);
    } catch {
      setError(
        "We could not complete account setup. Please check your connection and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f5f8f6",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#fff",
          border: "1px solid #e1e9e4",
          borderRadius: 16,
          padding: 30,
          boxShadow: "0 18px 55px rgba(20,54,39,.08)",
        }}
      >
        <div
          style={{
            height: 5,
            borderRadius: 5,
            background: "#00695c",
            marginBottom: 24,
          }}
        />

        <h1 style={{ margin: "0 0 8px", color: "#17211b", fontSize: 24 }}>
          Set your password
        </h1>

        <p
          style={{
            color: "#64748b",
            fontSize: 14,
            lineHeight: 1.6,
            marginTop: 0,
          }}
        >
          Your account requires a new password before you can access the CIU CRM. Choose a private password that you will remember.
        </p>

        {checking ? (
          <p>Checking your session…</p>
        ) : !userEmail ? (
          <div
            role="alert"
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#fff1f2",
              color: "#b42318",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "grid", gap: 15 }}
          >
            <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
              Account: <strong>{userEmail}</strong>
            </p>

            <label
              style={{
                display: "grid",
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
                color: "#34443b",
              }}
            >
              New password
              <input
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{
                  boxSizing: "border-box",
                  width: "100%",
                  padding: 12,
                  border: "1px solid #cbd5e1",
                  borderRadius: 9,
                }}
              />
            </label>

            <label
              style={{
                display: "grid",
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
                color: "#34443b",
              }}
            >
              Confirm new password
              <input
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                style={{
                  boxSizing: "border-box",
                  width: "100%",
                  padding: 12,
                  border: "1px solid #cbd5e1",
                  borderRadius: 9,
                }}
              />
            </label>

            {error && (
              <div
                role="alert"
                style={{
                  padding: 11,
                  borderRadius: 8,
                  background: "#fff1f2",
                  color: "#b42318",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {success && (
              <div
                role="status"
                style={{
                  padding: 11,
                  borderRadius: 8,
                  background: "#ecfdf3",
                  color: "#067647",
                  fontSize: 13,
                }}
              >
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                border: 0,
                borderRadius: 9,
                padding: 13,
                background: "#00695c",
                color: "white",
                fontWeight: 800,
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Saving password…" : "Save password and continue"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}