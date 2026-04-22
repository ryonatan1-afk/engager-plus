/**
 * Maps free-text country name variants to ISO 3166-1 alpha-2 codes.
 * Keys are lowercase for case-insensitive matching.
 * See also: normalise-country.ts for the lookup function.
 */
export const COUNTRY_MAP: Record<string, string> = {
  // Afghanistan
  'afghanistan': 'AF', 'af': 'AF',
  // Albania
  'albania': 'AL', 'al': 'AL',
  // Algeria
  'algeria': 'DZ', 'dz': 'DZ',
  // Argentina
  'argentina': 'AR', 'ar': 'AR',
  // Australia
  'australia': 'AU', 'au': 'AU',
  // Austria
  'austria': 'AT', 'österreich': 'AT', 'oesterreich': 'AT', 'at': 'AT',
  // Bangladesh
  'bangladesh': 'BD', 'bd': 'BD',
  // Belgium
  'belgium': 'BE', 'belgique': 'BE', 'belgien': 'BE', 'be': 'BE',
  // Bolivia
  'bolivia': 'BO', 'bo': 'BO',
  // Brazil
  'brazil': 'BR', 'brasil': 'BR', 'br': 'BR',
  // Bulgaria
  'bulgaria': 'BG', 'bg': 'BG',
  // Canada
  'canada': 'CA', 'ca': 'CA',
  // Chile
  'chile': 'CL', 'cl': 'CL',
  // China
  'china': 'CN', 'peoples republic of china': 'CN', "people's republic of china": 'CN',
  'prc': 'CN', 'cn': 'CN', 'zhongguo': 'CN', '中国': 'CN',
  // Colombia
  'colombia': 'CO', 'co': 'CO',
  // Croatia
  'croatia': 'HR', 'hrvatska': 'HR', 'hr': 'HR',
  // Czech Republic
  'czech republic': 'CZ', 'czechia': 'CZ', 'czech': 'CZ', 'cz': 'CZ',
  // Denmark
  'denmark': 'DK', 'danmark': 'DK', 'dk': 'DK',
  // Ecuador
  'ecuador': 'EC', 'ec': 'EC',
  // Egypt
  'egypt': 'EG', 'eg': 'EG',
  // Estonia
  'estonia': 'EE', 'ee': 'EE',
  // Ethiopia
  'ethiopia': 'ET', 'et': 'ET',
  // Finland
  'finland': 'FI', 'suomi': 'FI', 'fi': 'FI',
  // France
  'france': 'FR', 'fr': 'FR',
  // Germany
  'germany': 'DE', 'deutschland': 'DE', 'de': 'DE',
  // Ghana
  'ghana': 'GH', 'gh': 'GH',
  // Greece
  'greece': 'GR', 'hellas': 'GR', 'gr': 'GR',
  // Hong Kong
  'hong kong': 'HK', 'hk': 'HK', 'hong kong sar': 'HK', 'hong kong s.a.r.': 'HK',
  // Hungary
  'hungary': 'HU', 'magyarország': 'HU', 'hu': 'HU',
  // India
  'india': 'IN', 'bharat': 'IN', 'in': 'IN',
  // Indonesia
  'indonesia': 'ID', 'id': 'ID',
  // Ireland
  'ireland': 'IE', 'republic of ireland': 'IE', 'eire': 'IE', 'ie': 'IE',
  // Israel
  'israel': 'IL', 'il': 'IL',
  // Italy
  'italy': 'IT', 'italia': 'IT', 'it': 'IT',
  // Japan
  'japan': 'JP', 'nihon': 'JP', 'nippon': 'JP', 'jp': 'JP', '日本': 'JP',
  // Kenya
  'kenya': 'KE', 'ke': 'KE',
  // South Korea
  'south korea': 'KR', 'korea': 'KR', 'republic of korea': 'KR', 'kr': 'KR',
  '한국': 'KR',
  // Latvia
  'latvia': 'LV', 'lv': 'LV',
  // Lithuania
  'lithuania': 'LT', 'lt': 'LT',
  // Luxembourg
  'luxembourg': 'LU', 'lu': 'LU',
  // Malaysia
  'malaysia': 'MY', 'my': 'MY',
  // Mexico
  'mexico': 'MX', 'méxico': 'MX', 'mx': 'MX',
  // Morocco
  'morocco': 'MA', 'maroc': 'MA', 'ma': 'MA',
  // Myanmar
  'myanmar': 'MM', 'burma': 'MM', 'mm': 'MM',
  // Netherlands
  'netherlands': 'NL', 'the netherlands': 'NL', 'holland': 'NL', 'nederland': 'NL', 'nl': 'NL',
  // New Zealand
  'new zealand': 'NZ', 'nz': 'NZ',
  // Nigeria
  'nigeria': 'NG', 'ng': 'NG',
  // Norway
  'norway': 'NO', 'norge': 'NO', 'no': 'NO',
  // Pakistan
  'pakistan': 'PK', 'pk': 'PK',
  // Peru
  'peru': 'PE', 'perú': 'PE', 'pe': 'PE',
  // Philippines
  'philippines': 'PH', 'filipinas': 'PH', 'ph': 'PH',
  // Poland
  'poland': 'PL', 'polska': 'PL', 'pl': 'PL',
  // Portugal
  'portugal': 'PT', 'pt': 'PT',
  // Romania
  'romania': 'RO', 'ro': 'RO',
  // Russia
  'russia': 'RU', 'russian federation': 'RU', 'rossiya': 'RU', 'ru': 'RU',
  // Saudi Arabia
  'saudi arabia': 'SA', 'ksa': 'SA', 'sa': 'SA',
  // Serbia
  'serbia': 'RS', 'rs': 'RS',
  // Singapore
  'singapore': 'SG', 'sg': 'SG',
  // Slovakia
  'slovakia': 'SK', 'sk': 'SK',
  // Slovenia
  'slovenia': 'SI', 'si': 'SI',
  // South Africa
  'south africa': 'ZA', 'za': 'ZA',
  // Spain
  'spain': 'ES', 'españa': 'ES', 'espana': 'ES', 'es': 'ES',
  // Sri Lanka
  'sri lanka': 'LK', 'lk': 'LK',
  // Sweden
  'sweden': 'SE', 'sverige': 'SE', 'se': 'SE',
  // Switzerland
  'switzerland': 'CH', 'schweiz': 'CH', 'suisse': 'CH', 'svizzera': 'CH', 'ch': 'CH',
  // Taiwan
  'taiwan': 'TW', 'republic of china': 'TW', 'roc': 'TW', 'tw': 'TW',
  // Thailand
  'thailand': 'TH', 'th': 'TH',
  // Turkey
  'turkey': 'TR', 'türkiye': 'TR', 'turkiye': 'TR', 'tr': 'TR',
  // Ukraine
  'ukraine': 'UA', 'ua': 'UA',
  // United Arab Emirates
  'united arab emirates': 'AE', 'uae': 'AE', 'emirates': 'AE', 'ae': 'AE',
  // United Kingdom
  'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB', 'britain': 'GB',
  'england': 'GB', 'scotland': 'GB', 'wales': 'GB', 'northern ireland': 'GB',
  'gb': 'GB',
  // United States
  'united states': 'US', 'united states of america': 'US', 'usa': 'US',
  'america': 'US', 'us': 'US',
  // Uruguay
  'uruguay': 'UY', 'uy': 'UY',
  // Venezuela
  'venezuela': 'VE', 've': 'VE',
  // Vietnam
  'vietnam': 'VN', 'viet nam': 'VN', 'vn': 'VN',
};
