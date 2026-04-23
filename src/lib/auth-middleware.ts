import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client';

export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  const key = header.slice(7);
  const tenant = await prisma.tenant.findUnique({ where: { apiKey: key } });

  if (!tenant) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  req.tenant = tenant;
  next();
}

export function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.error('[auth] ADMIN_SECRET env var not set');
    res.status(500).json({ ok: false, error: 'Server misconfiguration' });
    return;
  }

  const header = req.headers['authorization'];
  if (!header || header !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  next();
}
