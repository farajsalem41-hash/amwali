import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  paymentRequestId: Types.ObjectId;
  customerId: Types.ObjectId;
  amount: number;
  method: 'bank_transfer' | 'cash' | 'wallet';
  paymentAccountId?: Types.ObjectId;
  transactionNumber?: string;
  transferredAt?: Date;
  senderName?: string;
  proofId?: Types.ObjectId;
  confirmedBy: Types.ObjectId;
  note?: string;
  createdAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    paymentRequestId: { type: Schema.Types.ObjectId, ref: 'PaymentRequest', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: ['bank_transfer', 'cash', 'wallet'], default: 'bank_transfer' },
    paymentAccountId: { type: Schema.Types.ObjectId, ref: 'PaymentAccount' },
    transactionNumber: { type: String, index: true },
    transferredAt: Date,
    senderName: String,
    proofId: { type: Schema.Types.ObjectId, ref: 'PaymentProof' },
    confirmedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

paymentSchema.index({ merchantId: 1, createdAt: -1 });

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
