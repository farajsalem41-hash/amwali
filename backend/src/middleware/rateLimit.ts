import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const skip = () => env.isTest;

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: { message: 'طلبات كثيرة، حاول لاحقًا', code: 'rate_limited' } },
});

export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  skip,
  message: { error: { message: 'محاولات كثيرة، حاول بعد قليل', code: 'rate_limited' } },
});

export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  skip,
  message: { error: { message: 'طلبات رمز كثيرة، حاول بعد قليل', code: 'rate_limited' } },
});

export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  skip,
  message: { error: { message: 'طلبات كثيرة، حاول لاحقًا', code: 'rate_limited' } },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  skip,
  message: { error: { message: 'رفع ملفات كثير، حاول لاحقًا', code: 'rate_limited' } },
});
