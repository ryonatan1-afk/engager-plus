# Multi-tenancy plan

## Goal
Allow multiple companies to use Rapport independently — each with their own HubSpot connection, contacts, owners, and digest — with zero data leakage between tenants.

## Core principle
Each company = one **Tenant**. All data except holidays (which are universal by country) is scoped to a tenant. The holiday table is shared; everything else gets a `tenantId`.

---

## Data model changes

### New model: `Tenant`
```prisma
model Tenant {
  id          String    @id @default(uuid())
  name        String?
  apiKey      String    @unique @map("api_key")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz

  contacts    Contact[]
  owners      Owner[]
  oAuthToken  OAuthToken?

  @@map("tenants")
}
```

### Modified models (add `tenantId`):
- `Contact` — add `tenantId String`
- `Owner` — add `tenantId String`
- `OAuthToken` — replace `id: 1` with `tenantId String @unique` (one token per tenant)
- `HolidayMatch` — inherits tenant scope through `Contact`
- `Greeting` — inherits through `HolidayMatch`

### Unchanged (shared across all tenants):
- `Holiday` — country holidays are universal; no duplication needed

---

## Onboarding flow (new tenant)

1. **POST /api/tenants/register** `{ name: "Acme Corp" }`
   - Creates a `Tenant` row
   - Generates a random `apiKey`
   - Returns `{ tenantId, apiKey }`

2. **Tenant visits** `GET /auth/hubspot` with their `apiKey` in the header
   - OAuth flow runs, token stored against their `tenantId`
   - Redirect lands on success page

3. **Tenant calls** `POST /api/sync/contacts` with their `apiKey`
   - Sync runs scoped to their HubSpot account
   - All contacts stored with their `tenantId`

4. **Monday cron fires** — iterates all active tenants, sends each tenant's owners their digest

---

## API changes

Every request to `/api/*` carries `Authorization: Bearer <tenantApiKey>`. Middleware resolves the tenant from the key and attaches `req.tenant` to the request context. All DB queries filter by `tenantId`.

Tenant registration endpoint (`POST /api/tenants/register`) is protected by a separate `ADMIN_SECRET` env var — only the platform operator can create tenants.

---

## Scheduler changes

`sendWeeklyDigests()` currently queries all unnotified matches globally. In multi-tenant mode it loops over active tenants and runs the digest pipeline per tenant, using each tenant's OAuth token for any HubSpot calls needed.

`syncContacts()` and `syncOwners()` accept a `tenantId` parameter and use the corresponding OAuth token.

---

## Holiday cache

No change — holidays are fetched per country, shared across tenants. The `refreshHolidayCacheFromContacts()` function collects distinct country codes across ALL tenants (deduped), which is correct.

---

## Migration strategy

This is a breaking schema change. Migration path:

1. Create `tenants` table, insert one row for the existing account
2. Add `tenantId` column (nullable) to `contacts`, `owners`, `oauth_tokens`
3. Backfill all existing rows with the existing tenant's ID
4. Make `tenantId` non-nullable
5. Update all queries to filter by `tenantId`
6. Update OAuth flow to scope token to tenant

Zero downtime if done in this order — backfill before making non-nullable.

---

## What we're NOT doing in v1 multi-tenancy

- **UI for tenant management** — operator manages tenants via API calls
- **Billing / usage limits** — out of scope for beta
- **Tenant-level holiday preferences** — each tenant gets the same holiday engine; customisation deferred
- **SSO / user accounts** — API key per tenant is sufficient for beta; proper user auth is a future phase

---

## Implementation order

1. Schema: add `Tenant` model, migrate existing data
2. `src/lib/auth-middleware.ts` — resolve tenant from API key, attach to `req`
3. `src/hubspot/auth.ts` — scope OAuth tokens to `tenantId`
4. `src/hubspot/sync-contacts.ts` + `sync-owners.ts` — accept `tenantId`, filter all queries
5. `src/matcher/matcher.ts` — filter contacts by `tenantId`
6. `src/greeting/generator.ts` — inherits scope through matches
7. `src/digest/builder.ts` — filter by `tenantId`
8. `src/scheduler/index.ts` — loop over tenants
9. `src/api/index.ts` — add `/api/tenants/register`, thread tenant context
10. Migration + backfill of existing data

**Estimated effort**: 3–4 sessions
