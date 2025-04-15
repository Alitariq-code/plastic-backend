import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookId extends Document {
  opportunityID: string;
  processed: boolean;
  createdAt: Date;
}

const WebhookIdSchema: Schema = new Schema(
  {
    opportunityID: { type: String, required: true, index: true },
    processed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } } 
);

export default mongoose.model<IWebhookId>('WebhookId', WebhookIdSchema);
