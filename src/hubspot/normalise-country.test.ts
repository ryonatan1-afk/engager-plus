import { describe, it, expect } from 'vitest';
import { normaliseCountry } from './normalise-country';

describe('normaliseCountry', () => {
  it('returns null for null/undefined/empty', () => {
    expect(normaliseCountry(null)).toBeNull();
    expect(normaliseCountry(undefined)).toBeNull();
    expect(normaliseCountry('')).toBeNull();
    expect(normaliseCountry('   ')).toBeNull();
  });

  it('handles ISO codes passed directly', () => {
    expect(normaliseCountry('DE')).toBe('DE');
    expect(normaliseCountry('de')).toBe('DE');
    expect(normaliseCountry('GB')).toBe('GB');
    expect(normaliseCountry('US')).toBe('US');
    expect(normaliseCountry('JP')).toBe('JP');
  });

  it('handles full English country names', () => {
    expect(normaliseCountry('Germany')).toBe('DE');
    expect(normaliseCountry('germany')).toBe('DE');
    expect(normaliseCountry('GERMANY')).toBe('DE');
    expect(normaliseCountry('United Kingdom')).toBe('GB');
    expect(normaliseCountry('United States')).toBe('US');
    expect(normaliseCountry('United States of America')).toBe('US');
    expect(normaliseCountry('France')).toBe('FR');
    expect(normaliseCountry('Japan')).toBe('JP');
    expect(normaliseCountry('India')).toBe('IN');
    expect(normaliseCountry('Australia')).toBe('AU');
    expect(normaliseCountry('Canada')).toBe('CA');
  });

  it('handles common abbreviations and aliases', () => {
    expect(normaliseCountry('USA')).toBe('US');
    expect(normaliseCountry('UK')).toBe('GB');
    expect(normaliseCountry('Holland')).toBe('NL');
    expect(normaliseCountry('England')).toBe('GB');
    expect(normaliseCountry('KSA')).toBe('SA');
    expect(normaliseCountry('UAE')).toBe('AE');
    expect(normaliseCountry('PRC')).toBe('CN');
  });

  it('handles local/native country names', () => {
    expect(normaliseCountry('Deutschland')).toBe('DE');
    expect(normaliseCountry('Österreich')).toBe('AT');
    expect(normaliseCountry('Sverige')).toBe('SE');
    expect(normaliseCountry('Suomi')).toBe('FI');
    expect(normaliseCountry('Brasil')).toBe('BR');
  });

  it('handles extra whitespace', () => {
    expect(normaliseCountry('  Germany  ')).toBe('DE');
    expect(normaliseCountry(' United Kingdom ')).toBe('GB');
  });

  it('returns null for unrecognised strings', () => {
    expect(normaliseCountry('XZ')).toBeNull();
    expect(normaliseCountry('unknown')).toBeNull();
    expect(normaliseCountry('N/A')).toBeNull();
    expect(normaliseCountry('Narnia')).toBeNull();
  });
});
