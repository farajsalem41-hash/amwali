import { Request, Response } from 'express';
import { Types } from 'mongoose';
import QRCode from 'qrcode';
import {
  PaymentRequest,
  PaymentAccount,
  Payment,
  PaymentProof,
  StatusHistory,
  Customer,
  Branch,
} from '../models';
import { merchantScope, requireAuth } from '../middleware/auth';
import { ApiError } from '../utils/errors';
import { asyncHandler } from '../utils/async';
import { computeDiscount, round2 } from '../utils/money';
import { randomToken } from '../utils/tokens';
import { generateRequestNumber } from '../utils/numbering';
import { escapeRegex, meta, pagination } from '../utils/query';
import { upsertCustomer, recalcCustomerTotals } from '../services/customer.service';
import { recalcPaymentRequest, recordStatusChange } from '../services/paymentRequest.service';
import { audit } from '../services/audit.service';
import { notifyMerchant } from '../services/notification.service';
import { env } from '../config/env';

export function publicPaymentUrl(token: string): string {
  return `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/#/pay/${token}`;
}

export const listRequests = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const auth = requireAuth(req);
  const p = pagination(req.query as Record<string, unknown>);
  const q = req.query as Record<string, string>;

  const filter: Record<string, unknown> = { ...scope };
  if (q.status) filter.status = { $in: q.status.split(',') };
  if (q.branchId) filter.branchId = q.branchId;
  if (q.from || q.to) {
    const range: Record<string, Date> = {};
    if (q.from) range.$gte = new Date(q.from);
    if (q.to) {
      const to = new Date(q.to);
      to.setHours(23, 59, 59, 999);
      range.$lte = to;
    }
    filter.createdAt = range;
  }
  // Cashiers only see their own requests.
  if (!auth.isOwner && !auth.isAdmin && !auth.permissions.includes('payments.confirm') && auth.permissions.includes('payment_requests.create')) {
    filter.createdBy = auth.userId;
  }
  if (auth.branchIds.length) filter.$or = [{ branchId: { $in: auth.branchIds } }, { branchId: { $exists: false } }];

  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search.trim()), 'i');
    const customers = await Customer.find({ ...scope, $or: [{ name: rx }, { phone: rx }] }).select('_id');
    filter.$and = [
      {
        $or: [
          { requestNumber: rx },
          { externalReference: rx },
          { customerId: { $in: customers.map((c) => c._id) } },
        ],
      },
    ];
  }

  const [items, total] = await Promise.all([
    PaymentRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(p.skip)
      .limit(p.limit)
      .populate('customerId', 'name phone')
      .populate('branchId', 'name'),
    PaymentRequest.countDocuments(filter),
  ]);

  res.json({ items, meta: meta(total, p) });
});

export const createRequest = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const auth = requireAuth(req);
  const body = req.body as {
    customer: { name: string; phone: string; city?: string; address?: string };
    originalAmount: number;
    discountType: 'none' | 'fixed' | 'percentage';
    discountValue: number;
    description?: string;
    externalReference?: string;
    paymentAccountIds: string[];
    branchId?: string;
    expiresAt?: string;
    expiresInDays?: number;
  };

  const accounts = await PaymentAccount.find({
    ...scope,
    _id: { $in: body.paymentAccountIds.map((id) => new Types.ObjectId(id)) },
    isActive: true,
  });
  if (accounts.length !== body.paymentAccountIds.length) {
    throw ApiError.badRequest('أحد الحسابات البنكية غير صالح أو غير فعال');
  }

  if (body.branchId) {
    const branch = await Branch.findOne({ _id: body.branchId, ...scope });
    if (!branch) throw ApiError.badRequest('الفرع غير صالح');
  }

  const customer = await upsertCustomer(scope.merchantId, body.customer);
  const { discountAmount, finalAmount } = computeDiscount(body.originalAmount, body.discountType, body.discountValue);
  if (finalAmount <= 0) throw ApiError.badRequest('المبلغ النهائي يجب أن يكون أكبر من صفر');

  let expiresAt: Date | undefined;
  if (body.expiresAt) expiresAt = new Date(body.expiresAt);
  else if (body.expiresInDays) expiresAt = new Date(Date.now() + body.expiresInDays * 86400000);

  const request = await PaymentRequest.create({
    merchantId: scope.merchantId,
    branchId: body.branchId,
    createdBy: auth.userId,
    customerId: customer._id,
    requestNumber: body.externalReference?.trim() || (await generateRequestNumber(scope.merchantId)),
    externalReference: body.externalReference?.trim(),
    originalAmount: round2(body.originalAmount),
    discountType: body.discountType,
    discountValue: body.discountValue,
    discountAmount,
    finalAmount,
    paidAmount: 0,
    remainingAmount: finalAmount,
    description: body.description,
    paymentAccountIds: accounts.map((a) => a._id),
    publicToken: randomToken(44),
    status: 'pending_payment',
    expiresAt,
  });

  await recordStatusChange({
    merchantId: scope.merchantId,
    resource: 'payment_request',
    resourceId: request._id,
    toStatus: 'pending_payment',
    actorId: auth.userId,
    actorLabel: auth.fullName,
  });
  await recalcCustomerTotals(scope.merchantId, customer._id);
  await audit(req, { action: 'payment_request.created', resource: 'payment_request', resourceId: request._id.toString(), metadata: { finalAmount } });
  await notifyMerchant({
    merchantId: scope.merchantId,
    type: 'request_created',
    title: `تم إنشاء طلب دفع ${request.requestNumber}`,
    body: `العميل ${customer.name} — المبلغ ${finalAmount}`,
    resource: 'payment_request',
    resourceId: request._id,
  });

  res.status(201).json({ request, publicUrl: publicPaymentUrl(request.publicToken) });
});

export const getRequest = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const request = await PaymentRequest.findOne({ _id: req.params.id, ...scope })
    .populate('customerId', 'name phone city address')
    .populate('branchId', 'name')
    .populate('paymentAccountIds');
  if (!request) throw ApiError.notFound('طلب الدفع غير موجود');

  const [payments, proofs, history] = await Promise.all([
    Payment.find({ paymentRequestId: request._id, ...scope }).sort({ createdAt: -1 }),
    PaymentProof.find({ paymentRequestId: request._id, ...scope }).sort({ createdAt: -1 }),
    StatusHistory.find({ resource: 'payment_request', resourceId: request._id }).sort({ createdAt: -1 }),
  ]);

  res.json({ request, payments, proofs, history, publicUrl: publicPaymentUrl(request.publicToken) });
});

export const getRequestQr = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const request = await PaymentRequest.findOne({ _id: req.params.id, ...scope }).select('publicToken requestNumber');
  if (!request) throw ApiError.notFound('طلب الدفع غير موجود');
  const url = publicPaymentUrl(request.publicToken);
  const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 512, errorCorrectionLevel: 'M' });
  res.json({ url, qr: dataUrl });
});

export const updateRequest = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const auth = requireAuth(req);
  const request = await PaymentRequest.findOne({ _id: req.params.id, ...scope });
  if (!request) throw ApiError.notFound('طلب الدفع غير موجود');
  if (['fully_paid', 'cancelled'].includes(request.status)) {
    throw ApiError.badRequest('لا يمكن تعديل طلب مكتمل أو ملغى');
  }

  const body = req.body as Record<string, unknown>;
  if (body.description !== undefined) request.description = body.description as string;

  if (body.paymentAccountIds) {
    const ids = (body.paymentAccountIds as string[]).map((id) => new Types.ObjectId(id));
    const accounts = await PaymentAccount.find({ ...scope, _id: { $in: ids }, isActive: true });
    if (accounts.length !== ids.length) throw ApiError.badRequest('أحد الحسابات البنكية غير صالح');
    request.paymentAccountIds = accounts.map((a) => a._id);
  }

  if (body.originalAmount !== undefined || body.discountType !== undefined || body.discountValue !== undefined) {
    if (request.paidAmount > 0) {
      throw ApiError.badRequest('لا يمكن تعديل المبلغ بعد تسجيل دفعات على الطلب');
    }
    const originalAmount = (body.originalAmount as number) ?? request.originalAmount;
    const discountType = ((body.discountType as string) ?? request.discountType) as 'none' | 'fixed' | 'percentage';
    const discountValue = (body.discountValue as number) ?? request.discountValue;
    const { discountAmount, finalAmount } = computeDiscount(originalAmount, discountType, discountValue);
    if (finalAmount < request.paidAmount) {
      throw ApiError.badRequest('المبلغ النهائي لا يمكن أن يكون أقل من المدفوع');
    }
    request.originalAmount = round2(originalAmount);
    request.discountType = discountType;
    request.discountValue = discountValue;
    request.discountAmount = discountAmount;
    request.finalAmount = finalAmount;
  }

  if (body.expiresAt !== undefined) request.expiresAt = body.expiresAt ? new Date(body.expiresAt as string) : undefined;
  if (body.branchId !== undefined) request.branchId = body.branchId ? new Types.ObjectId(body.branchId as string) : undefined;

  await request.save();
  const updated = await recalcPaymentRequest(request._id, { id: auth.userId, label: auth.fullName });
  await audit(req, { action: 'payment_request.updated', resource: 'payment_request', resourceId: request._id.toString() });
  res.json({ request: updated });
});

export const cancelRequest = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const auth = requireAuth(req);
  const request = await PaymentRequest.findOne({ _id: req.params.id, ...scope });
  if (!request) throw ApiError.notFound('طلب الدفع غير موجود');
  if (request.status === 'fully_paid') throw ApiError.badRequest('لا يمكن إلغاء طلب مدفوع بالكامل');

  const previous = request.status;
  request.status = 'cancelled';
  await request.save();
  await recordStatusChange({
    merchantId: scope.merchantId,
    resource: 'payment_request',
    resourceId: request._id,
    fromStatus: previous,
    toStatus: 'cancelled',
    actorId: auth.userId,
    actorLabel: auth.fullName,
    reason: (req.body?.reason as string) || undefined,
  });
  await recalcCustomerTotals(scope.merchantId, request.customerId);
  await audit(req, { action: 'payment_request.cancelled', resource: 'payment_request', resourceId: request._id.toString() });
  res.json({ request });
});

export const expireRequest = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const auth = requireAuth(req);
  const request = await PaymentRequest.findOne({ _id: req.params.id, ...scope });
  if (!request) throw ApiError.notFound('طلب الدفع غير موجود');
  if (['fully_paid', 'cancelled'].includes(request.status)) throw ApiError.badRequest('لا يمكن تعديل حالة هذا الطلب');

  const previous = request.status;
  request.status = 'expired';
  request.expiresAt = new Date();
  await request.save();
  await recordStatusChange({
    merchantId: scope.merchantId,
    resource: 'payment_request',
    resourceId: request._id,
    fromStatus: previous,
    toStatus: 'expired',
    actorId: auth.userId,
    actorLabel: auth.fullName,
  });
  await audit(req, { action: 'payment_request.expired', resource: 'payment_request', resourceId: request._id.toString() });
  res.json({ request });
});

/** Adds a payment record. Payments are immutable — never edited in place. */
export const addPayment = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const auth = requireAuth(req);
  const request = await PaymentRequest.findOne({ _id: req.params.id, ...scope });
  if (!request) throw ApiError.notFound('طلب الدفع غير موجود');
  if (['cancelled', 'rejected'].includes(request.status)) throw ApiError.badRequest('الطلب ملغى');
  if (request.remainingAmount <= 0) throw ApiError.badRequest('الطلب مدفوع بالكامل');

  const body = req.body as {
    amount: number;
    method: 'bank_transfer' | 'cash' | 'wallet';
    paymentAccountId?: string;
    transactionNumber?: string;
    transferredAt?: string;
    senderName?: string;
    proofId?: string;
    note?: string;
  };

  const amount = round2(body.amount);
  if (amount > request.remainingAmount + 0.001) {
    throw ApiError.badRequest(`المبلغ أكبر من المتبقي (${request.remainingAmount})`);
  }

  if (body.paymentAccountId) {
    const account = await PaymentAccount.findOne({ _id: body.paymentAccountId, ...scope });
    if (!account) throw ApiError.badRequest('الحساب البنكي غير صالح');
  }
  if (body.transactionNumber) {
    const dup = await Payment.findOne({ ...scope, transactionNumber: body.transactionNumber });
    if (dup) throw ApiError.conflict('رقم العملية مستخدم مسبقًا');
  }

  let proof = null;
  if (body.proofId) {
    proof = await PaymentProof.findOne({ _id: body.proofId, ...scope, paymentRequestId: request._id });
    if (!proof) throw ApiError.badRequest('الإثبات غير صالح');
  }

  const payment = await Payment.create({
    merchantId: scope.merchantId,
    paymentRequestId: request._id,
    customerId: request.customerId,
    amount,
    method: body.method,
    paymentAccountId: body.paymentAccountId,
    transactionNumber: body.transactionNumber,
    transferredAt: body.transferredAt ? new Date(body.transferredAt) : new Date(),
    senderName: body.senderName,
    proofId: proof?._id,
    confirmedBy: auth.userId,
    note: body.note,
  });

  if (proof) {
    proof.reviewStatus = 'approved';
    proof.reviewedBy = auth.userId;
    proof.reviewedAt = new Date();
    proof.paymentId = payment._id;
    await proof.save();
  }

  const updated = await recalcPaymentRequest(request._id, { id: auth.userId, label: auth.fullName });
  await audit(req, {
    action: 'payment.confirmed',
    resource: 'payment',
    resourceId: payment._id.toString(),
    metadata: { amount, requestNumber: request.requestNumber },
  });
  await notifyMerchant({
    merchantId: scope.merchantId,
    type: updated.remainingAmount <= 0 ? 'fully_paid' : 'partial_payment',
    title:
      updated.remainingAmount <= 0
        ? `تم دفع الطلب ${request.requestNumber} بالكامل`
        : `دفعة جزئية على الطلب ${request.requestNumber}`,
    body: `المبلغ ${amount} — المتبقي ${updated.remainingAmount}`,
    resource: 'payment_request',
    resourceId: request._id,
  });

  res.status(201).json({ payment, request: updated });
});

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const p = pagination(req.query as Record<string, unknown>);
  const [items, total] = await Promise.all([
    Payment.find(scope).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('customerId', 'name phone'),
    Payment.countDocuments(scope),
  ]);
  res.json({ items, meta: meta(total, p) });
});
