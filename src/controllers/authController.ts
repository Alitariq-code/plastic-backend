import { Request, Response } from 'express';
import axios from 'axios';
import { OAUTH_CONFIG } from '../config/oauthConfig';
import { saveTokens, getAccessToken, refreshAccessToken } from '../utils/tokenHandler';
import WebhookId from '../models/WebhookId.model';
import Opportunity from '../models/opportunity.plastic';
import userAuthTokens from '../models/UserInfo';
// import { resolveSource } from '../utils/sourceHandler';
import qs from 'qs'; // Required for application/x-www-form-urlencoded format
import { userInfo } from 'os';

/**
 * Redirect user to OAuth authorization page
 */
export const login = (req: Request, res: Response) => {
  console.log(OAUTH_CONFIG, 'OAUTH_CONFIG');
  const authUrl = `${OAUTH_CONFIG.authUrl}?response_type=code&client_id=${OAUTH_CONFIG.clientId}&redirect_uri=${
    OAUTH_CONFIG.redirectUri
  }&scope=${encodeURIComponent(OAUTH_CONFIG.scope)}`;
  res.redirect(authUrl);
};

/**
 * Handle OAuth callback & exchange authorization code for access token
 */
export const authCallback = async (req: Request, res: Response) => {
  const authCode = req.query.code as string;

  if (!authCode) {
    res.status(400).json({ error: 'Authorization code not found' });
    return;
  }

  try {
    const tokenData = qs.stringify({
      grant_type: 'authorization_code',
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      code: authCode,
    });

    const response = await axios.post(OAUTH_CONFIG.tokenUrl, tokenData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });
    console.log(response.data,'response.data')

    const { access_token, refresh_token, locationId } = response.data;
    const existingRecord = await userAuthTokens.findOne({locationId });
    if (existingRecord) {
      // If the record exists, update it
      existingRecord.set({
        access_token,
        refresh_token,
      });
      await existingRecord.save();
    } else {
      // If the record doesn't exist, create a new one
      await userAuthTokens.create({
        locationId,
        access_token,
        refresh_token,
      });
    }
    saveTokens(access_token, refresh_token);
    console.log(access_token, 'access_token');
    // Call the new helper function here:
    await updateOpportunity(access_token, locationId);

    res.redirect(
      `${process.env.PLASTIC_URL}/?access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(
        refresh_token
      )}&locationId=${encodeURIComponent(locationId)}`
    );
  } catch (error) {
    console.error('Error exchanging code:', error);
    res.status(500).json({ error: 'Token exchange failed' });
  }
};

const updateOpportunity = async (accessToken: string, locationId: string) => {
  try {
    const unprocessedWebhooks = await WebhookId.find({ processed: false });

    for (const webhook of unprocessedWebhooks) {
      const opportunityId = webhook.opportunityID;

      const response = await axios.get('https://services.leadconnectorhq.com/opportunities/search', {
        params: {
          location_id: locationId,
          id: opportunityId,
        },
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          Version: '2021-07-28',
        },
      });

      const { opportunity } = response.data;
      //  const resolveSourceDetail=resolveSource(opportunity)
      console.log(opportunity, 'opportunity');

      if (!opportunity) {
        console.warn(`No opportunity data found for ID: ${opportunityId}`);
        continue;
      }

      const updatedData = {
        // resolvedSourceList:resolveSourceDetail,
        attributions: opportunity?.attributions,
        customFields: opportunity?.customFields,
      };

      // Update (or insert) the Opportunity in MongoDB
      await Opportunity.findOneAndUpdate({ id: opportunityId }, { $set: updatedData }, { new: true, upsert: false });

      console.log(`Successfully updated Opportunity: ${opportunityId}`);

      // Mark webhook as processed
      webhook.processed = true;
      await webhook.save();
    }
  } catch (error) {
    console.error('Error updating opportunities:', error);
  }
};

/**
 * Example API call using the access token
 */
export const fetchProtectedResource = async (req: Request, res: Response) => {
  let accessToken = getAccessToken();

  try {
    if (!accessToken) {
      accessToken = await refreshAccessToken();
    }

    const apiResponse = await axios.get('https://api.gohighlevel.com/v2/protected-resource', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    res.json(apiResponse.data); // ✅ No need to return res.json()
  } catch (error: any) {
    if (error.response?.status === 401) {
      accessToken = await refreshAccessToken();
      res.json({ message: 'Token refreshed, retry the request' });
    } else {
      res.status(500).json({ error: 'API request failed' });
    }
  }
};