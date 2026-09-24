import mongoose, { Schema, Document, Types } from 'mongoose';
import { EMPLOYEE_ROLES, EmployeeRole } from '../config/constants';

export interface IEmployee extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  userId: Types.ObjectId;
  fullName: string;
  phone: string;
  role: EmployeeRole;
  permissions: string[];
  branchIds: Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
}

const employeeSchema = new Schema<IEmployee>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, enum: EMPLOYEE_ROLES, required: true },
    permissions: { type: [String], default: [] },
    branchIds: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Employee = mongoose.model<IEmployee>('Employee', employeeSchema);
