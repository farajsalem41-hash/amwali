import { z } from 'zod';

export const updateMerchantSchema = z.object({
  businessName: z.string().min(2).max(160).optional(),
  phone: z.string().max(20).optional(),
  city: z.string().max(80).optional(),
  address: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  whatsapp: z.string().max(30).optional(),
  facebook: z.string().max(200).optional(),
  instagram: z.string().max(200).optional(),
  tiktok: z.string().max(200).optional(),
  website: z.string().max(200).optional(),
  commercialRegister: z.string().max(80).optional(),
  taxNumber: z.string().max(80).optional(),
});

export const paymentAccountSchema = z.object({
  type: z.enum(['bank', 'wallet']).default('bank'),
  provider: z.string().min(2, 'اسم البنك مطلوب').max(120),
  bankLogo: z.string().max(300).optional(),
  accountHolder: z.string().min(2, 'اسم صاحب الحساب مطلوب').max(160),
  accountNumber: z.string().max(60).optional(),
  iban: z.string().max(60).optional(),
  walletIdentifier: z.string().max(60).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const branchSchema = z.object({
  name: z.string().min(2).max(120),
  address: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  phone: z.string().max(20).optional(),
  location: z.object({ lat: z.number().optional(), lng: z.number().optional() }).optional(),
  isActive: z.boolean().optional(),
});

export const employeeSchema = z.object({
  fullName: z.string().min(3).max(120),
  phone: z.string().min(6).max(20),
  password: z.string().min(8).max(72).optional(),
  role: z.enum(['manager', 'accountant', 'cashier', 'custom']),
  permissions: z.array(z.string()).optional(),
  branchIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const productSchema = z.object({
  name: z.string().min(2).max(160),
  kind: z.enum(['product', 'service']).default('product'),
  sku: z.string().max(60).optional(),
  price: z.number().min(0),
  unit: z.string().max(30).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const courierSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(6).max(20),
  area: z.string().max(120).optional(),
  isActive: z.boolean().optional(),
});
