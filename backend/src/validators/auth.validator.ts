import { z } from 'zod';
import { ACCOUNT_TYPES } from '../config/constants';
import { isValidLibyanPhone } from '../utils/phone';

const phone = z.string().min(6).max(20).refine(isValidLibyanPhone, 'رقم هاتف غير صالح');
const password = z
  .string()
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
  .max(72)
  .refine((v) => /[A-Za-z]/.test(v) || /[\u0600-\u06FF]/.test(v), 'كلمة المرور ضعيفة')
  .refine((v) => /\d/.test(v), 'يجب أن تحتوي كلمة المرور على رقم');

export const registerSchema = z
  .object({
    fullName: z.string().min(3, 'الاسم قصير').max(120),
    phone,
    password,
    confirmPassword: z.string(),
    accountType: z.enum(ACCOUNT_TYPES),
    businessName: z.string().min(2, 'اسم النشاط مطلوب').max(160),
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
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  });

export const verifyOtpSchema = z.object({
  phone,
  code: z.string().length(6, 'الرمز يجب أن يكون 6 أرقام'),
  purpose: z.enum(['register', 'reset_password']).default('register'),
});

export const loginSchema = z.object({
  phone,
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
  rememberMe: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({ phone });

export const resetPasswordSchema = z
  .object({
    phone,
    resetToken: z.string().min(10),
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  });
