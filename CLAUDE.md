# Holiday digest — Claude Code context

## What this project is
A HubSpot-embedded tool that surfaces upcoming holidays for a rep's contacts and generates AI-powered greetings. Contacts are pulled from HubSpot CRM, filtered by activity, matched to holidays by country, and delivered via a weekly Monday morning email digest. There is also an in-CRM card (HubSpot UI Extension) showing upcoming holidays on each contact record.

## Tech stack
- **Runtime**: Node.js 20+ with TypeScript
- **Backend**: Express — REST API and cron scheduler
- **Database**: PostgreSQL — contact cache, holiday cache, match results
- **ORM**: Prisma
- **HubSpot**: `@hubspot/api-client` — OAuth private app
- **Holiday data**: Nager.Date API (national) + Open Holidays API (religious/cultural)
- **AI greetings**: Anthropic SDK (`@anthropic-ai/sdk`) — claude-sonnet-4-6
- **Email**: Mailjet (digest delivery)
- **HubSpot card**: HubSpot UI Extensions SDK (React)
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
DATABASE_URL
MAILJET_API_KEY
MAILJET_SECRET_KEY
DIGEST_FROM_EMAIL        # sender address (e.g. digest@yourdomain.com)
MAILJET_SANDBOX          # set to "true" to process sends without delivering (dev/test)
ALERT_EMAIL              # where cron failure alerts are sent (optional but recommended)
```

## Greeting generation
- `src/greeting/prompt.ts` — pure `buildPrompt()` function + `SYSTEM_PROMPT`; no side effects, fully unit-testable
- `src/greeting/generator.ts` — `generatePendingGreetings()` is idempotent: only generates for `holiday_matches` rows with no linked `greeting` row and `holiday.date >= today`
- Contacts without a `firstName` are silently skipped (can't personalise)
- Rep name (`repFirstName`) falls back to `"there"` if owner not found

## Digest (Phase 4)
- `src/digest/builder.ts` — `buildDigests(weekOf)`: queries unnotified matches grouped by owner; `getThisMonday()` anchors the week
- `src/digest/template.ts` — `buildDigestHtml()` produces the HTML email; `buildDigestText()` produces console output for preview
- `src/digest/sender.ts` — `sendDigestEmail()` wraps the Mailjet v3.1 send API; reads `MAILJET_API_KEY` / `MAILJET_SECRET_KEY` / `DIGEST_FROM_EMAIL`
- `src/digest/index.ts` — `sendWeeklyDigests()`: timezone-aware orchestrator (checks if it's 7am local per owner); `sendTestDigest(email)`: sends first owner's data to a test address
- Cron: every hour on Monday (`0 * * * 1`) — sends to owners for whom it's 7am local
- API: `POST /api/digest/test { email }` — test send; `POST /api/digest/send` — force-send all (ignores timezone)
- After send, `notifiedAt` is stamped on each `holiday_match` row so it's excluded from future sends

## Holiday engine
- `src/holidays/nager.ts` — national holidays; filters `global: true` only (regional noise excluded)
- `src/holidays/openholidays.ts` — religious/cultural; alerts on `startDate` for multi-day events (Eid, Diwali span multiple days)
- `src/holidays/cache.ts` — `refreshHolidayCacheFromContacts()` pulls distinct country codes from contacts table, then fetches current year + next year from both APIs; `skipDuplicates: true` makes it safe to re-run
- `src/matcher/matcher.ts` — 14-day rolling window; `weekOf` is always set to the Monday of the holiday's week; `alert7d` = ≤7 days away, `alert1d` = ≤1 day away

## References (load on demand)
- Architecture + data flow: `@docs/architecture.md`
- HubSpot API fields + endpoints: `@docs/hubspot-api.md`
- Holiday data sources: `@docs/holiday-sources.md`
- Build phases + task checklist: `@docs/plan.md`
