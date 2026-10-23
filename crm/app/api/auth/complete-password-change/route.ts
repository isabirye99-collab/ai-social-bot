import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRoleKey || !supabaseUrl) return NextResponse.json({ error: "Password setup is not configured on the server." }, { status: 503 });
    const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await admin.from("profiles").update({ must_change_password: false }).eq("id", user.id);
    if (error) return NextResponse.json({ error: `Password changed, but the first-login flag could not be cleared: ${error.message}` }, { status: 500 });
    const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, must_change_password: false } });
    if (metadataError) console.error("Could not update first-login user metadata:", metadataError.message);
    return NextResponse.json({ message: "Password updated." });
  } catch (error) {
    console.error("Complete password change error:", error);
    return NextResponse.json({ error: "Unable to complete password setup." }, { status: 500 });
  }
}
