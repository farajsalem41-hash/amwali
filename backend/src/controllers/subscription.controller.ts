import { Request, Response } from 'express';
import { SubscriptionPlan, Subscription, Merchant, PaymentRequest, Employee, Branch, PaymentAccount } from '../models';
import { merchantScope, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/async';
import { ApiError } from '../utils/errors';
import { audit } from '../services/audit.service';

export const listPlans = asyncHandler(async (_req: Request, res: Response) => {
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1, price: 1 });
  res.json({ items: plans });
});

export const getMySubscription = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const [subscription, plans] = await Promise.all([
    Subscription.findOne(scope).populate('planId').populate('requestedPlanId'),
    SubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1, price: 1 }),
  ]);
  res.json({ subscription, plans });
});

/**
 * Amwali does not process payments. Requesting an upgrade records a pending
 * request that the platform admin reviews manually.
 */
export const requestPlanChange = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const auth = requireAuth(req);
  const { planId } = req.body as { planId: string };
  const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true });
  if (!plan) throw ApiError.badRequest('الخطة غير متوفرة');

  const subscription = await Subscription.findOne(scope);
  if (!subscription) throw ApiError.notFound('لا يوجد اشتراك');
  if (subscription.planId.toString() === plan._id.toString()) {
    throw ApiError.badRequest('أنت مشترك في هذه الخطة بالفعل');
  }
  subscription.requestedPlanId = plan._id;
  subscription.changeRequestStatus = 'pending';
  subscription.changeRequestedAt = new Date();
  await subscription.save();

  await audit(req, {
    action: 'subscription.change_requested',
    resource: 'subscription',
    resourceId: subscription._id.toString(),
    metadata: { planCode: plan.code, by: auth.userId.toString() },
  });
  res.json({ subscription, message: 'تم إرسال طلب تغيير الخطة، وسيتم مراجعته من الإدارة' });
});

export const getUsage = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const subscription = await Subscription.findOne(scope).populate('planId');
  const plan = subscription?.planId as unknown as { name?: string; limits?: Record<string, number> } | undefined;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const [requestsThisMonth, employees, branches, accounts, merchant] = await Promise.all([
    PaymentRequest.countDocuments({ ...scope, createdAt: { $gte: startOfMonth } }),
    Employee.countDocuments({ ...scope, isActive: true }),
    Branch.countDocuments(scope),
    PaymentAccount.countDocuments(scope),
    Merchant.findById(scope.merchantId).select('businessName'),
  ]);
  res.json({
    merchant: merchant?.businessName,
    status: subscription?.status,
    endsAt: subscription?.endsAt,
    plan: plan?.name,
    limits: plan?.limits || {},
    usage: { paymentRequestsPerMonth: requestsThisMonth, employees, branches, paymentAccounts: accounts },
  });
});
