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
        if (settings.preferences?.primaryColor) {
          setPrimaryColor(settings.preferences.primaryColor.toLowerCase() === "#00695c" ? "#65a30d" : settings.preferences.primaryColor);
        }
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
    <main className="ciu-login-page" style={{ "--login-green": primaryColor } as React.CSSProperties}>
      <style jsx>{`
        .ciu-login-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(360px, 0.92fr) minmax(440px, 1.08fr);
          background: #fff;
          color: #172b22;
          font-family: Inter, Arial, sans-serif;
        }
        .ciu-login-brand-panel {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: clamp(34px, 5vw, 72px);
          color: white;
          background: linear-gradient(145deg, #183d27 0%, #315d1b 52%, #4d7c0f 100%);
        }
        .ciu-login-brand-panel:before,
        .ciu-login-brand-panel:after {
          content: "";
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
        }
        .ciu-login-brand-panel:before {
          width: 430px; height: 430px; right: -180px; top: 12%;
          border: 1px solid rgba(255,255,255,.13);
          box-shadow: 0 0 0 42px rgba(255,255,255,.035), 0 0 0 88px rgba(255,255,255,.025);
        }
        .ciu-login-brand-panel:after {
          width: 260px; height: 260px; left: -140px; bottom: -100px;
          background: rgba(190,242,100,.10);
        }
        .ciu-login-brand-content, .ciu-login-brand-footer, .ciu-login-brand-top {
          position: relative; z-index: 1;
        }
        .ciu-login-brand-top {
          display: flex; align-items: center; gap: 14px;
        }
        .ciu-login-logo {
          width: 58px; height: 58px; flex: 0 0 58px;
          display: grid; place-items: center; overflow: hidden;
          border-radius: 16px; background: white; color: #365314;
          border: 1px solid rgba(255,255,255,.6);
          font-size: 19px; font-weight: 900; letter-spacing: -.06em;
        }
        .ciu-login-logo img { width: 100%; height: 100%; object-fit: contain; padding: 5px; }
        .ciu-login-university { font-size: 15px; font-weight: 800; line-height: 1.35; }
        .ciu-login-university span { display: block; margin-top: 3px; font-size: 11px; font-weight: 500; color: rgba(255,255,255,.7); }
        .ciu-login-brand-content { max-width: 540px; margin: auto 0; padding: 65px 0; }
        .ciu-login-eyebrow {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 8px 12px; border-radius: 999px;
          border: 1px solid rgba(217,249,157,.25);
          background: rgba(255,255,255,.07); color: #e4f8c0;
          font-size: 11px; font-weight: 800; letter-spacing: .11em; text-transform: uppercase;
        }
        .ciu-login-eyebrow:before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #bef264; }
        .ciu-login-brand-content h1 {
          max-width: 500px; margin: 25px 0 18px;
          font-size: clamp(34px, 4vw, 54px); line-height: 1.08;
          letter-spacing: -.045em; font-weight: 800;
        }
        .ciu-login-brand-content h1 em { color: #bef264; font-style: normal; }
        .ciu-login-brand-content p { max-width: 420px; margin: 0; color: rgba(255,255,255,.76); font-size: 15px; line-height: 1.8; }
        .ciu-login-points { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 32px; }
        .ciu-login-points span {
          padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.10); color: rgba(255,255,255,.9); font-size: 12px;
        }
        .ciu-login-brand-footer { color: rgba(255,255,255,.58); font-size: 11px; }
        .ciu-login-form-side {
          display: flex; align-items: center; justify-content: center;
          padding: clamp(26px, 5vw, 76px); background:
            radial-gradient(circle at 100% 0%, #f3f9e9 0, transparent 34%), #fff;
        }
        .ciu-login-form-wrap { width: 100%; max-width: 450px; }
        .ciu-login-mobile-brand { display: none; }
        .ciu-login-heading { margin-bottom: 34px; }
        .ciu-login-heading .overline { color: var(--login-green); font-size: 11px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
        .ciu-login-heading h2 { margin: 13px 0 9px; color: #172b22; font-size: clamp(29px, 3vw, 37px); line-height: 1.15; letter-spacing: -.04em; font-weight: 850; }
        .ciu-login-heading p { margin: 0; color: #748078; font-size: 14px; line-height: 1.65; }
        .ciu-login-field { margin-bottom: 21px; }
        .ciu-login-field label { display: block; margin-bottom: 9px; color: #35473b; font-size: 12px; font-weight: 800; }
        .ciu-login-field input {
          width: 100%; min-height: 52px; box-sizing: border-box; padding: 14px 15px;
          border: 1px solid #dce6df; border-radius: 11px; outline: none;
          background: rgba(255,255,255,.92); color: #172b22; font-size: 14px;
          transition: border-color .15s, box-shadow .15s;
        }
        .ciu-login-field input::placeholder { color: #a1aaa4; }
        .ciu-login-field input:focus { border-color: var(--login-green); box-shadow: 0 0 0 4px color-mix(in srgb, var(--login-green) 13%, transparent); }
        .ciu-login-submit {
          width: 100%; min-height: 53px; display: flex; align-items: center; justify-content: center; gap: 10px;
          margin-top: 8px; padding: 14px 18px; border: 0; border-radius: 11px;
          background: var(--login-green); color: white; font-size: 14px; font-weight: 850;
          box-shadow: 0 8px 18px color-mix(in srgb, var(--login-green) 22%, transparent);
          transition: transform .15s, filter .15s;
        }
        .ciu-login-submit:hover { filter: brightness(.94); transform: translateY(-1px); }
        .ciu-login-submit:disabled { cursor: wait; opacity: .7; transform: none; }
        .ciu-login-error { margin: 0 0 18px; padding: 12px 13px; border: 1px solid #fecaca; border-radius: 10px; background: #fff1f2; color: #b42318; font-size: 12px; line-height: 1.5; }
        .ciu-login-security { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 23px; color: #7c8981; font-size: 11px; }
        .ciu-login-security:before { content: "✓"; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: #edf7e3; color: #4d7c0f; font-weight: 900; }
        .ciu-login-divider { height: 1px; margin: 28px 0 19px; background: #edf1ee; }
        .ciu-login-bottom { text-align: center; color: #8a958e; font-size: 11px; line-height: 1.7; }
        @media (max-width: 850px) {
          .ciu-login-page { grid-template-columns: 1fr; }
          .ciu-login-brand-panel { display: none; }
          .ciu-login-form-side { min-height: 100vh; padding: 30px 22px; }
          .ciu-login-form-wrap { max-width: 460px; }
          .ciu-login-mobile-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 42px; }
          .ciu-login-mobile-brand .ciu-login-logo { border-color: #e4ebe6; box-shadow: 0 4px 15px rgba(23,50,44,.06); }
          .ciu-login-mobile-brand .ciu-login-university { color: #173b2b; }
          .ciu-login-mobile-brand .ciu-login-university span { color: #77857d; }
        }
        @media (max-width: 420px) {
          .ciu-login-form-side { padding: 24px 18px; }
          .ciu-login-heading { margin-bottom: 27px; }
          .ciu-login-mobile-brand { margin-bottom: 34px; }
          .ciu-login-heading h2 { font-size: 30px; }
        }
      `}</style>

      <section className="ciu-login-brand-panel" aria-label="Clarke International University">
        <div className="ciu-login-brand-top">
          <div className="ciu-login-logo">
            {logo ? <img src={logo} alt="Clarke International University logo" /> : "CIU"}
          </div>
          <div className="ciu-login-university">Clarke International University<span>Business & Admissions CRM</span></div>
        </div>
        <div className="ciu-login-brand-content">
          <div className="ciu-login-eyebrow">One connected workspace</div>
          <h1>Great work starts with <em>the right connection.</em></h1>
          <p>Manage leads, admissions, follow-ups and relationships across CIU from one secure workspace.</p>
          <div className="ciu-login-points">
            <span>Lead management</span>
            <span>Admissions follow-up</span>
            <span>Team collaboration</span>
          </div>
        </div>
        <div className="ciu-login-brand-footer">Clarke International University · Secure staff access</div>
      </section>

      <section className="ciu-login-form-side">
        <div className="ciu-login-form-wrap">
          <div className="ciu-login-mobile-brand">
            <div className="ciu-login-logo">
              {logo ? <img src={logo} alt="Clarke International University logo" /> : "CIU"}
            </div>
            <div className="ciu-login-university">Clarke International University<span>Business & Admissions CRM</span></div>
          </div>
          <div className="ciu-login-heading">
            <div className="overline">Staff portal</div>
            <h2>Welcome back</h2>
            <p>Sign in to continue to <strong>{crmName}</strong>.</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="ciu-login-field">
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" autoComplete="username" placeholder="you@ciu.ac.ug" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="ciu-login-field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            {errorMessage && <div role="alert" className="ciu-login-error">{errorMessage}</div>}
            <button type="submit" disabled={loading} className="ciu-login-submit">
              {loading ? "Signing you in..." : "Sign in securely"}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="ciu-login-security">Your account is protected by secure sign-in</div>
          <div className="ciu-login-divider" />
          <div className="ciu-login-bottom">Need access? Contact your CRM administrator.<br />© {new Date().getFullYear()} Clarke International University</div>
        </div>
      </section>
    </main>
  );
}
