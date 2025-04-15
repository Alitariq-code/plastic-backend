import axios from 'axios';
import { OAUTH_CONFIG } from '../config/oauthConfig';

let accessToken: string | null = null;
let refreshToken: string | null = null;

/**
 * Save tokens in memory (Ideally, store in DB)
 */
export const saveTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
};

/**
 * Get the current access token
 */
export const getAccessToken = (): string | null => {
  return accessToken;
};

/**
 * Refresh the access token using the refresh token
 */
export const refreshAccessToken = async (): Promise<string> => {
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await axios.post(OAUTH_CONFIG.tokenUrl, {
      grant_type: 'refresh_token',
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret,
      refresh_token: refreshToken,
    });

    const { access_token, refresh_token: newRefreshToken } = response.data;
    saveTokens(access_token, newRefreshToken);

    return access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw new Error('Token refresh failed');
  }
};
