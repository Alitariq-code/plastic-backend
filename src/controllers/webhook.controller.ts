import { Request, Response } from 'express';
import axios from 'axios';
import Opportunity from '../models/opportunity.plastic';
import WebhookId from '../models/WebhookId.model'
import { OAUTH_CONFIG } from '../config/oauthConfig';
import userAuthTokens from '../models/UserInfo';
// import {resolveSource} from '../utils/sourceHandler'
import qs from 'qs';

const TREATMENT_INTEREST_FIELD_ID = 'TloVurUlLLoJjD325POi';

/**
 * Webhook handler for opportunity events
 * Handles create, update, and delete events for opportunities
 */
export const handleOpportunityWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookEvent = req.body;
    console.log('Webhook Event Received:', JSON.stringify(webhookEvent));

    // Extract the event type
    const eventType = webhookEvent.type;
    console.log(eventType, 'eventType');

    switch (eventType) {
      case 'OpportunityCreate':
        console.log('isOpportunityCreate');
        await handleOpportunityCreate(webhookEvent);
        break;
      case 'OpportunityUpdate':
        await handleOpportunityUpdate(webhookEvent);
        break;
      case 'OpportunityDelete':
        await handleOpportunityDelete(webhookEvent);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    // Respond with success to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Always return 200 to acknowledge receipt even if processing failed
    // This prevents the webhook provider from retrying
    res.status(200).json({ success: false, error: 'Error processing webhook' });
  }
};

/**
 * Handle Opportunity Create event
 */
const handleOpportunityCreate = async (eventData: any): Promise<void> => {
  try {
    // Create opportunity with all data
    await Opportunity.create({
      ...eventData,
      monetaryValue: eventData.monetaryValue || 0,
      lastStageChangeAt: eventData.lastStageChangeAt || eventData.dateAdded,
      lastStatusChangeAt: eventData.lastStatusChangeAt || eventData.dateAdded,
    });

    console.log(`Created opportunity: ${eventData.id}`);
  } catch (error) {
    console.error(`Error creating opportunity ${eventData.id}:`, error);
    throw error;
  }
};

/**
 * Handle Opportunity Update event
 */
const handleOpportunityUpdate = async (eventData: any): Promise<void> => {
  try {
    // For updates, fetch the full opportunity data to get latest custom fields

    // Prepare update data
    const updateData = {
      ...eventData,
    };

    // Add timestamp updates if relevant fields changed
    if (eventData.pipelineStageId !== undefined) {
      updateData.lastStageChangeAt = new Date();
    }

    if (eventData.status !== undefined) {
      updateData.lastStatusChangeAt = new Date();
    }

    // Try to find and update in one operation
    const result = await Opportunity.findOneAndUpdate(
      { id: eventData.id },
      { $set: updateData },
      { new: true, upsert: false }
    );
    const locationId=eventData.locationId;
    const resultToken : any  = await userAuthTokens.findOne({ locationId });

    const opportunityDetails = await fetchOpportunityDetails(eventData.id,resultToken);

    if(opportunityDetails){
    const treatmentInterest = extractTreatmentInterest(opportunityDetails?.opportunities[0]?.customFields || []);
    // const resolveSourceDetail=resolveSource(opportunityDetails?.opportunities[0])

    await Opportunity.findOneAndUpdate(
      { id: eventData.id },
      {
        $set: {
          treatmentInterest,
          // resolvedSourceList:resolveSourceDetail,
          attributions: opportunityDetails?.opportunities[0]?.attributions || [],
          customFields: opportunityDetails?.opportunities[0]?.customFields || [],
        },
      },
      { new: true, upsert: false }
      );
    }else{
      await WebhookId.create({
        opportunityID: eventData.id,
        processed: false,
      });
    }

    if (!result) {
      // If not found, create it instead (this can happen if webhooks arrive out of order)
      console.log(`Opportunity ${eventData.id} not found for update, creating new record`);
      return await handleOpportunityCreate(eventData);
    }

    // console.log(`Updated opportunity: ${eventData.id} with treatment interest: ${treatmentInterest}`);
  } catch (error) {
    console.error(`Error updating opportunity ${eventData.id}:`, error);
    throw error;
  }
};

/**
 * Handle Opportunity Delete event
 */
const handleOpportunityDelete = async (eventData: any): Promise<void> => {
  try {
    const result = await Opportunity.deleteOne({ id: eventData.id });

    if (result.deletedCount === 0) {
      console.log(`Opportunity ${eventData.id} not found for deletion`);
      return;
    }

    console.log(`Deleted opportunity: ${eventData.id}`);
  } catch (error) {
    console.error(`Error deleting opportunity ${eventData.id}:`, error);
    throw error;
  }
};

/**
 * Extract treatment interest from custom fields
 */
function extractTreatmentInterest(customFields: any[]): string | null {
  if (!customFields || !Array.isArray(customFields)) return null;

  const treatmentField = customFields.find((field) => field.id === TREATMENT_INTEREST_FIELD_ID);
  return treatmentField?.fieldValueString || null;
}

/**
 * Fetch complete opportunity details from API
 * This is useful because webhook events might not contain all the data we need
 */
async function fetchOpportunityDetails(opportunityId: string,tokenObject: any): Promise<any> {
  try {
    // This function would need to be implemented with your authentication logic
    // const accessToken = await getAccessToken(tokenObject.refresh_token);
    // const accessToken = await getAccessToken(tokenObject.refresh_token);
    let response :any;
    
    if (tokenObject.access_token) {
     
       response = await axios.get('https://services.leadconnectorhq.com/opportunities/search', {
        params: {
          location_id: tokenObject.locationId,
          id: opportunityId,
        },
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${tokenObject.access_token}`,
          Version: '2021-07-28',
        },
      });
      
  
      if(response.statusCode===401){
        console.log('Access Token Expired, Refreshing Access Token...');
        const accessToken = await getAccessToken(tokenObject.refresh_token);
        response = await axios.get('https://services.leadconnectorhq.com/opportunities/search', {
          params: {
            location_id: tokenObject.locationId,
            id: opportunityId,
          },
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
            Version: '2021-07-28',
          },
        });

     }
     console.log(response.data,'response');
     return response.data;
     
    }
    
  } catch (error) {
    console.error(`Error fetching opportunity details for ${opportunityId}:`, error);
    // Return null instead of throwing, so we can still process the webhook
    // with the data we have
    return null;
  }
}

/**
 * Get API access token
 * Note: You would need to implement this with your token management logic
 */
async function getAccessToken(refresh_token:string): Promise<string> {
  const tokenData = qs.stringify({
    grant_type: 'authorization_code',
    client_id: OAUTH_CONFIG.clientId,
    client_secret: OAUTH_CONFIG.clientSecret,
    refresh_token:refresh_token,
  });
  const response = await axios.post(OAUTH_CONFIG.tokenUrl, tokenData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
  });

  const { access_token } = response.data;
  return access_token;
}