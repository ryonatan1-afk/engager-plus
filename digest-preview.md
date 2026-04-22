# Preview this week's email digest

Generate a console preview of the Monday digest for the current week by running:

```bash
npm run digest:preview
```

This shows all matches grouped by owner, with greetings, sorted by urgency (today first). No emails are sent. Use this to validate the matcher and greeting output before the Monday send.

Arguments (optional): pass a specific rep email to preview only their digest.
Example: `npm run digest:preview -- --owner=rep@company.com`
