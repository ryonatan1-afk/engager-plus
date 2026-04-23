import { prisma } from '../db/client';
import { fetchNationalHolidays } from './nager';
import { fetchReligiousHolidays } from './openholidays';

export interface CacheRefreshResult {
  countries: number;
  upserted: number;
  errors: number;
}

/**
 * Fetches holidays for the given country codes (current year + next year)
 * from both Nager.Date and Open Holidays API, then upserts them into the
 * holidays table — including tag updates on existing rows.
 */
export async function refreshHolidayCache(
  countryCodes: string[],
): Promise<CacheRefreshResult> {
  const currentYear = new Date().getUTCFullYear();
  const years = [currentYear, currentYear + 1];

  let upserted = 0;
  let errors = 0;

  for (const countryCode of countryCodes) {
    for (const year of years) {
      const [nationalResult, religiousResult] = await Promise.allSettled([
        fetchNationalHolidays(countryCode, year),
        fetchReligiousHolidays(countryCode, year),
      ]);

      const records = [
        ...(nationalResult.status === 'fulfilled' ? nationalResult.value : []),
        ...(religiousResult.status === 'fulfilled' ? religiousResult.value : []),
      ];

      if (nationalResult.status === 'rejected') {
        console.error(`[holidayCache] Nager failed for ${countryCode}/${year}:`, nationalResult.reason);
        errors++;
      }
      if (religiousResult.status === 'rejected') {
        console.error(`[holidayCache] OpenHolidays failed for ${countryCode}/${year}:`, religiousResult.reason);
        errors++;
      }

      for (const record of records) {
        try {
          await prisma.holiday.upsert({
            where: {
              countryIso_name_date_source: {
                countryIso: record.countryIso,
                name: record.name,
                date: record.date,
                source: record.source,
              },
            },
            create: record,
            update: {
              greetable: record.greetable,
              popular: record.popular,
              regional: record.regional,
              solemn: record.solemn,
            },
          });
          upserted++;
        } catch (err) {
          console.error(`[holidayCache] Failed to upsert ${record.name} (${countryCode}):`, err);
          errors++;
        }
      }
    }
  }

  console.log(
    `[holidayCache] Done. countries=${countryCodes.length} upserted=${upserted} errors=${errors}`,
  );
  return { countries: countryCodes.length, upserted, errors };
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
    return { countries: 0, upserted: 0, errors: 0 };
  }

  return refreshHolidayCache(codes);
}
