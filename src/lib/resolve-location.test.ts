import { describe, it, expect } from 'vitest';
import { resolveLocation } from './resolve-location';

describe('resolveLocation', () => {
  describe('Step 1 — contact country field', () => {
    it('resolves from contact country', () => {
      expect(resolveLocation('Germany', null, null)).toEqual({ iso: 'DE', status: 'resolved' });
      expect(resolveLocation('DE', null, null)).toEqual({ iso: 'DE', status: 'resolved' });
      expect(resolveLocation('United States', null, null)).toEqual({ iso: 'US', status: 'resolved' });
    });

    it('marks status as resolved', () => {
      const result = resolveLocation('Japan', undefined, undefined);
      expect(result.status).toBe('resolved');
    });
  });

  describe('Step 2 — company country fallback', () => {
    it('falls back to company country when contact country is missing', () => {
      expect(resolveLocation(null, 'France', null)).toEqual({ iso: 'FR', status: 'inferred' });
      expect(resolveLocation('', 'Spain', null)).toEqual({ iso: 'ES', status: 'inferred' });
    });

    it('marks status as inferred for company fallback', () => {
      const result = resolveLocation(null, 'Netherlands', null);
      expect(result.status).toBe('inferred');
    });

    it('does not fall back if contact country resolves', () => {
      const result = resolveLocation('Germany', 'France', null);
      expect(result).toEqual({ iso: 'DE', status: 'resolved' });
    });
  });

  describe('Step 3 — email TLD fallback', () => {
    it('infers country from ccTLD email', () => {
      expect(resolveLocation(null, null, 'user@company.de')).toEqual({ iso: 'DE', status: 'inferred' });
      expect(resolveLocation(null, null, 'user@company.co.jp')).toEqual({ iso: 'JP', status: 'inferred' });
      expect(resolveLocation(null, null, 'user@company.co.uk')).toEqual({ iso: 'GB', status: 'inferred' });
      expect(resolveLocation(null, null, 'user@company.fr')).toEqual({ iso: 'FR', status: 'inferred' });
      expect(resolveLocation(null, null, 'user@company.in')).toEqual({ iso: 'IN', status: 'inferred' });
    });

    it('does not infer from generic TLDs', () => {
      expect(resolveLocation(null, null, 'user@company.com')).toEqual({ iso: null, status: 'unknown' });
      expect(resolveLocation(null, null, 'user@company.io')).toEqual({ iso: null, status: 'unknown' });
      expect(resolveLocation(null, null, 'user@company.net')).toEqual({ iso: null, status: 'unknown' });
      expect(resolveLocation(null, null, 'user@company.org')).toEqual({ iso: null, status: 'unknown' });
    });
  });

  describe('Step 4 — unknown fallback', () => {
    it('returns unknown when nothing resolves', () => {
      expect(resolveLocation(null, null, null)).toEqual({ iso: null, status: 'unknown' });
      expect(resolveLocation('', '', '')).toEqual({ iso: null, status: 'unknown' });
      expect(resolveLocation('N/A', '', 'user@corp.com')).toEqual({ iso: null, status: 'unknown' });
    });
  });

  describe('priority ordering', () => {
    it('contact country takes priority over company and email', () => {
      const result = resolveLocation('Germany', 'France', 'user@company.es');
      expect(result).toEqual({ iso: 'DE', status: 'resolved' });
    });

    it('company country takes priority over email TLD', () => {
      const result = resolveLocation(null, 'Australia', 'user@company.de');
      expect(result).toEqual({ iso: 'AU', status: 'inferred' });
    });
  });
});
