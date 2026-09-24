import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStatusHistory extends Document {
  _id: Types.ObjectId;
  merchantId?: Types.ObjectId;
  resource: 'payment_request' | 'order' | 'invoice' | 'support_ticket' | 'subscription';
  resourceId: Types.ObjectId;
  field: string;
  fromStatus?: string;
  toStatus: string;
  actorId?: Types.ObjectId;
  actorLabel?: string;
  reason?: string;
  createdAt: Date;
}

const statusHistorySchema = new Schema<IStatusHistory>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', index: true },
    resource: {
      type: String,
      enum: ['payment_request', 'order', 'invoice', 'support_ticket', 'subscription'],
      required: true,
    },
    resourceId: { type: Schema.Types.ObjectId, required: true, index: true },
    field: { type: String, default: 'status' },
    fromStatus: String,
    toStatus: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorLabel: String,
    reason: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const StatusHistory = mongoose.model<IStatusHistory>('StatusHistory', statusHistorySchema);
