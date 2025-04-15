import mongoose, { Schema, Document } from 'mongoose';

export interface IStage extends Document {
  id: string;
  name: string;
  originId?: string;
  position?: number;
  showInFunnel?: boolean;
  showInPieChart?: boolean;
}

const StageSchema: Schema = new Schema(
  {
    id: { type: String },
    name: { type: String },
    originId: { type: String },
    position: { type: Number },
    showInFunnel: { type: Boolean, default: true },
    showInPieChart: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model<IStage>('Stage', StageSchema);
