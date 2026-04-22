import { Client } from '@hubspot/api-client';
import { getValidAccessToken } from './auth';

/**
 * Returns a HubSpot API client configured with a fresh, valid access token.
 * Call this fresh each time you need the client — do not cache the instance
 * across requests since tokens can be refreshed between calls.
 */
export async function getHubSpotClient(): Promise<Client> {
  const accessToken = await getValidAccessToken();
  return new Client({ accessToken });
}
