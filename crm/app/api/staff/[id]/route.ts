import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "You must be signed in to delete staff." }, { status: 401 });
    const { data: actor, error: actorError } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
    if (actorError || actor?.role !== "super_admin" || actor.is_active === false) return NextResponse.json({ error: "Only an active Super Admin can delete staff accounts." }, { status: 403 });
    const { id } = await context.params;
    if (!id || id === user.id) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRoleKey || !supabaseUrl) return NextResponse.json({ error: "Staff management is not configured on the server." }, { status: 503 });
    const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: target, error: targetError } = await admin.from("profiles").select("id, role, full_name").eq("id", id).maybeSingle();
    if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
    if (!target) return NextResponse.json({ error: "Staff profile was not found." }, { status: 404 });
    if (target.role === "super_admin") return NextResponse.json({ error: "Super Admin accounts cannot be deleted from this screen." }, { status: 403 });
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(id);
    if (authDeleteError) return NextResponse.json({ error: `Could not delete the authentication account: ${authDeleteError.message}` }, { status: 500 });
    const { error: profileDeleteError } = await admin.from("profiles").delete().eq("id", id);
    if (profileDeleteError) return NextResponse.json({ error: `The login was deleted, but the CRM profile could not be removed: ${profileDeleteError.message}` }, { status: 500 });
    return NextResponse.json({ message: `Deleted staff account ${target.full_name || "successfully"}. Existing CRM records were not intentionally deleted.` });
  } catch (error) {
    console.error("Staff deletion error:", error);
    return NextResponse.json({ error: "Unexpected error while deleting staff." }, { status: 500 });
  }
}
