import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, Merchant, Otp, Employee, Subscription, SubscriptionPlan } from '../models';
import { env } from '../config/env';
import { ApiError } from '../utils/errors';
import { asyncHandler } from '../utils/async';
import { normalizePhone } from '../utils/phone';
import { randomNumericCode, randomToken, sha256 } from '../utils/tokens';
import { signAccessToken } from '../utils/jwt';
import { audit } from '../services/audit.service';
import { ACCOUNT_TYPE_FEATURES, PERMISSIONS, ROLE_PERMISSIONS } from '../config/constants';

const GENERIC_OTP_RESPONSE = { message: 'إذا كان الرقم صالحًا فسيتم إرسال رمز التحقق' };

async function issueOtp(phone: string, purpose: 'register' | 'reset_password', payload?: Record<string, unknown>) {
  await Otp.updateMany({ phone, purpose, consumed: false }, { $set: { consumed: true } });
  const code = randomNumericCode(6);
  await Otp.create({
    phone,
    purpose,
    codeHash: sha256(code),
    payload,
    expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000),
  });
  // A real SMS provider plugs in here. In development the code is returned for testing.
  return code;
}

function sessionPayload(user: { _id: unknown; fullName: string; phone: string; merchantId?: unknown; isAdmin: boolean }) {
  return {
    id: String(user._id),
    fullName: user.fullName,
    phone: user.phone,
    isAdmin: user.isAdmin,
  };
}

/** Step 1-3 of registration are collected client side; this starts phone verification (step 4). */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    fullName: string;
    phone: string;
    password: string;
    accountType: string;
    businessName: string;
    [key: string]: unknown;
  };
  const phone = normalizePhone(body.phone);

  const existing = await User.findOne({ phone });
  if (existing) throw ApiError.conflict('رقم الهاتف مستخدم مسبقًا');

  const passwordHash = await bcrypt.hash(body.password, 12);
  const code = await issueOtp(phone, 'register', {
    fullName: body.fullName,
    passwordHash,
    accountType: body.accountType,
    businessName: body.businessName,
    city: body.city,
    address: body.address,
    description: body.description,
    whatsapp: body.whatsapp,
    facebook: body.facebook,
    instagram: body.instagram,
    tiktok: body.tiktok,
    website: body.website,
    commercialRegister: body.commercialRegister,
    taxNumber: body.taxNumber,
    phoneFromForm: body.phone,
  });

  res.status(201).json({
    message: 'تم إرسال رمز التحقق إلى رقم هاتفك',
    phone,
    ...(env.OTP_DEV_MODE ? { devCode: code } : {}),
  });
});

export const resendOtp = asyncHandler(async (req: Request, res: Response) => {
  const phone = normalizePhone(String(req.body.phone || ''));
  const purpose = (req.body.purpose === 'reset_password' ? 'reset_password' : 'register') as
    | 'register'
    | 'reset_password';
  const last = await Otp.findOne({ phone, purpose }).sort({ createdAt: -1 });
  if (!last) return res.json(GENERIC_OTP_RESPONSE);
  const code = await issueOtp(phone, purpose, last.payload as Record<string, unknown>);
  res.json({ ...GENERIC_OTP_RESPONSE, ...(env.OTP_DEV_MODE ? { devCode: code } : {}) });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code: string; purpose: 'register' | 'reset_password' };
  const purpose = req.body.purpose || 'register';
  const phone = normalizePhone(req.body.phone);

  const otp = await Otp.findOne({ phone, purpose, consumed: false }).sort({ createdAt: -1 });
  if (!otp) throw ApiError.badRequest('رمز غير صالح أو منتهي');
  if (otp.expiresAt.getTime() < Date.now()) throw ApiError.badRequest('انتهت صلاحية الرمز، اطلب رمزًا جديدًا');
  if (otp.attempts >= env.OTP_MAX_ATTEMPTS) throw ApiError.tooMany('تم تجاوز عدد المحاولات، اطلب رمزًا جديدًا');

  if (otp.codeHash !== sha256(code)) {
    otp.attempts += 1;
    await otp.save();
    throw ApiError.badRequest('الرمز غير صحيح');
  }

  otp.consumed = true;

  if (purpose === 'reset_password') {
    const resetToken = randomToken(48);
    otp.payload = { ...(otp.payload || {}), resetTokenHash: sha256(resetToken) };
    otp.consumed = false; // reused once by reset-password, then consumed there
    otp.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await otp.save();
    return res.json({ message: 'تم التحقق، يمكنك تعيين كلمة مرور جديدة', resetToken });
  }

  await otp.save();

  const payload = (otp.payload || {}) as Record<string, string>;
  const already = await User.findOne({ phone });
  if (already) throw ApiError.conflict('رقم الهاتف مستخدم مسبقًا');

  const user = await User.create({
    fullName: payload.fullName,
    phone,
    passwordHash: payload.passwordHash,
    accountType: payload.accountType,
    phoneVerified: true,
  });

  const merchant = await Merchant.create({
    ownerId: user._id,
    accountType: payload.accountType,
    businessName: payload.businessName,
    phone,
    city: payload.city,
    address: payload.address,
    description: payload.description,
    whatsapp: payload.whatsapp,
    facebook: payload.facebook,
    instagram: payload.instagram,
    tiktok: payload.tiktok,
    website: payload.website,
    commercialRegister: payload.commercialRegister,
    taxNumber: payload.taxNumber,
  });

  user.merchantId = merchant._id;
  await user.save();

  // Every new merchant starts on the free plan. Upgrades are reviewed manually.
  const freePlan = await SubscriptionPlan.findOne({ code: 'free' });
  if (freePlan) {
    await Subscription.create({
      merchantId: merchant._id,
      planId: freePlan._id,
      planCode: freePlan.code,
      status: 'active',
      price: freePlan.price,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + freePlan.billingPeriodDays * 86400000),
      autoRenew: true,
    });
  }

  const token = signAccessToken({ sub: user._id.toString(), merchantId: merchant._id.toString() });
  await audit(req, {
    action: 'auth.register',
    resource: 'user',
    resourceId: user._id.toString(),
    merchantId: merchant._id,
  });

  res.status(201).json({
    token,
    user: sessionPayload(user),
    merchant: {
      id: merchant._id,
      businessName: merchant.businessName,
      accountType: merchant.accountType,
      features: ACCOUNT_TYPE_FEATURES[merchant.accountType],
    },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const phone = normalizePhone(req.body.phone);
  const { password, rememberMe } = req.body as { password: string; rememberMe?: boolean };

  const user = await User.findOne({ phone }).select('+passwordHash');
  const invalid = ApiError.unauthorized('رقم الهاتف أو كلمة المرور غير صحيحة');
  if (!user) throw invalid;
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw ApiError.tooMany('تم إيقاف الحساب مؤقتًا بسبب محاولات فاشلة، حاول بعد قليل');
  }
  if (!user.isActive) throw ApiError.forbidden('الحساب معطل، تواصل مع الدعم');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= 8) {
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    await audit(req, { action: 'auth.login_failed', resource: 'user', resourceId: user._id.toString() });
    throw invalid;
  }

  user.failedLoginAttempts = 0;
  user.lastLoginAt = new Date();
  await user.save();

  const token = signAccessToken(
    { sub: user._id.toString(), merchantId: user.merchantId?.toString(), isAdmin: user.isAdmin },
    rememberMe ? '30d' : env.JWT_EXPIRES_IN
  );
  await audit(req, { action: 'auth.login', resource: 'user', resourceId: user._id.toString() });

  let merchantInfo = null;
  if (user.merchantId) {
    const merchant = await Merchant.findById(user.merchantId);
    if (merchant) {
      merchantInfo = {
        id: merchant._id,
        businessName: merchant.businessName,
        accountType: merchant.accountType,
        features: ACCOUNT_TYPE_FEATURES[merchant.accountType],
      };
    }
  }

  res.json({ token, user: sessionPayload(user), merchant: merchantInfo });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const phone = normalizePhone(req.body.phone);
  const user = await User.findOne({ phone });
  // Never reveal whether the phone exists.
  if (!user) return res.json(GENERIC_OTP_RESPONSE);
  const code = await issueOtp(phone, 'reset_password');
  res.json({ ...GENERIC_OTP_RESPONSE, ...(env.OTP_DEV_MODE ? { devCode: code } : {}) });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const phone = normalizePhone(req.body.phone);
  const { resetToken, password } = req.body as { resetToken: string; password: string };

  const otp = await Otp.findOne({ phone, purpose: 'reset_password', consumed: false }).sort({ createdAt: -1 });
  if (!otp) throw ApiError.badRequest('الرابط غير صالح، أعد العملية');
  if (otp.expiresAt.getTime() < Date.now()) throw ApiError.badRequest('انتهت الصلاحية، أعد العملية');
  const hash = (otp.payload as Record<string, string> | undefined)?.resetTokenHash;
  if (!hash || hash !== sha256(resetToken)) throw ApiError.badRequest('الرابط غير صالح، أعد العملية');

  const user = await User.findOne({ phone }).select('+passwordHash');
  if (!user) throw ApiError.badRequest('الرابط غير صالح، أعد العملية');

  user.passwordHash = await bcrypt.hash(password, 12);
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  await user.save();

  otp.consumed = true;
  await otp.save();

  await audit(req, { action: 'auth.password_reset', resource: 'user', resourceId: user._id.toString() });
  res.json({ message: 'تم تحديث كلمة المرور، يمكنك تسجيل الدخول' });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.auth!;
  const { currentPassword, password } = req.body as { currentPassword: string; password: string };
  const user = await User.findById(auth.userId).select('+passwordHash');
  if (!user) throw ApiError.unauthorized();
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw ApiError.badRequest('كلمة المرور الحالية غير صحيحة');
  user.passwordHash = await bcrypt.hash(password, 12);
  await user.save();
  await audit(req, { action: 'auth.password_changed', resource: 'user', resourceId: user._id.toString() });
  res.json({ message: 'تم تحديث كلمة المرور' });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.auth!;
  const user = await User.findById(auth.userId);
  if (!user) throw ApiError.unauthorized();

  let merchant = null;
  if (auth.merchantId) {
    const m = await Merchant.findById(auth.merchantId);
    if (m) {
      merchant = {
        id: m._id,
        businessName: m.businessName,
        accountType: m.accountType,
        logoFileId: m.logoFileId,
        features: ACCOUNT_TYPE_FEATURES[m.accountType],
      };
    }
  }

  let employee = null;
  if (user.employeeId) {
    const e = await Employee.findById(user.employeeId);
    if (e) employee = { id: e._id, role: e.role, branchIds: e.branchIds };
  }

  res.json({
    user: sessionPayload(user),
    merchant,
    employee,
    isOwner: auth.isOwner,
    adminRole: auth.adminRole,
    permissions: auth.isAdmin ? [...PERMISSIONS] : auth.permissions,
    rolePermissions: employee ? ROLE_PERMISSIONS[employee.role as 'manager'] : undefined,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await audit(req, { action: 'auth.logout', resource: 'user', resourceId: req.auth?.userId.toString() });
  res.json({ message: 'تم تسجيل الخروج' });
});
