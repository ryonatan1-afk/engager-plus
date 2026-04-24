# Backlog

Deferred work items that are not yet scheduled. Review before starting a new phase.

---

## Phase B — Full CRM adapter abstraction

**Context**: Rapport is evolving into a relationship intelligence platform. HubSpot is the first CRM adapter, not the product. Salesforce and a standalone web app are on the roadmap.

**Goal**: Make swapping or adding a second CRM a matter of wiring up a new adapter, not rewriting core logic.

### Tasks

1. **Define a `CrmAdapter` interface** in `src/adapters/types.ts`
   - Methods: `syncContacts(tenantId)`, `syncOwners(tenantId)`, `getAuthUrl(tenantId)`, `handleCallback(code, state)`
   - HubSpot implementation becomes `src/adapters/hubspot/index.ts`

2. **Move `src/hubspot/` → `src/adapters/hubspot/`**
   - `auth.ts`, `client.ts`, `sync-contacts.ts`, `sync-owners.ts` all move
   - API routes and scheduler call the interface, not HubSpot directly
   - Tenant model gets an `adapterType` field (`hubspot` | `salesforce`) to route calls

3. **Make `crmContactsUrl` per-tenant configurable**
   - Add `crmContactsUrl` to the Tenant model
   - Pass it through `buildDigests` → `buildDigestHtml` so the overflow link goes to the right CRM
   - HubSpot default: `https://app.hubspot.com/contacts/`

4. **Rename `Contact.ownerId` → `Contact.externalOwnerId`**
   - Currently stores the CRM's owner identifier (e.g. HubSpot owner ID)
   - Low risk but deferred to avoid churn while HubSpot-only

### Prerequisites
- Phase A complete (done 2026-04-24) — `externalId` fields, `src/lib/` utilities
- A second CRM integration is being actively started

### Notes
- `src/lib/` (resolve-location, normalise-country, country-map) is already CRM-agnostic
- Core engines (matcher, greeting, digest) have zero CRM coupling — no changes needed there
