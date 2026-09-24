import { Request, Response } from 'express';
import { PaymentRequest, Payment, PaymentProof, Customer, Order, Invoice } from '../models';
import { merchantScope, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/async';
import { round2 } from '../utils/money';

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const auth = requireAuth(req);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [requestAgg, todayAgg, pendingCount, proofsPending, customersCount, recentRequests, recentPayments] =
    await Promise.all([
      PaymentRequest.aggregate<{ _id: null; total: number; paid: number; remaining: number; count: number }>([
        { $match: { ...scope, status: { $nin: ['cancelled', 'rejected'] } } },
        {
          $group: {
            _id: null,
            total: { $sum: '$finalAmount' },
            paid: { $sum: '$paidAmount' },
            remaining: { $sum: '$remainingAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
      Payment.aggregate<{ _id: null; total: number; count: number }>([
        { $match: { ...scope, createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      PaymentRequest.countDocuments({ ...scope, status: { $in: ['pending_payment', 'partial', 'under_review'] } }),
      PaymentProof.countDocuments({ ...scope, reviewStatus: 'pending' }),
      Customer.countDocuments(scope),
      PaymentRequest.find(scope).sort({ createdAt: -1 }).limit(8).populate('customerId', 'name phone'),
      Payment.find(scope).sort({ createdAt: -1 }).limit(8).populate('customerId', 'name phone'),
    ]);

  const base = {
    totals: {
      totalAmount: round2(requestAgg[0]?.total || 0),
      totalPaid: round2(requestAgg[0]?.paid || 0),
      totalRemaining: round2(requestAgg[0]?.remaining || 0),
      requestsCount: requestAgg[0]?.count || 0,
      collectedToday: round2(todayAgg[0]?.total || 0),
      paymentsToday: todayAgg[0]?.count || 0,
      pendingRequests: pendingCount,
      proofsNeedingReview: proofsPending,
      customersCount,
    },
    recentRequests,
    recentPayments,
  };

  if (auth.accountType === 'online_seller') {
    const [orders, todayOrders] = await Promise.all([
      Order.find(scope).select('total paidAmount remainingAmount deliveryStatus'),
      Order.countDocuments({ ...scope, createdAt: { $gte: startOfDay } }),
    ]);
    const countBy = (s: string) => orders.filter((o) => o.deliveryStatus === s).length;
    return res.json({
      ...base,
      seller: {
        ordersCount: orders.length,
        ordersToday: todayOrders,
        collected: round2(orders.reduce((s, o) => s + o.paidAmount, 0)),
        remaining: round2(orders.reduce((s, o) => s + o.remainingAmount, 0)),
        partialCount: orders.filter((o) => o.paidAmount > 0 && o.remainingAmount > 0).length,
        withCourier: countBy('with_courier'),
        delivered: countBy('delivered'),
        returned: countBy('returned') + countBy('rejected'),
      },
    });
  }

  if (auth.accountType === 'company') {
    const invoices = await Invoice.find(scope).select('total paidAmount remainingAmount status dueDate');
    const soon = new Date(Date.now() + 7 * 86400000);
    return res.json({
      ...base,
      company: {
        invoicesCount: invoices.length,
        invoicesUnpaid: invoices.filter((i) => i.status !== 'paid').length,
        invoicesTotal: round2(invoices.reduce((s, i) => s + i.total, 0)),
        invoicesRemaining: round2(invoices.reduce((s, i) => s + i.remainingAmount, 0)),
        dueSoon: invoices.filter((i) => i.status !== 'paid' && i.dueDate && i.dueDate <= soon).length,
      },
    });
  }

  res.json(base);
});
