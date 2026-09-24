import { Request, Response } from 'express';
import {
  Merchant,
  User,
  Subscription,
  SubscriptionPlan,
  PaymentRequest,
  Payment,
  SupportTicket,
  AuditLog,
  BackupLog,
} from '../models';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/async';
import { ApiError } from '../utils/errors';
import { escapeRegex, meta, pagination } from '../utils/query';
import { round2 } from '../utils/money';
import { audit } from '../services/audit.service';
import { notifyMerchant } from '../services/notification.service';

export const getAdminOverview = asyncHandler(async (_req: Request, res: Response) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [merchants, activeMerchants, usersCount, byType, requestsCount, paymentsAgg, openTickets, pendingPlanChanges, newThisMonth] =
    await Promise.all([
      Merchant.countDocuments({}),
      Merchant.countDocuments({ isActive: true }),
      User.countDocuments({ isAdmin: false }),
      Merchant.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$accountType', count: { $sum: 1 } } }]),
      PaymentRequest.countDocuments({}),
      Payment.aggregate<{ _id: null; total: number; count: number }>([
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress', 'waiting_user'] } }),
      Subscription.countDocuments({ changeRequestStatus: 'pending' }),
      Merchant.countDocuments({ createdAt: { $gte: startOfMonth } }),
    ]);

  res.json({
    merchants,
    activeMerchants,
    disabledMerchants: merchants - activeMerchants,
    usersCount,
    newMerchantsThisMonth: newThisMonth,
    byAccountType: byType,
    requestsCount,
    paymentsCount: paymentsAgg[0]?.count || 0,
    platformVolume: round2(paymentsAgg[0]?.total || 0),
    openTickets,
    pendingPlanChanges,
  });
});

export const listMerchants = asyncHandler(async (req: Request, res: Response) => {
  const p = pagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = {};
  const search = String(req.query.search || '').trim();
  if (search) filter.businessName = new RegExp(escapeRegex(search), 'i');
  if (req.query.accountType) filter.accountType = req.query.accountType;
  if (req.query.isActive) filter.isActive = req.query.isActive === 'true';

  const [items, total] = await Promise.all([
    Merchant.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('ownerId', 'fullName phone'),
    Merchant.countDocuments(filter),
  ]);
  res.json({ items, meta: meta(total, p) });
});

export const getMerchantDetail = asyncHandler(async (req: Request, res: Response) => {
  const merchant = await Merchant.findById(req.params.id).populate('ownerId', 'fullName phone isActive lastLoginAt');
  if (!merchant) throw ApiError.notFound('الحساب غير موجود');
  const scope = { merchantId: merchant._id };
  const [subscription, requestsCount, paymentsAgg] = await Promise.all([
    Subscription.findOne(scope).populate('planId').populate('requestedPlanId'),
    PaymentRequest.countDocuments(scope),
    Payment.aggregate<{ _id: null; total: number; count: number }>([
      { $match: scope },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);
  // Admins see account metadata and aggregates, never customer-level private data.
  res.json({
    merchant,
    subscription,
    stats: {
      requestsCount,
      paymentsCount: paymentsAgg[0]?.count || 0,
      volume: round2(paymentsAgg[0]?.total || 0),
    },
  });
});

export const setMerchantStatus = asyncHandler(async (req: Request, res: Response) => {
  const { isActive, reason } = req.body as { isActive: boolean; reason?: string };
  const merchant = await Merchant.findById(req.params.id);
  if (!merchant) throw ApiError.notFound('الحساب غير موجود');
  merchant.isActive = Boolean(isActive);
  await merchant.save();
  await User.updateMany({ merchantId: merchant._id }, { $set: { isActive: merchant.isActive } });
  await audit(req, {
    action: isActive ? 'admin.merchant_enabled' : 'admin.merchant_disabled',
    resource: 'merchant',
    resourceId: merchant._id.toString(),
    metadata: { reason },
  });
  res.json({ merchant, message: isActive ? 'تم تنشيط الحساب' : 'تم تعطيل الحساب' });
});

/* ---------- Plans & subscriptions ---------- */

export const adminListPlans = asyncHandler(async (_req: Request, res: Response) => {
  const items = await SubscriptionPlan.find({}).sort({ sortOrder: 1, price: 1 });
  res.json({ items });
});

export const adminSavePlan = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  if (req.params.id) {
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, { $set: body }, { new: true });
    if (!plan) throw ApiError.notFound('الخطة غير موجودة');
    await audit(req, { action: 'admin.plan_updated', resource: 'subscription_plan', resourceId: plan._id.toString() });
    return res.json({ plan });
  }
  const plan = await SubscriptionPlan.create(body);
  await audit(req, { action: 'admin.plan_created', resource: 'subscription_plan', resourceId: plan._id.toString() });
  res.status(201).json({ plan });
});

export const listSubscriptionRequests = asyncHandler(async (req: Request, res: Response) => {
  const p = pagination(req.query as Record<string, unknown>);
  const filter = { changeRequestStatus: 'pending' };
  const [items, total] = await Promise.all([
    Subscription.find(filter)
      .sort({ changeRequestedAt: 1 })
      .skip(p.skip)
      .limit(p.limit)
      .populate('merchantId', 'businessName accountType')
      .populate('planId', 'name code price')
      .populate('requestedPlanId', 'name code price'),
    Subscription.countDocuments(filter),
  ]);
  res.json({ items, meta: meta(total, p) });
});

export const reviewSubscriptionRequest = asyncHandler(async (req: Request, res: Response) => {
  const { decision } = req.body as { decision: 'approve' | 'reject' };
  const subscription = await Subscription.findById(req.params.id);
  if (!subscription) throw ApiError.notFound('الاشتراك غير موجود');
  if (subscription.changeRequestStatus !== 'pending') throw ApiError.badRequest('لا يوجد طلب قيد المراجعة');

  if (decision === 'approve') {
    const plan = await SubscriptionPlan.findById(subscription.requestedPlanId);
    if (!plan) throw ApiError.badRequest('الخطة المطلوبة غير متوفرة');
    subscription.planId = plan._id;
    subscription.planCode = plan.code;
    subscription.price = plan.price;
    subscription.status = 'active';
    subscription.startsAt = new Date();
    subscription.endsAt = new Date(Date.now() + plan.billingPeriodDays * 86400000);
    subscription.changeRequestStatus = 'approved';
    subscription.requestedPlanId = undefined;
    subscription.lastPaymentAt = new Date();
  } else {
    subscription.changeRequestStatus = 'rejected';
    subscription.requestedPlanId = undefined;
  }
  await subscription.save();

  await notifyMerchant({
    merchantId: subscription.merchantId,
    type: 'subscription_updated',
    title: decision === 'approve' ? 'تم تحديث خطة اشتراكك' : 'تم رفض طلب تغيير الخطة',
    body: decision === 'approve' ? `الخطة الحالية: ${subscription.planCode}` : 'راسل الدعم لمزيد من التفاصيل',
  });
  await audit(req, {
    action: `admin.subscription_${decision}d`,
    resource: 'subscription',
    resourceId: subscription._id.toString(),
  });
  res.json({ subscription });
});

/* ---------- Support (staff side) ---------- */

export const adminListTickets = asyncHandler(async (req: Request, res: Response) => {
  const p = pagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ updatedAt: -1 })
      .skip(p.skip)
      .limit(p.limit)
      .populate('merchantId', 'businessName')
      .populate('userId', 'fullName phone'),
    SupportTicket.countDocuments(filter),
  ]);
  res.json({ items, meta: meta(total, p) });
});

export const adminReplyTicket = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) throw ApiError.notFound('التذكرة غير موجودة');
  const { body, status } = req.body as { body?: string; status?: string };
  if (body?.trim()) {
    ticket.messages.push({
      authorId: auth.userId,
      authorLabel: `${auth.fullName} (الدعم)`,
      isStaff: true,
      body: body.trim(),
      attachmentIds: [],
      createdAt: new Date(),
    });
    if (ticket.status === 'open') ticket.status = 'in_progress';
  }
  if (status) ticket.status = status as never;
  ticket.assignedTo = auth.userId;
  await ticket.save();
  await audit(req, { action: 'admin.ticket_replied', resource: 'support_ticket', resourceId: ticket._id.toString() });
  res.json({ ticket });
});

/* ---------- Audit & backups ---------- */

export const adminListAudit = asyncHandler(async (req: Request, res: Response) => {
  const p = pagination(req.query as Record<string, unknown>, 30);
  const filter: Record<string, unknown> = {};
  if (req.query.merchantId) filter.merchantId = req.query.merchantId;
  if (req.query.action) filter.action = new RegExp(escapeRegex(String(req.query.action)), 'i');
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ items, meta: meta(total, p) });
});

export const adminListBackups = asyncHandler(async (_req: Request, res: Response) => {
  const items = await BackupLog.find({}).sort({ createdAt: -1 }).limit(50);
  res.json({ items });
});
