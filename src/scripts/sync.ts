/**
 * Manual sync trigger: npm run sync
 * Runs contact and owner sync once and exits.
 */
import 'dotenv/config';
import { syncContacts } from '../hubspot/sync-contacts';
import { syncOwners } from '../hubspot/sync-owners';
import { prisma } from '../db/client';

async function main(): Promise<void> {
  console.log('[sync] Starting manual sync...');

  const [contactResult, ownerResult] = await Promise.allSettled([
    syncOwners(),
    syncContacts(),
  ]);

  if (ownerResult.status === 'rejected') {
    console.error('[sync] Owner sync failed:', ownerResult.reason);
  }
  if (contactResult.status === 'rejected') {
    console.error('[sync] Contact sync failed:', contactResult.reason);
  }

  console.log('[sync] Manual sync complete.');
}

main()
  .catch((err) => {
    console.error('[sync] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
