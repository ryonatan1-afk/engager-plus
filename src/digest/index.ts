import { prisma } from '../db/client';
import { buildDigests, getThisMonday, OwnerDigest } from './builder';
import { buildDigestHtml } from './template';
import { sendDigestEmail } from './sender';

export interface DigestResult {
  sent: number;
  skipped: number;
  errors: number;
}

/**
 * Returns true if it is currently 7am (±0) in the owner's local timezone.
 * Used by the Monday hourly cron to decide whether to send each rep's digest.
 * Falls back to UTC for owners with no timezone or an invalid one.
 */
function isSevenAmLocal(timezone: string | null): boolean {
  const tz = timezone ?? 'UTC';
  try {
    const hour = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(
        new Date(),
      ),
      10,
    );
    return hour === 7;
  } catch {
    return new Date().getUTCHours() === 7;
  }
}

/**
 * Sends the weekly digest to all reps for the given tenant whose local time is 7am.
 * Called by the Monday hourly cron — runs every hour, sends only to owners
 * for whom it is currently 7am in their timezone.
 *
 * Pass `ignoreTimezone: true` to send immediately regardless of local time
 * (used by the test-send API and the digest:preview script).
 */
export async function sendWeeklyDigests(
  tenantId: string,
  opts: { ignoreTimezone?: boolean; allWeeks?: boolean } = {},
): Promise<DigestResult> {
  const weekOf = getThisMonday();
  const digests = await buildDigests(tenantId, opts.allWeeks ? null : weekOf);

  if (!digests.length) {
    console.log('[digest] No pending digests for week of', weekOf.toISOString().slice(0, 10));
    return { sent: 0, skipped: 0, errors: 0 };
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const digest of digests) {
    if (!opts.ignoreTimezone && !isSevenAmLocal(digest.timezone)) {
      skipped++;
      continue;
    }

    try {
      await sendOneDigest(digest, weekOf);
      sent++;
    } catch (err) {
      console.error(`[digest] Failed to send to ${digest.ownerEmail}:`, err);
      errors++;
    }
  }

  console.log(`[digest] Done. sent=${sent} skipped=${skipped} errors=${errors}`);
  return { sent, skipped, errors };
}

/**
 * Sends a single digest to a specific email address, overriding the owner's
 * real email. Uses the first rep's data from the given tenant.
 */
export async function sendTestDigest(tenantId: string, toEmail: string): Promise<void> {
  const weekOf = getThisMonday();
  const digests = await buildDigests(tenantId, null);

  if (!digests.length) {
    throw new Error('No pending digest data found for this week.');
  }

  // Use the first owner's data sent to the test address
  const digest = digests[0];
  await sendOneDigest({ ...digest, ownerEmail: toEmail }, weekOf);
  console.log(`[digest] Test digest sent to ${toEmail} (using ${digest.ownerEmail}'s data)`);
}

async function sendOneDigest(digest: OwnerDigest, weekOf: Date): Promise<void> {
  const todayCards = digest.cards.filter((c) => c.daysUntil <= 1);
  const weekCards = digest.cards.filter((c) => c.daysUntil >= 2 && c.daysUntil <= 5);
  const laterCards = digest.cards.filter((c) => c.daysUntil >= 6);

  const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';

  const html = buildDigestHtml({
    ownerFirstName: digest.ownerFirstName,
    ownerExternalId: digest.ownerId,
    weekOf,
    todayCards,
    weekCards,
    laterCards,
    totalMatches: digest.totalMatches,
    baseUrl,
  });

  const weekLabel = weekOf.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  await sendDigestEmail({
    toEmail: digest.ownerEmail,
    toName: digest.ownerFirstName ?? digest.ownerEmail,
    subject: `Holiday Digest — Week of ${weekLabel}`,
    html,
  });

  // Mark all shown matches as notified so they don't appear in future sends
  const allMatchIds = digest.cards.flatMap((c) => c.contacts.map((r) => r.matchId));
  await prisma.holidayMatch.updateMany({
    where: { id: { in: allMatchIds } },
    data: { notifiedAt: new Date() },
  });

  const totalContacts = digest.cards.reduce((n, c) => n + c.contacts.length, 0);
  console.log(`[digest] Sent to ${digest.ownerEmail} (${digest.cards.length} holiday cards, ${totalContacts} contacts)`);
}
