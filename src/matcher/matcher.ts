import { prisma } from '../db/client';

export interface MatchResult {
  matched: number;
  skipped: number;
  errors: number;
}

/**
 * Returns the Monday of the week containing the given date (UTC).
 * Monday is used as the canonical week anchor for weekOf on holiday_matches.
 */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the number of whole days between today (UTC midnight) and the holiday date.
 * Negative if the holiday is in the past.
 */
export function daysUntil(today: Date, holidayDate: Date): number {
  const todayMs = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const holidayMs = Date.UTC(
    holidayDate.getUTCFullYear(),
    holidayDate.getUTCMonth(),
    holidayDate.getUTCDate(),
  );
  return Math.round((holidayMs - todayMs) / 86_400_000);
}

/**
 * Computes alert flags for a holiday given today's date.
 * alert7d: holiday is within 7 days (inclusive of today)
 * alert1d: holiday is today or tomorrow
 */
export function computeFlags(
  today: Date,
  holidayDate: Date,
): { alert7d: boolean; alert1d: boolean } {
  const days = daysUntil(today, holidayDate);
  return {
    alert7d: days >= 0 && days <= 7,
    alert1d: days >= 0 && days <= 1,
  };
}

/**
 * Cross-references a tenant's contacts against upcoming holidays within a
 * 14-day window. Upserts rows into holiday_matches with current alert flags.
 *
 * Run daily so that alert flags stay current as the holiday approaches.
 */
export async function runMatcher(tenantId: string): Promise<MatchResult> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const windowEnd = new Date(today);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 14);

  // Fetch all holidays within the 14-day window
  const holidays = await prisma.holiday.findMany({
    where: {
      date: { gte: today, lte: windowEnd },
    },
    select: { id: true, countryIso: true, date: true },
  });

  if (!holidays.length) {
    console.log('[matcher] No holidays in window — nothing to match.');
    return { matched: 0, skipped: 0, errors: 0 };
  }

  // Group holidays by country so we only query contacts once per country
  const byCountry = new Map<string, typeof holidays>();
  for (const h of holidays) {
    const list = byCountry.get(h.countryIso) ?? [];
    list.push(h);
    byCountry.set(h.countryIso, list);
  }

  let matched = 0;
  let skipped = 0;
  let errors = 0;

  for (const [countryIso, countryHolidays] of byCountry) {
    const contacts = await prisma.contact.findMany({
      where: {
        tenantId,
        countryIso,
        locationStatus: { not: 'unknown' },
      },
      select: { id: true },
    });

    if (!contacts.length) {
      skipped += countryHolidays.length;
      continue;
    }

    for (const holiday of countryHolidays) {
      const { alert7d, alert1d } = computeFlags(today, holiday.date);
      const weekOf = getMonday(holiday.date);

      for (const contact of contacts) {
        try {
          await prisma.holidayMatch.upsert({
            where: {
              contactId_holidayId: {
                contactId: contact.id,
                holidayId: holiday.id,
              },
            },
            create: {
              contactId: contact.id,
              holidayId: holiday.id,
              alert7d,
              alert1d,
              weekOf,
            },
            update: {
              alert7d,
              alert1d,
              weekOf,
            },
          });
          matched++;
        } catch (err) {
          console.error(
            `[matcher] Failed to upsert match contact=${contact.id} holiday=${holiday.id}:`,
            err,
          );
          errors++;
        }
      }
    }
  }

  console.log(`[matcher][${tenantId}] Done. matched=${matched} skipped=${skipped} errors=${errors}`);
  return { matched, skipped, errors };
}
