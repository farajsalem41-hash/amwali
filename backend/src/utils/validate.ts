import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from './errors';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(
        ApiError.badRequest(
          'بيانات غير صالحة',
          parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        )
      );
    }
    req.body = parsed.data as never;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return next(
        ApiError.badRequest(
          'مدخلات بحث غير صالحة',
          parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        )
      );
    }
    (req as unknown as { validatedQuery: T }).validatedQuery = parsed.data;
    next();
  };
}
