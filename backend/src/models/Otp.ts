import mongoose, { Schema, Document } from 'mongoose';

export interface IOtp extends Document {
  phone: string;
  purpose: 'register' | 'reset_password' | 'login';
  codeHash: string;
  payload?: Record<string, unknown>;
  attempts: number;
  consumed: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    phone: { type: String, required: true, index: true },
    purpose: { type: String, enum: ['register', 'reset_password', 'login'], required: true },
    codeHash: { type: String, required: true },
    payload: Schema.Types.Mixed,
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const Otp = mongoose.model<IOtp>('Otp', otpSchema);
