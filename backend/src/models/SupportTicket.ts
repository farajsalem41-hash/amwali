import mongoose, { Schema, Document, Types } from 'mongoose';
import { TICKET_STATUSES } from '../config/constants';

export interface ITicketMessage {
  authorId: Types.ObjectId;
  authorLabel: string;
  isStaff: boolean;
  body: string;
  attachmentIds: Types.ObjectId[];
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  _id: Types.ObjectId;
  ticketNumber: string;
  merchantId?: Types.ObjectId;
  userId: Types.ObjectId;
  category: 'technical' | 'payment' | 'account' | 'subscription' | 'other';
  subject: string;
  description: string;
  attachmentIds: Types.ObjectId[];
  assignedTo?: Types.ObjectId;
  status: (typeof TICKET_STATUSES)[number];
  messages: ITicketMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ticketMessageSchema = new Schema<ITicketMessage>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorLabel: { type: String, required: true },
    isStaff: { type: Boolean, default: false },
    body: { type: String, required: true },
    attachmentIds: [{ type: Schema.Types.ObjectId, ref: 'StoredFile' }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketNumber: { type: String, required: true, unique: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: ['technical', 'payment', 'account', 'subscription', 'other'], default: 'other' },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    attachmentIds: [{ type: Schema.Types.ObjectId, ref: 'StoredFile' }],
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: TICKET_STATUSES, default: 'open', index: true },
    messages: { type: [ticketMessageSchema], default: [] },
  },
  { timestamps: true }
);

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', supportTicketSchema);
