import { describe, it, expect } from 'vitest';
import { getMonday, daysUntil, computeFlags } from './matcher';

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

describe('getMonday', () => {
  it('returns the same day if already Monday', () => {
    const mon = utc(2026, 3, 23); // Monday
    expect(getMonday(mon).toISOString()).toBe(utc(2026, 3, 23).toISOString());
  });

  it('returns previous Monday for mid-week days', () => {
    expect(getMonday(utc(2026, 3, 25)).toISOString()).toBe(utc(2026, 3, 23).toISOString()); // Wed → Mon
    expect(getMonday(utc(2026, 3, 27)).toISOString()).toBe(utc(2026, 3, 23).toISOString()); // Fri → Mon
    expect(getMonday(utc(2026, 3, 28)).toISOString()).toBe(utc(2026, 3, 23).toISOString()); // Sat → Mon
  });

  it('returns previous Monday for Sunday', () => {
    const sun = utc(2026, 3, 29); // Sunday
    expect(getMonday(sun).toISOString()).toBe(utc(2026, 3, 23).toISOString());
  });

  it('handles month boundaries', () => {
    // Wednesday Apr 1 2026 → Monday Mar 30 2026
    expect(getMonday(utc(2026, 4, 1)).toISOString()).toBe(utc(2026, 3, 30).toISOString());
  });

  it('returns midnight UTC', () => {
    const result = getMonday(utc(2026, 3, 25));
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
  });
});

describe('daysUntil', () => {
  it('returns 0 when holiday is today', () => {
    const today = utc(2026, 3, 27);
    expect(daysUntil(today, utc(2026, 3, 27))).toBe(0);
  });

  it('returns 1 when holiday is tomorrow', () => {
    expect(daysUntil(utc(2026, 3, 27), utc(2026, 3, 28))).toBe(1);
  });

  it('returns 7 for exactly a week away', () => {
    expect(daysUntil(utc(2026, 3, 27), utc(2026, 4, 3))).toBe(7);
  });

  it('returns 14 for exactly two weeks away', () => {
    expect(daysUntil(utc(2026, 3, 27), utc(2026, 4, 10))).toBe(14);
  });

  it('returns negative for past holidays', () => {
    expect(daysUntil(utc(2026, 3, 27), utc(2026, 3, 26))).toBe(-1);
  });

  it('handles month boundaries correctly', () => {
    expect(daysUntil(utc(2026, 3, 31), utc(2026, 4, 1))).toBe(1);
  });
});

describe('computeFlags', () => {
  const today = utc(2026, 3, 27);

  it('sets both flags when holiday is today', () => {
    expect(computeFlags(today, utc(2026, 3, 27))).toEqual({ alert7d: true, alert1d: true });
  });

  it('sets both flags when holiday is tomorrow', () => {
    expect(computeFlags(today, utc(2026, 3, 28))).toEqual({ alert7d: true, alert1d: true });
  });

  it('sets only alert7d when holiday is in 2-7 days', () => {
    expect(computeFlags(today, utc(2026, 3, 29))).toEqual({ alert7d: true, alert1d: false });
    expect(computeFlags(today, utc(2026, 4, 3))).toEqual({ alert7d: true, alert1d: false });
  });

  it('sets neither flag when holiday is 8-14 days away', () => {
    expect(computeFlags(today, utc(2026, 4, 4))).toEqual({ alert7d: false, alert1d: false });
    expect(computeFlags(today, utc(2026, 4, 10))).toEqual({ alert7d: false, alert1d: false });
  });

  it('sets neither flag for past holidays', () => {
    expect(computeFlags(today, utc(2026, 3, 26))).toEqual({ alert7d: false, alert1d: false });
    expect(computeFlags(today, utc(2026, 1, 1))).toEqual({ alert7d: false, alert1d: false });
  });

  it('sets only alert7d at the 7-day boundary', () => {
    expect(computeFlags(today, utc(2026, 4, 3))).toEqual({ alert7d: true, alert1d: false });
  });

  it('sets neither flag at the 8-day boundary', () => {
    expect(computeFlags(today, utc(2026, 4, 4))).toEqual({ alert7d: false, alert1d: false });
  });
});
