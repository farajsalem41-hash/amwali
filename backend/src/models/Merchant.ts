import mongoose, { Schema, Document, Types } from 'mongoose';
import { ACCOUNT_TYPES, AccountType } from '../config/constants';

export interface IMerchant extends Document {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  accountType: AccountType;
  businessName: string;
  logoFileId?: Types.ObjectId;
  phone?: string;
  city?: string;
  address?: string;
  description?: string;
  whatsapp?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  website?: string;
  commercialRegister?: string;
  taxNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const merchantSchema = new Schema<IMerchant>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accountType: { type: String, enum: ACCOUNT_TYPES, required: true },
    businessName: { type: String, required: true, trim: true, maxlength: 160 },
    logoFileId: { type: Schema.Types.ObjectId, ref: 'StoredFile' },
    phone: String,
    city: String,
    address: String,
    description: { type: String, maxlength: 1000 },
    whatsapp: String,
    facebook: String,
    instagram: String,
    tiktok: String,
    website: String,
    commercialRegister: String,
    taxNumber: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Merchant = mongoose.model<IMerchant>('Merchant', merchantSchema);
