/**
 * Digest preview: npm run digest:preview
 *
 * Prints this week's digest to the console for each rep without sending email.
 * Add --html to dump the full HTML of the first rep's email instead.
 */
import 'dotenv/config';
import { buildDigests, getThisMonday } from '../digest/builder';
import { buildDigestText, buildDigestHtml } from '../digest/template';
import { prisma } from '../db/client';

async function main(): Promise<void> {
  const weekOf = getThisMonday();
  console.log(`[digest:preview] Week of ${weekOf.toISOString().slice(0, 10)}\n`);

  const digests = await buildDigests(weekOf);

  if (!digests.length) {
    console.log('[digest:preview] No pending digests for this week.');
    console.log('  Possible reasons:');
    console.log('  - No holiday matches in the 14-day window (run npm run sync first)');
    console.log('  - All matches already marked notified (notifiedAt is set)');
    return;
  }

  const dumpHtml = process.argv.includes('--html');

  if (dumpHtml) {
    const first = digests[0];
    const todayCards = first.cards.filter((c) => c.alert1d);
    const weekCards = first.cards.filter((c) => !c.alert1d);
    const html = buildDigestHtml({
      ownerFirstName: first.ownerFirstName,
      ownerHsId: first.ownerId,
      weekOf,
      todayCards,
      weekCards,
      totalMatches: first.totalMatches,
      baseUrl: process.env.BASE_URL ?? 'http://localhost:3000',
    });
    console.log(html);
    return;
  }

  for (const digest of digests) {
    const todayCards = digest.cards.filter((c) => c.alert1d);
    const weekCards = digest.cards.filter((c) => !c.alert1d);
    console.log('='.repeat(60));
    console.log(`Owner : ${digest.ownerEmail} (${digest.ownerFirstName ?? 'unknown'})`);
    console.log(`TZ    : ${digest.timezone ?? 'UTC (default)'}`);
    console.log(`Total : ${digest.totalMatches} match${digest.totalMatches === 1 ? '' : 'es'} (showing ${digest.cards.length})`);
    console.log('');
    console.log(buildDigestText({ ownerFirstName: digest.ownerFirstName, weekOf, todayCards, weekCards, totalMatches: digest.totalMatches }));
  }

  console.log(`\n[digest:preview] ${digests.length} digest${digests.length === 1 ? '' : 's'} ready. Run with --html to dump raw HTML.`);
}

main()
  .catch((err) => {
    console.error('[digest:preview] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
