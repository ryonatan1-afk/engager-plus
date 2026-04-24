import { Resend } from 'resend';

const FROM_EMAIL = process.env.DIGEST_FROM_EMAIL ?? 'onboarding@resend.dev';
const FROM_NAME = 'Holiday Digest';

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY must be set');
  return new Resend(apiKey);
}

export async function sendWelcomeEmail(toEmail: string): Promise<void> {
  const resend = getClient();
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#F8FAFC;margin:0;padding:40px 16px;color:#0F172A;">
  <div style="max-width:460px;margin:0 auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:40px;">
    <div style="font-size:17px;font-weight:800;letter-spacing:-0.3px;margin-bottom:28px;">
      <span style="display:inline-block;width:8px;height:8px;background:#0369A1;border-radius:50%;margin-right:8px;vertical-align:middle;"></span>Rapport
    </div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;letter-spacing:-0.3px;">You&rsquo;re connected</h1>
    <p style="color:#64748B;font-size:14px;line-height:1.6;margin:0 0 24px;">Your HubSpot account is connected and your contacts are syncing in the background.</p>
    <div style="background:#EFF6FF;border-radius:10px;padding:18px 20px;margin-bottom:24px;">
      <p style="color:#1D4ED8;font-size:13px;font-weight:700;margin:0 0 10px;">What happens next</p>
      <p style="color:#1E40AF;font-size:13px;line-height:1.6;margin:0 0 8px;">Every <strong>Monday at 7am</strong> local time you&rsquo;ll receive a holiday digest &mdash; a curated list of your contacts with upcoming holidays.</p>
      <p style="color:#1E40AF;font-size:13px;line-height:1.6;margin:0;">Each contact card includes an AI-written greeting draft. One click opens it as a ready-to-send email in your inbox.</p>
    </div>
    <p style="color:#94A3B8;font-size:12px;line-height:1.5;margin:0;">You&rsquo;ll receive your first digest on the next Monday. Nothing else to set up.</p>
  </div>
</body>
</html>`;
  const { error } = await resend.emails.send({
    from: `Rapport <${FROM_EMAIL}>`,
    to: toEmail,
    subject: 'You\'re connected — first digest arrives Monday',
    html,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function sendDigestEmail(params: {
  toEmail: string;
  toName: string;
  subject: string;
  html: string;
}): Promise<void> {
  const resend = getClient();
  const { error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: params.toEmail,
    subject: params.subject,
    html: params.html,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
