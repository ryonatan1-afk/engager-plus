import { prisma } from '../db/client';
import { getHubSpotClient } from './client';

export interface OwnerSyncResult {
  synced: number;
  errors: number;
}

/**
 * Fetches all HubSpot owners (sales reps) and upserts them into the owners table.
 * Owners are used to group digest emails and to inject the rep's first name into greetings.
 */
export async function syncOwners(): Promise<OwnerSyncResult> {
  const client = await getHubSpotClient();
  let synced = 0;
  let errors = 0;

  try {
    // Paginate through all owners (default page size: 100)
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
            where: { hsOwnerId: owner.id.toString() },
            create: {
              hsOwnerId: owner.id.toString(),
              email: owner.email ?? '',
              firstName: owner.firstName ?? null,
              // HubSpot doesn't provide timezone on the owner object — will be set manually
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

  console.log(`[syncOwners] Done. synced=${synced} errors=${errors}`);
  return { synced, errors };
}
