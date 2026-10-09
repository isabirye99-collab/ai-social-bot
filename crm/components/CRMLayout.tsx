"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Orientation = "vertical" | "horizontal";

type BrandingPreferences = {
  crmName?: string;
  organizationName?: string;
  tagline?: string;
  navigationOrientation?: Orientation;
  primaryColor?: string;
  secondaryColor?: string;
};

type NavItem = {
  label: string;
  href: string;
};

const nav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Leads", href: "/leads" },
  { label: "Customers", href: "/customers" },
  { label: "Pipeline", href: "/pipeline" },
  { label: "Tasks", href: "/tasks" },
  { label: "Marketing", href: "/marketing" },
  { label: "Reports", href: "/reports" },
  { label: "Settings", href: "/settings" },
];

const LOGO_KEY = "ciu_crm_logo";
const PREFERENCES_KEY = "ciu_crm_preferences";
const DEFAULT_BRANDING: Required<BrandingPreferences> = {
  crmName: "CIU Business CRM",
  organizationName: "Clarke International University",
  tagline: "Lead · Innovate · Transform",
  navigationOrientation: "vertical",
  primaryColor: "#00695c",
  secondaryColor: "#8bc63f",
};

function isOrientation(value: unknown): value is Orientation {
  return value === "vertical" || value === "horizontal";
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [logo, setLogo] = useState("");
  const [branding, setBranding] = useState<Required<BrandingPreferences>>(DEFAULT_BRANDING);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const applyPreferences = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      const prefs = value as BrandingPreferences;

      setBranding((current) => ({
        ...current,
        ...(typeof prefs.crmName === "string" && prefs.crmName.trim()
          ? { crmName: prefs.crmName.trim() }
          : {}),
        ...(typeof prefs.organizationName === "string"
          ? { organizationName: prefs.organizationName }
          : {}),
        ...(typeof prefs.tagline === "string" ? { tagline: prefs.tagline } : {}),
        ...(isOrientation(prefs.navigationOrientation)
          ? { navigationOrientation: prefs.navigationOrientation }
          : isOrientation((prefs as BrandingPreferences & { layoutOrientation?: string }).layoutOrientation)
            ? { navigationOrientation: (prefs as BrandingPreferences & { layoutOrientation?: Orientation }).layoutOrientation! }
            : {}),
        ...(isHexColor(prefs.primaryColor) ? { primaryColor: prefs.primaryColor } : {}),
        ...(isHexColor(prefs.secondaryColor) ? { secondaryColor: prefs.secondaryColor } : {}),
      }));
    };

    const loadSettings = async () => {
      try {
        const localLogo = window.localStorage.getItem(LOGO_KEY) || "";
        if (active && localLogo) setLogo(localLogo);

        const localPreferences = window.localStorage.getItem(PREFERENCES_KEY);
        if (localPreferences) {
          try {
            applyPreferences(JSON.parse(localPreferences));
          } catch {
            // Ignore malformed local preferences and continue to Supabase.
          }
        }

        const { data, error } = await supabase
          .from("crm_settings")
          .select("logo_data_url, preferences")
          .eq("id", 1)
          .maybeSingle();

        if (!active || error || !data) return;

        if (typeof data.logo_data_url === "string" && data.logo_data_url) {
          setLogo(data.logo_data_url);
          try {
            window.localStorage.setItem(LOGO_KEY, data.logo_data_url);
          } catch {}
        }

        applyPreferences(data.preferences);
      } catch (error) {
        console.error("Unable to load CRM branding settings:", error);
      }
    };

    const handleBrandingUpdated = (event: Event) => {
      const detail = (event as CustomEvent<BrandingPreferences & { logo?: string }>).detail;
      if (!detail) {
        void loadSettings();
        return;
      }

      if (typeof detail.logo === "string") {
        setLogo(detail.logo);
        try {
          window.localStorage.setItem(LOGO_KEY, detail.logo);
        } catch {}
      }

      applyPreferences(detail);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOGO_KEY && typeof event.newValue === "string") {
        setLogo(event.newValue);
      }
      if (event.key === PREFERENCES_KEY && event.newValue) {
        try {
          applyPreferences(JSON.parse(event.newValue));
        } catch {}
      }
    };

    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (active) setUserEmail(user?.email || "");
      } catch (error) {
        console.error("Unable to load CRM user:", error);
      }
    };

    void loadSettings();
    void loadUser();
    window.addEventListener("ciu-crm-logo-updated", handleBrandingUpdated);
    window.addEventListener("storage", handleStorage);

    return () => {
      active = false;
      window.removeEventListener("ciu-crm-logo-updated", handleBrandingUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  if (pathname === "/login") return <>{children}</>;

  const horizontal = branding.navigationOrientation === "horizontal";
  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const initials =
    userEmail.split("@")[0].split(/[.\s_-]+/).filter(Boolean).slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase()).join("") || "U";

  const headerBrand = (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-3 no-underline">
      <div
        className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-2"
        style={{ border: "1px solid rgba(255,255,255,.28)" }}
      >
        {logo ? (
          <img
            src={logo}
            alt="Organization logo"
            className="block max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="text-xl font-black" style={{ color: branding.primaryColor }}>
            CIU
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-base font-bold text-white">{branding.crmName}</div>
        <div className="truncate text-xs font-medium" style={{ color: "#d9edc4" }}>
          {branding.tagline}
        </div>
      </div>
    </Link>
  );

  const navLinks = (
    <nav
      aria-label="Main navigation"
      className={horizontal
        ? "flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 py-1"
        : "flex-1 space-y-1 overflow-y-auto px-3 py-5"}
    >
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={`${horizontal
            ? "shrink-0 whitespace-nowrap rounded-lg px-4 py-3 text-base font-semibold transition-colors"
            : "flex items-center rounded-lg px-4 py-3 text-base font-semibold transition-colors"} ${isActive(item.href) ? "text-white" : "text-white/75 hover:text-white"}`}
          style={{
            background: isActive(item.href) ? "rgba(139,198,63,.24)" : "transparent",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div
      className={horizontal ? "flex min-h-screen flex-col" : "min-h-screen"}
      data-navigation-orientation={branding.navigationOrientation}
      style={{
        background: "#f5f8f7",
        ["--ciu-primary" as string]: branding.primaryColor,
        ["--ciu-secondary" as string]: branding.secondaryColor,
      } as React.CSSProperties}
    >
      {mobileOpen && !horizontal && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}

      <aside
        className={horizontal
          ? "relative z-30 flex w-full flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 shadow-md"
          : `fixed inset-y-0 left-0 z-50 flex w-72 flex-col shadow-lg transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background: horizontal
            ? `linear-gradient(90deg, ${branding.primaryColor} 0%, ${branding.primaryColor}e8 72%, ${branding.primaryColor}cc 100%)`
            : `linear-gradient(180deg, ${branding.primaryColor} 0%, ${branding.primaryColor}e8 72%, ${branding.primaryColor}cc 100%)`,
        }}
      >
        <div className={horizontal ? "flex shrink-0 items-center" : "flex min-h-24 items-center border-b px-5 py-4"}
          style={{ borderColor: "rgba(255,255,255,.12)" }}>
          {headerBrand}
        </div>

        {navLinks}

        {!horizontal && (
          <div className="border-t p-4" style={{ borderColor: "rgba(255,255,255,.12)" }}>
            <div className="mb-3 flex items-center gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,.08)" }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "rgba(139,198,63,.25)" }}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{userEmail || "Authenticated user"}</p>
                <p className="text-xs text-white/60">{branding.organizationName}</p>
              </div>
            </div>
            <button type="button" onClick={async () => {
              const supabase = createClient();
              const { error } = await supabase.auth.signOut();
              if (error) {
                alert(error.message);
                return;
              }
              window.location.replace("/login");
            }} className="w-full rounded-lg bg-white px-3 py-2.5 text-sm font-semibold" style={{ color: branding.primaryColor }}>
              Sign out
            </button>
          </div>
        )}
      </aside>

      <div className={horizontal ? "min-w-0 flex-1" : "lg:pl-72"}>
        {!horizontal && (
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
              Menu
            </button>
            <span className="truncate text-sm font-bold text-slate-900">{branding.crmName}</span>
          </header>
        )}
        {horizontal && (
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
            <div className="truncate text-sm font-semibold text-slate-700">{branding.organizationName}</div>
            <div className="truncate text-xs text-slate-500">{userEmail || "Authenticated user"}</div>
          </div>
        )}
        <main className="min-h-screen">{children}</main>
      </div>

      {!horizontal && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white shadow-lg lg:hidden" aria-label="Mobile navigation">
          {nav.slice(0, 5).map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex flex-col items-center justify-center gap-1 px-1 py-3 text-xs font-semibold ${isActive(item.href) ? "text-emerald-800" : "text-slate-500"}`}>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
