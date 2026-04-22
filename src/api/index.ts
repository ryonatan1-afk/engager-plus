import { Router, Request, Response } from 'express';
import { getAuthorizationUrl, exchangeCode } from '../hubspot/auth';
import { syncContacts } from '../hubspot/sync-contacts';
import { syncOwners } from '../hubspot/sync-owners';
import { sendTestDigest, sendWeeklyDigests } from '../digest';
import { prisma } from '../db/client';

const router = Router();

// ── OAuth ─────────────────────────────────────────────────────────────────────

/** Kick off the HubSpot OAuth flow */
router.get('/auth/hubspot', (_req: Request, res: Response) => {
  res.redirect(getAuthorizationUrl());
});

/** HubSpot OAuth callback — exchange code for tokens */
router.get('/auth/hubspot/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error || !code) {
    res.status(400).send(`OAuth error: ${error ?? 'no code returned'}`);
    return;
  }

  try {
    await exchangeCode(code as string);
    res.send('HubSpot connected successfully. You can close this window.');
  } catch (err) {
    console.error('[auth] Token exchange failed:', err);
    res.status(500).send('Failed to exchange authorisation code. Check server logs.');
  }
});

// ── Manual triggers ───────────────────────────────────────────────────────────

/** Manually trigger a contact sync (useful for testing) */
router.post('/api/sync/contacts', async (_req: Request, res: Response) => {
  try {
    const result = await syncContacts();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[api] Contact sync failed:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/** Manually trigger an owner sync */
router.post('/api/sync/owners', async (_req: Request, res: Response) => {
  try {
    const result = await syncOwners();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[api] Owner sync failed:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── Digest ────────────────────────────────────────────────────────────────────

/**
 * Send a test digest to a specific email address.
 * Uses the first rep's data so you can preview the real email format.
 * Body: { "email": "you@example.com" }
 */
router.post('/api/digest/test', async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ ok: false, error: 'Body must include { "email": "..." }' });
    return;
  }
  try {
    await sendTestDigest(email);
    res.json({ ok: true, sentTo: email });
  } catch (err) {
    console.error('[api] Test digest failed:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * Force-send the weekly digest to all reps immediately, bypassing timezone check.
 * Useful for smoke-testing production send logic.
 */
router.post('/api/digest/send', async (_req: Request, res: Response) => {
  try {
    const result = await sendWeeklyDigests({ ignoreTimezone: true });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[api] Digest send failed:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── Data quality ──────────────────────────────────────────────────────────────

/**
 * Returns contacts with unresolved locations.
 * Useful for identifying CRM data quality issues.
 */
router.get('/api/data-quality', async (_req: Request, res: Response) => {
  try {
    const [unknownCount, total, samples] = await Promise.all([
      prisma.contact.count({ where: { locationStatus: 'unknown' } }),
      prisma.contact.count(),
      prisma.contact.findMany({
        where: { locationStatus: 'unknown' },
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

// ── Unsubscribe ───────────────────────────────────────────────────────────────

/** One-click unsubscribe link included in every digest email footer */
router.get('/unsubscribe', async (req: Request, res: Response) => {
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

// ── Health ────────────────────────────────────────────────────────────────────

router.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

export default router;
