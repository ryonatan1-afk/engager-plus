# Holiday digest — Claude Code context

## What this project is
**Rapport** (`getrapport.app`) — a backend service that surfaces upcoming holidays for a sales rep's HubSpot contacts and generates AI-powered greetings. Contacts are pulled from HubSpot CRM, filtered by activity, matched to holidays by country, and delivered via a weekly Monday morning email digest. Each card includes a mailto button that opens a pre-filled draft email in the rep's email client.

## Tech stack
- **Runtime**: Node.js 20+ with TypeScript
- **Backend**: Express — REST API and cron scheduler
- **Database**: PostgreSQL — contact cache, holiday cache, match results
- **ORM**: Prisma
- **HubSpot**: `@hubspot/api-client` — OAuth private app
- **Holiday data**: Nager.Date API (national) + Open Holidays API (religious/cultural)
- **AI greetings**: Anthropic SDK (`@anthropic-ai/sdk`) — claude-sonnet-4-6
- **Email**: Resend (`resend` npm package) — sending from `digest@getrapport.app`
- **HubSpot card**: deferred (reps don't live in HubSpot)
- **Package manager**: npm
- **Testing**: Vitest

## Project structure
```
/
├── src/
│   ├── hubspot/          # OAuth, contact sync, owner lookup, country normalisation
│   ├── holidays/         # Nager.Date + Open Holidays API clients (Phase 2)
│   ├── matcher/          # Country → upcoming holidays logic (Phase 2)
│   ├── greeting/         # Claude API prompt + greeting generator (Phase 3)
│   ├── digest/           # Email builder + SendGrid sender (Phase 4)
│   ├── scheduler/        # node-cron jobs (daily sync, Monday digest)
│   ├── db/               # Prisma client singleton
│   ├── api/              # Express routes (OAuth, sync triggers, data quality)
│   └── scripts/          # One-off scripts: sync.ts, digest-preview.ts
├── prisma/
│   └── schema.prisma     # DB schema — source of truth for all tables
├── hubspot-card/         # UI Extensions React app (Phase 5, separate build)
├── docs/                 # Architecture, API notes, phase plan, decisions
├── .claude/
│   ├── commands/         # Custom slash commands
│   └── settings.json     # Hooks config
└── CLAUDE.md
```

## Key commands
```bash
npm run dev           # Start Express server with hot reload
npm run sync          # Manual trigger: HubSpot contact sync
npm run digest:preview # Preview this week's digest (console output)
npm test              # Run Vitest suite
npm run db:migrate    # Run pending Prisma migrations
npm run db:studio     # Open Prisma Studio
```

## Bootstrap (first run)
Before the server can start, you need:
1. A PostgreSQL database — set `DATABASE_URL` in `.env`
2. `npm run db:migrate` — creates all tables from `prisma/schema.prisma`
3. `GET http://localhost:3000/auth/hubspot` — completes OAuth and stores tokens in DB

## Non-obvious rules
- **Always use ISO 3166-1 alpha-2 codes** for countries (e.g. `DE`, `JP`, `IN`) — never store free-text country names in the database
- **Country normalisation happens at ingest** — convert HubSpot's `country` field to ISO code before any DB write; see `src/hubspot/normalise-country.ts`
- **Active contact threshold** = any CRM interaction (note, call, email) in the last 12 months — use `hs_last_sales_activity_timestamp` as the primary filter field
- **Never write to HubSpot** in this MVP — all operations are read-only; write scopes are not requested
- **Religious holidays use soft language** in greetings — "may be celebrating" not "is celebrating" — because country ≠ religion
- **Greeting prompt context** must include: contact first name, company, country, holiday name, holiday date, and rep's first name
- **Never commit** `.env`, HubSpot app credentials, or Anthropic API keys

## Environment variables required
```
HUBSPOT_CLIENT_ID
HUBSPOT_CLIENT_SECRET
HUBSPOT_REDIRECT_URI
ANTHROPIC_API_KEY
DATABASE_URL             # Neon — remove &channel_binding=require for Railway compatibility
RESEND_API_KEY
DIGEST_FROM_EMAIL        # e.g. digest@getrapport.app (must be verified in Resend)
ALERT_EMAIL              # where cron failure alerts are sent
BASE_URL                 # e.g. https://engager-plus-production.up.railway.app (for unsubscribe links)
NODE_ENV                 # set to "production" on Railway
```

## Deployment
- **Production**: Railway — `engager-plus-production.up.railway.app`
- **Start command**: `npm run build && npm start`
- **Do NOT set PORT** in Railway env vars — Railway injects it automatically
- **GitHub**: https://github.com/ryonatan1-afk/engager-plus

## Greeting generation
- `src/greeting/prompt.ts` — pure `buildPrompt()` function + `SYSTEM_PROMPT`; no side effects, fully unit-testable
- `src/greeting/generator.ts` — `generatePendingGreetings()` is idempotent: only generates for `holiday_matches` rows with no linked `greeting` row and `holiday.date >= today`
- Contacts without a `firstName` are silently skipped (can't personalise)
- Rep name (`repFirstName`) falls back to `"there"` if owner not found

## Digest (Phase 4 + Phase 7)
- `src/digest/builder.ts` — `buildDigests(weekOf)`: scores contacts (relationship × 2 + significance), deduplicates to one holiday per contact, filters 6–7 day cards below score threshold, caps at 10 cards
- `src/digest/template.ts` — `buildDigestHtml()` produces HTML email with TODAY/TOMORROW, THIS WEEK, LATER THIS WEEK sections; each card has a mailto button pre-filled with To/Subject/Body; `buildDigestText()` for console preview
- `src/digest/sender.ts` — `sendDigestEmail()` wraps Resend API; reads `RESEND_API_KEY` / `DIGEST_FROM_EMAIL`
- `src/digest/index.ts` — `sendWeeklyDigests()`: timezone-aware orchestrator; `sendTestDigest(email)`: sends first owner's data to test address
- Cron: every hour on Monday (`0 * * * 1`) — sends to owners for whom it's 7am local
- API: `POST /api/digest/test { email }` — test send; `POST /api/digest/send` — force-send all
- After send, `notifiedAt` is stamped on each `holiday_match` row

## Holiday engine
- `src/holidays/nager.ts` — national holidays (`significance: major`); filters `global: true` only
- `src/holidays/openholidays.ts` — religious/cultural (`significance: cultural`); alerts on `startDate`
- `src/holidays/cache.ts` — `refreshHolidayCacheFromContacts()` pulls distinct country codes, fetches current + next year from both APIs
- `src/matcher/matcher.ts` — 14-day rolling window; `weekOf` = Monday of holiday's week; `alert1d` = ≤1 day away
- **Israel (IL)**: not covered by either Nager or Open Holidays APIs — will produce no matches

## Upcoming work (blueprints in docs/)
- `docs/plan-security.md` — API key auth, rate limiting, helmet, input validation (~half a day)
- `docs/plan-multitenancy.md` — Tenant model, per-tenant HubSpot OAuth, scoped queries (3–4 sessions)
- **Security must be done before multi-tenancy**

## References (load on demand)
- Architecture + data flow: `@docs/architecture.md`
- HubSpot API fields + endpoints: `@docs/hubspot-api.md`
- Holiday data sources: `@docs/holiday-sources.md`
- Build phases + task checklist: `@docs/plan.md`
