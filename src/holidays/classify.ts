/**
 * Classifies a holiday by name to determine greetable and popular tags.
 * Applied at ingest time so every holiday row is tagged from the start.
 */

const NOT_GREETABLE_PATTERNS = [
  /memorial/i,
  /remembrance/i,
  /day of mourning/i,
  /mourning/i,
  /fallen/i,
  /victims/i,
  /anzac/i,
  /armistice/i,
  /holocaust/i,
  /martyrs/i,
  /commemoration of/i,
  /yom hashoah/i,
  /tisha b.av/i,
  /day of silence/i,
  /day of fasting/i,
  /truth and reconciliation/i,  // CA: residential school victims — day of mourning
  /human rights day/i,          // ZA: Sharpeville massacre commemoration
  /youth day/i,                  // ZA: Soweto Uprising — students killed by police
  /army day/i,                   // CL: celebrating military is sensitive in Pinochet context
];

const POPULAR_SUBSTRINGS = [
  'christmas',
  'new year',
  'diwali',
  'deepavali',
  'eid al-fitr',
  'eid ul-fitr',
  'eid al-adha',
  'eid ul-adha',
  'bakrid',
  'chinese new year',
  'lunar new year',
  'spring festival',
  'hanukkah',
  'chanukah',
  'rosh hashanah',
  'easter',
  'holi',
  'navratri',
  'navaratri',
  'dussehra',
  'vijayadashami',
  'thanksgiving',
  "valentine's day",
  'ramadan',
  'purim',
  'vesak',
  'buddha',
  'nowruz',
  'norooz',
  'guru nanak',
  'janmashtami',
  'ganesh',
  'mawlid',
  'eid milad',
  'yom kippur',
  'passover',
  'pesach',
  'sukkot',
  'shavuot',
  'onam',
  'pongal',
  'baisakhi',
  'vaisakhi',
  'muharram',
  'loy krathong',
  'songkran',
];

export function classifyHoliday(name: string): { greetable: boolean; popular: boolean } {
  const lower = name.toLowerCase();
  return {
    greetable: !NOT_GREETABLE_PATTERNS.some((re) => re.test(name)),
    popular: POPULAR_SUBSTRINGS.some((s) => lower.includes(s)),
  };
}
