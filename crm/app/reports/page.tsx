"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ALL_CRM_MODULES, getEffectiveModules, type CrmModule } from "@/lib/permissions";

type Profile = { id: string; full_name: string | null; role: string | null; module_permissions: string[] | null };
type ReportCard = { title: string; description: string; href: string; module: CrmModule; tag: string; icon: string };

const moduleReports: ReportCard[] = [
  { title: "Lead & recruitment", description: "Lead volume, follow-ups, conversion and recruitment pipeline.", href: "/reports/modules/leads", module: "leads", tag: "Recruitment", icon: "↗" },
  { title: "Tasks & productivity", description: "Assigned work, completed activities and follow-up workload.", href: "/reports/modules/tasks", module: "tasks", tag: "Productivity", icon: "✓" },
  { title: "Salesperson contact performance", description: "Daily answered-call results, unique students reached, approved-absence adjustments and target attainment.", href: "/reports/contact-performance", module: "reports", tag: "Sales performance", icon: "☎" },
  { title: "Marketing activity", description: "Campaigns, outreach activity and marketing performance.", href: "/reports/modules/marketing", module: "marketing", tag: "Marketing", icon: "◉" },
  { title: "Strategy & intake", description: "Intake targets, planned activities, budgets and outcomes.", href: "/reports/modules/strategy", module: "strategy", tag: "Planning", icon: "◎" },
  { title: "Alumni relations", description: "Alumni profiles, verification, engagement and cohort reporting.", href: "/reports/modules/alumni", module: "alumni", tag: "Relationships", icon: "♧" },
  { title: "Partnerships", description: "Partner pipeline, active relationships and renewal follow-up.", href: "/reports/modules/partnerships", module: "partnerships", tag: "Relationships", icon: "◇" },
  { title: "Customer records", description: "Customer records and relationship activity.", href: "/reports/modules/customers", module: "customers", tag: "Records", icon: "○" },
  { title: "Admissions pipeline", description: "Admissions stages and progress through the recruitment journey.", href: "/reports/modules/pipeline", module: "pipeline", tag: "Admissions", icon: "⌁" },
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
  const allowedModules = moduleReports.filter(item => modules.includes(item.module));
  const listedReports: ReportCard[] = [...allowedModules];

  if (loading) return <main className="ciu-page" style={{ padding: 32, color: "#173d34" }}><div style={{ ...styles.panel, padding: 24 }}>Preparing your reports and access permissions…</div></main>;

  return <main className="ciu-consistent-workspace ciu-page ciu-report-centre" style={{ padding: "28px clamp(16px,3vw,34px) 48px", color: "#173d34" }}>
    <header style={{ ...styles.panel, overflow: "hidden", marginBottom: 22, background: "#ffffff", border: "1px solid #e3ebe5", borderRadius: 16, boxShadow: "0 5px 20px rgba(19,62,45,.035)" }}>
      <div style={{ padding: "24px clamp(18px,3vw,30px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 22, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 660, color: "#173d34" }}>
          <div style={{ fontSize: 10, fontWeight: 850, letterSpacing: 2, color: "#16715b" }}>CLARKE INTERNATIONAL UNIVERSITY · CRM</div>
          <h1 style={{ fontSize: "clamp(27px,3vw,36px)", lineHeight: 1.12, margin: "10px 0", fontWeight: 850, color: "#173d34" }}>Reports Centre</h1>
          <p style={{ margin: 0, maxWidth: 600, fontSize: 13, lineHeight: 1.7, color: "#718078" }}>A clear home for organisation-wide performance, your individual activity and reports from the modules you are authorised to access.</p>
        </div>
        <div style={{ background: "#f3f9f5", border: "1px solid #dfede3", color: "#145848", borderRadius: 12, padding: "15px 18px", minWidth: 170 }}>
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

    <div style={{ marginBottom: 13 }}><div style={{ color: "#16715b", fontSize: 10, letterSpacing: 1.5, fontWeight: 850 }}>REPORT CATEGORIES</div><h2 style={{ margin: "5px 0 4px", fontSize: 21, fontWeight: 850 }}>Reports by work area</h2><p style={{ margin: 0, fontSize: 12, color: "#718078" }}>Open a report area you have been granted access to. Areas without permission are not listed.</p></div>
    {listedReports.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,245px),1fr))", gap: 13 }}>
      {listedReports.map(item => <Link key={item.href} href={item.href} style={{ ...styles.panel, display: "flex", flexDirection: "column", minHeight: 176, padding: 18, textDecoration: "none", color: "#173d34", transition: "transform .15s ease,border-color .15s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, background: "#e8f5ec", color: "#12614d", fontSize: 20, fontWeight: 850 }}>{item.icon}</span><span style={{ fontSize: 9, fontWeight: 850, color: "#7d8b83", letterSpacing: 1 }}>{item.tag.toUpperCase()}</span></div>
        <h3 style={{ margin: "14px 0 6px", fontSize: 15, fontWeight: 850 }}>{item.title}</h3><p style={{ margin: 0, color: "#718078", fontSize: 11, lineHeight: 1.65 }}>{item.description}</p><span style={{ marginTop: "auto", paddingTop: 14, color: "#106053", fontSize: 11, fontWeight: 850 }}>Open report <span aria-hidden="true">→</span></span>
      </Link>)}
    </div> : <div style={{ ...styles.panel, padding: 22, color: "#718078", fontSize: 13 }}>No module report links are available for your current permissions. Contact your CRM administrator if you need access.</div>}

    <footer style={{ marginTop: 20, padding: "13px 15px", borderRadius: 10, background: "#f4f8f5", color: "#728177", fontSize: 10, lineHeight: 1.7 }}>Access note: this page uses your signed-in profile role and module permissions to decide which report areas to display. Data access must also be enforced by the corresponding module permissions and database policies.</footer>
    <style jsx>{`
      .ciu-report-centre { font-family: inherit; color: var(--ciu-ink, #17322c); }
      .ciu-report-centre header { border-radius: 16px !important; box-shadow: 0 5px 20px rgba(19,62,45,.035) !important; }
      .ciu-report-centre a { font-family: inherit; }
      .ciu-report-centre a:focus-visible { outline: 3px solid #8bc63f; outline-offset: 3px; }
      @media (max-width: 700px) {
      }
    `}</style>
  </main>;
}
