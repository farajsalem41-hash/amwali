import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProduct extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  name: string;
  kind: 'product' | 'service';
  sku?: string;
  price: number;
  unit?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['product', 'service'], default: 'product' },
    sku: String,
    price: { type: Number, required: true, min: 0 },
    unit: String,
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Product = mongoose.model<IProduct>('Product', productSchema);
