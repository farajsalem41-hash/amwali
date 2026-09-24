import mongoose, { Schema, Document, Types } from 'mongoose';

/** Extensible payment destination — bank today, e-wallet later (provider field). */
export interface IPaymentAccount extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  type: 'bank' | 'wallet';
  provider: string;
  bankLogo?: string;
  accountHolder: string;
  accountNumber?: string;
  iban?: string;
  walletIdentifier?: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
}

const paymentAccountSchema = new Schema<IPaymentAccount>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    type: { type: String, enum: ['bank', 'wallet'], default: 'bank' },
    provider: { type: String, required: true, trim: true },
    bankLogo: String,
    accountHolder: { type: String, required: true, trim: true },
    accountNumber: String,
    iban: String,
    walletIdentifier: String,
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const PaymentAccount = mongoose.model<IPaymentAccount>('PaymentAccount', paymentAccountSchema);
