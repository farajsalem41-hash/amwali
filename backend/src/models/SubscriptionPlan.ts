import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISubscriptionPlan extends Document {
  _id: Types.ObjectId;
  code: string;
  name: string;
  price: number;
  billingPeriodDays: number;
  limits: {
    paymentRequestsPerMonth: number;
    employees: number;
    branches: number;
    paymentAccounts: number;
  };
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

const subscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    billingPeriodDays: { type: Number, default: 30 },
    limits: {
      paymentRequestsPerMonth: { type: Number, default: 50 },
      employees: { type: Number, default: 0 },
      branches: { type: Number, default: 1 },
      paymentAccounts: { type: Number, default: 2 },
    },
    features: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const SubscriptionPlan = mongoose.model<ISubscriptionPlan>('SubscriptionPlan', subscriptionPlanSchema);
