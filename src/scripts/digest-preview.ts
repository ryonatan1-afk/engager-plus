/**
 * Digest preview: npm run digest:preview
 *
 * Prints this week's digest to the console for each rep without sending email.
 * Add --html to dump the full HTML of the first rep's email instead.
 * Add --tenant <id> to restrict to a single tenant (default: first tenant).
 */
import 'dotenv/config';
import { buildDigests, getThisMonday } from '../digest/builder';
import { buildDigestText, buildDigestHtml } from '../digest/template';
import { prisma } from '../db/client';

async function main(): Promise<void> {
  const tenantArgIdx = process.argv.indexOf('--tenant');
  let tenantId: string;

  if (tenantArgIdx !== -1 && process.argv[tenantArgIdx + 1]) {
    tenantId = process.argv[tenantArgIdx + 1];
  } else {
    const tenant = await prisma.tenant.findFirst({ select: { id: true } });
    if (!tenant) {
      console.log('[digest:preview] No tenants found. Create one via POST /api/tenants/register.');
      return;
    }
    tenantId = tenant.id;
  }

  const weekOf = getThisMonday();
  console.log(`[digest:preview] Week of ${weekOf.toISOString().slice(0, 10)}\n`);

  const digests = await buildDigests(tenantId, weekOf);

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
    const laterCards = first.cards.filter((c) => c.daysUntil >= 6);
    const html = buildDigestHtml({
      ownerFirstName: first.ownerFirstName,
      ownerExternalId: first.ownerId,
      weekOf,
      todayCards,
      weekCards,
      laterCards,
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
    const laterCards = digest.cards.filter((c) => c.daysUntil >= 6);
    console.log(buildDigestText({ ownerFirstName: digest.ownerFirstName, weekOf, todayCards, weekCards, laterCards, totalMatches: digest.totalMatches }));
  }

  console.log(`\n[digest:preview] ${digests.length} digest${digests.length === 1 ? '' : 's'} ready. Run with --html to dump raw HTML.`);
}

main()
  .catch((err) => {
    console.error('[digest:preview] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
