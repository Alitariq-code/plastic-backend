import { Request, Response } from 'express';
import Opportunity from '../models/opportunity.plastic';
import Stage from '../models/stage.plastic';
import { createSourceFilter } from '../utils/sourceHandler';


export const getSurgeryData = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1️⃣ Extract and type query parameters
    const { source, start, end, fixedDate } = req.query as {
      source?: string;
      start?: string;
      end?: string;
      fixedDate?: string;
    };

    console.log('Received params:', { source, start, end, fixedDate });
    
    // 2️⃣ Create source filter
    const filtersSource = createSourceFilter(source);

    // 3️⃣ Determine the date range for filtering
    let startDate: Date, endDate: Date;
    if (start && end) {
      startDate = new Date(start);
      endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
    } else if (fixedDate) {
      startDate = new Date(fixedDate);
      endDate = new Date(fixedDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // 4️⃣ Build the filter using date range and optional source
    let filters: any = {
      $or: [
        { dateAdded: { $gte: startDate, $lte: endDate } },
        { lastStageChangeAt: { $gte: startDate, $lte: endDate } },
      ],
    };

    if (source && source !== 'All') {
      filters = { ...filters, ...filtersSource };
    }

    console.log('Using filters:', JSON.stringify(filters));

    // 5️⃣ Fetch stages and opportunities
    const [stages, opportunities] = await Promise.all([
      Stage.find({}).lean(),
      Opportunity.find(filters).lean()
    ]);

    console.log(`Found ${opportunities.length} opportunities and ${stages.length} stages`);
    
    // 6️⃣ Group stages by their function for better organization and maintainability
    const stagesByType = {
      leadStageIds: stages
        .filter(stage => stage.name === 'Lead')
        .map(stage => stage.id),
        
      consultStageIds: stages
        .filter(stage => ['Pre-Qualify Call', 'Consult Booked', 'Consult Complete'].includes(stage.name))
        .map(stage => stage.id),
        
      surgeryScheduledIds: stages
        .filter(stage => stage.name === 'Surgery Scheduled')
        .map(stage => stage.id),
        
      surgeryCompletedIds: stages
        .filter(stage => stage.name === 'Surgery Complete')
        .map(stage => stage.id),
        
      canceledLeadIds: stages
        .filter(stage => ['Cold', 'Not Good Fit'].includes(stage.name))
        .map(stage => stage.id)
    };
    
    // Log stage IDs for verification
    console.log('Stage IDs by category:', JSON.stringify(stagesByType));

    // 7️⃣ Process all opportunities to populate metrics
    const metrics = {
      totalLeads: { total: 0, new: 0, existing: 0 },
      consultsBooked: { total: 0, new: 0, existing: 0 },
      surgeryScheduled: { total: 0, new: 0, existing: 0 },
      surgeryCompleted: { total: 0, new: 0, existing: 0 },
      canceledLead: { total: 0, new: 0, existing: 0 }
    };
    
    opportunities.forEach(opp => {
      const createdAt = new Date(opp.dateAdded);
      const isNew = createdAt >= startDate && createdAt <= endDate;
      
      // Count all opportunities as leads for total metrics
      metrics.totalLeads.total++;
      isNew ? metrics.totalLeads.new++ : metrics.totalLeads.existing++;
      
      // Use dynamic stage IDs for categorization
      if (stagesByType.consultStageIds.includes(opp.pipelineStageId)) {
        metrics.consultsBooked.total++;
        isNew ? metrics.consultsBooked.new++ : metrics.consultsBooked.existing++;
      } 
      else if (stagesByType.surgeryScheduledIds.includes(opp.pipelineStageId)) {
        metrics.surgeryScheduled.total++;
        isNew ? metrics.surgeryScheduled.new++ : metrics.surgeryScheduled.existing++;
      }
      else if (stagesByType.surgeryCompletedIds.includes(opp.pipelineStageId)) {
        metrics.surgeryCompleted.total++;
        isNew ? metrics.surgeryCompleted.new++ : metrics.surgeryCompleted.existing++;
      }
      else if (stagesByType.canceledLeadIds.includes(opp.pipelineStageId)) {
        metrics.canceledLead.total++;
        isNew ? metrics.canceledLead.new++ : metrics.canceledLead.existing++;
      }
    });

    // 8️⃣ Calculate conversion rates
    const calculatePercentage = (part: number, total: number): string => {
        return total > 0 ? `${Math.round((part / total) * 100)}%` : '0%';
      };
      

    // 9️⃣ Build the final response exactly matching the dashboard UI format
    const response = {
      // Top row widgets (4 count widgets)
      totalLeads: {
        total: metrics.totalLeads.total,
        new: metrics.totalLeads.new,
        existing: metrics.totalLeads.existing
      },
      consultsBooked: {
        total: metrics.consultsBooked.total,
        new: metrics.consultsBooked.new,
        existing: metrics.consultsBooked.existing
      },
      surgeryScheduled: {
        total: metrics.surgeryScheduled.total,
        new: metrics.surgeryScheduled.new,
        existing: metrics.surgeryScheduled.existing
      },
      surgeryCompleted: {
        total: metrics.surgeryCompleted.total,
        new: metrics.surgeryCompleted.new,
        existing: metrics.surgeryCompleted.existing
      },
      
      // Bottom row widgets (4 conversion rate widgets)
      leadToConsult: {
        total: calculatePercentage(metrics.consultsBooked.total, metrics.totalLeads.total),
        new: calculatePercentage(metrics.consultsBooked.new, metrics.totalLeads.new),
        existing: calculatePercentage(metrics.consultsBooked.existing, metrics.totalLeads.existing)
      },
      consultToSurgery: {
        total: calculatePercentage(metrics.surgeryScheduled.total, metrics.consultsBooked.total),
        new: calculatePercentage(metrics.surgeryScheduled.new, metrics.consultsBooked.new),
        existing: calculatePercentage(metrics.surgeryScheduled.existing, metrics.consultsBooked.existing)
      },
      leadToCompleted: {
        total: calculatePercentage(metrics.surgeryCompleted.total, metrics.totalLeads.total),
        new: calculatePercentage(metrics.surgeryCompleted.new, metrics.totalLeads.new),
        existing: calculatePercentage(metrics.surgeryCompleted.existing, metrics.totalLeads.existing)
      },
      canceledLead: {
        total: calculatePercentage(metrics.canceledLead.total, metrics.totalLeads.total),
        new: calculatePercentage(metrics.canceledLead.new, metrics.totalLeads.new),
        existing: calculatePercentage(metrics.canceledLead.existing, metrics.totalLeads.existing)
      }
    };

    // Log computed metrics for production monitoring
    console.log('Response metrics:', JSON.stringify(response));

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching surgery dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to generate surgery metrics' });
  }
};

export const getOpportunityTrendPlastic = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract query parameters with proper validation
    const { interval = 'Y'} = req.query;
    
    if (!['D', 'W', 'M', 'Y'].includes(interval as string)) {
      res.status(400).json({ error: 'Invalid interval provided. Use D, W, M, or Y.' });
      return;
    }

    const now = new Date();
    let start: Date;
    let intervals: number;
    let labelPrefix: string = '';

    // Determine time range and format based on interval
    switch (interval) {
      case 'D':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        intervals = 6; // 6 intervals of 4 hours each
        break;
      case 'W':
        start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); // Start 6 days ago for 7 days total
        start.setHours(0, 0, 0, 0); // Start at beginning of day
        labelPrefix = 'Week ';
        intervals = 7;
        break;
      case 'M':
        start = new Date(now.getTime() - 27 * 24 * 60 * 60 * 1000); // Start 27 days ago for 4 weeks
        start.setHours(0, 0, 0, 0);
        labelPrefix = 'Week ';
        intervals = 4;
        break;
      case 'Y':
        start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        start.setHours(0, 0, 0, 0); // Start at beginning of month
        intervals = 12;
        break;
      default:
        // This should never execute due to the validation above
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        intervals = 7;
    }



    // Build query filter with proper date constraints
    let filters: any = {
      dateAdded: { $gte: start, $lte: now },
    };
    console.log(filters,'filters')


    // Fetch opportunities and stages concurrently for better performance
    const [opportunities, stages] = await Promise.all([
      Opportunity.find(filters).lean().exec(),
      Stage.find({}, { id: 1, name: 1 }).lean().exec()
    ]);

    // Log query execution for monitoring
    console.log(opportunities.length,'opportunities');
    
    // Create a map for efficient stage name lookups
    const stageMap = new Map(stages.map((stage) => [stage.id, stage.name]));
    console.log(stageMap, 'stageMap');
    
    // Define stage categories by name - using exact names from your database
    const consultBookedStages = new Set(['Consult Booked', 'Pre-Qualify Call', 'Consult Complete']);
    const surgeryScheduledStages = new Set(['Surgery Scheduled']);
    const surgeryCompletedStages = new Set(['Surgery Complete']);

    // Generate interval labels based on the selected time interval
    const labels: string[] = [];
    if (interval === 'D') {
      for (let i = 0; i < intervals; i++) {
        const intervalStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), i * 4);
        const intervalEnd = new Date(intervalStart.getTime() + 4 * 3600000 - 1);
        const startLabel = intervalStart.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        const endLabel = intervalEnd.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        labels.push(`${startLabel} - ${endLabel}`);
      }
    } else if (interval === 'W' || interval === 'M') {
      for (let i = 0; i < intervals; i++) {
        labels.push(`${labelPrefix}${i + 1}`);
      }
    } else if (interval === 'Y') {
      // Get month names for the last 12 months
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 0; i < intervals; i++) {
        const monthIndex = (now.getMonth() - (intervals - i - 1) + 12) % 12;
        const year = now.getFullYear() - (monthIndex > now.getMonth() ? 1 : 0);
        labels.push(`${months[monthIndex]} ${year}`);
      }
    }

    // Initialize data structure with zeroes for each interval
    const dataMap = new Map<string, {
      total: number,
      booked: number,
      surgeryScheduled: number,
      appointments: number
    }>();

    labels.forEach(label => {
      dataMap.set(label, {
        total: 0,
        booked: 0,
        surgeryScheduled: 0,
        appointments: 0
      });
    });

    // Assign opportunities to intervals and categories
    opportunities.forEach(opp => {
      const createdAt = new Date(opp.dateAdded);
      let label = '';

      // Determine which interval this opportunity belongs to
      if (interval === 'D') {
        const hour = createdAt.getHours();
        const bucketStart = hour - (hour % 4);
        const intervalStart = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate(), bucketStart);
        const intervalEnd = new Date(intervalStart.getTime() + 4 * 3600000 - 1);
        label = `${intervalStart.toLocaleTimeString('en-US', {
          hour: 'numeric',
          hour12: true,
        })} - ${intervalEnd.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}`;
      } else if (interval === 'W') {
        const dayDiff = Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
        if (dayDiff >= 0 && dayDiff < intervals) {
          label = `${labelPrefix}${intervals - dayDiff}`;
        }
      } else if (interval === 'M') {
        const weekDiff = Math.floor((now.getTime() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weekDiff >= 0 && weekDiff < intervals) {
          label = `${labelPrefix}${intervals - weekDiff}`;
        }
      } else if (interval === 'Y') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = months[createdAt.getMonth()];
        const year = createdAt.getFullYear();
        label = `${monthName} ${year}`;
      }

      // Update counts in the appropriate interval
      const data = dataMap.get(label);
      if (data) {
        const stageName = stageMap.get(opp.pipelineStageId) || 'Unknown';
        
        // Always increment total leads
        data.total++;
        
        // Categorize by stage - using safe checks
        if (stageName && consultBookedStages.has(stageName)) {
          data.booked++;
        }
        if (stageName && surgeryScheduledStages.has(stageName)) {
          data.surgeryScheduled++;
        }
        if (stageName && surgeryCompletedStages.has(stageName)) {
          data.appointments++;
        }
      }
    });

    // Calculate overall totals for metrics
    let totalLeads = 0;
    let totalBooked = 0;
    let totalScheduled = 0;
    let totalCompleted = 0;

    dataMap.forEach(data => {
      totalLeads += data.total;
      totalBooked += data.booked;
      totalScheduled += data.surgeryScheduled;
      totalCompleted += data.appointments;
    });

    // Format data for chart exactly as in your example
    const chartData = labels.map(name => {
      const data = dataMap.get(name) || { 
        total: 0, 
        booked: 0, 
        surgeryScheduled: 0, 
        appointments: 0 
      };
      
      // Calculate percentages with proper handling of zero denominators
      const leadToBookPercentage = data.total > 0 ? Math.round((data.booked / data.total) * 100) : 0;
      const leadToCompletePercentage = data.total > 0 ? Math.round((data.appointments / data.total) * 100) : 0;
      
      return {
        name,
        booked: data.booked,
        surgeryScheduled: data.surgeryScheduled,
        appointments: data.appointments,
        total: data.total,
        leadToBook: `${leadToBookPercentage}%`,
        leadToComplete: `${leadToCompletePercentage}%`
      };
    });

    // Calculate summary metrics for the hover information
    const surgeryCompletedRate = totalScheduled > 0 
      ? Math.round((totalCompleted / totalScheduled) * 100) 
      : 0;
      
    const leadToCompletedRate = totalLeads > 0 
      ? Math.round((totalCompleted / totalLeads) * 100) 
      : 0;

    // Prepare metrics information that shows in the hover tooltip
    const metrics = {
      totalLeads,
      consultsBooked: totalBooked,
      surgeryScheduled: totalScheduled,
      surgeryCompleted: `${surgeryCompletedRate}%`,
      leadToCompleted: `${leadToCompletedRate}%`
    };

    // Return both the chart data and the metrics needed for the hover tooltip
    res.status(200).json({ 
      data: chartData,
      metrics
    });
    
  } catch (error) {
    console.error('Error fetching plastic surgery opportunity trend:', error);
    res.status(500).json({ 
      error: 'Failed to generate opportunity trend data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};


export const getTreatmentOpportunitiesPlastic = async (req: Request, res: Response): Promise<void> => {
  try {
    const { start, end, source } = req.query;

    // Set up filters based on provided parameters
    let filters: any = {};
    const filtersSource = createSourceFilter(source);

    // Add date filters if provided
    if (start && end) {
      const startDate = new Date(start as string);
      const endDate = new Date(end as string);
      // Add one day to end date to include the full end day
      endDate.setHours(23, 59, 59, 999);

      filters.$or = [
        { dateAdded: { $gte: startDate, $lte: endDate } },
        { lastStageChangeAt: { $gte: startDate, $lte: endDate } },
      ];
    }

    if (source && source !== 'All') {
      filters = { ...filters, ...filtersSource };
    }


    // Find all distinct treatment interests first
    const distinctTreatments = await Opportunity.distinct('treatmentInterest', {
      treatmentInterest: { $exists: true, $ne: null },
    });

    // Fetch total count for percentage calculation
    const totalOpportunities = await Opportunity.countDocuments({
      ...filters,
      treatmentInterest: { $exists: true, $ne: null },
    });

    // Get counts for each treatment interest
    const treatmentData = await Promise.all(
      distinctTreatments.map(async (treatment) => {
        if (!treatment) return null;

        const count = await Opportunity.countDocuments({
          ...filters,
          treatmentInterest: treatment,
        });

        // Calculate percentage
        const percentage = totalOpportunities > 0 ? Math.round((count / totalOpportunities) * 100) : 0;

        return {
          category: treatment, // Changed from 'treatment' to 'category'
          value: count, // Changed from 'count' to 'value'
          percentage: `${percentage}%`, // Format percentage as string with % symbol
        };
      })
    );

    // Filter out null results and sort by count descending
    const results = treatmentData
      .filter((item): item is { category: string; value: number; percentage: string } => item !== null)
      .sort((a, b) => b.value - a.value);

    // Return the array directly without wrapping it in an object
    res.json(results);
  } catch (error) {
    console.error('Error fetching treatment opportunities:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const totalRevenuePlastic = async (req: Request, res: Response): Promise<void> => {
  try {
    const { source, start, end, fixedDate } = req.query as {
      source?: string;
      start?: string;
      end?: string;
      fixedDate?: string;
    };

    const filtersSource = createSourceFilter(source);

    // 1️⃣ Determine the date range for filtering based on lastStageChangeAt
    let startDate: Date, endDate: Date;
    if (start && end) {
      startDate = new Date(start);
      endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
    } else if (fixedDate) {
      startDate = new Date(fixedDate);
      endDate = new Date(fixedDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // 2️⃣ Build the filter using lastStageChangeAt (revenue event) and optional source
    let filters: any = {
      lastStageChangeAt: { $gte: startDate, $lte: endDate },
    };

    if (source && source !== 'All') {
      filters = { ...filters, ...filtersSource };
    }

    // 3️⃣ Fetch revenue-related stage IDs
    const stages = await Stage.find({}, { id: 1, name: 1 }).lean();
    const revenueStageIds = stages
      .filter((stage) => ['Booked', 'Consult Complete', 'Patient', 'Consult Booked','Surgery Complete'].includes(stage.name))
      .map((stage) => stage.id);

    if (!revenueStageIds.length) {
      res.status(500).json({ error: 'No revenue-generating stages found' });
      return;
    }
    filters.pipelineStageId = { $in: revenueStageIds };

    // 4️⃣ Fetch opportunities that moved to a revenue stage within the given date range
    const opportunities = await Opportunity.find(filters).lean();

    // 5️⃣ Classify revenue as new (if created within range) or existing (if created before range)
    let newRevenue = 0;
    let existingRevenue = 0;
    for (const op of opportunities) {
      const createdAt = new Date(op.dateAdded);
      const revenue = op.monetaryValue || 0;
      // "New" if the opportunity was created during the dashboard’s date range
      const isNew = createdAt >= startDate && createdAt <= endDate;
      if (isNew) {
        newRevenue += revenue;
      } else {
        existingRevenue += revenue;
      }
    }

    const totalRevenue = newRevenue + existingRevenue;

    // 6️⃣ Return response with revenue values rounded (no decimals)
    res.status(200).json({
      totalRevenue: `$${Math.trunc(totalRevenue)}`,
      newRevenue: `$${Math.trunc(newRevenue)}`,
      existingRevenue: `$${Math.trunc(existingRevenue)}`,
    });
  } catch (error) {
    console.error('Error in totalRevenue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const automatedNurtureConversionRatePlastic = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1️⃣ Parse query params
    const { source, start, end, fixedDate } = req.query as {
      source?: string;
      start?: string;
      end?: string;
      fixedDate?: string;
    };
    const filtersSource = createSourceFilter(source);

    // 2️⃣ Determine date range
    let startDate: Date;
    let endDate: Date;

    if (start && end) {
      startDate = new Date(start);
      endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
    } else if (fixedDate) {
      startDate = new Date(fixedDate);
      endDate = new Date(fixedDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // default to today's full day
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // 3️⃣ Fetch stage IDs from the database
    const stages = await Stage.find({}, { id: 1, name: 1 }).lean();
    if (!stages.length) {
      res.status(500).json({ error: 'No stages found in the database.' });
      return;
    }

    // Identify "Replied" stage
    const repliedStage = stages.find((s) => s.name === 'Pre-Qualify Call');
    if (!repliedStage) {
      res.status(500).json({ error: 'Replied stage not found in the database.' });
      return;
    }

    // Identify "Patient" stage specifically
    const patientStage = stages.find((s) => s.name === 'Patient');
    if (!patientStage) {
      res.status(500).json({ error: 'Patient stage not found in the database.' });
      return;
    }

    // 4️⃣ Find all opportunities that entered "Replied" stage during the date range
    let repliedFilter: Record<string, any> = {
      pipelineStageId: repliedStage.id,
      lastStageChangeAt: { $gte: startDate, $lte: endDate },
    };

    // Apply source filter if provided
    // if (source && source !== 'All') {
    //   repliedFilter.resolvedSourceList = { $in: [source] };
    // }
    if (source && source !== 'All') {
      repliedFilter = { ...repliedFilter, ...filtersSource };
    }

    const repliedOps = await Opportunity.find(repliedFilter).lean();
    const totalReplied = repliedOps.length;
    console.log(totalReplied,'totalReplied')

    // 5️⃣ Find opportunities that are either:
    // - Currently in the "Patient" stage
    // - OR have a "Won" status
    let convertedFilter: Record<string, any> = {
      // _id: { $in: repliedIds },
      $or: [
        { pipelineStageId: patientStage.id }, // In Patient stage
        { status: 'Won' }, // Has Won status
      ],
    };

    // Apply the same source filter if needed
    //  if (source && source !== 'All') {
    //   convertedFilter.resolvedSourceList = { $in: [source] };
    // }
    if (source && source !== 'All') {
      convertedFilter = { ...convertedFilter, ...filtersSource };
    }


    const convertedOps = await Opportunity.find(convertedFilter).lean();
    const totalConverted = convertedOps.length;

    // 6️⃣ Calculate conversion rate
    const conversionRate = totalReplied === 0 ? 0 : (totalConverted / totalReplied) * 100;

    // 7️⃣ Respond with results
    res.status(200).json({
      totalReplied,
      totalConverted,
      conversionRate: Math.round(conversionRate), // e.g. 49 for 49%
      display: `${totalConverted} out of ${totalReplied} leads converted`,
      dateRange: {
        start: startDate,
        end: endDate,
      },
    });
  } catch (error) {
    console.error('Error in automatedNurtureConversionRate:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const marketingROIPlastic = async (req: Request, res: Response): Promise<void> => {
  try {
    const { source, start, end, fixedDate, totalInvestedCost } = req.query as {
      source?: string;
      start?: string;
      end?: string;
      fixedDate?: string;
      totalInvestedCost?: string; // Accept as string to parse
    };

    const filtersSource = createSourceFilter(source);

    // Validate and parse investment cost
    const currentInvestment = totalInvestedCost ? parseFloat(totalInvestedCost) : 0;
    if (currentInvestment <= 0) {
      res.status(400).json({ error: 'Valid total invested cost is required.' });
      return;
    }

    // 1️⃣ Determine date range
    let startDate: Date, endDate: Date;
    if (start && end) {
      startDate = new Date(start);
      endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
    } else if (fixedDate) {
      startDate = new Date(fixedDate);
      endDate = new Date(fixedDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // 2️⃣ Build the filter
    let filters: Record<string, any> = {
      lastStageChangeAt: { $gte: startDate, $lte: endDate },
    };

    if (source && source !== 'All') {
      filters = { ...filters, ...filtersSource };
    }


    // 3️⃣ Fetch revenue stages
    const stages = await Stage.find({}, { id: 1, name: 1 }).lean();
    const revenueStageIds = stages
      .filter((stage) => ['Booked', 'Consult Complete', 'Patient', 'Consult Booked','Surgery Complete'].includes(stage.name))
      .map((stage) => stage.id);

    if (!revenueStageIds.length) {
      res.status(500).json({ error: 'No revenue-generating stages found' });
      return;
    }
    filters.pipelineStageId = { $in: revenueStageIds };

    // 4️⃣ Fetch opportunities
    const opportunities = await Opportunity.find(filters).lean();

    // 5️⃣ Calculate revenue for new and existing opportunities
    let newRevenue = 0;
    let existingRevenue = 0;
    let newCount = 0;
    let existingCount = 0;

    for (const op of opportunities) {
      const createdAt = new Date(op.dateAdded);
      const revenue = op.monetaryValue || 0;
      const isNew = createdAt >= startDate && createdAt <= endDate;
      if (isNew) {
        newRevenue += revenue;
        newCount++;
      } else {
        existingRevenue += revenue;
        existingCount++;
      }
    }

    const totalRevenue = newRevenue + existingRevenue;
    
    // Prevent division by zero
    const totalRevenueForRatio = totalRevenue || 1;

    // 6️⃣ Calculate investment allocation based on revenue proportion
    const newCustomerInvestment = currentInvestment * (newRevenue / totalRevenueForRatio);
    const existingCustomerInvestment = currentInvestment * (existingRevenue / totalRevenueForRatio);

    // 7️⃣ Calculate ROI
    const calculateROI = (rev: number, inv: number) => {
      if (inv <= 0) return 0; // Avoid division by zero
      return Math.round((rev - inv) / inv * 100);
    };
    
    const totalROI = calculateROI(totalRevenue, currentInvestment);
    const newROI = calculateROI(newRevenue, newCustomerInvestment);
    const existingROI = calculateROI(existingRevenue, existingCustomerInvestment);

    // 8️⃣ Return the final response
    res.status(200).json({
      total: `${Math.max(totalROI, 0)}%`,
      new: `${Math.max(newROI, 0)}%`,    
      existing: `${Math.max(existingROI, 0)}%` 
    });
    
    
  } catch (error) {
    console.error('Error in marketingROI:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


export const customerAcquisitionCostPlastic = async (req: Request, res: Response): Promise<void> => {
  try {
    // Destructure and type query parameters
    const {
      source,
      start,
      end,
      fixedDate,
      totalMarketingCost,
    } = req.query as {
      source?: string;
      start?: string;
      end?: string;
      fixedDate?: string;
      totalMarketingCost?: string;
    };

    // Validate totalMarketingCost
    const marketingCost = totalMarketingCost ? parseFloat(totalMarketingCost) : 0;
    const filtersSource = createSourceFilter(source);
    if (!totalMarketingCost || isNaN(marketingCost) || marketingCost <= 0) {
      res.status(400).json({ error: 'Valid total marketing cost is required.' });
      return;
    }


    // Determine the date range based on provided parameters
    let startDate: Date, endDate: Date;
    if (start && end) {
      startDate = new Date(start);
      endDate = new Date(end);
      // Validate parsed dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({ error: 'Invalid date format for start or end.' });
        return;
      }
      endDate.setHours(23, 59, 59, 999);
    } else if (fixedDate) {
      startDate = new Date(fixedDate);
      if (isNaN(startDate.getTime())) {
        res.status(400).json({ error: 'Invalid date format for fixedDate.' });
        return;
      }
      endDate = new Date(fixedDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default to current day if no dates are provided
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // Build database filters based on the date range and optional source parameter
    let filters: Record<string, any> = {
      lastStageChangeAt: { $gte: startDate, $lte: endDate },
    };

    // If a specific source is provided (other than 'All'), filter by it
    if (source && source !== 'All') {
      filters = { ...filters, ...filtersSource };
    }

    // Retrieve all stages to determine which ones count as appointments
    const stages = await Stage.find({}, { id: 1, name: 1 }).lean();
    if (!stages || stages.length === 0) {
      res.status(500).json({ error: 'No stages found.' });
      return;
    }

    // Select appointment stages (e.g., Booked, Consult Completed, Patient)
    const appointmentStageIds = stages
      .filter((stage) => ['Booked', 'Consult Complete', 'Patient'].includes(stage.name))
      .map((stage) => stage.id);

    if (!appointmentStageIds.length) {
      res.status(500).json({ error: 'No appointment/booking stages found.' });
      return;
    }
    filters.pipelineStageId = { $in: appointmentStageIds };

    // Fetch appointments that match the filters
    const appointments = await Opportunity.find(filters).lean();

    // Calculate counts for new vs. existing appointments
    let newAppointmentsCount = 0;
    let existingAppointmentsCount = 0;
    appointments.forEach((appointment) => {
      const createdAt = new Date(appointment.dateAdded);
      if (createdAt >= startDate && createdAt <= endDate) {
        newAppointmentsCount++;
      } else {
        existingAppointmentsCount++;
      }
    });

    const totalAppointmentsCount = newAppointmentsCount + existingAppointmentsCount;

    // Default ratio is 50/50 if no appointments are found
    let newRatio = 0.5;
    let existingRatio = 0.5;
    if (totalAppointmentsCount > 0) {
      newRatio = newAppointmentsCount / totalAppointmentsCount;
      existingRatio = existingAppointmentsCount / totalAppointmentsCount;
    }

    // Calculate customer acquisition cost distribution based on the ratios
    const newCustomerCost = marketingCost * newRatio;
    const existingCustomerCost = marketingCost * existingRatio;

    // Helper function to format numbers as currency strings
    const formatCurrency = (value: number): string => {
      if (value >= 1000) {
        const inThousands = value / 1000;
        return `$${inThousands.toFixed(1).replace(/\.0$/, '')}K`;
      }
      return `$${Math.round(value)}`;
    };

    // Return the results, including a breakdown of appointment counts
    res.status(200).json({
      total: formatCurrency(marketingCost),
      new: formatCurrency(newCustomerCost),
      existing: formatCurrency(existingCustomerCost),
      breakdown: {
        newAppointmentsCount,
        existingAppointmentsCount,
      },
    });
  } catch (error) {
    console.error('Error in customerAcquisitionCost:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};