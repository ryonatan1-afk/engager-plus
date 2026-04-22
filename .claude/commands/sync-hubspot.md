# Sync contacts from HubSpot

Trigger a manual HubSpot contact sync by running:

```bash
npm run sync
```

Watch the output for:
- Total contacts fetched
- Contacts filtered out (inactive)
- Contacts with unknown location (data quality issue)
- Upsert counts (new vs updated)

If the sync fails, check `.env` for valid `HUBSPOT_CLIENT_ID` and `HUBSPOT_CLIENT_SECRET`, and verify the OAuth token hasn't expired.
