import { HolidayType, HolidaySource, HolidaySignificance } from '@prisma/client';
import { classifyHoliday } from './classify';

interface NagerApiHoliday {
  date: string;
  name: string;
  countryCode: string;
  global: boolean;
  types: string[];
}

export interface HolidayRecord {
  countryIso: string;
  name: string;
  date: Date;
  type: HolidayType;
  source: HolidaySource;
  significance: HolidaySignificance;
  solemn: boolean;
  greetable: boolean;
  popular: boolean;
  regional: boolean;
  year: number;
}

/**
 * Fetches national/public holidays from Nager.Date for a given country and year.
 * Only returns globally-applicable holidays (global: true) — regional ones are excluded.
 * Returns an empty array if the country is not supported by the API.
 */
export async function fetchNationalHolidays(
  countryCode: string,
  year: number,
): Promise<HolidayRecord[]> {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode.toUpperCase()}`;
  const res = await fetch(url);

  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(`Nager.Date API error ${res.status} for ${countryCode}/${year}`);
  }

  const data = (await res.json()) as NagerApiHoliday[];

  return data
    .filter((h) => h.global)
    .map((h) => {
      const { greetable, popular } = classifyHoliday(h.name);
      return {
        countryIso: countryCode.toUpperCase(),
        name: h.name,
        date: new Date(`${h.date}T00:00:00.000Z`),
        type: HolidayType.national,
        source: HolidaySource.nager,
        significance: HolidaySignificance.major,
        solemn: false,
        greetable,
        popular,
        regional: false, // already filtered to global: true above
        year,
      };
    });
}
