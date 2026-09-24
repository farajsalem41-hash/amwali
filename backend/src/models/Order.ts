import mongoose, { Schema, Document, Types } from 'mongoose';
import { DELIVERY_STATUSES, DeliveryStatus } from '../config/constants';

export interface IOrderItem {
  name: string;
  productId?: Types.ObjectId;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  orderNumber: string;
  customerId: Types.ObjectId;
  city?: string;
  address?: string;
  location?: { lat?: number; lng?: number };
  items: IOrderItem[];
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  deliveryNotes?: string;
  courierId?: Types.ObjectId;
  courierToken: string;
  deliveryStatus: DeliveryStatus;
  paymentRequestId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    name: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    orderNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    city: String,
    address: String,
    location: { lat: Number, lng: Number },
    items: { type: [orderItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    remainingAmount: { type: Number, default: 0, min: 0 },
    deliveryNotes: String,
    courierId: { type: Schema.Types.ObjectId, ref: 'Courier' },
    courierToken: { type: String, required: true, unique: true, index: true },
    deliveryStatus: { type: String, enum: DELIVERY_STATUSES, default: 'new', index: true },
    paymentRequestId: { type: Schema.Types.ObjectId, ref: 'PaymentRequest' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

orderSchema.index({ merchantId: 1, orderNumber: 1 }, { unique: true });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
