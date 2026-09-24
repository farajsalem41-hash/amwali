import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStoredFile extends Document {
  _id: Types.ObjectId;
  merchantId?: Types.ObjectId;
  kind: 'logo' | 'proof' | 'ticket' | 'subscription_proof';
  storedName: string;
  originalName: string;
  mimeType: string;
  size: number;
  isPublic: boolean;
  uploadedBy?: Types.ObjectId;
  createdAt: Date;
}

const storedFileSchema = new Schema<IStoredFile>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', index: true },
    kind: { type: String, enum: ['logo', 'proof', 'ticket', 'subscription_proof'], required: true },
    storedName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    isPublic: { type: Boolean, default: false },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const StoredFile = mongoose.model<IStoredFile>('StoredFile', storedFileSchema);
