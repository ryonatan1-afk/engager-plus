import { HolidayType } from '@prisma/client';

export interface GreetingContext {
  contactFirstName: string;
  contactLastName: string | null;
  company: string | null;
  countryIso: string;
  holidayName: string;
  holidayDate: Date;
  holidayType: HolidayType;
  repFirstName: string;
}

export const SYSTEM_PROMPT = `You are a professional sales representative writing a brief, warm holiday greeting to a business contact. Write in a professional but personable tone.

Rules:
- For national holidays, you can use direct language ("celebrating", "enjoying", etc.)
- For religious or cultural holidays, use soft language ("may be celebrating", "might be observing") — country of residence does not imply religion or cultural practice
- The body must be 2-3 sentences. No salutation (no "Dear" or "Hi [name]"). No sign-off or sender name — the rep will add those.
- The subject must be a short, natural email subject line (max 10 words) suited to the occasion.

Output a JSON object with exactly two fields — "subject" and "body". Output only raw JSON, no markdown, no code fences, no commentary.`;

/**
 * Builds the user-turn prompt for Claude given a greeting context.
 * Separating prompt construction from API calls makes this unit-testable.
 */
export function buildPrompt(ctx: GreetingContext): string {
  const dateStr = ctx.holidayDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const languageGuidance =
    ctx.holidayType === HolidayType.national
      ? 'This is a national holiday — direct language is appropriate (e.g. "celebrating", "enjoying the day").'
      : 'This is a religious or cultural holiday — use soft language (e.g. "may be celebrating", "might be observing") since country does not imply religion.';

  const contactLine = [ctx.contactFirstName, ctx.contactLastName].filter(Boolean).join(' ');
  const companyLine = ctx.company ?? 'their company';

  return `Write a holiday greeting for my business contact.

Contact: ${contactLine} at ${companyLine}, based in ${ctx.countryIso}
Holiday: ${ctx.holidayName} on ${dateStr}
My name (the sender): ${ctx.repFirstName}

${languageGuidance}

Return a JSON object with "subject" (short email subject line) and "body" (2-3 sentence greeting, no salutation, no sign-off).`;
}
