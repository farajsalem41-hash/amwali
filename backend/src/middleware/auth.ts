import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { User, Employee, Merchant } from '../models';
import { verifyAccessToken } from '../utils/jwt';
import { ApiError } from '../utils/errors';
import { asyncHandler } from '../utils/async';
import { ACCOUNT_TYPE_FEATURES, AccountType, Permission, PERMISSIONS, ROLE_PERMISSIONS } from '../config/constants';

export interface AuthContext {
  userId: Types.ObjectId;
  fullName: string;
  phone: string;
  isOwner: boolean;
  isAdmin: boolean;
  adminRole?: string;
  adminPermissions: string[];
  merchantId?: Types.ObjectId;
  accountType?: AccountType;
  permissions: Permission[];
  branchIds: Types.ObjectId[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/** Authenticates the bearer token and builds the full authorization context. */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw ApiError.unauthorized('مطلوب تسجيل الدخول');
  let payload;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch {
    throw ApiError.unauthorized('الجلسة منتهية أو غير صالحة');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('الحساب غير متاح');

  const ctx: AuthContext = {
    userId: user._id,
    fullName: user.fullName,
    phone: user.phone,
    isOwner: false,
    isAdmin: user.isAdmin,
    adminRole: user.adminRole,
    adminPermissions: user.adminPermissions || [],
    permissions: [],
    branchIds: [],
  };

  if (user.isAdmin) {
    req.auth = ctx;
    return next();
  }

  if (!user.merchantId) throw ApiError.forbidden('لا يوجد حساب تجاري مرتبط');
  const merchant = await Merchant.findById(user.merchantId);
  if (!merchant || !merchant.isActive) throw ApiError.forbidden('الحساب معطل');

  ctx.merchantId = merchant._id;
  ctx.accountType = merchant.accountType;

  if (user.employeeId) {
    const employee = await Employee.findById(user.employeeId);
    if (!employee || !employee.isActive) throw ApiError.forbidden('حساب الموظف معطل');
    ctx.permissions =
      employee.role === 'custom'
        ? (employee.permissions.filter((p) => (PERMISSIONS as readonly string[]).includes(p)) as Permission[])
        : ROLE_PERMISSIONS[employee.role];
    ctx.branchIds = employee.branchIds || [];
  } else {
    ctx.isOwner = true;
    ctx.permissions = [...PERMISSIONS];
  }

  req.auth = ctx;
  next();
});

export function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw ApiError.unauthorized();
  return req.auth;
}

/** Returns the merchant scope, guaranteeing merchant isolation on every query. */
export function merchantScope(req: Request): { merchantId: Types.ObjectId } {
  const auth = requireAuth(req);
  if (!auth.merchantId) throw ApiError.forbidden('هذه العملية للتجار فقط');
  return { merchantId: auth.merchantId };
}

export function requirePermission(...perms: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = requireAuth(req);
    if (auth.isAdmin) return next();
    const ok = perms.some((p) => auth.permissions.includes(p));
    if (!ok) return next(ApiError.forbidden('لا تملك صلاحية لهذه العملية'));
    next();
  };
}

export function requireFeature(feature: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = requireAuth(req);
    if (auth.isAdmin) return next();
    if (!auth.accountType) return next(ApiError.forbidden());
    if (!ACCOUNT_TYPE_FEATURES[auth.accountType].includes(feature)) {
      return next(ApiError.forbidden('هذه الخاصية غير متاحة لنوع حسابك'));
    }
    next();
  };
}

export function requireAdmin(...perms: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = requireAuth(req);
    if (!auth.isAdmin) return next(ApiError.forbidden('لوحة الإدارة فقط'));
    if (auth.adminRole === 'super_admin') return next();
    if (perms.length && !perms.some((p) => auth.adminPermissions.includes(p))) {
      return next(ApiError.forbidden('لا تملك صلاحية إدارية لهذه العملية'));
    }
    next();
  };
}
