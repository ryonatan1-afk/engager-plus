# Holiday data sources

## Nager.Date — national/public holidays

**What it covers**: Public and national holidays for 100+ countries (bank holidays, national days, independence days, etc.)
**Cost**: Free, no API key required
**Docs**: https://date.nager.at/swagger/index.html

### Key endpoint
```
GET https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}
```

**Example**:
```
GET https://date.nager.at/api/v3/PublicHolidays/2026/JP
```

**Response fields**:
- `date` — ISO date string (e.g. `"2026-01-01"`)
- `localName` — name in local language
- `name` — English name
- `countryCode` — ISO 3166-1 alpha-2
- `fixed` — whether it falls on the same date every year
- `global` — whether it applies nationwide vs. regional
- `types` — array e.g. `["Public"]`

**Usage notes**:
- Filter `global: true` only — regional holidays are noise for this use case
- Cache responses — data doesn't change year to year once fetched
- Fetch 2 years ahead on each weekly refresh (current year + next year)
- Covers most of Europe, Americas, Asia-Pacific well; Middle East and Africa coverage is thinner

---

## Open Holidays API — religious and cultural events

**What it covers**: Religious observances (Eid al-Fitr, Eid al-Adha, Diwali, Passover, Rosh Hashanah, Lunar New Year, Holi, Vesak, etc.) and cultural/regional events
**Cost**: Free, no API key required
**Docs**: https://openholidaysapi.org/swagger/index.html

### Key endpoint
```
GET https://openholidaysapi.org/PublicHolidays
  ?countryIsoCode={countryCode}
  &languageIsoCode=EN
  &validFrom={YYYY-MM-DD}
  &validTo={YYYY-MM-DD}
```

**Example**:
```
GET https://openholidaysapi.org/PublicHolidays
  ?countryIsoCode=IN
  &languageIsoCode=EN
  &validFrom=2026-01-01
  &validTo=2026-12-31
```

**Response fields**:
- `id` — unique identifier
- `startDate` / `endDate` — ISO date strings (some holidays span multiple days)
- `name` — array of `{ language, text }` objects; use the EN entry
- `type` — `"Public"` or `"Optional"` — include both
- `nationwide` — boolean

**Usage notes**:
- Multi-day holidays (e.g. Eid, Diwali) have different `startDate` and `endDate` — alert on `startDate`
- Some countries have richer coverage than others — India, Malaysia, Indonesia, Saudi Arabia are well covered
- Lunar calendar holidays (Eid, Lunar New Year) shift each year — always fetch fresh data, never hardcode dates
- Use `languageIsoCode=EN` for consistent naming in greetings

---

## Combined coverage strategy

| Holiday type | Source | Notes |
|---|---|---|
| National / bank holidays | Nager.Date | Primary source for all countries |
| Religious observances | Open Holidays API | Eid, Diwali, Passover, etc. |
| Cultural events | Open Holidays API | Lunar New Year, Holi, etc. |

For any given country, fetch from both sources and deduplicate by date + name before writing to the `holidays` table. Some national holidays (e.g. Eid as a public holiday in Malaysia) may appear in both — the `source` field in the DB tracks origin.

---

## Cache refresh schedule

- **Frequency**: Weekly, Sunday at 3am
- **Range**: Current year + next year (rolling 2-year window)
- **Strategy**: Upsert by `(country_iso, date, name)` — safe to re-run
- **Invalidation**: No manual invalidation needed; lunar holidays recalculate correctly on each annual fetch

---

## Countries with known thin coverage

These countries have limited or unreliable data in both APIs. Flag contacts from these countries with `holiday_confidence = 'low'` and consider excluding them from the digest until coverage improves:

- Libya, Sudan, Yemen, Somalia (Middle East / North Africa)
- Many sub-Saharan African countries outside Nigeria, Kenya, South Africa
- Myanmar, Laos, Cambodia (Southeast Asia)

For these, national holidays may still be available via Nager.Date — check before excluding.

---

## Greeting language guidance by holiday type

| Holiday | Greeting style | Notes |
|---|---|---|
| Eid al-Fitr / Eid al-Adha | "Eid Mubarak" or "wishing you a blessed Eid" | Never "Happy Eid" |
| Diwali | "Wishing you a bright and joyful Diwali" | "Happy Diwali" is also fine |
| Lunar New Year | "Wishing you a prosperous New Year" | Avoid "Happy Chinese New Year" — also celebrated in Vietnam, Korea, etc. |
| Nowruz | "Nowruz Mobarak" or "wishing you a joyful Nowruz" | Persian New Year |
| Passover | "Chag Pesach Sameach" or "wishing you a meaningful Passover" | |
| Rosh Hashanah | "Shana Tova" or "wishing you a sweet new year" | |
| Christmas | "Wishing you a wonderful Christmas" | |
| National holidays | "Wishing you a wonderful [holiday name]" | Generic but appropriate |

These are baked into the Claude greeting prompt — this table is for reference when tuning the prompt.
