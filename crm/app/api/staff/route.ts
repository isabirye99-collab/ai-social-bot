import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const ALLOWED_ROLES = [
  "admin",
  "manager",
  "salesperson",
  "marketing",
  "finance",
  "viewer",
] as const;

type StaffRole = (typeof ALLOWED_ROLES)[number];

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  let admin: ReturnType<typeof createAdminClient> | null = null;

  try {
    // Only an active Super Admin may create staff accounts.
    const supabase = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 },
      );
    }

    const { data: actor, error: actorError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (
      actorError ||
      actor?.role !== "super_admin" ||
      actor.is_active === false
    ) {
      return NextResponse.json(
        { error: "Only an active Super Admin can create staff accounts." },
        { status: 403 },
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        {
          error:
            "Staff onboarding is not configured. Check the server environment variables.",
        },
        { status: 503 },
      );
    }

    const body = await request.json();

    const full_name =
      typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";
    const phone =
      typeof body.phone === "string" ? body.phone.trim() : "";
    const role = body.role as StaffRole;
    const temporaryPassword =
      typeof body.temporary_password === "string"
        ? body.temporary_password
        : "";

    if (!full_name || full_name.length > 120) {
      return NextResponse.json(
        { error: "Enter a valid staff name of no more than 120 characters." },
        { status: 400 },
      );
    }

    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    if (phone.length > 40) {
      return NextResponse.json(
        { error: "The phone number is too long." },
        { status: 400 },
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Select a valid CRM role." },
        { status: 400 },
      );
    }

    if (temporaryPassword.length < 10) {
      return NextResponse.json(
        { error: "The temporary password must be at least 10 characters." },
        { status: 400 },
      );
    }

    admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create the account with a temporary password.
    // Email confirmation is handled by the trusted server-side Admin API.
    // No verification email is required for this temporary workflow.
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name,
          must_change_password: true,
        },
      });

    if (createError || !created.user) {
      return NextResponse.json(
        {
          error:
            createError?.message ||
            "Supabase did not return the new staff account.",
        },
        { status: 400 },
      );
    }

    createdUserId = created.user.id;

    // Create the CRM profile and require a password change at first login.
    const profilesTable = admin.from("profiles") as any;

    const { error: profileError } = await profilesTable.upsert(
      {
        id: createdUserId,
        full_name,
        phone: phone || null,
        role,
        is_active: true,
        must_change_password: true,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      throw new Error(
        `The staff profile could not be created: ${profileError.message}`,
      );
    }

    return NextResponse.json(
      {
        message:
          `Staff account created successfully for ${email}. ` +
          "You may share the temporary password securely. " +
          "The staff member must change it before accessing CRM modules.",
        userId: createdUserId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Staff creation error:", error);

    // If profile setup fails, remove the partially created account.
    if (createdUserId && admin) {
      const profilesTable = admin.from("profiles") as any;

      const { error: profileDeleteError } = await profilesTable
        .delete()
        .eq("id", createdUserId);

      if (profileDeleteError) {
        console.error(
          "Staff profile rollback failed:",
          profileDeleteError.message,
        );
      }

      const { error: authDeleteError } =
        await admin.auth.admin.deleteUser(createdUserId);

      if (authDeleteError) {
        console.error(
          "Staff Auth rollback failed:",
          authDeleteError.message,
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the staff account.",
      },
      { status: 500 },
    );
  }
}