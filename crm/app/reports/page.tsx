"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ALL_CRM_MODULES, getEffectiveModules, type CrmModule } from "@/lib/permissions";

type Profile = { id: string; full_name: string | null; role: string | null; module_permissions: string[] | null };
type ReportCard = { title: string; description: string; href: string; module: CrmModule; tag: string; icon: string };

const moduleReports: ReportCard[] = [
  { title: "Lead & recruitment", description: "Lead volume, follow-ups, conversion and recruitment pipeline.", href: "/leads", module: "leads", tag: "Recruitment", icon: "↗" },
  { title: "Tasks & productivity", description: "Assigned work, completed activities and follow-up workload.", href: "/tasks", module: "tasks", tag: "Productivity", icon: "✓" },
  { title: "Marketing activity", description: "Campaigns, outreach activity and marketing performance.", href: "/marketing", module: "marketing", tag: "Marketing", icon: "◉" },
  { title: "Strategy & intake", description: "Intake targets, planned activities, budgets and outcomes.", href: "/strategy", module: "strategy", tag: "Planning", icon: "◎" },
  { title: "Alumni relations", description: "Alumni profiles, verification, engagement and cohort reporting.", href: "/alumni/reports", module: "alumni", tag: "Relationships", icon: "♧" },
  { title: "Partnerships", description: "Partner pipeline, active relationships and renewal follow-up.", href: "/partnerships", module: "partnerships", tag: "Relationships", icon: "◇" },
  { title: "Customer records", description: "Customer records and relationship activity.", href: "/customers", module: "customers", tag: "Records", icon: "○" },
  { title: "Admissions pipeline", description: "Admissions stages and progress through the recruitment journey.", href: "/pipeline", module: "pipeline", tag: "Admissions", icon: "⌁" },
];

const styles: Record<string, React.CSSProperties> = {
  panel: { background: "#fff", border: "1px solid #e3ebe5", borderRadius: 16, boxShadow: "0 5px 20px rgba(19,62,45,.035)" },
  button: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 9, padding: "10px 14px", background: "#106053", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 800 },
};

export default function ReportsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) { router.replace("/login"); return; }
        const { data, error: profileError } = await supabase.from("profiles").select("id,full_name,role,module_permissions").eq("id", user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!data) { router.replace("/dashboard"); return; }
        if (active) setProfile(data as Profile);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Unable to load your reporting permissions.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProfile();
    return () => { active = false; };
  }, [router, supabase]);

  const role = String(profile?.role || "").trim().toLowerCase().replace(/[ -]/g, "_");
  const modules = useMemo(() => {
    const effective = getEffectiveModules(role, profile?.module_permissions);
    if (effective.length || ["super_admin", "admin", "manager", "salesperson", "marketing", "finance", "viewer"].includes(role)) return effective;
    return (profile?.module_permissions || []).filter((module): module is CrmModule => ALL_CRM_MODULES.includes(module as CrmModule));
  }, [role, profile?.module_permissions]);
  const canViewTeam = ["super_admin", "admin", "manager"].includes(role);
  const canViewReports = modules.includes("reports");
  const allowedModules = moduleReports.filter(item => modules.includes(item.module));

  if (loading) return <main className="ciu-page" style={{ padding: 32, color: "#173d34" }}><div style={{ ...styles.panel, padding: 24 }}>Preparing your reports and access permissions…</div></main>;

  return <main className="ciu-page ciu-report-centre" style={{ padding: "28px clamp(16px,3vw,34px) 48px", color: "#173d34" }}>
    <header style={{ ...styles.panel, overflow: "hidden", marginBottom: 22, background: "linear-gradient(115deg,#0d5145 0%,#176f5b 60%,#d9f0e1 60%,#f3faf5 100%)", border: 0 }}>
      <div style={{ padding: "28px clamp(18px,3vw,34px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 22, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 660, color: "#fff" }}>
          <div style={{ fontSize: 10, fontWeight: 850, letterSpacing: 2, opacity: .82 }}>CLARKE INTERNATIONAL UNIVERSITY · CRM</div>
          <h1 style={{ fontSize: "clamp(27px,3vw,36px)", lineHeight: 1.12, margin: "10px 0", fontWeight: 850 }}>Reports Centre</h1>
          <p style={{ margin: 0, maxWidth: 600, fontSize: 13, lineHeight: 1.7, color: "#e2f3e9" }}>A clear home for organisation-wide performance, your individual activity and reports from the modules you are authorised to access.</p>
        </div>
        <div style={{ background: "rgba(255,255,255,.88)", color: "#145848", borderRadius: 14, padding: "15px 18px", minWidth: 170 }}>
          <div style={{ fontSize: 10, fontWeight: 850, letterSpacing: 1 }}>SIGNED IN AS</div>
          <div style={{ fontSize: 16, fontWeight: 850, marginTop: 6 }}>{profile?.full_name || "CRM user"}</div>
          <div style={{ fontSize: 11, marginTop: 4, textTransform: "capitalize" }}>{role.replaceAll("_", " ") || "Staff"}</div>
          <div style={{ fontSize: 10, marginTop: 9, color: "#527267" }}>{modules.length} module permissions active</div>
        </div>
      </div>
    </header>

    {error && <div role="alert" style={{ ...styles.panel, padding: 16, marginBottom: 18, borderColor: "#f1c9c9", color: "#9d2929" }}>{error}</div>}

    <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 13 }}>
      <div><div style={{ color: "#16715b", fontSize: 10, letterSpacing: 1.5, fontWeight: 850 }}>REPORTING WORKSPACE</div><h2 style={{ margin: "5px 0 0", fontSize: 21, fontWeight: 850 }}>Choose a report category</h2></div>
      <div style={{ fontSize: 11, color: "#73837a" }}>Reports shown here follow your assigned CRM permissions.</div>
    </div>

    <section aria-label="General reports" style={{ ...styles.panel, padding: "20px clamp(16px,2.5vw,26px)", marginBottom: 18, display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(220px,.6fr)", gap: 20, alignItems: "center" }}>
      <div>
        <div style={{ display: "inline-flex", alignItems: "center", borderRadius: 20, padding: "5px 9px", background: "#e6f5eb", color: "#176849", fontSize: 10, fontWeight: 850, letterSpacing: .7 }}>01 · GENERAL REPORTS</div>
        <h3 style={{ margin: "12px 0 6px", fontSize: 19, fontWeight: 850 }}>Organisation & team performance</h3>
        <p style={{ margin: 0, maxWidth: 620, color: "#718078", fontSize: 12, lineHeight: 1.75 }}>Review recruitment activity, admissions progress, team output, intake performance, alumni relations and partnerships in one consolidated report.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>{["Daily", "Weekly", "Monthly", "Intake view"].map(x => <span key={x} style={{ border: "1px solid #e2ebe5", background: "#fafcfb", color: "#51685d", borderRadius: 7, padding: "6px 9px", fontSize: 10, fontWeight: 750 }}>{x}</span>)}</div>
      </div>
      <div style={{ background: "#f3f9f5", border: "1px solid #dfede3", borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 12, color: "#60766a", lineHeight: 1.6 }}>{canViewTeam ? "Your role allows access to team-level reporting." : "Organisation-wide reporting is restricted to authorised management roles."}</div>
        {canViewTeam && canViewReports ? <Link href="/reports/performance" style={{ ...styles.button, marginTop: 14 }}>Open general report <span aria-hidden="true">→</span></Link> : <div style={{ marginTop: 13, fontSize: 11, fontWeight: 800, color: "#7a8981" }}>Management permission required</div>}
      </div>
    </section>

    <section aria-label="Individual reports" style={{ ...styles.panel, padding: "20px clamp(16px,2.5vw,26px)", marginBottom: 22, display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(220px,.6fr)", gap: 20, alignItems: "center" }}>
      <div>
        <div style={{ display: "inline-flex", alignItems: "center", borderRadius: 20, padding: "5px 9px", background: "#e9f0fb", color: "#315a8b", fontSize: 10, fontWeight: 850, letterSpacing: .7 }}>02 · INDIVIDUAL REPORTS</div>
        <h3 style={{ margin: "12px 0 6px", fontSize: 19, fontWeight: 850 }}>My activity & results</h3>
        <p style={{ margin: 0, maxWidth: 620, color: "#718078", fontSize: 12, lineHeight: 1.75 }}>A personal view of assigned leads, calls and follow-ups, admissions outcomes, tasks completed and your activity for the selected day, week or month. Managers can also review eligible staff reports.</p>
      </div>
      <div style={{ background: "#f5f8fd", border: "1px solid #e0e8f5", borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 12, color: "#60718a", lineHeight: 1.6 }}>{canViewTeam ? "Your report includes team performance and individual staff breakdowns." : "Your report is limited to your own activity and records available to your account."}</div>
        {canViewReports ? <Link href="/reports/performance?view=individual" style={{ ...styles.button, marginTop: 14, background: "#315a8b" }}>Open individual report <span aria-hidden="true">→</span></Link> : <div style={{ marginTop: 13, fontSize: 11, fontWeight: 800, color: "#7a8981" }}>Reports permission required</div>}
      </div>
    </section>

    <div style={{ marginBottom: 13 }}><div style={{ color: "#16715b", fontSize: 10, letterSpacing: 1.5, fontWeight: 850 }}>03 · MODULE REPORTS</div><h2 style={{ margin: "5px 0 4px", fontSize: 21, fontWeight: 850 }}>Reports by work area</h2><p style={{ margin: 0, fontSize: 12, color: "#718078" }}>Open a module you have been granted access to. Modules without permission are not listed.</p></div>
    {allowedModules.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,245px),1fr))", gap: 13 }}>
      {allowedModules.map(item => <Link key={item.module} href={item.href} style={{ ...styles.panel, display: "flex", flexDirection: "column", minHeight: 176, padding: 18, textDecoration: "none", color: "#173d34", transition: "transform .15s ease,border-color .15s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, background: "#e8f5ec", color: "#12614d", fontSize: 20, fontWeight: 850 }}>{item.icon}</span><span style={{ fontSize: 9, fontWeight: 850, color: "#7d8b83", letterSpacing: 1 }}>{item.tag.toUpperCase()}</span></div>
        <h3 style={{ margin: "14px 0 6px", fontSize: 15, fontWeight: 850 }}>{item.title}</h3><p style={{ margin: 0, color: "#718078", fontSize: 11, lineHeight: 1.65 }}>{item.description}</p><span style={{ marginTop: "auto", paddingTop: 14, color: "#106053", fontSize: 11, fontWeight: 850 }}>Open module <span aria-hidden="true">→</span></span>
      </Link>)}
    </div> : <div style={{ ...styles.panel, padding: 22, color: "#718078", fontSize: 13 }}>No module report links are available for your current permissions. Contact your CRM administrator if you need access.</div>}

    <footer style={{ marginTop: 20, padding: "13px 15px", borderRadius: 10, background: "#f4f8f5", color: "#728177", fontSize: 10, lineHeight: 1.7 }}>Access note: this page uses your signed-in profile role and module permissions to decide which report areas to display. Data access must also be enforced by the corresponding module permissions and database policies.</footer>
    <style jsx>{`@media (max-width: 700px) { section[aria-label="General reports"], section[aria-label="Individual reports"] { grid-template-columns: 1fr !important; } }`}</style>
  </main>;
}
