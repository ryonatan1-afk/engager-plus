import { prisma } from '../db/client';
import { getHubSpotClient } from './client';

export interface OwnerSyncResult {
  synced: number;
  errors: number;
}

/**
 * Fetches all HubSpot owners (sales reps) and upserts them into the owners
 * table scoped to the given tenant.
 */
export async function syncOwners(tenantId: string): Promise<OwnerSyncResult> {
  const client = await getHubSpotClient(tenantId);
  let synced = 0;
  let errors = 0;

  try {
    let after: string | undefined;

    do {
      const response = await client.crm.owners.ownersApi.getPage(
        undefined, // email filter — none
        after,
        100,
        false, // include archived
      );

      for (const owner of response.results) {
        try {
          await prisma.owner.upsert({
            where: { tenantId_externalId: { tenantId, externalId: owner.id.toString() } },
            create: {
              tenantId,
              externalId: owner.id.toString(),
              email: owner.email ?? '',
              firstName: owner.firstName ?? null,
              timezone: null,
              syncedAt: new Date(),
            },
            update: {
              email: owner.email ?? '',
              firstName: owner.firstName ?? null,
              syncedAt: new Date(),
            },
          });
          synced++;
        } catch (err) {
          console.error(`[syncOwners] Failed to upsert owner ${owner.id}:`, err);
          errors++;
        }
      }

      after = response.paging?.next?.after;
    } while (after);
  } catch (err) {
    console.error('[syncOwners] Failed to fetch owners from HubSpot:', err);
    errors++;
  }

  console.log(`[syncOwners][${tenantId}] Done. synced=${synced} errors=${errors}`);
  return { synced, errors };
}
