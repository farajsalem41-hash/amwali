import { Request, Response } from 'express';
import { Merchant, PaymentAccount } from '../models';
import { merchantScope } from '../middleware/auth';
import { ApiError } from '../utils/errors';
import { asyncHandler } from '../utils/async';
import { audit } from '../services/audit.service';
import { ACCOUNT_TYPE_FEATURES } from '../config/constants';

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const merchant = await Merchant.findById(scope.merchantId);
  if (!merchant) throw ApiError.notFound('الحساب غير موجود');
  res.json({ merchant, features: ACCOUNT_TYPE_FEATURES[merchant.accountType] });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const merchant = await Merchant.findById(scope.merchantId);
  if (!merchant) throw ApiError.notFound('الحساب غير موجود');

  const body = req.body as Record<string, string | undefined>;
  const editable = [
    'businessName',
    'phone',
    'city',
    'address',
    'description',
    'whatsapp',
    'facebook',
    'instagram',
    'tiktok',
    'website',
  ];
  for (const key of editable) if (body[key] !== undefined) (merchant as never as Record<string, unknown>)[key] = body[key];

  if (merchant.accountType === 'store' || merchant.accountType === 'company') {
    if (body.commercialRegister !== undefined) merchant.commercialRegister = body.commercialRegister;
    if (body.taxNumber !== undefined) merchant.taxNumber = body.taxNumber;
  }

  await merchant.save();
  await audit(req, { action: 'merchant.updated', resource: 'merchant', resourceId: merchant._id.toString() });
  res.json({ merchant });
});

export const listPaymentAccounts = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const accounts = await PaymentAccount.find(scope).sort({ isDefault: -1, createdAt: 1 });
  res.json({ accounts });
});

export const createPaymentAccount = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const body = req.body as Record<string, unknown>;
  if (!body.accountNumber && !body.iban && !body.walletIdentifier) {
    throw ApiError.badRequest('أدخل رقم الحساب أو الـIBAN');
  }
  const count = await PaymentAccount.countDocuments(scope);
  const account = await PaymentAccount.create({
    ...body,
    merchantId: scope.merchantId,
    isDefault: count === 0 ? true : Boolean(body.isDefault),
  });
  if (account.isDefault) {
    await PaymentAccount.updateMany({ ...scope, _id: { $ne: account._id } }, { $set: { isDefault: false } });
  }
  await audit(req, { action: 'payment_account.created', resource: 'payment_account', resourceId: account._id.toString() });
  res.status(201).json({ account });
});

export const updatePaymentAccount = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const account = await PaymentAccount.findOne({ _id: req.params.id, ...scope });
  if (!account) throw ApiError.notFound('الحساب البنكي غير موجود');

  const body = req.body as Record<string, unknown>;
  const editable = ['provider', 'bankLogo', 'accountHolder', 'accountNumber', 'iban', 'walletIdentifier', 'isActive', 'type'];
  for (const key of editable) if (body[key] !== undefined) (account as never as Record<string, unknown>)[key] = body[key];

  if (body.isDefault === true) {
    account.isDefault = true;
    account.isActive = true;
    await PaymentAccount.updateMany({ ...scope, _id: { $ne: account._id } }, { $set: { isDefault: false } });
  }
  if (account.isDefault && account.isActive === false) account.isDefault = false;

  await account.save();
  await audit(req, { action: 'payment_account.updated', resource: 'payment_account', resourceId: account._id.toString() });
  res.json({ account });
});

export const setDefaultPaymentAccount = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const account = await PaymentAccount.findOne({ _id: req.params.id, ...scope });
  if (!account) throw ApiError.notFound('الحساب البنكي غير موجود');
  await PaymentAccount.updateMany(scope, { $set: { isDefault: false } });
  account.isDefault = true;
  account.isActive = true;
  await account.save();
  await audit(req, { action: 'payment_account.set_default', resource: 'payment_account', resourceId: account._id.toString() });
  res.json({ account });
});

export const deletePaymentAccount = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const account = await PaymentAccount.findOne({ _id: req.params.id, ...scope });
  if (!account) throw ApiError.notFound('الحساب البنكي غير موجود');
  await account.deleteOne();
  if (account.isDefault) {
    const next = await PaymentAccount.findOne({ ...scope, isActive: true }).sort({ createdAt: 1 });
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }
  await audit(req, { action: 'payment_account.deleted', resource: 'payment_account', resourceId: account._id.toString() });
  res.json({ message: 'تم حذف الحساب' });
});
