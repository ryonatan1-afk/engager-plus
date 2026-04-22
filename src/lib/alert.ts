import Mailjet from 'node-mailjet';

const FROM_EMAIL = process.env.DIGEST_FROM_EMAIL ?? 'digest@holidaydigest.app';
const ALERT_EMAIL = process.env.ALERT_EMAIL;

/**
 * Sends a plain-text alert email to ALERT_EMAIL when a cron job fails.
 * Always bypasses sandbox mode — the point of an alert is to actually arrive.
 * Silently logs and returns if ALERT_EMAIL is not configured.
 */
export async function sendAlert(subject: string, detail: unknown): Promise<void> {
  if (!ALERT_EMAIL) {
    console.warn('[alert] ALERT_EMAIL not set — skipping alert:', subject);
    return;
  }

  const apiKey = process.env.MAILJET_API_KEY;
  const apiSecret = process.env.MAILJET_SECRET_KEY;
  if (!apiKey || !apiSecret) {
    console.warn('[alert] Mailjet credentials not set — skipping alert:', subject);
    return;
  }

  const body = detail instanceof Error
    ? `${detail.message}\n\n${detail.stack ?? ''}`
    : String(detail);

  const timestamp = new Date().toISOString();
  const textPart = `Holiday Digest — automated alert\n\n${subject}\n${'-'.repeat(60)}\n${body}\n\nTimestamp: ${timestamp}`;

  try {
    const client = Mailjet.apiConnect(apiKey, apiSecret);
    await client.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: { Email: FROM_EMAIL, Name: 'Holiday Digest Alerts' },
          To: [{ Email: ALERT_EMAIL }],
          Subject: `[Alert] ${subject}`,
          TextPart: textPart,
        },
      ],
    });
    console.log(`[alert] Sent alert to ${ALERT_EMAIL}: ${subject}`);
  } catch (err) {
    // Don't let alert failures crash the process
    console.error('[alert] Failed to send alert email:', err);
  }
}
