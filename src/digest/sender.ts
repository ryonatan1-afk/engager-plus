import { Resend } from 'resend';

const FROM_EMAIL = process.env.DIGEST_FROM_EMAIL ?? 'onboarding@resend.dev';
const FROM_NAME = 'Holiday Digest';

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY must be set');
  return new Resend(apiKey);
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
