import { describe, it, expect } from 'vitest';
import { HolidayType } from '@prisma/client';
import { buildPrompt, type GreetingContext } from './prompt';

function makeCtx(overrides: Partial<GreetingContext> = {}): GreetingContext {
  return {
    contactFirstName: 'Aisha',
    contactLastName: 'Rahman',
    company: 'Acme Corp',
    countryIso: 'MY',
    holidayName: 'Eid al-Fitr',
    holidayDate: new Date('2026-03-30T00:00:00.000Z'),
    holidayType: HolidayType.religious,
    repFirstName: 'James',
    ...overrides,
  };
}

describe('buildPrompt', () => {
  describe('required context fields', () => {
    it('includes contact first name', () => {
      expect(buildPrompt(makeCtx({ contactFirstName: 'Priya' }))).toContain('Priya');
    });

    it('includes contact last name when present', () => {
      expect(buildPrompt(makeCtx({ contactLastName: 'Sharma' }))).toContain('Sharma');
    });

    it('handles null last name gracefully', () => {
      const prompt = buildPrompt(makeCtx({ contactLastName: null }));
      expect(prompt).toContain('Aisha');
      expect(prompt).not.toContain('null');
      expect(prompt).not.toContain('undefined');
    });

    it('includes company name', () => {
      expect(buildPrompt(makeCtx({ company: 'GlobalTech' }))).toContain('GlobalTech');
    });

    it('falls back when company is null', () => {
      const prompt = buildPrompt(makeCtx({ company: null }));
      expect(prompt).toContain('their company');
      expect(prompt).not.toContain('null');
    });

    it('includes holiday name', () => {
      expect(buildPrompt(makeCtx({ holidayName: 'Diwali' }))).toContain('Diwali');
    });

    it('includes holiday date in readable form', () => {
      const prompt = buildPrompt(makeCtx({ holidayDate: new Date('2026-03-30T00:00:00.000Z') }));
      expect(prompt).toContain('March 30, 2026');
    });

    it('includes rep first name', () => {
      expect(buildPrompt(makeCtx({ repFirstName: 'Sarah' }))).toContain('Sarah');
    });

    it('includes country ISO code', () => {
      expect(buildPrompt(makeCtx({ countryIso: 'JP' }))).toContain('JP');
    });
  });

  describe('language guidance by holiday type', () => {
    it('instructs direct language for national holidays', () => {
      const prompt = buildPrompt(makeCtx({
        holidayType: HolidayType.national,
        holidayName: 'Independence Day',
      }));
      expect(prompt).toMatch(/national holiday/i);
      expect(prompt).toMatch(/direct language/i);
    });

    it('instructs soft language for religious holidays', () => {
      const prompt = buildPrompt(makeCtx({ holidayType: HolidayType.religious }));
      expect(prompt).toMatch(/religious or cultural/i);
      expect(prompt).toMatch(/soft language/i);
    });

    it('instructs soft language for cultural holidays', () => {
      const prompt = buildPrompt(makeCtx({
        holidayType: HolidayType.cultural,
        holidayName: 'Lunar New Year',
      }));
      expect(prompt).toMatch(/religious or cultural/i);
      expect(prompt).toMatch(/soft language/i);
    });
  });

  describe('formatting', () => {
    it('returns a non-empty string', () => {
      expect(buildPrompt(makeCtx())).toBeTruthy();
    });

    it('does not contain raw null or undefined', () => {
      const prompt = buildPrompt(makeCtx({ contactLastName: null, company: null }));
      expect(prompt).not.toContain('null');
      expect(prompt).not.toContain('undefined');
    });
  });
});
