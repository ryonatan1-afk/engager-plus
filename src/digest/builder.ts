import { HolidaySignificance } from '@prisma/client';
import { prisma } from '../db/client';

export interface ContactCard {
  matchId: string;
  contactFirstName: string;
  contactLastName: string | null;
  company: string | null;
  email: string | null;
  lastActivityAt: Date | null;
  holidayName: string;
  holidayDate: Date;
  holidayType: string;
  significance: HolidaySignificance;
  daysUntil: number;
  score: number;
  greeting: string | null;
  subject: string | null;
  alert1d: boolean;
  countryIso: string | null;
  solemn: boolean;
}

export interface OwnerDigest {
  ownerId: string;
  ownerEmail: string;
  ownerFirstName: string | null;
  timezone: string | null;
  cards: ContactCard[];
  totalMatches: number;
}

/** Max contact cards rendered per digest email */
const CARDS_PER_DIGEST = 10;

/** Score threshold below which 6–7 day cards are dropped to overflow */
const LATER_THRESHOLD = 4;

const SIG_SCORE: Record<HolidaySignificance, number> = {
  major: 2,
  cultural: 1,
  minor: 0,
};

/**
 * Returns the Monday (UTC) of the week containing `from`.
 */
export function getThisMonday(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function computeDaysUntil(today: Date, holidayDate: Date): number {
  return Math.round((holidayDate.getTime() - today.getTime()) / 86_400_000);
}

function relationshipScore(lastActivityAt: Date | null): number {
  if (!lastActivityAt) return 1;
  const days = Math.floor((Date.now() - lastActivityAt.getTime()) / 86_400_000);
  if (days < 30) return 3;
  if (days < 90) return 2;
  if (days < 365) return 1;
  return 0;
}

/**
 * Queries all unnotified holiday matches for the given tenant and week, groups
 * them by owner. Applies dedup (one holiday per contact), scoring, urgency
 * filtering, and caps at CARDS_PER_DIGEST.
 */
export async function buildDigests(tenantId: string, weekOf: Date): Promise<OwnerDigest[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const matches = await prisma.holidayMatch.findMany({
    where: {
      weekOf,
      notifiedAt: null,
      contact: { tenantId, ownerId: { not: null } },
      holiday: { greetable: true, regional: false },
    },
    include: {
      contact: true,
      holiday: true,
      greeting: true,
    },
    orderBy: [{ alert1d: 'desc' }, { holiday: { date: 'asc' } }],
  });

  if (!matches.length) return [];

  // Group by owner
  const byOwner = new Map<string, typeof matches>();
  for (const m of matches) {
    const ownerId = m.contact.ownerId!;
    if (!byOwner.has(ownerId)) byOwner.set(ownerId, []);
    byOwner.get(ownerId)!.push(m);
  }

  const ownerIds = [...byOwner.keys()];
  const owners = await prisma.owner.findMany({
    where: { tenantId, externalId: { in: ownerIds }, unsubscribedAt: null },
  });
  const ownerMap = new Map(owners.map((o) => [o.externalId, o]));

  const digests: OwnerDigest[] = [];

  for (const [ownerId, ownerMatches] of byOwner) {
    const owner = ownerMap.get(ownerId);
    if (!owner) continue;

    // Dedup: one holiday per contact — keep highest significance, then soonest date
    const bestByContact = new Map<string, (typeof ownerMatches)[number]>();
    for (const m of ownerMatches) {
      const existing = bestByContact.get(m.contact.id);
      if (!existing) { bestByContact.set(m.contact.id, m); continue; }
      const newSig = SIG_SCORE[m.holiday.significance];
      const exSig = SIG_SCORE[existing.holiday.significance];
      if (newSig > exSig || (newSig === exSig && m.holiday.date < existing.holiday.date)) {
        bestByContact.set(m.contact.id, m);
      }
    }
    const deduped = [...bestByContact.values()];

    // Score and annotate each match
    const scored = deduped.map((m) => {
      const days = computeDaysUntil(today, m.holiday.date);
      const relScore = relationshipScore(m.contact.lastActivityAt);
      const holScore = SIG_SCORE[m.holiday.significance] + (m.holiday.popular ? 1 : 0);
      const score = relScore * 2 + holScore;
      return { m, days, score };
    });

    // Drop LATER THIS WEEK (6–7 days) cards below threshold, unless the holiday is popular
    const visible = scored.filter(({ days, score, m }) =>
      days <= 5 || score >= LATER_THRESHOLD || m.holiday.popular,
    );

    // Sort: highest score first, then soonest holiday
    visible.sort((a, b) => b.score - a.score || a.days - b.days);

    const totalMatches = deduped.length;
    const capped = visible.slice(0, CARDS_PER_DIGEST);

    const cards: ContactCard[] = capped.map(({ m, days, score }) => ({
      matchId: m.id,
      contactFirstName: m.contact.firstName ?? '(unknown)',
      contactLastName: m.contact.lastName ?? null,
      company: m.contact.company ?? null,
      email: m.contact.email ?? null,
      lastActivityAt: m.contact.lastActivityAt ?? null,
      holidayName: m.holiday.name,
      holidayDate: m.holiday.date,
      holidayType: m.holiday.type,
      significance: m.holiday.significance,
      daysUntil: days,
      score,
      greeting: m.greeting?.body ?? null,
      subject: m.greeting?.subject ?? null,
      alert1d: m.alert1d,
      countryIso: m.contact.countryIso ?? null,
      solemn: m.holiday.solemn,
    }));

    digests.push({
      ownerId,
      ownerEmail: owner.email,
      ownerFirstName: owner.firstName ?? null,
      timezone: owner.timezone ?? null,
      cards,
      totalMatches,
    });
  }

  return digests;
}
