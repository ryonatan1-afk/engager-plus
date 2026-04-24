# Build plan

## Current state
**Date**: 2026-04-23
**Phase**: All phases complete. App live in production.

**Deployed**: Railway (engager-plus-production.up.railway.app)
**Email**: Resend, sending from digest@getrapport.app
**Domain**: getrapport.app (Cloudflare Registrar)
**GitHub**: https://github.com/ryonatan1-afk/engager-plus (v0.2.0)

**Next step**: Populate real HubSpot contacts with `hs_last_sales_activity_timestamp` and trigger `POST /api/sync/contacts`. Monday cron handles everything from there.

---

## Known issues
- None. Production is healthy.

---

## Phase 1 — Data plumbing
- [x] Set up Express + TypeScript project structure
- [x] Configure Prisma with PostgreSQL, run initial migration
- [x] HubSpot OAuth flow (private app, token storage)
- [x] Contact sync: search API with activity filter, pagination
- [x] Country normalisation: ISO 3166-1 alpha-2 lookup table
- [x] Location fallback chain (contact → company → email domain → unknown)
- [x] Owner sync: fetch and cache rep list
- [x] Daily cron job for incremental contact sync
- [x] Data quality report: contacts with `location_status = 'unknown'`
- [x] Provision PostgreSQL (Neon), run migrations, complete HubSpot OAuth

**Note**: Node.js is at `C:\Program Files\nodejs\` — prefix bash npm/node commands with `export PATH="$PATH:/c/Program Files/nodejs" &&`.

## Phase 2 — Holiday engine
- [x] Nager.Date client: fetch national holidays by country + year
- [x] Open Holidays API client: fetch religious/cultural events
- [x] Holiday cache: upsert into `holidays` table
- [x] Weekly cache refresh cron (Sunday 3am, 2 years ahead)
- [x] Holiday matcher: cross-reference contacts × holidays, 14-day window
- [x] Write matches to `holiday_matches` with `alert_7d` and `alert_1d` flags
- [x] Unit tests for matcher logic

## Phase 3 — AI greetings
- [x] Anthropic SDK setup, env var for API key
- [x] Greeting prompt template (see `docs/architecture.md`)
- [x] Greeting generator: call Claude, store in `greetings` table
- [x] Sunday night cron to pre-generate greetings for upcoming week
- [x] Retry logic for failed generations
- [x] Unit tests for prompt construction

## Phase 4 — Email digest
- [x] Mailjet integration (swapped from SendGrid), env vars for API key + secret
- [x] Digest builder: group matches by owner, sort by urgency (alert1d first)
- [x] HTML email template (today / this week sections)
- [x] Contact card: name, company, holiday, date, greeting, last activity
- [x] "+N more" footer link to HubSpot
- [x] Monday 7am cron per rep (timezone-aware — hourly check, sends at 7am local)
- [x] Digest preview command (`npm run digest:preview`, add `--html` for raw HTML)
- [x] Test send via `POST /api/digest/test { email }` and `POST /api/digest/send`

## Phase 5 — HubSpot card
- [ ] Set up HubSpot UI Extensions project (`hs project create`)
- [ ] Express API endpoint: `GET /api/contacts/:hsObjectId/holidays`
- [ ] Card component: upcoming holidays list, greeting copy button
- [ ] Deploy to HubSpot sandbox, test on contact record
- [ ] Production deploy via `hs project upload`

## Phase 5 — HubSpot card
- [ ] DEFERRED — client-facing teams don't live in HubSpot; not critical for MVP. Revisit post-launch if reps ask for in-CRM context.

## Phase 7 — Smart digest (complete, 2026-04-22)
- [x] Holiday significance field: major (Nager), cultural (OpenHolidays), minor
- [x] Contact scoring: relationship recency × 2 + holiday significance
- [x] Dedup: one holiday per contact per week
- [x] Urgency tightening: 6–7 day cards suppressed if score < 4
- [x] LATER THIS WEEK section in email template
- [x] 12-month activity filter re-enabled on contact sync

## Phase 6 — Refinement
- [ ] Religious/cultural holiday coverage audit (top 20 countries) — data review, not code
- [ ] Contact tagging: allow reps to manually set religion/observance — deferred, needs UI
- [ ] User preferences: mute contacts, adjust alert window — deferred, needs UI
- [x] Logging + error alerting: `src/lib/alert.ts` sends email to `ALERT_EMAIL` on any cron failure; timestamps on all scheduler log lines
- [x] Unsubscribe — DB column (`unsubscribed_at` on owners), Prisma migration done, builder filters unsubscribed owners
- [x] Unsubscribe — email footer link + `GET /unsubscribe?token=<hsOwnerId>` endpoint
- [ ] Admin dashboard — deferred post-launch
