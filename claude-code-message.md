# Message for Claude Code — Architecture Direction Check

## Context

Rapport is evolving beyond a HubSpot holiday greeting tool. The broader vision is a **relationship intelligence platform** for GTM teams (sales-first, then CS) that:

- Detects moments to reach out (holidays, job changes, relationship gone cold, company milestones, etc.)
- Generates contextually appropriate AI-powered outreach
- Works inside whatever CRM the user is already in

**HubSpot is the first CRM adapter — not the product.** Salesforce and a standalone web app are on the roadmap.

---

## What I need you to check

Before we continue building, please audit the current codebase for the following:

### 1. Is business logic separated from HubSpot-specific code?

The goal is a clean three-layer architecture:

```
Signal Engine        → detects moments worth acting on
Content Engine       → generates AI-powered outreach
CRM Adapter Layer    → HubSpot today, Salesforce / standalone tomorrow
```

**Red flags to look for:**
- Business logic (holiday matching, contact filtering, greeting generation) living inside HubSpot API calls or HubSpot-specific modules
- Data models that are shaped around HubSpot's schema rather than a neutral internal schema
- Any place where swapping HubSpot for Salesforce would require rewriting core logic

### 2. Is there a clear internal contact/company data model?

We should have a neutral internal schema (e.g. `Contact`, `Company`) that the HubSpot adapter maps *to* — not raw HubSpot objects flowing through the whole app.

### 3. Is the HubSpot integration isolated?

HubSpot-specific code (OAuth, API calls, webhook handling, UI extensions) should live in an `integrations/hubspot/` or `adapters/hubspot/` directory and expose a clean interface to the rest of the app.

---

## What I want as output

1. A short summary of where we currently stand against this architecture
2. A list of specific files or functions that would need to change to achieve clean separation
3. A recommended refactor plan (if needed) — but **do not make any changes yet**

Just the audit and the plan. We'll decide together what to do next.
