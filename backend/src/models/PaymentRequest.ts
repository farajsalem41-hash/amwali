import mongoose, { Schema, Document, Types } from 'mongoose';
import { PAYMENT_REQUEST_STATUSES, PaymentRequestStatus } from '../config/constants';

export interface IPaymentRequest extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  branchId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  customerId: Types.ObjectId;
  requestNumber: string;
  externalReference?: string;
  originalAmount: number;
  discountType: 'none' | 'fixed' | 'percentage';
  discountValue: number;
  discountAmount: number;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: string;
  description?: string;
  paymentAccountIds: Types.ObjectId[];
  publicToken: string;
  status: PaymentRequestStatus;
  expiresAt?: Date;
  firstOpenedAt?: Date;
  invoiceId?: Types.ObjectId;
  orderId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paymentRequestSchema = new Schema<IPaymentRequest>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    requestNumber: { type: String, required: true },
    externalReference: String,
    originalAmount: { type: Number, required: true, min: 0 },
    discountType: { type: String, enum: ['none', 'fixed', 'percentage'], default: 'none' },
    discountValue: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    finalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    remainingAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'LYD' },
    description: { type: String, maxlength: 1000 },
    paymentAccountIds: [{ type: Schema.Types.ObjectId, ref: 'PaymentAccount' }],
    publicToken: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: PAYMENT_REQUEST_STATUSES, default: 'pending_payment', index: true },
    expiresAt: { type: Date, index: true },
    firstOpenedAt: Date,
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  },
  { timestamps: true }
);

paymentRequestSchema.index({ merchantId: 1, requestNumber: 1 }, { unique: true });
paymentRequestSchema.index({ merchantId: 1, createdAt: -1 });
paymentRequestSchema.index({ merchantId: 1, status: 1 });

export const PaymentRequest = mongoose.model<IPaymentRequest>('PaymentRequest', paymentRequestSchema);
