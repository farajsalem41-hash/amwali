import mongoose, { Schema, Document, Types } from 'mongoose';
import { ACCOUNT_TYPES, AccountType, ADMIN_ROLES, AdminRole } from '../config/constants';

export interface IUser extends Document {
  _id: Types.ObjectId;
  fullName: string;
  phone: string;
  passwordHash: string;
  accountType?: AccountType;
  merchantId?: Types.ObjectId;
  employeeId?: Types.ObjectId;
  isAdmin: boolean;
  adminRole?: AdminRole;
  adminPermissions: string[];
  phoneVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, unique: true, index: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    accountType: { type: String, enum: ACCOUNT_TYPES },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    isAdmin: { type: Boolean, default: false, index: true },
    adminRole: { type: String, enum: ADMIN_ROLES },
    adminPermissions: { type: [String], default: [] },
    phoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
