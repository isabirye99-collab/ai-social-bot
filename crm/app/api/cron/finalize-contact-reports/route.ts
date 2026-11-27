import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EAT = "Africa/Kampala";
const PAGE_SIZE = 1000;

function dateKeyInEAT(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: EAT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {} as Record<string, string>);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isWeekday(dateKey: string) {
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

function utcBoundsForEATDate(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00+03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function fetchAll<T>(query: any): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({
      error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment configuration.",
    }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const now = new Date();
    const eatClock = new Intl.DateTimeFormat("en-GB", {
      timeZone: EAT, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now).reduce((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {} as Record<string, string>);
    if (Number(eatClock.hour) < 17) {
      return NextResponse.json({ error: "Scheduled finalisation is only permitted from 5:00pm EAT." }, { status: 409 });
    }
    const reportDate = dateKeyInEAT(now);
    const { data: calendarRow, error: calendarError } = await supabase
      .from("ciu_working_calendar")
      .select("day_type")
      .eq("calendar_date", reportDate)
      .eq("is_active", true)
      .maybeSingle();
    if (calendarError) throw calendarError;
    const workingDay = calendarRow
      ? calendarRow.day_type === "working_day"
      : isWeekday(reportDate);
    if (!workingDay) {
      return NextResponse.json({ ok: true, report_date: reportDate, skipped: true, reason: "Non-working day in CIU calendar." });
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,full_name,role,is_active")
      .eq("role", "salesperson")
      .eq("is_active", true);
    if (profilesError) throw profilesError;

    const { start, end } = utcBoundsForEATDate(reportDate);
    const interactions = await fetchAll<any>(
      supabase.from("engagement_interactions")
        .select("id,lead_id,channel,response,outcome,assigned_to,created_by,contacted_at")
        .eq("channel", "call")
        .eq("response", "answered")
        .gte("contacted_at", start)
        .lt("contacted_at", end)
        .order("contacted_at", { ascending: true })
    );
    const qualifying = interactions.filter((item) =>
      Boolean(item.lead_id) && (item.outcome || "").trim().toLowerCase() !== "wrong number"
    );
    const leadIds = Array.from(new Set(qualifying.map((item) => item.lead_id as string)));
    const leadRows: any[] = [];
    for (let offset = 0; offset < leadIds.length; offset += 500) {
      const batchIds = leadIds.slice(offset, offset + 500);
      const { data, error } = await supabase.from("leads")
        .select("id,name,ciu_number,phone")
        .in("id", batchIds);
      if (error) throw error;
      leadRows.push(...(data || []));
    }
    const leadById = new Map(leadRows.map((lead) => [lead.id, lead]));
    const { data: absences, error: absenceError } = await supabase
      .from("salesperson_absence_requests")
      .select("salesperson_id,day_fraction")
      .eq("absence_date", reportDate)
      .eq("status", "approved");
    if (absenceError) throw absenceError;

    const { data: existingRows, error: existingError } = await supabase
      .from("salesperson_contact_report_snapshots")
      .select("salesperson_id,revision")
      .eq("report_date", reportDate)
      .order("revision", { ascending: false });
    if (existingError) throw existingError;
    const alreadyFinalized = new Set((existingRows || []).map((row) => row.salesperson_id));

    const created: string[] = [];
    const skippedExisting: string[] = [];
    for (const profile of profiles || []) {
      if (alreadyFinalized.has(profile.id)) {
        skippedExisting.push(profile.id);
        continue;
      }
      const staffCalls = qualifying.filter((item) =>
        (item.assigned_to || item.created_by) === profile.id
      );
      const uniqueLeadIds = Array.from(new Set(staffCalls.map((item) => item.lead_id as string)));
      const absenceFraction = Math.min(1, (absences || [])
        .filter((absence) => absence.salesperson_id === profile.id)
        .reduce((sum, absence) => sum + Number(absence.day_fraction || 0), 0));
      const target = Math.max(0, Math.round(50 * (1 - absenceFraction)));
      const status = target === 0
        ? "Exempt / non-working day"
        : uniqueLeadIds.length >= target
          ? "Target achieved"
          : uniqueLeadIds.length > 0
            ? "Below target"
            : "No qualifying calls";
      const reportData = {
        salesperson_id: profile.id,
        salesperson_name: profile.full_name || "Unnamed salesperson",
        report_date: reportDate,
        target,
        unique_students_contacted: uniqueLeadIds.length,
        status,
        working_day: true,
        approved_absence_fraction: absenceFraction,
        generated_at_eat: new Intl.DateTimeFormat("en-UG", {
          timeZone: EAT, dateStyle: "medium", timeStyle: "short",
        }).format(now),
        finalization_method: "scheduled server-side job",
        calls: staffCalls.map((item) => {
          const lead = leadById.get(item.lead_id);
          return {
            contacted_at: item.contacted_at,
            lead_id: item.lead_id,
            student_name: lead?.name || lead?.ciu_number || "Unnamed student",
            ciu_number: lead?.ciu_number || "",
            phone: lead?.phone || "",
            outcome: item.outcome || "",
          };
        }),
      };
      const { error: insertError } = await supabase
        .from("salesperson_contact_report_snapshots")
        .insert({
          report_date: reportDate,
          salesperson_id: profile.id,
          revision: 1,
          report_data: reportData,
          finalized_by: null,
          finalization_source: "automated",
        });
      if (insertError) {
        // A simultaneous manual finalisation may have won the unique constraint.
        if (insertError.code === "23505") {
          skippedExisting.push(profile.id);
          continue;
        }
        throw insertError;
      }
      created.push(profile.id);
    }

    return NextResponse.json({
      ok: true,
      report_date: reportDate,
      created_count: created.length,
      skipped_existing_count: skippedExisting.length,
      created_salesperson_ids: created,
    });
  } catch (error) {
    console.error("CIU daily contact report cron failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unexpected finalisation failure",
    }, { status: 500 });
  }
}
