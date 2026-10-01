import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CrmModule =
  | "dashboard"
  | "leads"
  | "customers"
  | "pipeline"
  | "tasks"
  | "marketing"
  | "reports"
  | "staff"
  | "settings";

type CrmRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "salesperson"
  | "marketing"
  | "finance"
  | "viewer";

const ROLE_MODULES: Record<CrmRole, CrmModule[]> = {
  super_admin: [
    "dashboard",
    "leads",
    "customers",
    "pipeline",
    "tasks",
    "marketing",
    "reports",
    "staff",
    "settings",
  ],

  admin: [
    "dashboard",
    "leads",
    "customers",
    "pipeline",
    "tasks",
    "marketing",
    "reports",
    "staff",
  ],

  manager: [
    "dashboard",
    "leads",
    "customers",
    "pipeline",
    "tasks",
    "reports",
  ],

  salesperson: [
    "dashboard",
    "leads",
    "customers",
    "pipeline",
    "tasks",
  ],

  marketing: [
    "dashboard",
    "leads",
    "marketing",
    "reports",
  ],

  finance: [
    "dashboard",
    "customers",
    "pipeline",
    "reports",
  ],

  viewer: [
    "dashboard",
    "leads",
    "customers",
    "pipeline",
    "reports",
  ],
};

function hasModuleAccess(
  role: string | null | undefined,
  module: CrmModule
): boolean {
  if (!role) return false;

  return ROLE_MODULES[role as CrmRole]?.includes(module) ?? false;
}

function getRequiredModule(pathname: string): CrmModule | null {
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/leads")) return "leads";
  if (pathname.startsWith("/customers")) return "customers";
  if (pathname.startsWith("/pipeline")) return "pipeline";
  if (pathname.startsWith("/tasks")) return "tasks";
  if (pathname.startsWith("/marketing")) return "marketing";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/staff")) return "staff";
  if (pathname.startsWith("/settings")) return "settings";

  return null;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    }
  );

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const user = claimsData?.claims;
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";

  /*
   * AUTHENTICATION PROTECTION
   */

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  /*
   * ROLE-BASED MODULE PROTECTION
   *
   * Only run this for authenticated users and CRM modules.
   */

  if (user && !claimsError) {
    const requiredModule = getRequiredModule(pathname);

    if (requiredModule) {
      const userId = String(user.sub ?? "");

      if (!userId) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      /*
       * If the profile cannot be read or has no role,
       * do not grant access to a protected CRM module.
       */
      if (profileError || !profile?.role) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }

      /*
       * Check whether this user's role is allowed
       * to access the requested module.
       */
      if (!hasModuleAccess(profile.role, requiredModule)) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};