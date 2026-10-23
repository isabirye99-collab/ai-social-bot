import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  hasModuleAccess,
  type CrmModule,
} from "./lib/permissions";

function getRequiredModule(pathname: string): CrmModule | null {
  const routes: [string, CrmModule][] = [
    ["/dashboard", "dashboard"],
    ["/leads", "leads"],
    ["/customers", "customers"],
    ["/pipeline", "pipeline"],
    ["/tasks", "tasks"],
    ["/marketing", "marketing"],
    ["/reports", "reports"],
    ["/staff", "staff"],
    ["/advanced", "advanced"],
    ["/settings", "settings"],
  ];

  return (
    routes.find(
      ([route]) =>
        pathname === route || pathname.startsWith(`${route}/`),
    )?.[1] ?? null
  );
}

function redirectTo(request: NextRequest, pathname: string, error?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  if (error) url.searchParams.set("error", error);

  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase public environment configuration is missing.");
    return new NextResponse("Authentication service is not configured.", {
      status: 500,
    });
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isVerifyCodePage = pathname === "/verify-code";
  const isSetPasswordPage = pathname === "/set-password";
  const isAuthCallback =
    pathname === "/auth/callback" ||
    pathname === "/auth/confirm";
  const isPasswordChangeApi =
    pathname === "/api/auth/complete-password-change";

  // Authentication callbacks must be able to finish the sign-in flow.
  if (isAuthCallback) return supabaseResponse;

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const user = claimsData?.claims;
  const userId = typeof user?.sub === "string" ? user.sub : null;

  if (claimsError && userId) {
    return redirectTo(request, "/login", "session_invalid");
  }

  // Unauthenticated visitors may access the login and verification pages.
  if (!userId) {
    if (isLoginPage || isVerifyCodePage) return supabaseResponse;
    return redirectTo(request, "/login");
  }

  // Read the account's current access settings from its profile.
  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role, is_active, must_change_password, module_permissions")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile || !profile.role || profile.is_active !== true) {
    return redirectTo(request, "/login", "account_unavailable");
  }

  // A required password change takes priority over normal CRM navigation.
  if (profile.must_change_password === true) {
    if (isSetPasswordPage || isPasswordChangeApi) {
      return supabaseResponse;
    }

    return redirectTo(request, "/set-password");
  }

  // Users who do not need a password change must not remain on that page.
  if (isSetPasswordPage) {
    return redirectTo(request, "/dashboard");
  }

  if (isLoginPage || isVerifyCodePage) {
    return redirectTo(request, "/dashboard");
  }

  // The password-change endpoint is exempt from module checks, not sign-in
  // or account-status checks.
  if (isPasswordChangeApi) return supabaseResponse;

  const requiredModule = getRequiredModule(pathname);

  if (requiredModule) {
    const permissions = Array.isArray(profile.module_permissions)
      ? profile.module_permissions.filter(
          (value): value is string => typeof value === "string",
        )
      : null;

    if (
      !hasModuleAccess(
        profile.role,
        requiredModule,
        permissions,
      )
    ) {
      return redirectTo(request, "/dashboard", "module_access_denied");
    }
  }

  return supabaseResponse;
}

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
