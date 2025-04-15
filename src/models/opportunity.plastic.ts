import mongoose, { Schema, Document } from 'mongoose';

// Define the Attribution interface
export interface Attribution {
  utmSessionSource: string;
  medium: string;
  mediumId?: string;
  url?: string;
  isFirst?: boolean;
  isLast?: boolean;
}

// Define the CustomField interface
export interface CustomField {
  id: string;
  type: string;
  fieldValueString?: string;
}

// Update the main Opportunity interface
export interface IOpportunity extends Document {
  type: string;
  locationId: string;
  id: string;
  assignedTo: string;
  contactId: string;
  monetaryValue: number;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  source: string;
  status: string;
  dateAdded: Date;
  lastStageChangeAt: Date;
  lastStatusChangeAt: Date;
  treatmentInterest: string;
  attributions: Attribution[];
  customFields: CustomField[];
}

// Create the attribution schema
const AttributionSchema = new Schema(
  {
    utmSessionSource: { type: String },
    medium: { type: String },
    mediumId: { type: String },
    url: { type: String },
    isFirst: { type: Boolean },
    isLast: { type: Boolean },
  },
  { _id: false }
);

const CustomFieldSchema = new Schema(
  {
    id: { type: String },
    type: { type: String },
    fieldValueString: { type: String },
  },
  { _id: false }
);

const OpportunitySchema: Schema = new Schema(
  {
    type: { type: String },
    locationId: { type: String },
    id: { type: String, unique: true },
    assignedTo: { type: String },
    contactId: { type: String },
    monetaryValue: { type: Number, default: 0 },
    name: { type: String },
    pipelineId: { type: String },
    pipelineStageId: { type: String },
    treatmentInterest: { type: String },
    source: { type: String },
    status: { type: String },
    dateAdded: { type: Date, default: Date.now },
    lastStageChangeAt: { type: Date },
    lastStatusChangeAt: { type: Date },
    resolvedSourceList:{ type: Array<string> },
    attributions: [AttributionSchema],
    customFields: [CustomFieldSchema],
  },
  { timestamps: true }
);

OpportunitySchema.index({ source: 1 });
OpportunitySchema.index({ 'attributions.utmSessionSource': 1 });
OpportunitySchema.index({ 'attributions.medium': 1 });
OpportunitySchema.index({ treatmentInterest: 1 });
OpportunitySchema.index({ status: 1 });
OpportunitySchema.index({ 'customFields.id': 1 });

export default mongoose.model<IOpportunity>('plasticOpps', OpportunitySchema);