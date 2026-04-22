# Architecture

## Problem
Client-facing reps working globally have contacts in many countries. It's hard to remember which contacts are celebrating which holidays and when. This tool solves that by surfacing upcoming holidays for active contacts, grouped by rep, delivered weekly with AI-generated greetings ready to send.

## System overview

```
HubSpot CRM ──► Contact filter ──► Location resolver ──► Holiday matcher ──► Greeting generator
                                                                          │
                                                                          ├──► Email digest (Monday AM)
                                                                          └──► HubSpot card (in-CRM)
Holiday APIs ───────────────────────────────────────────────────────────►┘
Claude AI ───────────────────────────────────────────────────────────────►┘
```

## Data pipeline

### Step 1 — Contact sync (runs daily via cron)
- Call HubSpot Contacts Search API (`POST /crm/v3/objects/contacts/search`)
- Filter: `hs_last_sales_activity_timestamp` > 12 months ago
- Pull fields: `firstname`, `lastname`, `email`, `country`, `company`, `hubspot_owner_id`, `hs_last_sales_activity_timestamp`
- Paginate with `after` cursor, 100 contacts per page
- Upsert into `contacts` table (keyed on HubSpot `hs_object_id`)

### Step 2 — Location resolution (at ingest)
Fallback chain when `country` is missing or blank:
1. Contact's `country` field (normalise to ISO 3166-1 alpha-2)
2. Associated company's `country` field (`GET /crm/v3/objects/companies/{id}`)
3. Infer from email domain (`.de` → `DE`, `.jp` → `JP`, etc. — ~60 TLDs covered)
4. If all fail → set `location_status = 'unknown'`, exclude from matching, surface in data quality report

Country normalisation maps free-text variants to ISO codes:
`"Deutschland" | "germany" | "DE"` → `"DE"`
See `src/hubspot/country-map.ts` for the full lookup table.

### Step 3 — Holiday matching (runs daily, looks 14 days ahead)
- For each contact with a resolved country, query the holiday cache for events in the next 14 days
- Store matches in `holiday_matches` table with `alert_7d` and `alert_1d` boolean flags
- Refresh the holiday cache weekly from Nager.Date and Open Holidays APIs

### Step 4 — Greeting generation (runs Sunday night, before Monday digest)
- For each match where `alert_7d = true` and no greeting exists yet
- Call Claude API with contact context (see prompt template below)
- Store generated greeting in `greetings` table, linked to the match

### Step 5 — Email digest (runs Monday 7am, rep's local timezone)
- Group matches by `hubspot_owner_id` → one digest email per rep
- Sort: today's contacts first (amber pill), then rest of week (green pill)
- Show full card for top 4 contacts, "+N more" link for the rest
- Send via SendGrid using rep's email from the owners cache

---

## Database schema

### `contacts`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | internal |
| hs_object_id | varchar | HubSpot ID, unique |
| first_name | varchar | |
| last_name | varchar | |
| email | varchar | |
| country_iso | char(2) | ISO 3166-1 alpha-2 |
| company | varchar | |
| owner_id | varchar | HubSpot owner ID |
| last_activity_at | timestamptz | from `hs_last_sales_activity_timestamp` |
| location_status | enum | `resolved` \| `inferred` \| `unknown` |
| synced_at | timestamptz | last HubSpot sync |

### `holidays`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| country_iso | char(2) | |
| name | varchar | e.g. "Diwali" |
| date | date | |
| type | enum | `national` \| `religious` \| `cultural` |
| source | enum | `nager` \| `openholidays` |
| year | int | for cache invalidation |

### `holiday_matches`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| contact_id | uuid FK | |
| holiday_id | uuid FK | |
| alert_7d | boolean | holiday is within 7 days |
| alert_1d | boolean | holiday is within 1 day |
| week_of | date | Monday of the relevant week |
| notified_at | timestamptz | null until digest sent |

### `greetings`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| match_id | uuid FK | |
| body | text | AI-generated message |
| generated_at | timestamptz | |
| model | varchar | e.g. `claude-sonnet-4-20250514` |

### `owners`
| Column | Type | Notes |
|---|---|---|
| hs_owner_id | varchar PK | |
| email | varchar | used for digest delivery |
| first_name | varchar | injected into greeting prompt |
| timezone | varchar | for digest send time |
| synced_at | timestamptz | |

---

## Claude greeting prompt template

```
You are a professional business communication assistant.

Write a warm, brief holiday greeting from {{rep_first_name}} to {{contact_first_name}} at {{company}}.

Holiday: {{holiday_name}} ({{holiday_date}})
Contact country: {{country_name}}
Holiday type: {{holiday_type}}

Rules:
- 2-3 sentences maximum
- Professional but warm tone
- For religious/cultural holidays, use "wishing you a wonderful..." not "happy..."
- For religious holidays, use "may be celebrating" framing if relevant
- Do not mention the rep's company or make any sales references
- Do not use emoji
- Address the contact by first name
- Sign off naturally, do not include a signature block

Return only the greeting text, nothing else.
```

---

## HubSpot API reference

### OAuth scopes required
- `crm.objects.contacts.read`
- `crm.objects.companies.read`
- `sales-email-read`
- `timeline.read`
- `oauth`

### Key endpoints
| Purpose | Method + Path |
|---|---|
| Contact sync | `POST /crm/v3/objects/contacts/search` |
| Company country fallback | `GET /crm/v3/objects/companies/{id}` |
| Owner list | `GET /crm/v3/owners` |

### Rate limits
- 100 requests / 10 seconds
- 200,000 requests / day
- Use `after` cursor pagination, 100 contacts per page

---

## Holiday data sources

### Nager.Date (national/public holidays)
- Free, no API key required
- Endpoint: `https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}`
- Covers 100+ countries
- Use for: bank holidays, national days, public holidays

### Open Holidays API (religious + cultural)
- Free, no API key required
- Endpoint: `https://openholidaysapi.org/PublicHolidays`
- Covers religious events (Eid, Diwali, Passover, etc.) and cultural (Lunar New Year)
- Use for: all non-national observances

Refresh holiday cache: weekly, every Sunday at 3am, 2 years ahead.

---

## HubSpot UI Extension (card)

The in-CRM card is a separate React app built with HubSpot's UI Extensions SDK. It:
1. Receives `hs_object_id` as context when the sidebar loads
2. Calls our Express API (`GET /api/contacts/:hsObjectId/holidays`)
3. Displays upcoming holidays in the next 30 days with the greeting copy button

The card does **not** call HubSpot APIs directly — it queries our database via the Express API. This keeps latency low and avoids rate limit issues on render.

---

## Deployment

- **Backend + scheduler**: Railway or Render (single Node.js service)
- **Database**: Railway PostgreSQL or Render PostgreSQL
- **HubSpot card**: deployed via HubSpot CLI (`hs project upload`)
- **Scheduler**: `node-cron` running inside the same Express process for MVP
