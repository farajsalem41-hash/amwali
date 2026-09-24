import mongoose, { Schema, Document, Types } from 'mongoose';
import { PROOF_MATCH_RESULTS, PROOF_REVIEW_STATUSES } from '../config/constants';

export interface IPaymentProof extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  paymentRequestId: Types.ObjectId;
  customerId: Types.ObjectId;
  fileId: Types.ObjectId;
  declaredAmount?: number;
  declaredBank?: string;
  declaredTransactionNumber?: string;
  declaredTransferDate?: Date;
  declaredSender?: string;
  targetPaymentAccountId?: Types.ObjectId;
  /** Automatic (rule based / future OCR) matching outcome — never a final confirmation. */
  matchResult: (typeof PROOF_MATCH_RESULTS)[number];
  matchReasons: string[];
  reviewStatus: (typeof PROOF_REVIEW_STATUSES)[number];
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  paymentId?: Types.ObjectId;
  uploadedFromIp?: string;
  createdAt: Date;
}

const paymentProofSchema = new Schema<IPaymentProof>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    paymentRequestId: { type: Schema.Types.ObjectId, ref: 'PaymentRequest', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    fileId: { type: Schema.Types.ObjectId, ref: 'StoredFile', required: true },
    declaredAmount: Number,
    declaredBank: String,
    declaredTransactionNumber: { type: String, index: true },
    declaredTransferDate: Date,
    declaredSender: String,
    targetPaymentAccountId: { type: Schema.Types.ObjectId, ref: 'PaymentAccount' },
    matchResult: { type: String, enum: PROOF_MATCH_RESULTS, default: 'needs_review' },
    matchReasons: { type: [String], default: [] },
    reviewStatus: { type: String, enum: PROOF_REVIEW_STATUSES, default: 'pending', index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectionReason: String,
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    uploadedFromIp: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PaymentProof = mongoose.model<IPaymentProof>('PaymentProof', paymentProofSchema);
