import { HolidaySignificance } from '@prisma/client';
import { prisma } from '../db/client';

export interface ContactRow {
  matchId: string;
  contactFirstName: string;
  contactLastName: string | null;
  company: string | null;
  email: string | null;
  lastActivityAt: Date | null;
  score: number;
}

export interface DigestCard {
  holidayName: string;
  holidayDate: Date;
  holidayType: string;
  significance: HolidaySignificance;
  countryIso: string | null;
  solemn: boolean;
  alert1d: boolean;
  daysUntil: number;
  score: number;
  greeting: string | null;
  subject: string | null;
  contacts: ContactRow[];
}

export interface OwnerDigest {
  ownerId: string;
  ownerEmail: string;
  ownerFirstName: string | null;
  timezone: string | null;
  cards: DigestCard[];
  totalMatches: number;
}

/** Max holiday cards rendered per digest email */
const CARDS_PER_DIGEST = 10;

/** Score threshold below which 6–7 day cards are dropped */
const LATER_THRESHOLD = 4;

const SIG_SCORE: Record<HolidaySignificance, number> = {
  major: 2,
  cultural: 1,
  minor: 0,
};

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
 * them by owner then by holiday. Each DigestCard represents one holiday with
 * all eligible contacts listed. Contacts are deduplicated to their best holiday
 * first, then grouped so each contact appears in at most one card.
 */
export async function buildDigests(tenantId: string, weekOf: Date | null): Promise<OwnerDigest[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const matches = await prisma.holidayMatch.findMany({
    where: {
      ...(weekOf ? { weekOf } : {}),
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

    // Step 1: dedup — one holiday per contact (highest significance, then soonest)
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
    const totalMatches = deduped.length;

    // Step 2: score each match
    const scored = deduped.map((m) => {
      const days = computeDaysUntil(today, m.holiday.date);
      const relScore = relationshipScore(m.contact.lastActivityAt);
      const holScore = SIG_SCORE[m.holiday.significance] + (m.holiday.popular ? 1 : 0);
      const score = relScore * 2 + holScore;
      return { m, days, score };
    });

    // Step 3: group by holiday
    const byHoliday = new Map<string, typeof scored>();
    for (const item of scored) {
      const key = item.m.holidayId;
      if (!byHoliday.has(key)) byHoliday.set(key, []);
      byHoliday.get(key)!.push(item);
    }

    // Step 4: build DigestCards — one per holiday
    const cards: DigestCard[] = [];
    for (const [, group] of byHoliday) {
      const { holiday } = group[0].m;
      const days = group[0].days;
      const cardScore = Math.max(...group.map((g) => g.score));

      // Drop LATER THIS WEEK cards below threshold
      if (days >= 6 && cardScore < LATER_THRESHOLD && !holiday.popular) continue;

      const alert1d = group.some((g) => g.m.alert1d);

      // Sort contacts within card by score desc
      group.sort((a, b) => b.score - a.score);

      // Use greeting from the first match that has one
      const withGreeting = group.find((g) => g.m.greeting);

      cards.push({
        holidayName: holiday.name,
        holidayDate: holiday.date,
        holidayType: holiday.type,
        significance: holiday.significance,
        countryIso: holiday.countryIso,
        solemn: holiday.solemn,
        alert1d,
        daysUntil: days,
        score: cardScore,
        greeting: withGreeting?.m.greeting?.body ?? null,
        subject: withGreeting?.m.greeting?.subject ?? null,
        contacts: group.map((g) => ({
          matchId: g.m.id,
          contactFirstName: g.m.contact.firstName ?? '(unknown)',
          contactLastName: g.m.contact.lastName ?? null,
          company: g.m.contact.company ?? null,
          email: g.m.contact.email ?? null,
          lastActivityAt: g.m.contact.lastActivityAt ?? null,
          score: g.score,
        })),
      });
    }

    // Step 5: sort cards, cap at CARDS_PER_DIGEST
    cards.sort((a, b) => {
      if (a.alert1d !== b.alert1d) return a.alert1d ? -1 : 1;
      return b.score - a.score || a.holidayDate.getTime() - b.holidayDate.getTime();
    });

    digests.push({
      ownerId,
      ownerEmail: owner.email,
      ownerFirstName: owner.firstName ?? null,
      timezone: owner.timezone ?? null,
      cards: cards.slice(0, CARDS_PER_DIGEST),
      totalMatches,
    });
  }

  return digests;
}
