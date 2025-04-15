export function createSourceFilter(sourceFilter:any) {
  // If no filter is provided or "All" is selected, return an empty object
  if (!sourceFilter || sourceFilter === "All") {
    return {};
  }
  
  switch (sourceFilter) {
    case "Paid Search":
      return {
        source: { $in: ["Google Ads", "google ads"] }
      };
      
    case "Paid Social":
      return {
        source: { $in: ["Facebook Ads: Botox", "Facebook Ad: Diamond Glow", "facebook form lead"] }
      };
      
    case "Organic Search":
      return {
        "attributions.utmSessionSource": "Organic Search"
      };
      
    case "Organic Social":
      return {
        source: { $in: ["Instagram DM", "Facebook Message"] }
      };
      
    case "Direct Traffic":
      return {
        "attributions.utmSessionSource": "Direct traffic"
      };
      
    case "Referral Traffic":
      return {
        "attributions.utmSessionSource": "Referral"
      };
      
    case "Other":
      return {
        $and: [
          // Include these sources or utmSessionSource values
          { 
            $or: [
              { source: { $in: ["chat widget", "Website Form: Consultation", "form 9", null, "undefined"] } },
              { "attributions.utmSessionSource": { $in: ["CRM UI", "Other", "CRM Workflows"] } }
            ]
          },
          // Exclude sources that belong to other categories
          { 
            $and: [
              { source: { $nin: ["Google Ads","google ads", "Facebook Ads: Botox", "Facebook Ad: Diamond Glow", "facebook form lead", "Instagram DM", "Facebook Message"] } },
              { "attributions.utmSessionSource": { $nin: ["Organic Search", "Direct traffic", "Referral"] } }
            ]
          }
        ]
      };
      
    default:
      // If an unexpected filter is provided, return an empty object
      return {};
  }
}