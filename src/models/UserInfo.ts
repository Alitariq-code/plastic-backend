import mongoose, { Schema, Document } from 'mongoose';

export interface IUserInfo extends Document {
  locationId: string;
  access_token: string;
  refresh_token: string;
}

const UserInfoSchema: Schema = new Schema(
  {
    locationId: { type: String, required: true, index: true },
    access_token: { type: String, required: true },
    refresh_token: { type: String, required: true },
  },
  { timestamps: true } 
);

export default mongoose.model<IUserInfo>('userAuthTokens', UserInfoSchema);
