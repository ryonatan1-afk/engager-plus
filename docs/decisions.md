# Architectural decisions

A log of key decisions made during planning, and why. Reference this before proposing changes to core design choices.

---

## CRM: HubSpot only (MVP)
**Decision**: Integrate with HubSpot exclusively for MVP.
**Why**: Single integration reduces scope significantly. HubSpot has a well-documented API and UI Extensions SDK. Other CRMs (Salesforce, Pipedrive) can be added post-MVP using the same abstraction layer.

---

## Delivery: Email digest only (MVP)
**Decision**: Weekly Monday morning email digest as the only notification channel.
**Why**: Lowest friction for users — no new app to open, no Slack setup required. Monday morning timing matches weekly planning behaviour. In-app dashboard and Slack notifications deferred to post-MVP.

---

## Cadence: Weekly Monday digest (not daily)
**Decision**: One digest per week, sent Monday morning, covering the full week ahead.
**Why**: Daily emails would fatigue users quickly. A Monday digest fits how reps plan their week. Same-day nudges can be added later as a separate lightweight email if users ask for it.

---

## Location enrichment: CRM fields only, no paid API
**Decision**: Resolve contact country from HubSpot fields only — no LinkedIn scraping, no paid enrichment APIs (Apollo, Clay, Clearbit).
**Why**: Paid APIs add cost and complexity for MVP. LinkedIn scraping violates ToS. HubSpot country fields, company fallback, and email domain inference cover the majority of cases. Revisit if data quality proves to be a significant problem post-launch.

**Fallback chain**: contact `country` field → associated company `country` → email domain TLD → mark as `unknown`.

---

## Activity threshold: any CRM interaction in last 12 months
**Decision**: A contact is "active" if `hs_last_sales_activity_timestamp` is within 12 months. This field covers notes, calls, and emails logged in HubSpot.
**Why**: Prevents garbage contacts from polluting the digest. 12 months is broad enough to include accounts that are slow-moving but still live. Threshold is a config value — easy to adjust.

---

## Holiday coverage: all types (national + religious + cultural)
**Decision**: Cover public/national holidays (Nager.Date), religious observances (Eid, Diwali, Passover, etc.), and cultural events (Lunar New Year) via Open Holidays API.
**Why**: The value of the tool is in the edges — anyone knows about Christmas, but Nowruz or Shunbun no Hi are exactly what reps forget. Covering all types maximises the tool's usefulness for global teams.

---

## Religious holidays: soft language, country as signal only
**Decision**: Country is used as a soft signal for religious holidays — not a hard assertion. Greetings use "may be celebrating" framing, not "is celebrating."
**Why**: Country ≠ religion. Not every person in India celebrates Diwali; many do in countries where it's not the norm. Asserting religion from country would produce incorrect and potentially offensive greetings. Soft framing is safer and still useful.

---

## Greetings: AI-generated via Claude, pre-generated Sunday night
**Decision**: Use Claude (`claude-sonnet-4-20250514`) to generate personalised greetings. Generate them on Sunday night and cache results — do not generate on-demand during digest send.
**Why**: AI greetings are the product's key differentiator over a simple holiday calendar. Pre-generation ensures the Monday digest sends fast and isn't blocked by API latency or failures. Cached greetings can be regenerated manually if needed.

---

## Platform: CRM plugin / HubSpot UI Extension
**Decision**: Build as a HubSpot UI Extension (in-CRM card) rather than a standalone web app, browser extension, or mobile app.
**Why**: Keeps the workflow native — reps don't leave HubSpot to see holiday context. The digest email handles proactive alerting; the card handles in-context lookup when a rep is already on a contact record.

---

## Backend: single Node.js service for MVP
**Decision**: Run the Express API, cron scheduler, and all workers in a single Node.js process for MVP. Use `node-cron` rather than a separate queue or worker service.
**Why**: Simplest possible deployment. A separate queue (Bull, BullMQ) adds operational complexity that isn't justified until job volume or reliability requirements grow. Extract the scheduler if it becomes a problem.

---

## No write access to HubSpot
**Decision**: The app is entirely read-only against HubSpot. No write scopes requested.
**Why**: Minimises OAuth permission footprint, reduces risk, and simplifies the security model. The only data we write is to our own PostgreSQL database.

---

## OAuth token storage: single DB row, not file/env
**Decision**: Store the HubSpot access + refresh token as a single row (`id = 1`) in the `oauth_tokens` table, upserted on each auth/refresh cycle.
**Why**: Keeps all state in one place (Postgres). Environment variables are read-only at deploy time and can't be updated when a token refreshes. File-based storage adds another thing to back up. The single-row design explicitly encodes the constraint that this app serves one HubSpot account.
**Implication**: The app is single-tenant by design for MVP. Multi-tenancy would require a `portal_id` key on this table.

---

## Company country lookup: `associatedcompanyid` property, not Associations API
**Decision**: Fetch `associatedcompanyid` as a contact property in the search response, then batch-read those companies separately — rather than using the Associations API.
**Why**: The Associations API requires a separate call per contact (N+1). Fetching `associatedcompanyid` as a property gets it in the same search response at no extra cost, then a single batch company read covers up to 100 contacts at once.

---

## OAuth scopes: crm.objects.owners.read required
**Decision**: Include `crm.objects.owners.read` in the OAuth scope list alongside the contact/company scopes.
**Why**: The owner sync (`syncOwners`) calls the HubSpot Owners API, which requires this scope. Discovered at runtime — HubSpot returns a 403 without it. The scope must be declared in both `src/hubspot/auth.ts` and the HubSpot app's Auth settings in the developer portal.
**Note**: `timeline.read` is not a valid HubSpot scope — removed it during bootstrap.

---

## Database: Neon (hosted PostgreSQL)
**Decision**: Use Neon (neon.tech) as the PostgreSQL host for development.
**Why**: Free tier with 10GB storage and no expiry. No local Docker or installer required. Connection string drops straight into `DATABASE_URL` — Prisma doesn't know the difference.

---

## Email TLD inference: 2-char ccTLDs only
**Decision**: Only infer country from email domain TLDs that are exactly 2 characters (ccTLDs like `.de`, `.jp`, `.uk`). Generic TLDs (`.com`, `.io`, `.net`, `.org`, `.app`, etc.) are explicitly excluded.
**Why**: Generic TLDs carry no geographic signal. False positives (e.g. inferring a country from `.co`) would silently assign the wrong country and corrupt match results downstream. When in doubt, `unknown` is safer than a wrong country.

---

## Holiday match window: 14 days, weekOf anchored to Monday
**Decision**: The matcher looks 14 days ahead (not 7) and sets `weekOf` to the Monday of the holiday's week.
**Why**: 14 days gives enough lead time for the digest to surface holidays that fall in the following week without needing a separate "next week" query. Anchoring `weekOf` to Monday (not the holiday date itself) makes digest grouping simple — all holidays in a given digest week share the same `weekOf` value.

---

## Greeting prompt: split into pure builder + generator module
**Decision**: `src/greeting/prompt.ts` contains only `buildPrompt()` and `SYSTEM_PROMPT` with no imports from `@prisma/client` runtime or Anthropic SDK. The API call and DB write live in `src/greeting/generator.ts`.
**Why**: Keeps prompt construction unit-testable without mocking the Anthropic SDK or Prisma. The prompt is the core logic worth testing — the API call is just I/O.

---

## Greeting generation: pre-generated Sunday night, not on-demand
**Decision**: `generatePendingGreetings()` runs as a Sunday 22:00 cron. The digest (Phase 4) reads from the `greetings` table — it never calls Claude at send time.
**Why**: Decouples digest send reliability from Anthropic API availability. A slow or failed API call at Monday 7am would delay or break the digest. Pre-generation means the worst case is a missing greeting (skipped in the digest), not a send failure.

---

## Greeting generator: contacts without firstName are skipped
**Decision**: If a contact has no `firstName`, the generator skips them silently rather than generating a generic greeting.
**Why**: A personalised greeting addressed to "there" or to a last name only would look worse than no greeting. The digest can still include the holiday alert for that contact without a generated message — better to surface the holiday than produce a bad greeting.

---

## Email provider: Mailjet (switched from SendGrid)
**Decision**: Use Mailjet instead of SendGrid.
**Why**: User preference. The send logic is isolated to `src/digest/sender.ts` (30 lines) — swapping providers again in future only touches that file.
**Sandbox mode**: `MAILJET_SANDBOX=true` in `.env` processes API calls without delivering. Used during development because no verified sender domain exists yet. Alert emails in `src/lib/alert.ts` bypass sandbox mode intentionally.

---

## HubSpot UI Extension card: deferred
**Decision**: Skip Phase 5 (HubSpot in-CRM card) for MVP.
**Why**: Client-facing reps don't live inside HubSpot. The Monday digest email covers the proactive use case; the card only adds value for reps who habitually look up contacts in HubSpot, which is not the target behaviour. Revisit post-launch if users ask.

---

## Unsubscribe: token is plain hsOwnerId
**Decision**: The unsubscribe link uses the owner's `hsOwnerId` directly as the token (e.g. `GET /unsubscribe?token=<hsOwnerId>`), with no HMAC or signed JWT.
**Why**: This is an internal tool — recipients are company employees, not public users. The security tradeoff is acceptable for MVP. If the tool becomes externally facing, replace with a signed token.

---

## Email provider: switched from Mailjet to Resend
**Decision**: Replace Mailjet with Resend for digest delivery.
**Why**: Mailjet account was suspended. Resend has simpler signup (GitHub login), a generous free tier, and a cleaner API. Code change was isolated to `src/digest/sender.ts`.
**Sender**: `digest@getrapport.app` — verified via Resend's Cloudflare auto-configuration.

---

## Greeting output: JSON with subject + body
**Decision**: Claude returns `{"subject": "...", "body": "..."}` JSON instead of plain text.
**Why**: The digest email needs a subject line for the mailto draft button. Storing subject alongside body avoids regenerating greetings at send time. Falls back gracefully — if JSON parse fails, raw text is used as body with null subject.
**Schema**: `subject String?` added to `Greeting` model (nullable for backwards compatibility).

---

## Mailto draft button: pre-filled email draft per contact card
**Decision**: Each contact card in the digest includes an "Open draft in email app" button — a `mailto:` link with To, Subject, and Body pre-filled.
**Why**: Removes friction from the rep's workflow. One click opens a ready-to-send email. Body prefixed with `Hi [firstname],\r\n\r\n` at template render time (not stored in DB) so the greeting body stays clean for other uses. Email address is NOT encoded in the mailto href (only query params are encoded) to avoid `%40` breaking the To field.

---

## Smart digest: scoring, dedup, urgency tightening (Phase 7)
**Decision**: Contacts are scored before digest rendering; digest shows max 10 curated cards.
**Scoring**: relationship recency (0–3) × 2 + holiday significance (0–2). Sorted descending.
**Dedup**: one holiday per contact per week — highest significance wins, then soonest date.
**Urgency**: 6–7 day cards suppressed unless score ≥ 4. Three sections: TODAY/TOMORROW, THIS WEEK, LATER THIS WEEK.
**Why**: Prevents wall-of-cards problem in busy weeks. Reps see 3–8 high-signal contacts, not 20.

---

## Holiday significance: stored at ingest, not computed at query time
**Decision**: `significance` enum (`major`, `cultural`, `minor`) stored on the `holidays` table.
**Why**: Computed at ingest where the source is known (Nager = major, OpenHolidays = cultural). Avoids re-deriving significance on every digest query. Stored as a Prisma enum so invalid values are rejected at DB level.

---

## Deployment: Railway (single service)
**Decision**: Deploy to Railway, not Render or Fly.io.
**Why**: Render's free tier sleeps — cron jobs would miss Monday 7am fires. Railway's $5/month credit covers a small Node.js service and never sleeps. Single service (Express + cron in one process) keeps deployment simple.
**PORT**: Do NOT set PORT in Railway env vars — Railway injects its own and the app uses `process.env.PORT` correctly.
**DATABASE_URL**: Remove `&channel_binding=require` from the Neon connection string — this param causes connection failures from Railway's network.

---

## Branding: Rapport / getrapport.app
**Decision**: Product name is Rapport. Domain is getrapport.app registered on Cloudflare Registrar.
**Why**: "Rapport" is vocabulary reps already use. No existing SaaS product found with this name. `.app` TLD signals a modern product. `getrapport.app` follows the `get[productname].app` convention common in SaaS.

---

## Error alerting: email via Mailjet to ALERT_EMAIL
**Decision**: Cron job failures send a plain-text alert email to `ALERT_EMAIL` via `src/lib/alert.ts`.
**Why**: Simplest possible alerting with no extra dependencies. Covers the most important failure modes (sync, matcher, greeting gen, digest send) before real users depend on the tool. Upgrade to a proper alerting service (PagerDuty, Sentry) post-launch if needed.
