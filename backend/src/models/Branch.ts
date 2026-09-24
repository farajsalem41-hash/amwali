import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBranch extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  name: string;
  address?: string;
  city?: string;
  location?: { lat?: number; lng?: number };
  phone?: string;
  isActive: boolean;
  createdAt: Date;
}

const branchSchema = new Schema<IBranch>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    address: String,
    city: String,
    location: { lat: Number, lng: Number },
    phone: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Branch = mongoose.model<IBranch>('Branch', branchSchema);
