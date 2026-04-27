import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../db/client';
import { buildPrompt, SYSTEM_PROMPT, type GreetingContext } from './prompt';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 400;
const MAX_RETRIES = 3;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface GenerationResult {
  generated: number;
  skipped: number;
  errors: number;
}

async function callClaude(prompt: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = msg.content[0];
  if (block.type !== 'text') throw new Error('Unexpected non-text response from Claude');
  return block.text.trim();
}

async function generateWithRetry(prompt: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callClaude(prompt);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastErr;
}

/**
 * Generates AI greetings for all ungreeted holiday matches for the given tenant.
 *
 * Groups by (ownerId, holidayId) and generates ONE greeting per group using
 * [Name] as a placeholder — the template substitutes the real name per contact.
 * This reduces API calls from N contacts to N unique (owner, holiday) pairs.
 *
 * Idempotent — already-generated greetings are skipped.
 */
export async function generatePendingGreetings(tenantId: string): Promise<GenerationResult> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const matches = await prisma.holidayMatch.findMany({
    where: {
      greeting: null,
      holiday: { date: { gte: today }, greetable: true },
      contact: { tenantId },
    },
    include: { contact: true, holiday: true },
  });

  if (!matches.length) {
    console.log('[greeting] No pending matches — nothing to generate.');
    return { generated: 0, skipped: 0, errors: 0 };
  }

  // Batch-load owners
  const ownerIds = [...new Set(
    matches.map((m) => m.contact.ownerId).filter((id): id is string => id !== null),
  )];
  const owners = await prisma.owner.findMany({
    where: { tenantId, externalId: { in: ownerIds } },
    select: { externalId: true, firstName: true },
  });
  const ownerMap = new Map(owners.map((o) => [o.externalId, o.firstName ?? null]));

  // Group by (ownerId, holidayId) — one API call per unique pair
  const groups = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = `${m.contact.ownerId ?? ''}:${m.holidayId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const [, group] of groups) {
    const { contact, holiday } = group[0];
    const repFirstName = contact.ownerId ? (ownerMap.get(contact.ownerId) ?? 'there') : 'there';

    const ctx: GreetingContext = {
      contactFirstName: '[Name]',
      contactLastName: null,
      company: null,
      countryIso: holiday.countryIso,
      holidayName: holiday.name,
      holidayDate: holiday.date,
      holidayType: holiday.type,
      solemn: holiday.solemn,
      repFirstName,
    };

    let body: string;
    let subject: string | null = null;

    try {
      const raw = await generateWithRetry(buildPrompt(ctx));
      body = raw;
      try {
        const parsed = JSON.parse(raw) as { subject?: string; body?: string };
        body = parsed.body?.trim() ?? raw;
        subject = parsed.subject?.trim() ?? null;
      } catch { /* treat raw as body */ }

      console.log(`[greeting] Generated for ${holiday.name} (${group.length} contacts)`);
    } catch (err) {
      console.error(`[greeting] Failed for ${holiday.name}:`, err);
      errors++;
      skipped += group.length;
      continue;
    }

    // Save to every match in the group
    for (const match of group) {
      if (!match.contact.firstName) { skipped++; continue; }
      try {
        await prisma.greeting.create({ data: { matchId: match.id, body, subject, model: MODEL } });
        generated++;
      } catch (err) {
        console.error(`[greeting] Failed to save match ${match.id}:`, err);
        errors++;
      }
    }
  }

  console.log(`[greeting] Done. generated=${generated} skipped=${skipped} errors=${errors}`);
  return { generated, skipped, errors };
}
