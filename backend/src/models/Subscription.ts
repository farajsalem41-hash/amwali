import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISubscriptionPaymentProof {
  fileId: Types.ObjectId;
  amount: number;
  transactionNumber?: string;
  submittedAt: Date;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewedBy?: Types.ObjectId;
  reviewNote?: string;
}

export interface ISubscription extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  planId: Types.ObjectId;
  planCode: string;
  status: 'pending_payment' | 'active' | 'expired' | 'cancelled';
  price: number;
  startsAt?: Date;
  endsAt?: Date;
  autoRenew: boolean;
  proofs: ISubscriptionPaymentProof[];
  lastPaymentAt?: Date;
  requestedPlanId?: Types.ObjectId;
  changeRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  changeRequestedAt?: Date;
  createdAt: Date;
}

const proofSchema = new Schema<ISubscriptionPaymentProof>(
  {
    fileId: { type: Schema.Types.ObjectId, ref: 'StoredFile', required: true },
    amount: { type: Number, required: true },
    transactionNumber: String,
    submittedAt: { type: Date, default: Date.now },
    reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewNote: String,
  },
  { _id: true }
);

const subscriptionSchema = new Schema<ISubscription>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    planCode: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending_payment', 'active', 'expired', 'cancelled'],
      default: 'pending_payment',
      index: true,
    },
    price: { type: Number, required: true },
    startsAt: Date,
    endsAt: Date,
    autoRenew: { type: Boolean, default: false },
    proofs: { type: [proofSchema], default: [] },
    lastPaymentAt: Date,
    requestedPlanId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    changeRequestStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    changeRequestedAt: Date,
  },
  { timestamps: true }
);

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
