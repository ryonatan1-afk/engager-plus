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
  greeting: string | null;
  subject: string | null;
  alert1d: boolean;
}

export interface OwnerDigest {
  ownerId: string;
  ownerEmail: string;
  ownerFirstName: string | null;
  timezone: string | null;
  cards: ContactCard[];
  totalMatches: number;
}

/** Max contact cards shown per digest email; remainder shown as "+N more" */
const CARDS_PER_DIGEST = 10;

/**
 * Returns the Monday (UTC) of the week containing `from`.
 * Used to key digest queries against `holiday_matches.week_of`.
 */
export function getThisMonday(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/**
 * Queries all unnotified holiday matches for the given week and groups
 * them by owner. Returns one OwnerDigest per rep, sorted by urgency
 * (alert1d first, then by holiday date).
 */
export async function buildDigests(weekOf: Date): Promise<OwnerDigest[]> {
  const matches = await prisma.holidayMatch.findMany({
    where: {
      weekOf,
      notifiedAt: null,
      contact: { ownerId: { not: null } },
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

  // Batch-load owner records, excluding unsubscribed owners
  const ownerIds = [...byOwner.keys()];
  const owners = await prisma.owner.findMany({
    where: { hsOwnerId: { in: ownerIds }, unsubscribedAt: null },
  });
  const ownerMap = new Map(owners.map((o) => [o.hsOwnerId, o]));

  const digests: OwnerDigest[] = [];

  for (const [ownerId, ownerMatches] of byOwner) {
    const owner = ownerMap.get(ownerId);
    if (!owner) continue;

    const totalMatches = ownerMatches.length;
    const capped = ownerMatches.slice(0, CARDS_PER_DIGEST);

    const cards: ContactCard[] = capped.map((m) => ({
      matchId: m.id,
      contactFirstName: m.contact.firstName ?? '(unknown)',
      contactLastName: m.contact.lastName ?? null,
      company: m.contact.company ?? null,
      email: m.contact.email ?? null,
      lastActivityAt: m.contact.lastActivityAt ?? null,
      holidayName: m.holiday.name,
      holidayDate: m.holiday.date,
      holidayType: m.holiday.type,
      greeting: m.greeting?.body ?? null,
      subject: m.greeting?.subject ?? null,
      alert1d: m.alert1d,
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
