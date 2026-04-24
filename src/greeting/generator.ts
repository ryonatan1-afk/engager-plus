import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../db/client';
import { buildPrompt, SYSTEM_PROMPT, type GreetingContext } from './prompt';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 400;
const MAX_RETRIES = 3;

// Initialised at module scope — dotenv/config is loaded before this module
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
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastErr;
}

/**
 * Generates AI greetings for all ungreeted holiday matches for the given tenant,
 * where the holiday date is today or in the future.
 *
 * Designed to be idempotent — safe to re-run; already-generated greetings
 * are skipped via the `greeting: null` filter.
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
    include: {
      contact: true,
      holiday: true,
    },
  });

  if (!matches.length) {
    console.log('[greeting] No pending matches — nothing to generate.');
    return { generated: 0, skipped: 0, errors: 0 };
  }

  // Batch-load owners so we don't query per-match
  const ownerIds = [
    ...new Set(
      matches.map((m) => m.contact.ownerId).filter((id): id is string => id !== null),
    ),
  ];
  const owners = await prisma.owner.findMany({
    where: { tenantId, externalId: { in: ownerIds } },
    select: { externalId: true, firstName: true },
  });
  const ownerMap = new Map(owners.map((o) => [o.externalId, o.firstName ?? null]));

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const match of matches) {
    const { contact, holiday } = match;

    if (!contact.firstName) {
      // Can't personalise without a first name — skip silently
      skipped++;
      continue;
    }

    const repFirstName =
      contact.ownerId ? (ownerMap.get(contact.ownerId) ?? 'there') : 'there';

    const ctx: GreetingContext = {
      contactFirstName: contact.firstName,
      contactLastName: contact.lastName ?? null,
      company: contact.company ?? null,
      countryIso: contact.countryIso ?? '',
      holidayName: holiday.name,
      holidayDate: holiday.date,
      holidayType: holiday.type,
      repFirstName,
    };

    try {
      const raw = await generateWithRetry(buildPrompt(ctx));
      let body = raw;
      let subject: string | null = null;

      try {
        const parsed = JSON.parse(raw) as { subject?: string; body?: string };
        body = parsed.body?.trim() ?? raw;
        subject = parsed.subject?.trim() ?? null;
      } catch {
        // Fallback: treat raw text as body, no subject
      }

      await prisma.greeting.create({
        data: { matchId: match.id, body, subject, model: MODEL },
      });

      generated++;
      console.log(`[greeting] Generated for match ${match.id} (${contact.firstName}, ${holiday.name})`);
    } catch (err) {
      console.error(`[greeting] Failed after ${MAX_RETRIES} attempts for match ${match.id}:`, err);
      errors++;
    }
  }

  console.log(`[greeting] Done. generated=${generated} skipped=${skipped} errors=${errors}`);
  return { generated, skipped, errors };
}
