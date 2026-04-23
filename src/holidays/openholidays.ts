import { HolidayType, HolidaySource, HolidaySignificance } from '@prisma/client';
import type { HolidayRecord } from './nager';
import { classifyHoliday } from './classify';

interface OpenHolidayName {
  language: string;
  text: string;
}

interface OpenApiHoliday {
  id: string;
  startDate: string;
  endDate: string;
  name: OpenHolidayName[];
  type: string;
  nationwide: boolean;
}

function extractEnName(names: OpenHolidayName[]): string {
  return names.find((n) => n.language === 'EN')?.text ?? names[0]?.text ?? 'Unknown';
}

/**
 * Fetches religious and cultural holidays from Open Holidays API for a given country and year.
 * Multi-day events (e.g. Eid, Diwali) alert on startDate only.
 * Sets regional=true for non-nationwide observances.
 * Returns an empty array if the country has no coverage.
 */
export async function fetchReligiousHolidays(
  countryCode: string,
  year: number,
): Promise<HolidayRecord[]> {
  const validFrom = `${year}-01-01`;
  const validTo = `${year}-12-31`;
  const params = new URLSearchParams({
    countryIsoCode: countryCode.toUpperCase(),
    languageIsoCode: 'EN',
    validFrom,
    validTo,
  });

  const url = `https://openholidaysapi.org/PublicHolidays?${params}`;
  const res = await fetch(url);

  if (res.status === 404 || res.status === 204) return [];
  if (!res.ok) {
    throw new Error(`Open Holidays API error ${res.status} for ${countryCode}/${year}`);
  }

  const text = await res.text();
  if (!text.trim()) return [];

  const data: OpenApiHoliday[] = JSON.parse(text);

  return data.map((h) => {
    const name = extractEnName(h.name);
    const { greetable, popular } = classifyHoliday(name);
    return {
      countryIso: countryCode.toUpperCase(),
      name,
      date: new Date(`${h.startDate}T00:00:00.000Z`),
      type: HolidayType.religious,
      source: HolidaySource.openholidays,
      significance: HolidaySignificance.cultural,
      solemn: false,
      greetable,
      popular,
      regional: !h.nationwide,
      year: new Date(`${h.startDate}T00:00:00.000Z`).getUTCFullYear(),
    };
  });
}
