import { prisma } from '../db/client';
import { getHubSpotClient } from './client';
import { resolveLocation } from '../lib/resolve-location';

const ACTIVE_MONTHS = 12;
const PAGE_SIZE = 100;
const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'country',
  'company',
  'hubspot_owner_id',
  'hs_last_sales_activity_timestamp',
  'associatedcompanyid',
];

export interface SyncResult {
  synced: number;
  unknown: number;
  errors: number;
}

/**
 * Pulls all contacts with CRM activity in the last 12 months from HubSpot,
 * resolves their country via the fallback chain, and upserts into the DB
 * scoped to the given tenant.
 */
export async function syncContacts(
  tenantId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<SyncResult> {
  const client = await getHubSpotClient(tenantId);
  const activeOnly = opts.activeOnly ?? true;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - ACTIVE_MONTHS);
  const cutoffMs = cutoff.getTime();

  let cursor: string | undefined;
  let synced = 0;
  let errors = 0;

  do {
    const response = await client.crm.contacts.searchApi.doSearch({
      filterGroups: activeOnly
        ? [{ filters: [{ propertyName: 'hs_last_sales_activity_timestamp', operator: 'GTE' as any, value: cutoffMs.toString() }] }]
        : [],
      properties: CONTACT_PROPERTIES,
      limit: PAGE_SIZE,
      after: cursor as any,
      sorts: [],
    });

    const contacts = response.results;
    if (!contacts.length) break;

    // Collect company IDs needed for location fallback
    const companyIds = [
      ...new Set(
        contacts
          .map((c) => c.properties['associatedcompanyid'])
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    // Batch-fetch company countries (up to 100 per batch)
    const companyCountries = await fetchCompanyCountries(client, companyIds);

    // Upsert each contact scoped to the tenant
    for (const contact of contacts) {
      try {
        const props = contact.properties;
        const companyId = props['associatedcompanyid'];
        const companyCountry = companyId ? companyCountries.get(companyId) : undefined;

        const location = resolveLocation(
          props['country'],
          companyCountry,
          props['email'],
        );

        const lastActivityRaw = props['hs_last_sales_activity_timestamp'];
        const lastActivityAt = lastActivityRaw ? new Date(Number(lastActivityRaw)) : null;

        await prisma.contact.upsert({
          where: { tenantId_externalId: { tenantId, externalId: contact.id } },
          create: {
            tenantId,
            externalId: contact.id,
            firstName: props['firstname'] ?? null,
            lastName: props['lastname'] ?? null,
            email: props['email'] ?? null,
            countryIso: location.iso,
            company: props['company'] ?? null,
            ownerId: props['hubspot_owner_id'] ?? null,
            lastActivityAt,
            locationStatus: location.status,
            syncedAt: new Date(),
          },
          update: {
            firstName: props['firstname'] ?? null,
            lastName: props['lastname'] ?? null,
            email: props['email'] ?? null,
            countryIso: location.iso,
            company: props['company'] ?? null,
            ownerId: props['hubspot_owner_id'] ?? null,
            lastActivityAt,
            locationStatus: location.status,
            syncedAt: new Date(),
          },
        });

        synced++;
      } catch (err) {
        console.error(`[syncContacts] Failed to upsert contact ${contact.id}:`, err);
        errors++;
      }
    }

    cursor = response.paging?.next?.after;
  } while (cursor);

  // Data quality report (scoped to tenant)
  const unknown = await prisma.contact.count({
    where: { tenantId, locationStatus: 'unknown' },
  });
  console.log(
    `[syncContacts][${tenantId}] Done. synced=${synced} errors=${errors} unknown_location=${unknown}`,
  );

  return { synced, unknown, errors };
}

/**
 * Batch-fetch company country fields.
 * Returns a map of companyId -> country string.
 */
async function fetchCompanyCountries(
  client: Awaited<ReturnType<typeof getHubSpotClient>>,
  companyIds: string[],
): Promise<Map<string, string | undefined>> {
  const result = new Map<string, string | undefined>();
  if (!companyIds.length) return result;

  // HubSpot batch read accepts up to 100 IDs
  for (let i = 0; i < companyIds.length; i += 100) {
    const batch = companyIds.slice(i, i + 100);
    try {
      const response = await client.crm.companies.batchApi.read({
        inputs: batch.map((id) => ({ id })),
        properties: ['country'],
        propertiesWithHistory: [],
      });
      for (const company of response.results) {
        result.set(company.id, company.properties['country'] ?? undefined);
      }
    } catch (err) {
      console.warn('[syncContacts] Company batch fetch failed for batch, skipping:', err);
    }
  }

  return result;
}
