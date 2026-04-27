import cron from 'node-cron';
import { prisma } from '../db/client';
import { syncContacts } from '../hubspot/sync-contacts';
import { syncOwners } from '../hubspot/sync-owners';
import { refreshHolidayCacheFromContacts } from '../holidays/cache';
import { runMatcher } from '../matcher/matcher';
import { generatePendingGreetings } from '../greeting/generator';
import { sendWeeklyDigests } from '../digest';
import { sendAlert } from '../lib/alert';

async function getActiveTenants(): Promise<string[]> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  return tenants.map((t) => t.id);
}

/**
 * Registers all cron jobs. Each job that operates on per-tenant data loops
 * over all tenants. Holiday data (shared) is refreshed once globally.
 */
export function startScheduler(): void {
  // Daily incremental contact sync at 2:00 AM (per tenant)
  cron.schedule('0 2 * * *', async () => {
    console.log(`[scheduler][${ts()}] Starting daily contact sync...`);
    for (const tenantId of await getActiveTenants()) {
      try {
        await syncContacts(tenantId);
      } catch (err) {
        console.error(`[scheduler][${ts()}] Contact sync failed for tenant ${tenantId}:`, err);
        await sendAlert(`Daily contact sync failed (tenant ${tenantId})`, err);
      }
    }
  });

  // Daily owner sync at 2:15 AM (per tenant)
  cron.schedule('15 2 * * *', async () => {
    console.log(`[scheduler][${ts()}] Starting daily owner sync...`);
    for (const tenantId of await getActiveTenants()) {
      try {
        await syncOwners(tenantId);
      } catch (err) {
        console.error(`[scheduler][${ts()}] Owner sync failed for tenant ${tenantId}:`, err);
        await sendAlert(`Daily owner sync failed (tenant ${tenantId})`, err);
      }
    }
  });

  // Daily holiday matcher at 2:30 AM (per tenant)
  cron.schedule('30 2 * * *', async () => {
    console.log(`[scheduler][${ts()}] Starting daily holiday matcher...`);
    for (const tenantId of await getActiveTenants()) {
      try {
        await runMatcher(tenantId);
      } catch (err) {
        console.error(`[scheduler][${ts()}] Holiday matcher failed for tenant ${tenantId}:`, err);
        await sendAlert(`Daily holiday matcher failed (tenant ${tenantId})`, err);
      }
    }
  });

  // Daily holiday cache refresh at 2:45 AM — shared across all tenants
  cron.schedule('45 2 * * *', async () => {
    console.log(`[scheduler][${ts()}] Starting weekly holiday cache refresh...`);
    try {
      await refreshHolidayCacheFromContacts();
    } catch (err) {
      console.error(`[scheduler][${ts()}] Weekly holiday cache refresh failed:`, err);
      await sendAlert('Weekly holiday cache refresh failed', err);
    }
  });

  // Daily greeting generation at 3:00 AM — after matcher (per tenant)
  cron.schedule('0 3 * * *', async () => {
    console.log(`[scheduler][${ts()}] Starting Sunday greeting pre-generation...`);
    for (const tenantId of await getActiveTenants()) {
      try {
        await generatePendingGreetings(tenantId);
      } catch (err) {
        console.error(`[scheduler][${ts()}] Greeting pre-gen failed for tenant ${tenantId}:`, err);
        await sendAlert(`Sunday greeting pre-generation failed (tenant ${tenantId})`, err);
      }
    }
  });

  // Every hour on Monday — sends digest to owners where it is currently 7am local (per tenant)
  cron.schedule('0 * * * 1', async () => {
    console.log(`[scheduler][${ts()}] Checking Monday digest sends...`);
    for (const tenantId of await getActiveTenants()) {
      try {
        await sendWeeklyDigests(tenantId);
      } catch (err) {
        console.error(`[scheduler][${ts()}] Monday digest send failed for tenant ${tenantId}:`, err);
        await sendAlert(`Monday digest send failed (tenant ${tenantId})`, err);
      }
    }
  });

  console.log(
    '[scheduler] Cron jobs registered: contact sync 02:00, owner sync 02:15, matcher 02:30, holiday refresh 02:45, greeting gen 03:00, digest Mon 07:00 (tz-aware)',
  );
}

/** ISO timestamp for log lines */
function ts(): string {
  return new Date().toISOString();
}
