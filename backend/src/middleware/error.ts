import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';
import { env } from '../config/env';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { message: 'المسار غير موجود', code: 'not_found' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } });
  }
  const e = err as { name?: string; code?: number; message?: string; errors?: unknown };
  if (e?.name === 'ValidationError') {
    return res.status(400).json({ error: { message: 'بيانات غير صالحة', code: 'validation_error' } });
  }
  if (e?.name === 'CastError') {
    return res.status(400).json({ error: { message: 'معرف غير صالح', code: 'invalid_id' } });
  }
  if (e?.code === 11000) {
    return res.status(409).json({ error: { message: 'القيمة مستخدمة مسبقًا', code: 'duplicate' } });
  }
  if (!env.isTest) {
     
    console.error('[unhandled]', e?.message || err);
  }
  // Safe error message — never leak internals to the client.
  return res.status(400).json({ error: { message: 'حدث خطأ غير متوقع', code: 'internal_error' } });
}
