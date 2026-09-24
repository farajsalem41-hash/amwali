import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  name: string;
  phone: string;
  city?: string;
  address?: string;
  notes?: string;
  requestsCount: number;
  totalPaid: number;
  totalRemaining: number;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true },
    city: String,
    address: String,
    notes: String,
    requestsCount: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    totalRemaining: { type: Number, default: 0 },
    lastActivityAt: Date,
  },
  { timestamps: true }
);

customerSchema.index({ merchantId: 1, phone: 1 }, { unique: true });

export const Customer = mongoose.model<ICustomer>('Customer', customerSchema);
