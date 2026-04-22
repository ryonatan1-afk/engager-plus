# Security hardening plan

## Goal
Make the app safe to hand to a beta user — protect their contact data, prevent unauthorized access to API endpoints, and limit blast radius if any credential is compromised.

## Current risks (priority order)

1. **No authentication on API endpoints** — anyone with the Railway URL can trigger syncs, read contact data, or send emails to arbitrary addresses.
2. **HubSpot OAuth token stored in DB** — if DB credentials leak, attacker gets a live read token to the beta user's HubSpot.
3. **Contact PII in database** — names, emails, companies, countries sit in plaintext in Neon.
4. **No input validation or rate limiting** — `/api/digest/test` accepts any email address; endpoints can be hammered freely.

---

## Change 1 — API key authentication on all admin routes

**File**: `src/api/index.ts` + new `src/lib/auth-middleware.ts`

Add a `requireApiKey` Express middleware that checks the `Authorization: Bearer <secret>` header on every `/api/*` route. The secret is stored in a new `API_SECRET` env var set in Railway.

Exempt routes (must stay open):
- `GET /health` — monitoring
- `GET /auth/hubspot` — browser redirect
- `GET /auth/hubspot/callback` — OAuth callback from HubSpot
- `GET /unsubscribe` — one-click link from email

All other routes require the header. Return `401 Unauthorized` if missing or wrong.

**Env var to add**: `API_SECRET=<random 32-char string>`

---

## Change 2 — Request validation

**File**: `src/api/index.ts`

- `/api/digest/test`: validate `email` is a valid email format before passing to Resend
- `/api/sync/contacts`, `/api/sync/owners`: no body needed — already safe
- `/api/digest/send`: add a confirmation header or body flag to prevent accidental mass sends

---

## Change 3 — Rate limiting

**Package**: `express-rate-limit` (lightweight, no Redis needed for MVP)

Apply limits:
- `/api/digest/test` — 5 requests per 15 minutes (prevent spam sends)
- `/api/sync/*` — 10 requests per hour
- `/unsubscribe` — 20 requests per 15 minutes

---

## Change 4 — Security headers

**Package**: `helmet` (one-liner middleware)

Adds: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`. Prevents a class of browser-based attacks. Single line: `app.use(helmet())`.

---

## Change 5 — Neon DB role restriction

**Where**: Neon console (not code)

Create a dedicated DB role with only `SELECT`, `INSERT`, `UPDATE`, `DELETE` on application tables. Remove `CREATE`, `DROP`, `ALTER` privileges. The app never needs DDL at runtime — only migrations do, and those run manually.

---

## What we're NOT doing (and why)

- **Encrypting contact data at rest** — Neon encrypts storage by default; adding application-level encryption adds complexity with marginal benefit for a beta.
- **JWT/session auth for a UI** — there's no user-facing UI; API key is sufficient for the admin API.
- **Rotating HubSpot tokens** — HubSpot handles refresh automatically; our code already does this correctly.

---

## Implementation order

1. `src/lib/auth-middleware.ts` — write the middleware
2. `src/api/index.ts` — apply middleware, add email validation
3. `npm install helmet express-rate-limit` — add packages
4. `src/index.ts` — add helmet
5. Apply rate limiters to relevant routes
6. Add `API_SECRET` to Railway env vars
7. Update `.env.example` with new var
8. Update `CLAUDE.md` env var list

**Estimated effort**: ~half a day
