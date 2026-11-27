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

Do not run these against production until the release owner has reviewed the SQL, confirmed the schema/role assumptions, taken a backup or confirmed the normal recovery process, and explicitly approved the change. The UI queries the new tables, so deploying UI code before migrations are applied will cause Tasks-page data loading errors.

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
- Confirm a completed GitHub Actions run before release; adding the workflow file does not itself prove the workflow has executed.

## Required tests before release
1. Run the CRM build/type-check against the exact PR head commit.
2. Apply migrations to a non-production Supabase environment first.
3. Verify salesperson can see/export only their own report and absence requests.
4. Verify manager/admin/super_admin can see team progress, approve/reject absences, manage the calendar, record review decisions, and view both contact-review and absence-decision audit histories.
5. Verify marketing, finance, viewer, and short-course roles cannot read team report snapshots or write review/absence decisions.
6. Verify 50 unique answered-call contacts meets target; repeat calls to the same lead count once; unanswered calls, messages, and wrong numbers do not count.
7. Verify public holidays/closures suppress target, working-day overrides enable target, and approved partial/full-day absences adjust it.
8. Verify the cron creates one snapshot per active salesperson, skips existing snapshots, skips non-working days, and runs only at/after 17:00 EAT.
9. Verify corrections require a reason and create a new immutable revision without changing the original.
10. Verify PDF print output and CSV files open correctly in Excel.
11. Test lead reassignment and ensure historical call attribution remains with the salesperson who made the call.
12. Confirm the live branch remains `deploy/ciu-crm-updated`; do not merge/deploy without approval.

## Known limitations
- The holiday calendar is management-maintained; it is not pre-populated with future Uganda public-holiday dates. Management must enter confirmed dates and update them when authorities announce moon-dependent holidays.
- CSV exports are Excel-compatible but are not native `.xlsx` files.
- Answered-call status is manually recorded without telephony integration; it is not independent proof of a completed call.
- The cron route requires the environment variables above and has not been confirmed running in production.
