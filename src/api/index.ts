import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getAuthorizationUrl, exchangeCode } from '../hubspot/auth';
import { syncContacts } from '../hubspot/sync-contacts';
import { syncOwners } from '../hubspot/sync-owners';
import { sendTestDigest, sendWeeklyDigests } from '../digest';
import { prisma } from '../db/client';
import { requireApiKey, requireAdminKey } from '../lib/auth-middleware';

const router = Router();

// ── Rate limiters ─────────────────────────────────────────────────────────────

const testDigestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests, please try again later.' },
});

const syncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests, please try again later.' },
});

const unsubscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Tenant registration (admin-only) ──────────────────────────────────────────

/**
 * Creates a new tenant and returns their API key.
 * Protected by ADMIN_SECRET — only the platform operator can call this.
 * Body: { "name": "Acme Corp" }  (name is optional)
 */
router.post('/api/tenants/register', requireAdminKey, async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  try {
    // Generate a 40-char random API key from two UUIDs (without dashes)
    const { randomUUID } = await import('crypto');
    const apiKey = (randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')).slice(0, 40);

    const tenant = await prisma.tenant.create({
      data: { name: name ?? null, apiKey },
      select: { id: true, name: true, apiKey: true, createdAt: true },
    });

    res.status(201).json({ ok: true, tenant });
  } catch (err) {
    console.error('[api] Tenant registration failed:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── OAuth ─────────────────────────────────────────────────────────────────────

/**
 * Kick off the HubSpot OAuth flow for a specific tenant.
 * Pass the tenant's API key as ?apiKey=<key> — the tenantId is encoded
 * in the OAuth state so the callback can complete the right tenant's setup.
 */
router.get('/auth/hubspot', async (req: Request, res: Response) => {
  const { apiKey } = req.query as { apiKey?: string };
  if (!apiKey) {
    res.status(400).send('Missing ?apiKey= query parameter. Provide your tenant API key.');
    return;
  }
  const tenant = await prisma.tenant.findUnique({ where: { apiKey } });
  if (!tenant) {
    res.status(401).send('Invalid API key.');
    return;
  }
  res.redirect(getAuthorizationUrl(tenant.id));
});

/** HubSpot OAuth callback — exchange code for tokens using state (tenantId) */
router.get('/auth/hubspot/callback', async (req: Request, res: Response) => {
  const { code, state: tenantId, error } = req.query;

  if (error || !code) {
    res.status(400).send(`OAuth error: ${error ?? 'no code returned'}`);
    return;
  }

  if (!tenantId || typeof tenantId !== 'string') {
    res.status(400).send('OAuth callback missing state (tenantId).');
    return;
  }

  try {
    await exchangeCode(code as string, tenantId);
    res.send('HubSpot connected successfully. You can close this window.');
  } catch (err) {
    console.error('[auth] Token exchange failed:', err);
    res.status(500).send('Failed to exchange authorisation code. Check server logs.');
  }
});

// ── Unsubscribe (public) ──────────────────────────────────────────────────────

/** One-click unsubscribe link included in every digest email footer */
router.get('/unsubscribe', unsubscribeLimiter, async (req: Request, res: Response) => {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(400).send('Invalid unsubscribe link.');
    return;
  }
  try {
    const updated = await prisma.owner.updateMany({
      where: { hsOwnerId: token, unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    });
    if (updated.count === 0) {
      res.send('You are already unsubscribed from Holiday Digest emails.');
    } else {
      res.send('You have been unsubscribed from Holiday Digest emails. You will no longer receive weekly digests.');
    }
  } catch (err) {
    console.error('[api] Unsubscribe failed:', err);
    res.status(500).send('Something went wrong. Please try again later.');
  }
});

// ── Health (public) ───────────────────────────────────────────────────────────

router.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ── All routes below require a valid tenant API key ───────────────────────────

router.use('/api', requireApiKey);

// ── Manual triggers ───────────────────────────────────────────────────────────

/** Manually trigger a contact sync for the authenticated tenant.
 *  Body: { "activeOnly": false } to skip the 12-month activity filter. */
router.post('/api/sync/contacts', syncLimiter, async (req: Request, res: Response) => {
  try {
    const { activeOnly } = req.body as { activeOnly?: boolean };
    const result = await syncContacts(req.tenant.id, { activeOnly: activeOnly ?? true });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[api] Contact sync failed:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/** Manually trigger an owner sync for the authenticated tenant */
router.post('/api/sync/owners', syncLimiter, async (req: Request, res: Response) => {
  try {
    const result = await syncOwners(req.tenant.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[api] Owner sync failed:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── Digest ────────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Send a test digest to a specific email address.
 * Uses the first rep's data for the authenticated tenant.
 * Body: { "email": "you@example.com" }
 */
router.post('/api/digest/test', testDigestLimiter, async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ ok: false, error: 'Body must include a valid { "email": "..." }' });
    return;
  }
  try {
    await sendTestDigest(req.tenant.id, email);
    res.json({ ok: true, sentTo: email });
  } catch (err) {
    console.error('[api] Test digest failed:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * Force-send the weekly digest for the authenticated tenant immediately,
 * bypassing the timezone check.
 * Requires { "confirm": true } in body to prevent accidental sends.
 */
router.post('/api/digest/send', async (req: Request, res: Response) => {
  if (!(req.body as { confirm?: boolean }).confirm) {
    res.status(400).json({ ok: false, error: 'Body must include { "confirm": true }' });
    return;
  }
  try {
    const result = await sendWeeklyDigests(req.tenant.id, { ignoreTimezone: true });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[api] Digest send failed:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── Data quality ──────────────────────────────────────────────────────────────

/**
 * Returns contacts with unresolved locations for the authenticated tenant.
 */
router.get('/api/data-quality', async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenant.id;
    const [unknownCount, total, samples] = await Promise.all([
      prisma.contact.count({ where: { tenantId, locationStatus: 'unknown' } }),
      prisma.contact.count({ where: { tenantId } }),
      prisma.contact.findMany({
        where: { tenantId, locationStatus: 'unknown' },
        select: { hsObjectId: true, firstName: true, lastName: true, email: true, company: true },
        take: 50,
        orderBy: { syncedAt: 'desc' },
      }),
    ]);

    res.json({
      total,
      unknownCount,
      unknownPct: total > 0 ? ((unknownCount / total) * 100).toFixed(1) : '0.0',
      samples,
    });
  } catch (err) {
    console.error('[api] Data quality query failed:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
