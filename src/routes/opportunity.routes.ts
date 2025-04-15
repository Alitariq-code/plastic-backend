import express from 'express';

import { getSurgeryData,getOpportunityTrendPlastic,getTreatmentOpportunitiesPlastic,totalRevenuePlastic,automatedNurtureConversionRatePlastic,marketingROIPlastic,customerAcquisitionCostPlastic } from '../controllers/plasticOpp.controller';

const router = express.Router();

////Plastic Surgery Dashboard
router.get('/plastic-leads', getSurgeryData);
router.get('/plastic-getOpportunityTrend', getOpportunityTrendPlastic);
router.get('/plastic-treatments', getTreatmentOpportunitiesPlastic);
router.get('/plastic-totalRevenue', totalRevenuePlastic);
router.get('/plastic-automatedNurtureConversionRate', automatedNurtureConversionRatePlastic);
router.get('/plastic-marketingROI', marketingROIPlastic);
router.get('/plastic-customerAcquisitionCost', customerAcquisitionCostPlastic);

export default router;
