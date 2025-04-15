import express from 'express';
import { handleOpportunityWebhook } from '../controllers/webhook.controller';

const router = express.Router();

// Webhook endpoint for opportunities
router.post('/', handleOpportunityWebhook);

export default router;
