import mongoose, { Schema, Document, Types } from 'mongoose';
import { INVOICE_STATUSES } from '../config/constants';

export interface IInvoiceItem {
  name: string;
  productId?: Types.ObjectId;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface IInvoice extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  branchId?: Types.ObjectId;
  customerId: Types.ObjectId;
  invoiceNumber: string;
  items: IInvoiceItem[];
  subtotal: number;
  discountType: 'none' | 'fixed' | 'percentage';
  discountValue: number;
  discountAmount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  notes?: string;
  dueDate?: Date;
  status: (typeof INVOICE_STATUSES)[number];
  paymentRequestId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const invoiceItemSchema = new Schema<IInvoiceItem>(
  {
    name: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    invoiceNumber: { type: String, required: true },
    items: { type: [invoiceItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    discountType: { type: String, enum: ['none', 'fixed', 'percentage'], default: 'none' },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    total: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    notes: String,
    dueDate: Date,
    status: { type: String, enum: INVOICE_STATUSES, default: 'unpaid', index: true },
    paymentRequestId: { type: Schema.Types.ObjectId, ref: 'PaymentRequest' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

invoiceSchema.index({ merchantId: 1, invoiceNumber: 1 }, { unique: true });

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
