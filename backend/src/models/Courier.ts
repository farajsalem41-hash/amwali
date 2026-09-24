import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICourier extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  name: string;
  phone: string;
  area?: string;
  isActive: boolean;
  createdAt: Date;
}

const courierSchema = new Schema<ICourier>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    area: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Courier = mongoose.model<ICourier>('Courier', courierSchema);
