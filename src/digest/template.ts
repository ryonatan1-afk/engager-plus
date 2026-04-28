import { DigestCard, ContactRow } from './builder';

function countryFlag(iso: string): string {
  return [...iso.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}

function countryName(iso: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(iso) ?? iso;
  } catch {
    return iso;
  }
}

function holidayContext(type: string, solemn: boolean): string {
  if (solemn) return 'Solemn occasion — consider a respectful tone';
  if (type === 'national') return 'National public holiday';
  if (type === 'religious') return 'Religious observance';
  if (type === 'cultural') return 'Cultural observance';
  return 'Public holiday';
}

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

function mailtoHref(contact: ContactRow, card: DigestCard): string | null {
  if (!contact.email || !card.greeting) return null;
  const body = card.greeting.replace(/\[Name\]/g, contact.contactFirstName);
  const subject = (card.subject ?? '').replace(/\[Name\]/g, contact.contactFirstName);
  return `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Hi ${contact.contactFirstName},\r\n\r\n${body}`)}`;
}

function renderContactRow(contact: ContactRow, card: DigestCard): string {
  const name = [contact.contactFirstName, contact.contactLastName].filter(Boolean).join(' ');
  const company = contact.company ? ` <span style="color:#9ca3af;">&middot; ${contact.company}</span>` : '';
  const href = mailtoHref(contact, card);
  const button = href
    ? `<a href="${href}" style="background:#6366f1;color:#fff;padding:5px 12px;border-radius:5px;font-size:12px;font-weight:600;text-decoration:none;white-space:nowrap;">&#9993; Open draft</a>`
    : '';
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #f3f4f6;"><tr>
    <td style="padding:7px 0;font-size:13px;color:#111827;font-weight:500;">${name}${company}</td>
    <td style="padding:7px 0;text-align:right;white-space:nowrap;">${button}</td>
  </tr></table>`;
}

function renderCard(card: DigestCard): string {
  const urgencyBadge = card.alert1d
    ? '<span style="background:#ef4444;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.5px;margin-right:8px;">TODAY</span>'
    : '';
  const locationLine = card.countryIso
    ? ` &middot; ${countryFlag(card.countryIso)} ${countryName(card.countryIso)} &middot; ${holidayContext(card.holidayType, card.solemn)}`
    : '';

  const isSolo = card.contacts.length === 1;
  const contact = card.contacts[0];

  if (isSolo) {
    // Single contact — classic layout with greeting preview
    const name = [contact.contactFirstName, contact.contactLastName].filter(Boolean).join(' ');
    const company = contact.company ? ` &middot; ${contact.company}` : '';
    const lastActivity = contact.lastActivityAt
      ? `<p style="margin:6px 0 0;color:#9ca3af;font-size:12px;">Last activity: ${formatShortDate(contact.lastActivityAt)}</p>`
      : '';
    const greetingBody = card.greeting
      ? card.greeting.replace(/\[Name\]/g, contact.contactFirstName)
      : null;
    const greetingBlock = greetingBody
      ? `<blockquote style="margin:10px 0 0;padding:10px 14px;border-left:3px solid #6366f1;background:#f5f3ff;color:#374151;font-style:italic;font-size:14px;border-radius:0 4px 4px 0;">${greetingBody}</blockquote>`
      : '';
    const href = mailtoHref(contact, card);
    const draftButton = href
      ? `<div style="margin:10px 0 0;text-align:right;"><a href="${href}" style="background:#6366f1;color:#fff;padding:7px 16px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;display:inline-block;">&#9993; Open draft in email app</a></div>`
      : '';

    return `
  <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 18px;margin-bottom:10px;background:#fff;">
    <div style="margin-bottom:6px;">
      ${urgencyBadge}<strong style="font-size:15px;color:#111827;">${name}${company}</strong>
    </div>
    <p style="margin:0;color:#6366f1;font-weight:600;font-size:14px;">${card.holidayName}</p>
    <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">${formatDate(card.holidayDate)}${locationLine}</p>
    ${lastActivity}
    ${greetingBlock}
    ${draftButton}
  </div>`;
  }

  // Grouped card — holiday header + shared greeting + contact rows
  const greetingBlock = card.greeting
    ? `<blockquote style="margin:10px 0 12px;padding:10px 14px;border-left:3px solid #6366f1;background:#f5f3ff;color:#374151;font-style:italic;font-size:14px;border-radius:0 4px 4px 0;">${card.greeting}</blockquote>`
    : '';
  const rows = card.contacts.map((c) => renderContactRow(c, card)).join('');

  return `
  <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 18px;margin-bottom:10px;background:#fff;">
    <div style="margin-bottom:4px;">${urgencyBadge}<strong style="font-size:15px;color:#111827;">${card.holidayName}</strong></div>
    <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">${formatDate(card.holidayDate)}${locationLine}</p>
    ${greetingBlock}
    <div style="margin-top:4px;">${rows}</div>
    <p style="margin:10px 0 0;color:#9ca3af;font-size:12px;">${card.contacts.length} contact${card.contacts.length === 1 ? '' : 's'}</p>
  </div>`;
}

export function buildDigestHtml(params: {
  ownerFirstName: string | null;
  ownerExternalId: string;
  weekOf: Date;
  todayCards: DigestCard[];
  weekCards: DigestCard[];
  laterCards: DigestCard[];
  totalMatches: number;
  baseUrl: string;
  crmContactsUrl?: string;
}): string {
  const { ownerFirstName, ownerExternalId, weekOf, todayCards, weekCards, laterCards, totalMatches, baseUrl, crmContactsUrl } = params;

  const salutation = ownerFirstName ? `Hi ${ownerFirstName},` : 'Hi,';
  const weekLabel = weekOf.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });

  const shownContacts = [...todayCards, ...weekCards, ...laterCards]
    .flatMap((c) => c.contacts).length;
  const overflow = totalMatches - shownContacts;

  const todaySection = todayCards.length > 0
    ? `<h2 style="font-size:15px;font-weight:700;color:#ef4444;margin:24px 0 10px;text-transform:uppercase;letter-spacing:.5px;">&#9888; Today / Tomorrow</h2>${todayCards.map(renderCard).join('')}`
    : '';

  const weekSection = weekCards.length > 0
    ? `<h2 style="font-size:15px;font-weight:700;color:#374151;margin:24px 0 10px;text-transform:uppercase;letter-spacing:.5px;">This Week</h2>${weekCards.map(renderCard).join('')}`
    : '';

  const laterSection = laterCards.length > 0
    ? `<h2 style="font-size:15px;font-weight:700;color:#9ca3af;margin:24px 0 10px;text-transform:uppercase;letter-spacing:.5px;">Later This Week</h2>${laterCards.map(renderCard).join('')}`
    : '';

  const overflowFooter = overflow > 0
    ? crmContactsUrl
      ? `<p style="text-align:center;margin:20px 0 0;"><a href="${crmContactsUrl}" style="color:#6366f1;font-size:14px;">+${overflow} more contact${overflow === 1 ? '' : 's'} &mdash; view all &rarr;</a></p>`
      : `<p style="text-align:center;margin:20px 0 0;color:#6b7280;font-size:14px;">+${overflow} more contact${overflow === 1 ? '' : 's'} not shown</p>`
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
    <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:24px 28px;border-radius:10px 10px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">&#127881; Holiday Digest</h1>
      <p style="color:#c7d2fe;margin:4px 0 0;font-size:14px;">Week of ${weekLabel}</p>
    </div>
    <div style="background:#f9fafb;padding:20px 24px;">
      <p style="color:#374151;margin:0 0 4px;font-size:15px;">${salutation}</p>
      <p style="color:#6b7280;margin:0;font-size:14px;">Here are your contacts with upcoming holidays this week. Greetings are ready to copy and send.</p>
      ${todaySection}
      ${weekSection}
      ${laterSection}
      ${overflowFooter}
    </div>
    <div style="background:#e5e7eb;padding:14px 24px;border-radius:0 0 10px 10px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">You're receiving this because you use Rapport.</p>
      <p style="color:#9ca3af;font-size:12px;margin:6px 0 0;"><a href="${baseUrl}/unsubscribe?token=${ownerExternalId}" style="color:#9ca3af;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;
}

export function buildDigestText(params: {
  ownerFirstName: string | null;
  weekOf: Date;
  todayCards: DigestCard[];
  weekCards: DigestCard[];
  laterCards: DigestCard[];
  totalMatches: number;
}): string {
  const { ownerFirstName, weekOf, todayCards, weekCards, laterCards, totalMatches } = params;
  const allCards = [...todayCards, ...weekCards, ...laterCards];
  const shownContacts = allCards.flatMap((c) => c.contacts).length;
  const overflow = totalMatches - shownContacts;
  const lines: string[] = [];

  lines.push(`Holiday Digest — Week of ${weekOf.toISOString().slice(0, 10)}`);
  lines.push(`For: ${ownerFirstName ?? '(unknown)'}`);
  lines.push('');

  const renderSection = (label: string, cards: DigestCard[]) => {
    if (!cards.length) return;
    lines.push(label);
    lines.push('-'.repeat(40));
    for (const c of cards) {
      lines.push(`${c.holidayName} (${c.holidayDate.toISOString().slice(0, 10)}) — ${c.contacts.length} contact${c.contacts.length === 1 ? '' : 's'}`);
      if (c.greeting) lines.push(`  "${c.greeting.slice(0, 80)}${c.greeting.length > 80 ? '…' : ''}"`);
      for (const r of c.contacts) {
        const name = [r.contactFirstName, r.contactLastName].filter(Boolean).join(' ');
        lines.push(`  • ${name}${r.company ? ` @ ${r.company}` : ''}`);
      }
    }
    lines.push('');
  };

  renderSection('TODAY / TOMORROW', todayCards);
  renderSection('THIS WEEK', weekCards);
  renderSection('LATER THIS WEEK', laterCards);

  if (overflow > 0) lines.push(`+${overflow} more contacts not shown`);
  return lines.join('\n');
}
