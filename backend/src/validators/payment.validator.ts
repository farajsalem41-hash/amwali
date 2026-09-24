import { z } from 'zod';
import { DELIVERY_STATUSES } from '../config/constants';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'معرف غير صالح');

export const createPaymentRequestSchema = z.object({
  customer: z.object({
    name: z.string().min(2, 'اسم العميل مطلوب').max(120),
    phone: z.string().min(6, 'رقم هاتف العميل مطلوب').max(20),
    city: z.string().max(80).optional(),
    address: z.string().max(200).optional(),
  }),
  originalAmount: z.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  discountType: z.enum(['none', 'fixed', 'percentage']).default('none'),
  discountValue: z.number().min(0).default(0),
  description: z.string().max(1000).optional(),
  externalReference: z.string().max(80).optional(),
  paymentAccountIds: z.array(objectId).min(1, 'اختر حسابًا بنكيًا واحدًا على الأقل'),
  branchId: objectId.optional(),
  expiresAt: z.string().datetime().optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const updatePaymentRequestSchema = z.object({
  description: z.string().max(1000).optional(),
  originalAmount: z.number().positive().optional(),
  discountType: z.enum(['none', 'fixed', 'percentage']).optional(),
  discountValue: z.number().min(0).optional(),
  paymentAccountIds: z.array(objectId).min(1).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  branchId: objectId.nullable().optional(),
});

export const addPaymentSchema = z.object({
  amount: z.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  method: z.enum(['bank_transfer', 'cash', 'wallet']).default('bank_transfer'),
  paymentAccountId: objectId.optional(),
  transactionNumber: z.string().max(80).optional(),
  transferredAt: z.string().datetime().optional(),
  senderName: z.string().max(120).optional(),
  proofId: objectId.optional(),
  note: z.string().max(300).optional(),
});

export const reviewProofSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  amount: z.number().positive().optional(),
  reason: z.string().max(300).optional(),
});

// Proofs arrive as multipart/form-data, so numeric fields need coercion from strings.
export const publicProofSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  bankName: z.string().max(120).optional(),
  transactionNumber: z.string().max(80).optional(),
  transferDate: z.string().optional(),
  senderName: z.string().max(120).optional(),
  paymentAccountId: objectId.optional(),
});

export const invoiceSchema = z.object({
  customer: z.object({
    name: z.string().min(2).max(120),
    phone: z.string().min(6).max(20),
  }),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(160),
        productId: objectId.optional(),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0),
      })
    )
    .min(1, 'أضف بندًا واحدًا على الأقل'),
  discountType: z.enum(['none', 'fixed', 'percentage']).default('none'),
  discountValue: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
  dueDate: z.string().optional(),
  branchId: objectId.optional(),
  createPaymentRequest: z.boolean().default(true),
  paymentAccountIds: z.array(objectId).optional(),
});

export const orderSchema = z.object({
  customer: z.object({
    name: z.string().min(2).max(120),
    phone: z.string().min(6).max(20),
    city: z.string().max(80).optional(),
    address: z.string().max(300).optional(),
  }),
  location: z.object({ lat: z.number().optional(), lng: z.number().optional() }).optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(160),
        productId: objectId.optional(),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0),
      })
    )
    .min(1, 'أضف منتجًا واحدًا على الأقل'),
  deliveryFee: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  deliveryNotes: z.string().max(500).optional(),
  courierId: objectId.optional(),
  createPaymentRequest: z.boolean().default(true),
  paymentAccountIds: z.array(objectId).optional(),
});

export const deliveryStatusSchema = z.object({
  deliveryStatus: z.enum(DELIVERY_STATUSES),
  reason: z.string().max(300).optional(),
});
