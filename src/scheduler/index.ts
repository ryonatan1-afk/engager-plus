import cron from 'node-cron';
import { syncContacts } from '../hubspot/sync-contacts';
import { syncOwners } from '../hubspot/sync-owners';
import { refreshHolidayCacheFromContacts } from '../holidays/cache';
import { runMatcher } from '../matcher/matcher';
import { generatePendingGreetings } from '../greeting/generator';
import { sendWeeklyDigests } from '../digest';
import { sendAlert } from '../lib/alert';

/**
 * Registers all cron jobs.
 * Phase 1: daily contact + owner sync.
 * Phase 2: Sunday holiday cache refresh + daily matcher.
 * Phase 3: Sunday night greeting pre-generation.
 * Phase 4: Monday hourly check — sends digest to owners where it is 7am local.
 * Phase 6: sendAlert() on any cron failure.
 */
export function startScheduler(): void {
  // Daily incremental contact sync at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log(`[scheduler][${ts()}] Starting daily contact sync...`);
    try {
      await syncContacts();
    } catch (err) {
      console.error(`[scheduler][${ts()}] Daily contact sync failed:`, err);
      await sendAlert('Daily contact sync failed', err);
    }
  });

  // Daily owner sync at 2:15 AM (staggered after contact sync)
  cron.schedule('15 2 * * *', async () => {
    console.log(`[scheduler][${ts()}] Starting daily owner sync...`);
    try {
      await syncOwners();
    } catch (err) {
      console.error(`[scheduler][${ts()}] Daily owner sync failed:`, err);
      await sendAlert('Daily owner sync failed', err);
    }
  });

  // Daily holiday matcher at 2:30 AM — keeps alert flags current
  cron.schedule('30 2 * * *', async () => {
    console.log(`[scheduler][${ts()}] Starting daily holiday matcher...`);
    try {
      await runMatcher();
    } catch (err) {
      console.error(`[scheduler][${ts()}] Daily holiday matcher failed:`, err);
      await sendAlert('Daily holiday matcher failed', err);
    }
  });

  // Weekly holiday cache refresh: Sunday 3:00 AM — fetches current + next year
  cron.schedule('0 3 * * 0', async () => {
    console.log(`[scheduler][${ts()}] Starting weekly holiday cache refresh...`);
    try {
      await refreshHolidayCacheFromContacts();
    } catch (err) {
      console.error(`[scheduler][${ts()}] Weekly holiday cache refresh failed:`, err);
      await sendAlert('Weekly holiday cache refresh failed', err);
    }
  });

  // Sunday 10:00 PM — pre-generate greetings so Monday digest sends fast
  cron.schedule('0 22 * * 0', async () => {
    console.log(`[scheduler][${ts()}] Starting Sunday greeting pre-generation...`);
    try {
      await generatePendingGreetings();
    } catch (err) {
      console.error(`[scheduler][${ts()}] Sunday greeting pre-generation failed:`, err);
      await sendAlert('Sunday greeting pre-generation failed', err);
    }
  });

  // Every hour on Monday — sends digest to owners where it is currently 7am local
  cron.schedule('0 * * * 1', async () => {
    console.log(`[scheduler][${ts()}] Checking Monday digest sends...`);
    try {
      await sendWeeklyDigests();
    } catch (err) {
      console.error(`[scheduler][${ts()}] Monday digest send failed:`, err);
      await sendAlert('Monday digest send failed', err);
    }
  });

  console.log(
    '[scheduler] Cron jobs registered: contact sync 02:00, owner sync 02:15, matcher 02:30, holiday refresh Sun 03:00, greeting pre-gen Sun 22:00, digest Mon 07:00 (tz-aware)',
  );
}

/** ISO timestamp for log lines */
function ts(): string {
  return new Date().toISOString();
}
