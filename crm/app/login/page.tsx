"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        className="crm-card"
        style={{
          width: "100%",
          maxWidth: 430,
        }}
      >
        <div
          className="crm-card-body"
          style={{
            padding: 35,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              className="crm-logo-mark"
              style={{
                margin: "0 auto 15px",
              }}
            >
              CIU
            </div>

            <h1
              style={{
                margin: "0 0 7px",
                fontSize: 23,
              }}
            >
              Welcome back
            </h1>

            <p
              style={{
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              Sign in to your Business CRM
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            style={{
              display: "grid",
              gap: 15,
              marginTop: 25,
            }}
          >
            <div>
              <label
                htmlFor="email"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  marginTop: 6,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  marginTop: 6,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {errorMessage && (
              <div
                style={{
                  padding: "11px 13px",
                  borderRadius: 8,
                  background: "#fff4f4",
                  border: "1px solid #f3c7c7",
                  color: "#b42318",
                  fontSize: 12,
                }}
              >
                {errorMessage}
              </div>
            )}

            <button
              className="crm-btn"
              type="submit"
              disabled={loading}
              style={{
                padding: 13,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}