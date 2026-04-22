import { HolidayType, HolidaySource, HolidaySignificance } from '@prisma/client';

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

  if (res.status === 404) return []; // country not covered by Nager
  if (!res.ok) {
    throw new Error(`Nager.Date API error ${res.status} for ${countryCode}/${year}`);
  }

  const data = (await res.json()) as NagerApiHoliday[];

  return data
    .filter((h) => h.global)
    .map((h) => ({
      countryIso: countryCode.toUpperCase(),
      name: h.name,
      // Parse as UTC midnight to avoid timezone-shifting the date
      date: new Date(`${h.date}T00:00:00.000Z`),
      type: HolidayType.national,
      source: HolidaySource.nager,
      significance: HolidaySignificance.major,
      year,
    }));
}
