import { Client } from '@hubspot/api-client';
import { getValidAccessToken } from './auth';

/**
 * Returns a HubSpot API client configured with a fresh, valid access token
 * for the given tenant. Call this fresh each time — tokens can be refreshed
 * between calls.
 */
export async function getHubSpotClient(tenantId: string): Promise<Client> {
  const accessToken = await getValidAccessToken(tenantId);
  return new Client({ accessToken });
}
