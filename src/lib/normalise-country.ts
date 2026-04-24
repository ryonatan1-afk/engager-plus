import { COUNTRY_MAP } from './country-map';

/** Valid ISO 3166-1 alpha-2 code pattern */
const ISO_ALPHA2 = /^[A-Z]{2}$/;

/**
 * Normalise a free-text country string to an ISO 3166-1 alpha-2 code.
 * Returns the 2-letter code (uppercase) or null if unrecognised.
 */
export function normaliseCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already a valid 2-letter ISO code
  const upper = trimmed.toUpperCase();
  if (ISO_ALPHA2.test(upper)) {
    // Confirm it's a code we actually know (not just any 2 letters)
    const fromMap = COUNTRY_MAP[upper.toLowerCase()];
    return fromMap ?? (isKnownIso(upper) ? upper : null);
  }

  // Look up by lowercase key
  return COUNTRY_MAP[trimmed.toLowerCase()] ?? null;
}

/**
 * Minimal set of all valid ISO 3166-1 alpha-2 codes for pass-through validation.
 * Avoids false positives like "IT" (Italy) vs a random 2-letter abbreviation.
 */
const VALID_ISO_CODES = new Set(Object.values(COUNTRY_MAP));

function isKnownIso(code: string): boolean {
  return VALID_ISO_CODES.has(code);
}
