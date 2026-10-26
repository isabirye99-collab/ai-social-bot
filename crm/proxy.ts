
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  hasModuleAccess,
  type CrmModule,
  type CrmRole,
} from "@/lib/permissions";

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

  return routes.find(([prefix]) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  )?.[1] ?? null;
}

function redirect(
  request: NextRequest,
  pathname: string,
  search = "",
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/auth/callback") {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          supabaseResponse = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );

          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const user = claimsData?.claims;
  const isLoginPage = pathname === "/login";
  const isVerifyCodePage = pathname === "/verify-code";
  const isSetPasswordPage = pathname === "/set-password";

  if (!user) {
    if (isLoginPage || isVerifyCodePage) return supabaseResponse;
    return redirect(request, "/login");
  }

  if (claimsError) {
    return redirect(request, "/login", "?error=session_invalid");
  }

  const userId = String(user.sub ?? "");
  if (!userId) return redirect(request, "/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active, must_change_password, module_permissions")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile || profile.is_active === false) {
    return redirect(request, "/login", "?error=account_unavailable");
  }

  if (
    profile.must_change_password &&
    !isSetPasswordPage &&
    !pathname.startsWith("/api/auth/complete-password-change")
  ) {
    return redirect(request, "/set-password");
  }

  if (!profile.must_change_password && isSetPasswordPage) {
    return redirect(request, "/dashboard");
  }

  if (isLoginPage) {
    return redirect(
      request,
      profile.must_change_password ? "/set-password" : "/dashboard",
    );
  }

  const requiredModule = getRequiredModule(pathname);

  if (
    requiredModule &&
    !hasModuleAccess(
      profile.role as CrmRole,
      requiredModule,
      profile.module_permissions as string[] | null,
    )
  ) {
    return redirect(request, "/dashboard", "?error=module_access_denied");
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
