/**
 * Manual sync trigger: npm run sync
 * Runs contact and owner sync for all tenants once and exits.
 * Pass --tenant <id> to restrict to a single tenant.
 */
import 'dotenv/config';
import { syncContacts } from '../hubspot/sync-contacts';
import { syncOwners } from '../hubspot/sync-owners';
import { prisma } from '../db/client';

async function main(): Promise<void> {
  const tenantArgIdx = process.argv.indexOf('--tenant');
  let tenantIds: string[];

  if (tenantArgIdx !== -1 && process.argv[tenantArgIdx + 1]) {
    tenantIds = [process.argv[tenantArgIdx + 1]];
  } else {
    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    tenantIds = tenants.map((t) => t.id);
  }

  if (!tenantIds.length) {
    console.log('[sync] No tenants found. Create one via POST /api/tenants/register.');
    return;
  }

  console.log(`[sync] Starting manual sync for ${tenantIds.length} tenant(s)...`);

  for (const tenantId of tenantIds) {
    console.log(`[sync] Tenant ${tenantId}`);
    const [contactResult, ownerResult] = await Promise.allSettled([
      syncOwners(tenantId),
      syncContacts(tenantId),
    ]);
    if (ownerResult.status === 'rejected') {
      console.error('[sync] Owner sync failed:', ownerResult.reason);
    }
    if (contactResult.status === 'rejected') {
      console.error('[sync] Contact sync failed:', contactResult.reason);
    }
  }

  console.log('[sync] Manual sync complete.');
}

main()
  .catch((err) => {
    console.error('[sync] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
