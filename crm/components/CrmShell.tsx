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
  {
    label: "Dashboard",
    href: "/dashboard",
    module: "dashboard",
    icon: "⌂",
  },
  {
    label: "Leads",
    href: "/leads",
    module: "leads",
    icon: "◉",
  },
  {
    label: "Customers",
    href: "/customers",
    module: "customers",
    icon: "♙",
  },
  {
    label: "Pipeline",
    href: "/pipeline",
    module: "pipeline",
    icon: "▥",
  },
  {
    label: "Tasks",
    href: "/tasks",
    module: "tasks",
    icon: "✓",
  },
  {
    label: "Marketing",
    href: "/marketing",
    module: "marketing",
    icon: "✦",
  },
  {
    label: "Reports",
    href: "/reports",
    module: "reports",
    icon: "▤",
  },
  {
    label: "Staff",
    href: "/staff",
    module: "staff",
    icon: "♟",
  },
  {
    label: "Settings",
    href: "/settings",
    module: "settings",
    icon: "⚙",
  },
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

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
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
          setUserEmail(user.email ?? "");
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("CRM shell profile error:", error);
        }

        if (mounted) {
          setRole((profile?.role as CrmRole) ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error("CRM shell error:", error);

        if (mounted) {
          setRole(null);
          setUserEmail("");
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleSignOut() {
  alert("Sign Out button clicked");

  try {
    const result = await supabase.auth.signOut();

    console.log("Supabase sign out result:", result);

    if (result.error) {
      alert(`Sign out error: ${result.error.message}`);
      return;
    }

    alert("Supabase sign out successful");

    window.location.href = "/login";
  } catch (error) {
    console.error("Sign out exception:", error);
    alert("An unexpected sign out error occurred.");
  }
}

  const visibleItems = navItems.filter((item) =>
    hasModuleAccess(role, item.module)
  );

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const roleLabel = role ? role.replace("_", " ") : "Loading...";

  const userInitials =
    userEmail
      .split("@")[0]
      .split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U";

  return (
    <div className="min-h-screen bg-slate-50">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white shadow-sm transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center border-b border-slate-200 px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
            onClick={() => setMobileOpen(false)}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
              AI
            </div>

            <div>
              <div className="text-sm font-bold text-slate-900">
                All-in-One
              </div>

              <div className="text-xs font-medium text-slate-500">
                Business CRM
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-sm ${
                        active
                          ? "bg-white/10 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
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

        <div className="border-t border-slate-200 p-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {userInitials}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  Nicholas Isabirye
                </p>

                <p className="truncate text-xs text-slate-500">
                  {userEmail || "Authenticated user"}
                </p>
              </div>
            </div>

            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Access Level
              </p>

              <p className="mt-1 text-sm font-semibold capitalize text-slate-900">
                {roleLabel}
              </p>

              {role === "super_admin" && (
                <p className="mt-1 text-xs text-slate-500">
                  Full system access
                </p>
              )}

              {role === "admin" && (
                <p className="mt-1 text-xs text-slate-500">
                  Administrative access
                </p>
              )}

              {role === "manager" && (
                <p className="mt-1 text-xs text-slate-500">
                  Management access
                </p>
              )}

              {role === "salesperson" && (
                <p className="mt-1 text-xs text-slate-500">
                  Sales access
                </p>
              )}

              {role === "marketing" && (
                <p className="mt-1 text-xs text-slate-500">
                  Marketing access
                </p>
              )}

              {role === "finance" && (
                <p className="mt-1 text-xs text-slate-500">
                  Finance access
                </p>
              )}

              {role === "viewer" && (
                <p className="mt-1 text-xs text-slate-500">
                  View-only access
                </p>
              )}
            </div>

     <button
  type="button"
  onClick={() => alert("BUTTON WORKS")}
  className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
>
  Sign Out
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
            aria-label="Open menu"
          >
            Menu
          </button>

          <Link
            href="/dashboard"
            className="ml-3 text-sm font-bold text-slate-900"
          >
            All-in-One Business CRM
          </Link>
        </div>

        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}

