-- Multi-tenancy migration
-- Creates Tenant model; adds tenantId to Contact, Owner, OAuthToken.
-- Backfills all existing rows into a single default tenant.

-- ── 1. Create tenants table ───────────────────────────────────────────────────

CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "api_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_api_key_key" ON "tenants"("api_key");

-- Insert the default tenant; use UUID as both id and (without dashes) as api_key seed
INSERT INTO "tenants" ("id", "api_key")
VALUES (
    gen_random_uuid()::text,
    substring(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 40)
);

-- ── 2. contacts: add tenant_id, backfill, enforce, update unique ──────────────

ALTER TABLE "contacts" ADD COLUMN "tenant_id" TEXT;

UPDATE "contacts" SET "tenant_id" = (SELECT "id" FROM "tenants" LIMIT 1);

ALTER TABLE "contacts" ALTER COLUMN "tenant_id" SET NOT NULL;

DROP INDEX "contacts_hs_object_id_key";

CREATE UNIQUE INDEX "contacts_tenant_id_hs_object_id_key" ON "contacts"("tenant_id", "hs_object_id");

ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. owners: add surrogate id + tenant_id, change PK ───────────────────────

ALTER TABLE "owners" ADD COLUMN "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE "owners" ADD COLUMN "tenant_id" TEXT;

UPDATE "owners" SET "tenant_id" = (SELECT "id" FROM "tenants" LIMIT 1);

ALTER TABLE "owners" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "owners" DROP CONSTRAINT "owners_pkey";

ALTER TABLE "owners" ADD CONSTRAINT "owners_pkey" PRIMARY KEY ("id");

ALTER TABLE "owners" ALTER COLUMN "id" DROP DEFAULT;

CREATE UNIQUE INDEX "owners_tenant_id_hs_owner_id_key" ON "owners"("tenant_id", "hs_owner_id");

ALTER TABLE "owners" ADD CONSTRAINT "owners_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 4. oauth_tokens: add tenant_id, swap PK, drop serial id ──────────────────

ALTER TABLE "oauth_tokens" ADD COLUMN "tenant_id" TEXT;

UPDATE "oauth_tokens" SET "tenant_id" = (SELECT "id" FROM "tenants" LIMIT 1);

ALTER TABLE "oauth_tokens" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "oauth_tokens" DROP CONSTRAINT "oauth_tokens_pkey";

ALTER TABLE "oauth_tokens" DROP COLUMN "id";

ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("tenant_id");

ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
