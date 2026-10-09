"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  hasModuleAccess,
  type CrmModule,
  type CrmRole,
} from "@/lib/permissions";

type NavItem = {
  label: string;
  href: string;
  module: CrmModule;
  icon: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", module: "dashboard", icon: "âŒ‚" },
  { label: "Leads", href: "/leads", module: "leads", icon: "â—Ž" },
  { label: "Customers", href: "/customers", module: "customers", icon: "â™™" },
  { label: "Pipeline", href: "/pipeline", module: "pipeline", icon: "â–°" },
  { label: "Tasks", href: "/tasks", module: "tasks", icon: "âœ“" },
  { label: "Marketing", href: "/marketing", module: "marketing", icon: "âœ¦" },
  { label: "Reports", href: "/reports", module: "reports", icon: "â–¤" },
  { label: "Advanced", href: "/advanced", module: "advanced", icon: "âœ§" },
  { label: "Settings", href: "/settings", module: "settings", icon: "âš™" },
];

export default function CrmShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const supabase = createClient();

  const [role, setRole] = useState<CrmRole | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoSrc, setLogoSrc] = useState("");
  const [crmName, setCrmName] = useState("CIU Business CRM");
  const [primaryColor, setPrimaryColor] = useState("#00695c");
  const [layoutOrientation, setLayoutOrientation] = useState<"vertical" | "horizontal">("vertical");

  useEffect(() => {
    let mounted = true;

    const applyLogo = (value: string) => {
      if (mounted) {
        setLogoSrc(value || "");
      }
    };

    const loadLogo = async () => {
      try {
        try {
          const savedName = localStorage.getItem("ciu_crm_name");
          const savedColor = localStorage.getItem("ciu_crm_primary_color");
          const savedLayout = localStorage.getItem("ciu_crm_layout_orientation");
          const savedPreferences = Object.keys(localStorage).find((key) => key.toLowerCase().includes("preferences") && key.toLowerCase().includes("ciu"));
          if (savedName) setCrmName(savedName);
          if (savedColor && /^#[0-9a-fA-F]{6}$/.test(savedColor)) setPrimaryColor(savedColor);
          if (savedLayout === "horizontal" || savedLayout === "vertical") setLayoutOrientation(savedLayout);
          if (savedPreferences) {
            try {
              const parsed = JSON.parse(localStorage.getItem(savedPreferences) || "{}") as Record<string, unknown>;
              const orientation = parsed.navigationOrientation ?? parsed.layoutOrientation;
              if (orientation === "horizontal" || orientation === "vertical") setLayoutOrientation(orientation);
              if (typeof parsed.crmName === "string" && parsed.crmName.trim()) setCrmName(parsed.crmName);
              if (typeof parsed.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(parsed.primaryColor)) setPrimaryColor(parsed.primaryColor);
            } catch {}
          }
        } catch {}
        let localLogo = "";

        try {
          localLogo =
            window.localStorage.getItem("ciu_crm_logo") || "";
        } catch {}

        if (localLogo) {
          applyLogo(localLogo);
        }

        const { data, error } = await supabase
          .from("crm_settings")
          .select("logo_data_url, preferences")
          .eq("id", 1)
          .maybeSingle();

        if (!error && data) {
          if (data.logo_data_url) applyLogo(data.logo_data_url);
          const prefs = (data.preferences || {}) as Record<string, unknown>;
          const savedName = typeof prefs.crmName === "string" ? prefs.crmName : "";
          const savedColor = typeof prefs.primaryColor === "string" ? prefs.primaryColor : "";
          const savedLayout = prefs.navigationOrientation === "horizontal" || prefs.layoutOrientation === "horizontal" ? "horizontal" : "vertical";
          if (savedName) setCrmName(savedName);
          if (/^#[0-9a-fA-F]{6}$/.test(savedColor)) setPrimaryColor(savedColor);
          setLayoutOrientation(savedLayout);
          try {
            if (savedName) localStorage.setItem("ciu_crm_name", savedName);
            if (savedColor) localStorage.setItem("ciu_crm_primary_color", savedColor);
            localStorage.setItem("ciu_crm_layout_orientation", savedLayout);
          } catch {}
          return;
        }

        if (!localLogo) applyLogo("");
      } catch (error) {
        console.error("Unable to load CRM logo:", error);

        try {
          applyLogo(
            window.localStorage.getItem("ciu_crm_logo") || "",
          );
        } catch {
          applyLogo("");
        }
      }
    };

    const handleLogoUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{
        logo?: string;
        logoName?: string;
        crmName?: string;
        organizationName?: string;
        tagline?: string;
        navigationOrientation?: string;
        layoutOrientation?: string;
        primaryColor?: string;
        secondaryColor?: string;
      }>).detail;

      if (detail && typeof detail.logo === "string") applyLogo(detail.logo);
      else loadLogo();

      if (detail?.crmName?.trim()) setCrmName(detail.crmName.trim());
      if (detail?.primaryColor && /^#[0-9a-fA-F]{6}$/.test(detail.primaryColor)) setPrimaryColor(detail.primaryColor);
      const orientation = detail?.navigationOrientation ?? detail?.layoutOrientation;
      if (orientation === "horizontal" || orientation === "vertical") setLayoutOrientation(orientation);

      try {
        if (detail?.crmName) localStorage.setItem("ciu_crm_name", detail.crmName);
        if (detail?.primaryColor) localStorage.setItem("ciu_crm_primary_color", detail.primaryColor);
        if (orientation === "horizontal" || orientation === "vertical") {
          localStorage.setItem("ciu_crm_layout_orientation", orientation);
        }
      } catch {}
    };

    loadLogo();

    window.addEventListener("ciu-crm-logo-updated", handleLogoUpdated);
    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ crmName?: string; primaryColor?: string; layoutOrientation?: string; navigationOrientation?: string }>).detail;
      if (!detail) return;
      if (detail.crmName) setCrmName(detail.crmName);
      if (detail.primaryColor && /^#[0-9a-fA-F]{6}$/.test(detail.primaryColor)) setPrimaryColor(detail.primaryColor);
      const orientation = detail.navigationOrientation ?? detail.layoutOrientation;
      if (orientation === "horizontal" || orientation === "vertical") setLayoutOrientation(orientation);
    };
    window.addEventListener("ciu-crm-settings-updated", handleSettingsUpdated);

    window.addEventListener("storage", loadLogo);

    const loadUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted) {
            setRole(null);
            setUserEmail("");
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          setUserEmail(user.email || "");
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (mounted) {
          setRole(
            (profile?.role as CrmRole) || null,
          );
          setLoading(false);
        }
      } catch (error) {
        console.error("CRM shell user loading error:", error);

        if (mounted) {
          setRole(null);
          setLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      mounted = false;

      window.removeEventListener(
        "ciu-crm-logo-updated",
        handleLogoUpdated,
      );

      window.removeEventListener(
        "storage",
        loadLogo,
      );
      window.removeEventListener("ciu-crm-settings-updated", handleSettingsUpdated);
    };
  }, []);

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        alert(error.message);
        setSigningOut(false);
        return;
      }

      window.location.replace("/login");
    } catch (error) {
      console.error(error);
      alert("Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  }

  const visibleItems = navItems.filter((item) =>
    item.label !== "Staff" && hasModuleAccess(role, item.module),
  );

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href ||
        pathname.startsWith(`${href}/`);

  const roleLabel = role
    ? role.replace("_", " ")
    : "Loading...";

  const userInitials =
    userEmail
      .split("@")[0]
      .split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase(),
      )
      .join("") || "U";

  return (
    <div
      className={layoutOrientation === "horizontal" ? "min-h-screen flex flex-col" : "min-h-screen"}
      data-navigation-orientation={layoutOrientation}
      style={{ background: "#f5f8f7", "--ciu-primary": primaryColor } as React.CSSProperties}
    >
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={layoutOrientation === "horizontal"
          ? "relative z-50 flex w-full flex-row items-center gap-4 px-4 py-3 shadow-md"
          : `fixed inset-y-0 left-0 z-50 flex w-64 flex-col shadow-lg transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background: `linear-gradient(90deg,${primaryColor} 0%,${primaryColor}e8 72%,${primaryColor}cc 100%)`,
          ...(layoutOrientation === "vertical" ? { background: `linear-gradient(180deg,${primaryColor} 0%,${primaryColor}e8 72%,${primaryColor}cc 100%)` } : {}),
        }}
      >
        <div
          className={layoutOrientation === "horizontal" ? "flex shrink-0 items-center border-r pr-4" : "flex h-24 items-center border-b px-5"}
          style={{ borderColor: "rgba(255,255,255,.12)" }}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
            onClick={() => setMobileOpen(false)}
          >
            <div
  style={{
    width: 110,
    height: 68,
    borderRadius: 12,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: 8,
    flexShrink: 0,
    border: "1px solid rgba(255,255,255,.25)",
  }}
>
  {logoSrc ? (
    <img
      src={logoSrc}
      alt="CIU Logo"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain",
      }}
    />
  ) : (
    <div
      style={{
        fontSize: 20,
        fontWeight: 900,
        color: primaryColor,
      }}
    >
      CIU
    </div>
  )}
</div>

            <div>
              <div
                className="text-sm font-bold"
                style={{ color: "#fff" }}
              >
                {crmName}
              </div>

              <div
                className="text-xs font-medium"
                style={{ color: "#cce8a8" }}
              >
                Lead · Innovate · Transform
              </div>
            </div>
          </Link>
        </div>

        <nav className={layoutOrientation === "horizontal" ? "min-w-0 flex-1 overflow-x-auto px-1 py-1" : "flex-1 overflow-y-auto px-3 py-5"}>
          <p
            className={`mb-3 px-3 text-[10px] font-bold uppercase tracking-wider ${layoutOrientation === "horizontal" ? "hidden" : ""}`}
            style={{
              color: "rgba(255,255,255,.5)",
            }}
          >
            Main Menu
          </p>

          <div className={layoutOrientation === "horizontal" ? "flex min-w-max items-center gap-1" : "space-y-1"}>
            {loading ? (
              <div className="space-y-2 px-3 py-2">
                <div className="h-9 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-9 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-9 animate-pulse rounded-lg bg-slate-100" />
              </div>
            ) : (
              visibleItems.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.module}
                    href={item.href}
                    onClick={() =>
                      setMobileOpen(false)
                    }
                    className={`${layoutOrientation === "horizontal" ? "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition" : "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition"} ${
                      active
                        ? "text-white shadow-sm"
                        : "hover:text-white"
                    }`}
                    style={{
                      background: active
                        ? "rgba(139,198,63,.22)"
                        : "transparent",
                      color: active
                        ? "#fff"
                        : "rgba(255,255,255,.72)",
                    }}
                  >
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-md text-sm"
                      style={{
                        background: active
                          ? "rgba(139,198,63,.24)"
                          : "rgba(255,255,255,.08)",
                        color: active
                          ? "#cce8a8"
                          : "rgba(255,255,255,.7)",
                      }}
                    >
                      {item.icon}
                    </span>

                    <span>{item.label}</span>
                  </Link>
                );
              })
            )}
          </div>
        </nav>

        <div
          className={layoutOrientation === "horizontal" ? "flex shrink-0 items-center gap-3 border-l pl-4" : "border-t p-4"}
          style={{ borderColor: "rgba(255,255,255,.12)" }}
        >
          <div
            className={layoutOrientation === "horizontal" ? "flex items-center gap-3" : "rounded-xl p-3"}
            style={{
              background:
                "rgba(255,255,255,.08)",
            }}
          >
            <div className={layoutOrientation === "horizontal" ? "hidden" : "flex items-center gap-3"}>
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{
                  background:
                    "rgba(139,198,63,.25)",
                }}
              >
                {userInitials}
              </div>

              <div className="min-w-0">
                <p
                  className="truncate text-sm font-semibold"
                  style={{ color: "#fff" }}
                >
                  Nicholas Isabirye
                </p>

                <p
                  className="truncate text-xs"
                  style={{
                    color:
                      "rgba(255,255,255,.58)",
                  }}
                >
                  {userEmail ||
                    "Authenticated user"}
                </p>
              </div>
            </div>

            <div
              className={layoutOrientation === "horizontal" ? "flex items-center gap-3" : "mt-3 border-t pt-3"}
              style={{
                borderColor:
                  "rgba(255,255,255,.12)",
              }}
            >
              <p
                className={`text-[10px] font-semibold uppercase tracking-wide ${layoutOrientation === "horizontal" ? "hidden" : ""}`}
                style={{
                  color:
                    "rgba(255,255,255,.48)",
                }}
              >
                Access Level
              </p>

              <p
                className="text-sm font-semibold capitalize"
                style={{ color: "#fff" }}
              >
                {roleLabel}
              </p>

              {role === "super_admin" && (
                <p
                  className="mt-1 text-xs"
                  style={{
                    color:
                      "rgba(255,255,255,.58)",
                  }}
                >
                  Full system access
                </p>
              )}

              {role === "admin" && (
                <p
                  className="mt-1 text-xs"
                  style={{
                    color:
                      "rgba(255,255,255,.58)",
                  }}
                >
                  Administrative access
                </p>
              )}

              {role === "manager" && (
                <p
                  className="mt-1 text-xs"
                  style={{
                    color:
                      "rgba(255,255,255,.58)",
                  }}
                >
                  Management access
                </p>
              )}

              {role === "salesperson" && (
                <p
                  className="mt-1 text-xs"
                  style={{
                    color:
                      "rgba(255,255,255,.58)",
                  }}
                >
                  Sales access
                </p>
              )}

              {role === "marketing" && (
                <p
                  className="mt-1 text-xs"
                  style={{
                    color:
                      "rgba(255,255,255,.58)",
                  }}
                >
                  Marketing access
                </p>
              )}

              {role === "finance" && (
                <p
                  className="mt-1 text-xs"
                  style={{
                    color:
                      "rgba(255,255,255,.58)",
                  }}
                >
                  Finance access
                </p>
              )}

              {role === "viewer" && (
                <p
                  className="mt-1 text-xs"
                  style={{
                    color:
                      "rgba(255,255,255,.58)",
                  }}
                >
                  View-only access
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-3 w-full rounded-lg border px-3 py-2 text-xs font-semibold"
              style={{
                borderColor:
                  "rgba(255,255,255,.18)",
                background: "#fff",
                color: primaryColor,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                visibility: "visible",
                opacity: signingOut ? 0.65 : 1,
                cursor: signingOut
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {signingOut
                ? "Signing Out..."
                : "Sign Out"}
            </button>
          </div>
        </div>
      </aside>

      <div className={layoutOrientation === "horizontal" ? "min-w-0 flex-1" : "lg:pl-64"}>
        <div className={layoutOrientation === "horizontal" ? "hidden" : "sticky top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white px-4 lg:hidden"}>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Menu
          </button>

          <Link
            href="/dashboard"
            className="ml-3 text-sm font-bold text-slate-900"
          >
            {crmName}
          </Link>
        </div>

        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
