import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedSources = new Set([
  "Facebook", "TikTok", "Website", "WhatsApp",
  "Instagram", "Google", "Referral", "Other",
]);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const body = await req.json();

    if (typeof body.website === "string" && body.website.trim() !== "") {
      return json({ success: true });
    }

    const campaignId = typeof body.campaignId === "string" ? body.campaignId.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const program = typeof body.program === "string" ? body.program.trim() : "";
    const location = typeof body.location === "string" ? body.location.trim() : "";
    const source = typeof body.source === "string" ? body.source.trim() : "";
    const school = typeof body.school === "string" ? body.school.trim() : "";
    const level = typeof body.level === "string" ? body.level.trim() : "";
    const intake = typeof body.intake === "string" ? body.intake.trim() : "";
    const previousEducation = typeof body.previousEducation === "string" ? body.previousEducation.trim() : "";
    const heardAboutUs = typeof body.heardAboutUs === "string" ? body.heardAboutUs.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!campaignId || !name || !phone) {
      return json({ error: "Campaign, full name, and telephone number are required." }, 400);
    }

    if (name.length > 150 || phone.length > 50 || email.length > 254) {
      return json({ error: "One or more fields are too long." }, 400);
    }

    if (
      program.length > 200 ||
      location.length > 150 ||
      school.length > 200 ||
      level.length > 100 ||
      intake.length > 50 ||
      previousEducation.length > 100 ||
      heardAboutUs.length > 100 ||
      message.length > 2000
    ) {
      return json({ error: "One or more fields are too long." }, 400);
    }

    if (source && !allowedSources.has(source)) {
      return json({ error: "Invalid lead source." }, 400);
    }

    if (email && !/^\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*$/.test(email)) {
      return json({ error: "Please provide a valid email address." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase server credentials are missing.");
      return json({ error: "Lead capture service is not configured." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id,name")
      .eq("id", campaignId)
      .maybeSingle();

    if (campaignError) {
      console.error("Campaign lookup error:", campaignError);
      return json({ error: "Unable to verify campaign." }, 500);
    }

    if (!campaign) {
      return json({ error: "Campaign not found." }, 404);
    }

    const noteParts = [
      source ? "Lead captured through " + source : "Lead captured through campaign",
      "Campaign: " + campaign.name,
      school ? "School/Faculty: " + school : "",
      level ? "Level of Study: " + level : "",
      intake ? "Preferred Intake: " + intake : "",
      previousEducation ? "Previous Education: " + previousEducation : "",
      heardAboutUs ? "How They Heard About CIU: " + heardAboutUs : "",
      message ? "Additional Message: " + message : "",
    ].filter(Boolean);

    let leadId: string | null = null;
    let createdLead = false;
    let duplicateLead = false;

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        name,
        phone,
        email: email || null,
        product_service: program || null,
        location: location || null,
        status: "new",
        notes: noteParts.join("\n"),
      })
      .select("id")
      .single();

    if (leadError || !lead) {
      // The database protects existing CIU numbers, email addresses and phone
      // numbers from accidental duplication. A returning prospect should still
      // be able to submit a campaign form: attach the campaign to the existing
      // lead instead of showing a generic failure or creating duplicate data.
      const detail = String(leadError?.details || "");
      const duplicateId = leadError?.code === "23505"
        ? detail.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]
        : null;

      if (!duplicateId) {
        console.error("Lead insert error:", leadError);
        return json({ error: "Unable to save your enquiry. Please check your details and try again." }, 500);
      }

      const { data: existingLead, error: existingLeadError } = await supabase
        .from("leads")
        .select("id,notes,product_service,location")
        .eq("id", duplicateId)
        .maybeSingle();

      if (existingLeadError || !existingLead) {
        console.error("Could not resolve duplicate lead:", existingLeadError || detail);
        return json({ error: "We could not safely match this enquiry to an existing record. Please contact CIU Admissions." }, 409);
      }

      leadId = existingLead.id;
      duplicateLead = true;

      // Preserve the existing lead record while capturing this new campaign enquiry.
      const duplicateUpdates: Record<string, string> = {};
      if (!existingLead.product_service && program) duplicateUpdates.product_service = program;
      if (!existingLead.location && location) duplicateUpdates.location = location;
      const additionalNotes = "\\n--- Additional campaign enquiry ---\\n" + noteParts.join("\\n");
      duplicateUpdates.notes = [String(existingLead.notes || "").trim(), additionalNotes].filter(Boolean).join("\\n");
      duplicateUpdates.updated_at = new Date().toISOString();
      const { error: duplicateUpdateError } = await supabase
        .from("leads")
        .update(duplicateUpdates)
        .eq("id", existingLead.id);
      if (duplicateUpdateError) {
        // Keep the campaign submission successful if the note update fails; the campaign link below is still recorded.
        console.error("Existing lead enrichment error:", duplicateUpdateError);
      }
    } else {
      leadId = lead.id;
      createdLead = true;
    }

    const { data: existingCampaignLink, error: linkLookupError } = await supabase
      .from("campaign_leads")
      .select("lead_id")
      .eq("campaign_id", campaignId)
      .eq("lead_id", leadId)
      .limit(1)
      .maybeSingle();

    if (linkLookupError) {
      console.error("Campaign lead lookup error:", linkLookupError);
      if (createdLead) await supabase.from("leads").delete().eq("id", leadId);
      return json({ error: "Your enquiry was received but campaign tracking could not be completed. Please contact CIU Admissions." }, 500);
    }

    if (!existingCampaignLink) {
      const { error: campaignLeadError } = await supabase
        .from("campaign_leads")
        .insert({ campaign_id: campaignId, lead_id: leadId });

      if (campaignLeadError) {
        console.error("Campaign lead link error:", campaignLeadError);
        if (createdLead) await supabase.from("leads").delete().eq("id", leadId);
        return json({ error: "Your enquiry was received but campaign tracking could not be completed. Please contact CIU Admissions." }, 500);
      }
    }

    return json({ success: true, leadId, campaignId, duplicate: duplicateLead });
  } catch (error) {
    console.error("Lead capture request error:", error);
    return json({ error: "Invalid request." }, 400);
  }
});
