import { ContactCard } from './builder';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function renderCard(card: ContactCard): string {
  const name = [card.contactFirstName, card.contactLastName].filter(Boolean).join(' ');
  const company = card.company ? ` &middot; ${card.company}` : '';
  const urgencyBadge = card.alert1d
    ? '<span style="background:#ef4444;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.5px;margin-right:8px;">TODAY</span>'
    : '';
  const lastActivity = card.lastActivityAt
    ? `<p style="margin:6px 0 0;color:#9ca3af;font-size:12px;">Last activity: ${formatShortDate(card.lastActivityAt)}</p>`
    : '';
  const greetingBlock = card.greeting
    ? `<blockquote style="margin:10px 0 0;padding:10px 14px;border-left:3px solid #6366f1;background:#f5f3ff;color:#374151;font-style:italic;font-size:14px;border-radius:0 4px 4px 0;">${card.greeting}</blockquote>`
    : '';

  const mailtoBody = card.greeting
    ? `Hi ${card.contactFirstName},\r\n\r\n${card.greeting}`
    : null;
  const mailtoHref = card.email && mailtoBody
    ? `mailto:${card.email}?subject=${encodeURIComponent(card.subject ?? '')}&body=${encodeURIComponent(mailtoBody)}`
    : null;
  const draftButton = mailtoHref
    ? `<div style="margin:10px 0 0;text-align:right;"><a href="${mailtoHref}" style="background:#6366f1;color:#ffffff;padding:7px 16px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;display:inline-block;">&#9993; Open draft in email app</a></div>`
    : '';

  return `
  <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 18px;margin-bottom:10px;background:#ffffff;">
    <div style="margin-bottom:6px;">
      ${urgencyBadge}<strong style="font-size:15px;color:#111827;">${name}${company}</strong>
    </div>
    <p style="margin:0;color:#6366f1;font-weight:600;font-size:14px;">${card.holidayName}</p>
    <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">${formatDate(card.holidayDate)}</p>
    ${lastActivity}
    ${greetingBlock}
    ${draftButton}
  </div>`;
}

export function buildDigestHtml(params: {
  ownerFirstName: string | null;
  ownerHsId: string;
  weekOf: Date;
  todayCards: ContactCard[];
  weekCards: ContactCard[];
  laterCards: ContactCard[];
  totalMatches: number;
  baseUrl: string;
}): string {
  const { ownerFirstName, ownerHsId, weekOf, todayCards, weekCards, laterCards, totalMatches, baseUrl } = params;

  const salutation = ownerFirstName ? `Hi ${ownerFirstName},` : 'Hi,';
  const weekLabel = weekOf.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const shown = todayCards.length + weekCards.length + laterCards.length;
  const overflow = totalMatches - shown;

  const todaySection =
    todayCards.length > 0
      ? `<h2 style="font-size:15px;font-weight:700;color:#ef4444;margin:24px 0 10px;text-transform:uppercase;letter-spacing:.5px;">&#9888; Today / Tomorrow</h2>
         ${todayCards.map(renderCard).join('')}`
      : '';

  const weekSection =
    weekCards.length > 0
      ? `<h2 style="font-size:15px;font-weight:700;color:#374151;margin:24px 0 10px;text-transform:uppercase;letter-spacing:.5px;">This Week</h2>
         ${weekCards.map(renderCard).join('')}`
      : '';

  const laterSection =
    laterCards.length > 0
      ? `<h2 style="font-size:15px;font-weight:700;color:#9ca3af;margin:24px 0 10px;text-transform:uppercase;letter-spacing:.5px;">Later This Week</h2>
         ${laterCards.map(renderCard).join('')}`
      : '';

  const overflowFooter =
    overflow > 0
      ? `<p style="text-align:center;margin:20px 0 0;"><a href="https://app.hubspot.com/contacts/" style="color:#6366f1;font-size:14px;">+${overflow} more contact${overflow === 1 ? '' : 's'} &mdash; view in HubSpot &rarr;</a></p>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Holiday Digest &mdash; Week of ${weekLabel}</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f3f4f6;margin:0;padding:24px 16px;">
  <div style="max-width:600px;margin:0 auto;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:24px 28px;border-radius:10px 10px 0 0;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">&#127881; Holiday Digest</h1>
      <p style="color:#c7d2fe;margin:4px 0 0;font-size:14px;">Week of ${weekLabel}</p>
    </div>

    <!-- Body -->
    <div style="background:#f9fafb;padding:20px 24px;">
      <p style="color:#374151;margin:0 0 4px;font-size:15px;">${salutation}</p>
      <p style="color:#6b7280;margin:0;font-size:14px;">Here are your contacts with upcoming holidays this week. Greetings are ready to copy and send.</p>

      ${todaySection}
      ${weekSection}
      ${laterSection}
      ${overflowFooter}
    </div>

    <!-- Footer -->
    <div style="background:#e5e7eb;padding:14px 24px;border-radius:0 0 10px 10px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">You're receiving this digest because you use Holiday Digest for HubSpot.</p>
      <p style="color:#9ca3af;font-size:12px;margin:6px 0 0;"><a href="${baseUrl}/unsubscribe?token=${ownerHsId}" style="color:#9ca3af;">Unsubscribe</a></p>
    </div>

  </div>
</body>
</html>`;
}

/** Plain-text fallback for terminals / digest:preview */
export function buildDigestText(params: {
  ownerFirstName: string | null;
  weekOf: Date;
  todayCards: ContactCard[];
  weekCards: ContactCard[];
  laterCards: ContactCard[];
  totalMatches: number;
}): string {
  const { ownerFirstName, weekOf, todayCards, weekCards, laterCards, totalMatches } = params;
  const shown = todayCards.length + weekCards.length + laterCards.length;
  const overflow = totalMatches - shown;
  const lines: string[] = [];

  lines.push(`Holiday Digest — Week of ${weekOf.toISOString().slice(0, 10)}`);
  lines.push(`For: ${ownerFirstName ?? '(unknown)'}`);
  lines.push('');

  if (todayCards.length) {
    lines.push('TODAY / TOMORROW');
    lines.push('-'.repeat(40));
    for (const c of todayCards) {
      const name = [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ');
      lines.push(`[!] ${name} @ ${c.company ?? '?'} — ${c.holidayName} (${c.holidayDate.toISOString().slice(0, 10)})`);
      if (c.greeting) lines.push(`    "${c.greeting.slice(0, 100)}${c.greeting.length > 100 ? '…' : ''}"`);
    }
    lines.push('');
  }

  if (weekCards.length) {
    lines.push('THIS WEEK');
    lines.push('-'.repeat(40));
    for (const c of weekCards) {
      const name = [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ');
      lines.push(`[ ] ${name} @ ${c.company ?? '?'} — ${c.holidayName} (${c.holidayDate.toISOString().slice(0, 10)})`);
      if (c.greeting) lines.push(`    "${c.greeting.slice(0, 100)}${c.greeting.length > 100 ? '…' : ''}"`);
    }
    lines.push('');
  }

  if (laterCards.length) {
    lines.push('LATER THIS WEEK');
    lines.push('-'.repeat(40));
    for (const c of laterCards) {
      const name = [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ');
      lines.push(`[ ] ${name} @ ${c.company ?? '?'} — ${c.holidayName} (${c.holidayDate.toISOString().slice(0, 10)})`);
      if (c.greeting) lines.push(`    "${c.greeting.slice(0, 100)}${c.greeting.length > 100 ? '…' : ''}"`);
    }
    lines.push('');
  }

  if (overflow > 0) lines.push(`+${overflow} more — view in HubSpot: https://app.hubspot.com/contacts/`);

  return lines.join('\n');
}
