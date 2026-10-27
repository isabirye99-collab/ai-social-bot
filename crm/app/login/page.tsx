"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SavedSettings = {
  logo_data_url?: string | null;
  preferences?: { crmName?: string; primaryColor?: string } | null;
};

export default function Login() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState("");
  const [crmName, setCrmName] = useState("CIU Business CRM");
  const [primaryColor, setPrimaryColor] = useState("#65a30d");

  useEffect(() => {
    let active = true;
    async function loadBranding() {
      try {
        const localLogo = window.localStorage.getItem("ciu_crm_logo");
        const localName = window.localStorage.getItem("ciu_crm_name");
        if (active && localLogo) setLogo(localLogo);
        if (active && localName?.trim()) setCrmName(localName.trim());
        const { data, error } = await supabase
          .from("crm_settings")
          .select("logo_data_url, preferences")
          .eq("id", 1)
          .maybeSingle();
        if (error || !data || !active) return;
        const settings = data as SavedSettings;
        if (settings.logo_data_url) {
          setLogo(settings.logo_data_url);
          window.localStorage.setItem("ciu_crm_logo", settings.logo_data_url);
        }
        if (settings.preferences?.crmName?.trim()) {
          const name = settings.preferences.crmName.trim();
          setCrmName(name);
          window.localStorage.setItem("ciu_crm_name", name);
        }
        if (settings.preferences?.primaryColor) setPrimaryColor(settings.preferences.primaryColor);
      } catch {
        // Branding is optional; keep login available if settings cannot be loaded.
      }
    }
    void loadBranding();
    return () => { active = false; };
  }, [supabase]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }
    router.replace("/set-password");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "calc(100vh - 24px)", display: "grid", placeItems: "center", padding: 20, background: "#f5f8f6" }}>
      <div className="crm-card" style={{ width: "100%", maxWidth: 430, overflow: "hidden", border: "1px solid #e1e9e4", boxShadow: "0 18px 55px rgba(20,54,39,.09)" }}>
        <div style={{ height: 5, background: primaryColor }} />
        <div className="crm-card-body" style={{ padding: 35 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ margin: "0 auto 16px", width: 76, height: 76, display: "grid", placeItems: "center", overflow: "hidden", borderRadius: 18, border: "1px solid #e4ebe6", background: "#fff", color: primaryColor, fontWeight: 900, fontSize: 22 }}>
              {logo ? <img src={logo} alt="CRM logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 5 }} /> : "CIU"}
            </div>
            <h1 style={{ margin: "0 0 7px", fontSize: 24, fontWeight: 800, color: "#17211b" }}>Welcome back</h1>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7b72" }}>Sign in to {crmName}</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: "grid", gap: 15, marginTop: 28 }}>
            <div>
              <label htmlFor="email" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#34443b" }}>Email address</label>
              <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} style={{ boxSizing: "border-box", width: "100%", padding: 12, marginTop: 7, border: "1px solid #dce5df", borderRadius: 10, background: "#fff", color: "#17211b" }} />
            </div>
            <div>
              <label htmlFor="password" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#34443b" }}>Password</label>
              <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} style={{ boxSizing: "border-box", width: "100%", padding: 12, marginTop: 7, border: "1px solid #dce5df", borderRadius: 10, background: "#fff", color: "#17211b" }} />
            </div>
            {errorMessage && <div role="alert" style={{ padding: 11, borderRadius: 9, border: "1px solid #fecaca", background: "#fff1f2", color: "#b42318", fontSize: 12 }}>{errorMessage}</div>}
            <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 4, padding: "13px 16px", border: 0, borderRadius: 10, background: primaryColor, color: "#fff", fontSize: 13, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <p style={{ margin: "22px 0 0", textAlign: "center", fontSize: 11, color: "#87948d" }}>Clarke International University</p>
        </div>
      </div>
    </div>
  );
}
