import { Request, Response } from 'express';
import QRCode from 'qrcode';
import {
  PaymentRequest,
  PaymentAccount,
  Merchant,
  Customer,
  PaymentProof,
  StoredFile,
  Order,
  Courier,
} from '../models';
import { ApiError } from '../utils/errors';
import { asyncHandler } from '../utils/async';
import { evaluateProof } from '../services/proof.service';
import { recalcPaymentRequest, recordStatusChange } from '../services/paymentRequest.service';
import { notifyMerchant } from '../services/notification.service';
import { publicPaymentUrl } from './paymentRequest.controller';
import { DELIVERY_STATUSES } from '../config/constants';

/** Public payment page — no account required. Exposes only what the customer needs. */
export const getPublicPayment = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.params.token || '');
  if (token.length < 20) throw ApiError.notFound('الرابط غير صالح');

  const request = await PaymentRequest.findOne({ publicToken: token });
  if (!request) throw ApiError.notFound('الرابط غير صالح أو منتهي');

  const merchant = await Merchant.findById(request.merchantId).select(
    'businessName logoFileId city phone whatsapp isActive'
  );
  if (!merchant || !merchant.isActive) throw ApiError.notFound('الرابط غير متاح حاليًا');

  const isExpired = !!request.expiresAt && request.expiresAt.getTime() < Date.now() && request.paidAmount === 0;
  if (isExpired && request.status !== 'expired') {
    await PaymentRequest.updateOne({ _id: request._id }, { $set: { status: 'expired' } });
    request.status = 'expired';
  }
  if (['cancelled'].includes(request.status)) throw ApiError.notFound('الطلب ملغى');

  if (!request.firstOpenedAt) {
    request.firstOpenedAt = new Date();
    await request.save();
    await notifyMerchant({
      merchantId: request.merchantId,
      type: 'link_opened',
      title: `تم فتح رابط الطلب ${request.requestNumber}`,
      resource: 'payment_request',
      resourceId: request._id,
    });
  }

  const [accounts, customer] = await Promise.all([
    PaymentAccount.find({ _id: { $in: request.paymentAccountIds }, isActive: true }).select(
      'provider bankLogo accountHolder accountNumber iban type walletIdentifier'
    ),
    Customer.findById(request.customerId).select('name'),
  ]);

  const qr = await QRCode.toDataURL(publicPaymentUrl(token), { margin: 1, width: 420 });

  res.json({
    merchant: {
      businessName: merchant.businessName,
      logoFileId: merchant.logoFileId,
      city: merchant.city,
      phone: merchant.phone,
      whatsapp: merchant.whatsapp,
    },
    request: {
      requestNumber: request.requestNumber,
      originalAmount: request.originalAmount,
      discountAmount: request.discountAmount,
      finalAmount: request.finalAmount,
      paidAmount: request.paidAmount,
      remainingAmount: request.remainingAmount,
      currency: request.currency,
      description: request.description,
      status: request.status,
      expiresAt: request.expiresAt,
      createdAt: request.createdAt,
      customerName: customer?.name,
      canUploadProof: !['fully_paid', 'cancelled', 'expired'].includes(request.status),
    },
    accounts,
    qr,
    publicUrl: publicPaymentUrl(token),
  });
});

export const submitPublicProof = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.params.token || '');
  const request = await PaymentRequest.findOne({ publicToken: token });
  if (!request) throw ApiError.notFound('الرابط غير صالح');
  if (['fully_paid', 'cancelled', 'expired'].includes(request.status)) {
    throw ApiError.badRequest('لا يمكن رفع إثبات لهذا الطلب');
  }
  if (!req.file) throw ApiError.badRequest('يجب رفع صورة إثبات التحويل');

  const body = req.body as Record<string, string>;
  const amount = body.amount ? Number(body.amount) : undefined;
  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    throw ApiError.badRequest('المبلغ غير صالح');
  }

  let targetAccountId: string | undefined = body.paymentAccountId;
  if (targetAccountId) {
    const ok = request.paymentAccountIds.some((id) => id.toString() === targetAccountId);
    if (!ok) throw ApiError.badRequest('الحساب المحدد غير مرتبط بالطلب');
  }

  const stored = await StoredFile.create({
    merchantId: request.merchantId,
    kind: 'proof',
    storedName: req.file.filename,
    originalName: req.file.originalname.slice(0, 160),
    mimeType: req.file.mimetype,
    size: req.file.size,
    isPublic: false,
  });

  const outcome = await evaluateProof({
    merchantId: request.merchantId,
    paymentRequestId: request._id,
    declaredAmount: amount,
    declaredTransactionNumber: body.transactionNumber,
    targetPaymentAccountId: targetAccountId ? (request.paymentAccountIds.find((i) => i.toString() === targetAccountId) as never) : undefined,
    declaredTransferDate: body.transferDate ? new Date(body.transferDate) : undefined,
  });

  const proof = await PaymentProof.create({
    merchantId: request.merchantId,
    paymentRequestId: request._id,
    customerId: request.customerId,
    fileId: stored._id,
    declaredAmount: amount,
    declaredBank: body.bankName,
    declaredTransactionNumber: body.transactionNumber,
    declaredTransferDate: body.transferDate ? new Date(body.transferDate) : undefined,
    declaredSender: body.senderName,
    targetPaymentAccountId: targetAccountId,
    matchResult: outcome.matchResult,
    matchReasons: outcome.matchReasons,
    reviewStatus: 'pending',
    uploadedFromIp: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
  });

  const previous = request.status;
  if (request.paidAmount === 0) {
    request.status = 'under_review';
    await request.save();
    await recordStatusChange({
      merchantId: request.merchantId,
      resource: 'payment_request',
      resourceId: request._id,
      fromStatus: previous,
      toStatus: 'under_review',
      actorLabel: 'customer',
      reason: 'تم رفع إثبات دفع',
    });
  }

  await notifyMerchant({
    merchantId: request.merchantId,
    type: outcome.matchResult === 'matched' ? 'proof_matched' : 'proof_needs_review',
    title: `إثبات دفع جديد على الطلب ${request.requestNumber}`,
    body: `نتيجة المطابقة الأولية: ${outcome.matchResult}`,
    resource: 'payment_request',
    resourceId: request._id,
  });

  res.status(201).json({
    message: 'تم رفع الإثبات، سيتم مراجعته من التاجر',
    proof: { id: proof._id, matchResult: proof.matchResult, reviewStatus: proof.reviewStatus },
  });
});

/** Courier link — minimal delivery data only, no merchant internals. */
export const getCourierOrder = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.params.token || '');
  if (token.length < 20) throw ApiError.notFound('الرابط غير صالح');
  const order = await Order.findOne({ courierToken: token });
  if (!order) throw ApiError.notFound('الرابط غير صالح');

  const [customer, merchant, courier] = await Promise.all([
    Customer.findById(order.customerId).select('name phone'),
    Merchant.findById(order.merchantId).select('businessName phone isActive'),
    order.courierId ? Courier.findById(order.courierId).select('name phone') : null,
  ]);
  if (!merchant || !merchant.isActive) throw ApiError.notFound('الرابط غير متاح');

  res.json({
    order: {
      orderNumber: order.orderNumber,
      city: order.city,
      address: order.address,
      location: order.location,
      items: order.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      total: order.total,
      paidAmount: order.paidAmount,
      remainingAmount: order.remainingAmount,
      deliveryNotes: order.deliveryNotes,
      deliveryStatus: order.deliveryStatus,
    },
    customer: { name: customer?.name, phone: customer?.phone },
    merchant: { businessName: merchant.businessName, phone: merchant.phone },
    courier: courier ? { name: courier.name } : null,
    allowedStatuses: ['with_courier', 'delivered', 'rejected', 'returned'],
  });
});

export const updateCourierStatus = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.params.token || '');
  const order = await Order.findOne({ courierToken: token });
  if (!order) throw ApiError.notFound('الرابط غير صالح');

  const status = String(req.body.deliveryStatus || '');
  const allowed = ['with_courier', 'delivered', 'rejected', 'returned'];
  if (!allowed.includes(status) || !(DELIVERY_STATUSES as readonly string[]).includes(status)) {
    throw ApiError.badRequest('حالة غير مسموحة');
  }
  if (['delivered', 'cancelled'].includes(order.deliveryStatus)) {
    throw ApiError.badRequest('لا يمكن تعديل حالة هذا الطلب');
  }

  const previous = order.deliveryStatus;
  order.deliveryStatus = status as never;
  await order.save();
  await recordStatusChange({
    merchantId: order.merchantId,
    resource: 'order',
    resourceId: order._id,
    field: 'deliveryStatus',
    fromStatus: previous,
    toStatus: status,
    actorLabel: 'courier',
    reason: (req.body.reason as string) || undefined,
  });
  await notifyMerchant({
    merchantId: order.merchantId,
    type: 'delivery_status_changed',
    title: `تحديث توصيل الطلب ${order.orderNumber}`,
    body: `الحالة الجديدة: ${status}`,
    resource: 'order',
    resourceId: order._id,
  });

  res.json({ message: 'تم تحديث حالة التوصيل', deliveryStatus: order.deliveryStatus });
});
