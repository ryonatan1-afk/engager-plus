import { prisma } from '../db/client';
import { fetchNationalHolidays } from './nager';
import { fetchReligiousHolidays } from './openholidays';

export interface CacheRefreshResult {
  countries: number;
  inserted: number;
  errors: number;
}

/**
 * Fetches holidays for the given country codes (current year + next year)
 * from both Nager.Date and Open Holidays API, then upserts them into the
 * holidays table. Safe to re-run — duplicates are skipped via the DB
 * unique constraint (country_iso, name, date, source).
 */
export async function refreshHolidayCache(
  countryCodes: string[],
): Promise<CacheRefreshResult> {
  const currentYear = new Date().getUTCFullYear();
  const years = [currentYear, currentYear + 1];

  let inserted = 0;
  let errors = 0;

  for (const countryCode of countryCodes) {
    for (const year of years) {
      try {
        const [national, religious] = await Promise.all([
          fetchNationalHolidays(countryCode, year),
          fetchReligiousHolidays(countryCode, year),
        ]);

        const records = [...national, ...religious];
        if (!records.length) continue;

        const result = await prisma.holiday.createMany({
          data: records,
          skipDuplicates: true,
        });

        inserted += result.count;
      } catch (err) {
        console.error(`[holidayCache] Failed to refresh ${countryCode}/${year}:`, err);
        errors++;
      }
    }
  }

  console.log(
    `[holidayCache] Done. countries=${countryCodes.length} inserted=${inserted} errors=${errors}`,
  );
  return { countries: countryCodes.length, inserted, errors };
}

/**
 * Pulls all distinct country codes from the contacts table (resolved + inferred)
 * and runs a full holiday cache refresh for those countries.
 */
export async function refreshHolidayCacheFromContacts(): Promise<CacheRefreshResult> {
  const rows = await prisma.contact.findMany({
    where: { locationStatus: { not: 'unknown' }, countryIso: { not: null } },
    select: { countryIso: true },
    distinct: ['countryIso'],
  });

  const codes = rows.map((r) => r.countryIso).filter((c): c is string => c !== null);

  if (!codes.length) {
    console.log('[holidayCache] No contacts with resolved countries — nothing to refresh.');
    return { countries: 0, inserted: 0, errors: 0 };
  }

  return refreshHolidayCache(codes);
}
