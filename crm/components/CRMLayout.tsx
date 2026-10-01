"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
const nav = [
  ["🏠", "Dashboard", "/dashboard"],
  ["👥", "Leads", "/leads"],
  ["🏢", "Customers", "/customers"],
  ["💼", "Pipeline", "/pipeline"],
  ["✓", "Tasks", "/tasks"],
  ["📢", "Marketing", "/marketing"],
  ["📊", "Reports", "/reports"],
  ["👨‍💼", "Staff", "/staff"],
  ["⚙", "Settings", "/settings"],
];

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
const pathname = usePathname();
const router = useRouter();

async function handleSignOut() {
  const supabase = createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Sign out error:", error);
    alert("Unable to sign out. Please try again.");
    return;
  }

  window.location.href = "/login";
}

if (pathname === "/login") {
  return <>{children}</>;
}
  return (
    <div className="crm-shell">
      <aside className="crm-sidebar">
        <div className="crm-logo">
          <div className="crm-logo-mark">CIU</div>

          <div>
            <strong>CIU Online</strong>
            <span>Lead • Innovate • Transform</span>
          </div>
        </div>

        <nav className="crm-nav">
          {nav.map(([icon, label, href]) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "active" : ""}
            >
              <span className="crm-nav-icon">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="crm-sidebar-bottom">
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 14px",
              border: "0",
              borderRadius: "8px",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: "14px",
              textAlign: "left",
            }}
          >
            <span className="crm-nav-icon">↪</span>
            Sign out
          </button>
        </div>
      </aside>

      <main className="crm-main">
        <header className="crm-topbar">
          <div className="crm-search">
            <span>⌕</span>
            <input placeholder="Search leads, customers, deals..." />
          </div>

          <div className="crm-user">
            <span style={{ fontSize: 20 }}>🔔</span>

            <div className="crm-avatar">NI</div>

            <div className="crm-user-name">
              Nicholas Isabirye
              <div className="crm-user-role">
                Business Development Manager
              </div>
            </div>
          </div>
        </header>

        <section className="crm-content">{children}</section>
      </main>

      <nav className="crm-mobile-nav">
        {nav.slice(0, 5).map(([icon, label, href]) => (
          <Link key={href} href={href}>
            <span>{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}