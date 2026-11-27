# CIU Salesperson Accountability — Release Checklist

## Current release boundary
- Development branch: `feature/salesperson-task-accountability`
- Intended base/production branch: `deploy/ciu-crm-updated`
- Draft pull request: https://github.com/isabirye99-collab/ai-social-bot/pull/6
- Do not merge or deploy until the migration, build, permissions, and scheduled-job checks below are complete.

## Database migrations
Review and apply in this order in a controlled release:
1. `supabase/migrations/20261127140000_salesperson_contact_review_history.sql`
2. `supabase/migrations/20261127170000_salesperson_calendar_absence_report_snapshots.sql` (includes append-only absence decision audit history)
3. `supabase/migrations/20261127180000_align_salesperson_call_interactions.sql` (aligns task call logging with the existing engagement interaction constraints: outgoing-call channel, optional engagement contact link, and supported outcome labels)
4. `supabase/migrations/20261127190000_restrict_engagement_interaction_mutations.sql` (limits edits/deletes to record creators or management; task-outcome interactions are management-only for edits/deletes)

The live Supabase migration history was checked read-only on 2026-11-27. None of these four migrations is recorded as applied. Do not run them against production until the release owner has reviewed the SQL, confirmed the schema/role assumptions, taken a backup or confirmed the normal recovery process, and explicitly approved the change. The Tasks page now tolerates missing optional accountability tables while surfacing other database errors, but the new features remain unavailable until migrations are applied.

## Required Vercel environment variables
Configure these on the CRM Vercel project (server-side only):
- `CRON_SECRET`: a long random secret used to protect the scheduled endpoint.
- `SUPABASE_SERVICE_ROLE_KEY`: the Supabase service-role secret. Never use a `NEXT_PUBLIC_` prefix and never expose this value in browser code.

The route also uses the existing `NEXT_PUBLIC_SUPABASE_URL`. After setting variables, redeploy the intended production branch only after explicit release approval.

## Scheduled finalisation
- Vercel cron path: `/api/cron/finalize-contact-reports`
- Schedule: `0 14 * * *` UTC (17:00 East Africa Time).
- The endpoint checks `CRON_SECRET`, checks the EAT time, reads the CIU working calendar, skips non-working days, and inserts only missing daily snapshots.
- Verify the Vercel project root is `crm`, so `crm/vercel.json` is used by Vercel.
- Verify the cron schedule is available for the project's Vercel plan and confirm the first production invocation in function logs. Do not manually invoke with production secrets in a public or untrusted environment.

## Continuous integration
- Workflow: `.github/workflows/ciu-crm-build.yml`.
- Runs `npm ci` and `npm run build` in `crm/` for matching pull requests and pushes to the feature branch, with placeholder Supabase build variables only.
- Latest verified build: run #44 (ID `45998902394`) passed on commit `b07d29893871cb8e645f1eb564979d01d6e12ac8`; install and production build completed successfully. The Tasks page now treats missing optional accountability tables as a migration-not-yet-applied condition, while still surfacing other errors. This is a compatibility safeguard, not a substitute for applying and testing the migrations. The migration for `Paid Acceptance Fee` is also included on the feature branch. `npm ci` reported 3 dependency audit findings (2 high, 1 critical); review them separately before release and do not run `npm audit fix --force` blindly.
- A read-only production schema check on 2026-11-27 confirmed `engagement_interactions.contact_id` is currently NOT NULL and the current outcome constraint allows only the existing lowercase values. Migration #3 addresses these known schema mismatches and now includes all call-task UI outcomes, including `Paid Acceptance Fee`; it remains unapplied.
- A read-only policy check found the existing `Authenticated staff manage engagement interactions` policy allowed all authenticated users to manage all interaction records (`USING true`, `WITH CHECK true`). A feature-branch migration now replaces this with active-staff read/create permissions, creator-or-management edit/delete for ordinary interactions, and management-only edits/deletes for `Salesperson task call outcome` records. Creator-based update/delete policies also require the creator to have an active CRM profile, so deactivated staff cannot keep modifying their old records. The Call Centre & WhatsApp UI hides edit/delete controls for records the current user cannot change. The insert policy also requires a task-outcome interaction to link to a call task accessible to the current user, with the same lead and current-user attribution. This is a proposed change only: test staff role coverage, existing contact-centre flows, task follow-up linking, and RPC permissions in a non-production environment before applying.

- A read-only production table check on 2026-11-27 confirmed that `ciu_working_calendar`, `salesperson_absence_requests`, `salesperson_absence_decision_history`, `salesperson_contact_report_snapshots`, and `lead_contact_review_history` are not present in the live schema. This explains why the Tasks page's new accountability queries could fail before the optional-table handling change. The feature-branch UI now skips only recognized missing-table/schema-cache errors for these optional governance queries; it still throws permission, network, and other query errors. Core tasks/leads remain required. Do not treat this as a production fix until a reviewed release is deployed.
- Report-correction guard reviewed on the feature branch: first-time finalisation remains restricted to today's report after 17:00 EAT, but an existing snapshot can be corrected later with a required reason and appended revision. The change is not yet verified by CI or database tests.
- Active-profile enforcement now covers creator-based update/delete policies for both engagement contacts and interactions in migration #4, most recently at commit `06c5b1a2f35748c543515e54897b00103fe82fd4`. Build/RLS regression checks for this latest change are pending; a passing earlier build does not cover it.
- This verifies compilation/build only; it does not verify database migrations, RLS behaviour, Vercel preview deployment, or the scheduled production job.

## Required tests before release
1. Run the CRM build/type-check against the exact PR head commit.
2. Apply migrations to a non-production Supabase environment first.
3. Verify salesperson can see/export only their own report and absence requests.
4. Verify interaction policy migration: active staff can read/create; ordinary interaction creators can edit/delete their own records; management can administer all records; non-management staff cannot edit/delete salesperson task-outcome records; inactive users are blocked. Verify Call Centre & WhatsApp still supports normal logging, follow-up task linking, and lead assignment.
5. Verify manager/admin/super_admin can see team progress, approve/reject absences, manage the calendar, record review decisions, and view both contact-review and absence-decision audit histories.
6. Verify marketing, finance, viewer, and short-course roles cannot read team report snapshots or write review/absence decisions.
7. Verify 50 unique answered-call contacts meets target; repeat calls to the same lead count once; unanswered calls, messages, and wrong numbers do not count.
8. Verify public holidays/closures suppress target, working-day overrides enable target, and approved partial/full-day absences adjust it.
9. Verify the cron creates one snapshot per active salesperson, skips existing snapshots, skips non-working days, and runs only at/after 17:00 EAT.
10. Verify first-time finalisation is limited to the current EAT date at/after 17:00, while corrections to an existing report can be made on a later date only with a required reason and a new immutable revision; confirm the original snapshot remains unchanged.
11. Verify PDF print output and CSV files open correctly in Excel.
12. Test lead reassignment and ensure historical call attribution remains with the salesperson who made the call.
13. Confirm the live branch remains `deploy/ciu-crm-updated`; do not merge/deploy without approval.

## Known limitations
- The holiday calendar is management-maintained; it is not pre-populated with future Uganda public-holiday dates. Management must enter confirmed dates and update them when authorities announce moon-dependent holidays.
- CSV exports are Excel-compatible but are not native `.xlsx` workbooks.
- Answered-call status is manually recorded without telephony integration; it is not independent proof of a completed call.
- The cron route requires the environment variables above and has not been confirmed running in production.
- No production data writes, migration applications, merge, or deployment have been performed.

## Follow-up review findings — 2026-11-27
- Corrected attribution in the live Tasks-page daily summary, manual report snapshot builder, and scheduled finalisation route: use `created_by` (the staff member who recorded the call) first, falling back to `assigned_to` only for legacy rows where the creator is missing. This prevents the next-contact assignee from receiving credit for a call they did not record.
- Corrected migration #4's interaction-update `WITH CHECK` clause so creator-based updates also require an active CRM profile, consistent with the `USING` condition.
- The live production schema was rechecked read-only: `engagement_interactions.contact_id` remains NOT NULL; its channel constraint includes `outgoing_call`; its outcome constraint still permits only the legacy lowercase values; and the broad `Authenticated staff manage engagement interactions` policy still allows all authenticated users to manage all rows. These facts reinforce that migrations #3 and #4 are required for the proposed feature, but also carry workflow risk and must be tested before release.
- The follow-up code and checklist commit `0b5df81f41fb796ccf626de24fe196a55a9b5dcd` passed the CIU CRM build in run #66: https://github.com/isabirye99-collab/ai-social-bot/actions/runs/46001877981. This confirms compilation/build only; it does not replace database/RLS testing or Vercel cron verification.
- The current Supabase security advisor also reports pre-existing callable SECURITY DEFINER functions (`assign_lead_from_engagement`, partnership MOU functions, and the public short-course application RPC) and disabled leaked-password protection. These are outside the salesperson-accountability migration set; review them separately rather than changing them as part of this release without function-by-function authorization analysis.
