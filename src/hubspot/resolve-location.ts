import { normaliseCountry } from './normalise-country';

export type LocationStatus = 'resolved' | 'inferred' | 'unknown';

export type LocationResult =
  | { iso: string; status: 'resolved' | 'inferred' }
  | { iso: null; status: 'unknown' };

/**
 * Country code TLDs that reliably map to a country.
 * Generic TLDs (.com, .net, .org, .io, etc.) are intentionally excluded.
 * Note: .uk maps to GB (not a standard ISO TLD but the most common UK domain).
 */
const TLD_TO_ISO: Record<string, string> = {
  'ac': 'SH', 'ad': 'AD', 'ae': 'AE', 'af': 'AF', 'ag': 'AG',
  'al': 'AL', 'am': 'AM', 'ao': 'AO', 'ar': 'AR', 'at': 'AT',
  'au': 'AU', 'az': 'AZ', 'ba': 'BA', 'bb': 'BB', 'bd': 'BD',
  'be': 'BE', 'bf': 'BF', 'bg': 'BG', 'bh': 'BH', 'bj': 'BJ',
  'bn': 'BN', 'bo': 'BO', 'br': 'BR', 'bs': 'BS', 'bt': 'BT',
  'bw': 'BW', 'by': 'BY', 'bz': 'BZ', 'ca': 'CA', 'cd': 'CD',
  'cf': 'CF', 'cg': 'CG', 'ch': 'CH', 'ci': 'CI', 'cl': 'CL',
  'cm': 'CM', 'cn': 'CN', 'co': 'CO', 'cr': 'CR', 'cu': 'CU',
  'cv': 'CV', 'cy': 'CY', 'cz': 'CZ', 'de': 'DE', 'dj': 'DJ',
  'dk': 'DK', 'dm': 'DM', 'do': 'DO', 'dz': 'DZ', 'ec': 'EC',
  'ee': 'EE', 'eg': 'EG', 'er': 'ER', 'es': 'ES', 'et': 'ET',
  'fi': 'FI', 'fj': 'FJ', 'fm': 'FM', 'fr': 'FR', 'ga': 'GA',
  'gb': 'GB', 'gd': 'GD', 'ge': 'GE', 'gh': 'GH', 'gm': 'GM',
  'gn': 'GN', 'gq': 'GQ', 'gr': 'GR', 'gt': 'GT', 'gw': 'GW',
  'gy': 'GY', 'hk': 'HK', 'hn': 'HN', 'hr': 'HR', 'ht': 'HT',
  'hu': 'HU', 'id': 'ID', 'ie': 'IE', 'il': 'IL', 'in': 'IN',
  'iq': 'IQ', 'ir': 'IR', 'is': 'IS', 'it': 'IT', 'jm': 'JM',
  'jo': 'JO', 'jp': 'JP', 'ke': 'KE', 'kg': 'KG', 'kh': 'KH',
  'ki': 'KI', 'km': 'KM', 'kn': 'KN', 'kp': 'KP', 'kr': 'KR',
  'kw': 'KW', 'kz': 'KZ', 'la': 'LA', 'lb': 'LB', 'lc': 'LC',
  'li': 'LI', 'lk': 'LK', 'lr': 'LR', 'ls': 'LS', 'lt': 'LT',
  'lu': 'LU', 'lv': 'LV', 'ly': 'LY', 'ma': 'MA', 'mc': 'MC',
  'md': 'MD', 'me': 'ME', 'mg': 'MG', 'mh': 'MH', 'mk': 'MK',
  'ml': 'ML', 'mm': 'MM', 'mn': 'MN', 'mr': 'MR', 'mt': 'MT',
  'mu': 'MU', 'mv': 'MV', 'mw': 'MW', 'mx': 'MX', 'my': 'MY',
  'mz': 'MZ', 'na': 'NA', 'ne': 'NE', 'ng': 'NG', 'ni': 'NI',
  'nl': 'NL', 'no': 'NO', 'np': 'NP', 'nr': 'NR', 'nz': 'NZ',
  'om': 'OM', 'pa': 'PA', 'pe': 'PE', 'pg': 'PG', 'ph': 'PH',
  'pk': 'PK', 'pl': 'PL', 'pt': 'PT', 'pw': 'PW', 'py': 'PY',
  'qa': 'QA', 'ro': 'RO', 'rs': 'RS', 'ru': 'RU', 'rw': 'RW',
  'sa': 'SA', 'sb': 'SB', 'sc': 'SC', 'sd': 'SD', 'se': 'SE',
  'sg': 'SG', 'si': 'SI', 'sk': 'SK', 'sl': 'SL', 'sm': 'SM',
  'sn': 'SN', 'so': 'SO', 'sr': 'SR', 'st': 'ST', 'sv': 'SV',
  'sy': 'SY', 'sz': 'SZ', 'td': 'TD', 'tg': 'TG', 'th': 'TH',
  'tj': 'TJ', 'tl': 'TL', 'tm': 'TM', 'tn': 'TN', 'to': 'TO',
  'tr': 'TR', 'tt': 'TT', 'tv': 'TV', 'tw': 'TW', 'tz': 'TZ',
  'ua': 'UA', 'ug': 'UG', 'uk': 'GB', // .uk -> GB
  'us': 'US', 'uy': 'UY', 'uz': 'UZ', 'va': 'VA', 've': 'VE',
  'vn': 'VN', 'vu': 'VU', 'ws': 'WS', 'ye': 'YE', 'za': 'ZA',
  'zm': 'ZM', 'zw': 'ZW',
};

/**
 * Resolve a contact's country using the fallback chain:
 * 1. Contact's own country field
 * 2. Associated company's country field
 * 3. Email domain TLD
 * 4. Unknown
 */
export function resolveLocation(
  contactCountry: string | null | undefined,
  companyCountry: string | null | undefined,
  email: string | null | undefined,
): LocationResult {
  // Step 1: contact's country
  if (contactCountry) {
    const iso = normaliseCountry(contactCountry);
    if (iso) return { iso, status: 'resolved' };
  }

  // Step 2: company's country
  if (companyCountry) {
    const iso = normaliseCountry(companyCountry);
    if (iso) return { iso, status: 'inferred' };
  }

  // Step 3: email domain TLD
  if (email) {
    const iso = inferFromEmailTld(email);
    if (iso) return { iso, status: 'inferred' };
  }

  return { iso: null, status: 'unknown' };
}

function inferFromEmailTld(email: string): string | null {
  const atIdx = email.lastIndexOf('@');
  if (atIdx === -1) return null;
  const domain = email.slice(atIdx + 1).toLowerCase();
  const parts = domain.split('.');
  if (parts.length < 2) return null;
  const tld = parts[parts.length - 1];
  // Only map if the TLD is 2 chars (ccTLD)
  if (tld.length !== 2) return null;
  return TLD_TO_ISO[tld] ?? null;
}
