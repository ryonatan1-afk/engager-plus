import { prisma } from '../db/client';

const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

const OAUTH_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.companies.read',
  'crm.objects.owners.read',
  'sales-email-read',
  'oauth',
].join(' ');

/** Returns the URL to redirect the user to for HubSpot OAuth consent. */
export function getAuthorizationUrl(tenantId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.HUBSPOT_CLIENT_ID!,
    redirect_uri: process.env.HUBSPOT_REDIRECT_URI!,
    scope: OAUTH_SCOPES,
    state: tenantId,
  });
  return `${HUBSPOT_AUTH_URL}?${params}`;
}

/** Exchange an authorisation code for access + refresh tokens and persist them. */
export async function exchangeCode(code: string, tenantId: string): Promise<void> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.HUBSPOT_CLIENT_ID!,
    client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
    redirect_uri: process.env.HUBSPOT_REDIRECT_URI!,
    code,
  });

  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  await persistTokens(tenantId, data.access_token, data.refresh_token, data.expires_in);
}

/**
 * Returns a valid access token for the given tenant, refreshing automatically
 * if within 60 seconds of expiry. Throws if no token exists.
 */
export async function getValidAccessToken(tenantId: string): Promise<string> {
  const token = await prisma.oAuthToken.findUnique({ where: { tenantId } });
  if (!token) {
    throw new Error('No HubSpot OAuth token found. Visit /auth/hubspot to authorise the app.');
  }

  const expiresInMs = token.expiresAt.getTime() - Date.now();
  if (expiresInMs > 60_000) {
    return token.accessToken;
  }

  return doRefresh(tenantId, token.refreshToken);
}

async function doRefresh(tenantId: string, refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.HUBSPOT_CLIENT_ID!,
    client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
    refresh_token: refreshToken,
  });

  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token refresh failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  await persistTokens(tenantId, data.access_token, data.refresh_token, data.expires_in);
  return data.access_token;
}

async function persistTokens(
  tenantId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  await prisma.oAuthToken.upsert({
    where: { tenantId },
    create: { tenantId, accessToken, refreshToken, expiresAt },
    update: { accessToken, refreshToken, expiresAt },
  });
}
