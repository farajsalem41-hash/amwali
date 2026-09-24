import mongoose, { Schema, Document, Types } from 'mongoose';
import { NOTIFICATION_TYPES, NotificationType } from '../config/constants';

export interface INotification extends Document {
  _id: Types.ObjectId;
  merchantId?: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string;
  resource?: string;
  resourceId?: Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: String,
    resource: String,
    resourceId: Schema.Types.ObjectId,
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
