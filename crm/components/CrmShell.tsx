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
  { label: "Dashboard", href: "/dashboard", module: "dashboard", icon: "⌂" },
  { label: "Leads", href: "/leads", module: "leads", icon: "◎" },
  { label: "Customers", href: "/customers", module: "customers", icon: "♙" },
  { label: "Pipeline", href: "/pipeline", module: "pipeline", icon: "▰" },
  { label: "Tasks", href: "/tasks", module: "tasks", icon: "✓" },
  { label: "Marketing", href: "/marketing", module: "marketing", icon: "✦" },
  { label: "Reports", href: "/reports", module: "reports", icon: "▤" },
  { label: "Advanced", href: "/advanced", module: "advanced", icon: "✧" },
  { label: "Settings", href: "/settings", module: "settings", icon: "⚙" },
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

  useEffect(() => {
    let mounted = true;

    const applyLogo = (value: string) => {
      if (mounted) {
        setLogoSrc(value || "");
      }
    };

    const loadLogo = async () => {
      try {
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
          .select("logo_data_url")
          .eq("id", 1)
          .maybeSingle();

        if (!error && data?.logo_data_url) {
          applyLogo(data.logo_data_url);
          return;
        }

        if (!localLogo) {
          applyLogo("");
        }
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
      const detail = (
        event as CustomEvent<{
          logo?: string;
          logoName?: string;
        }>
      ).detail;

      if (
        detail &&
        typeof detail.logo === "string"
      ) {
        applyLogo(detail.logo);
      } else {
        loadLogo();
      }
    };

    loadLogo();

    window.addEventListener(
      "ciu-crm-logo-updated",
      handleLogoUpdated,
    );

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
    hasModuleAccess(role, item.module),
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
      className="min-h-screen"
      style={{ background: "#f5f8f7" }}
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
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col shadow-lg transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
        style={{
          background:
            "linear-gradient(180deg,#003f36 0%,#00695c 72%,#087b68 100%)",
        }}
      >
        <div
          className="flex h-24 items-center border-b px-5"
          style={{
            borderColor:
              "rgba(255,255,255,.12)",
          }}
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
        color: "#00695c",
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
                CIU CRM
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

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p
            className="mb-3 px-3 text-[10px] font-bold uppercase tracking-wider"
            style={{
              color: "rgba(255,255,255,.5)",
            }}
          >
            Main Menu
          </p>

          <div className="space-y-1">
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
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
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
          className="border-t p-4"
          style={{
            borderColor:
              "rgba(255,255,255,.12)",
          }}
        >
          <div
            className="rounded-xl p-3"
            style={{
              background:
                "rgba(255,255,255,.08)",
            }}
          >
            <div className="flex items-center gap-3">
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
              className="mt-3 border-t pt-3"
              style={{
                borderColor:
                  "rgba(255,255,255,.12)",
              }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  color:
                    "rgba(255,255,255,.48)",
                }}
              >
                Access Level
              </p>

              <p
                className="mt-1 text-sm font-semibold capitalize"
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
                color: "#00695c",
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

      <div className="lg:pl-64">
        <div className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white px-4 lg:hidden">
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
            CIU CRM
          </Link>
        </div>

        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}