import { Types } from 'mongoose';
import { PaymentRequest, Payment, Order, Invoice, Employee, Branch } from '../models';
import { round2 } from '../utils/money';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ReportRange {
  from: Date;
  to: Date;
}

export function resolveRange(period: ReportPeriod, from?: string, to?: string): ReportRange {
  const now = new Date();
  if (period === 'custom' && from && to) {
    const f = new Date(from);
    const t = new Date(to);
    f.setHours(0, 0, 0, 0);
    t.setHours(23, 59, 59, 999);
    return { from: f, to: t };
  }
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'weekly') start.setDate(start.getDate() - 6);
  if (period === 'monthly') start.setDate(start.getDate() - 29);
  return { from: start, to: end };
}

export interface ReportSummary {
  range: { from: string; to: string };
  totals: {
    requestsCount: number;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    discountsAmount: number;
    fullyPaidCount: number;
    partialCount: number;
    unpaidCount: number;
    paymentsCount: number;
    collectedInRange: number;
  };
  byStatus: { status: string; count: number; amount: number }[];
  byDay: { date: string; collected: number; requests: number }[];
}

export async function buildSummary(merchantId: Types.ObjectId, range: ReportRange): Promise<ReportSummary> {
  const match = { merchantId, createdAt: { $gte: range.from, $lte: range.to } };

  const [requests, paymentsAgg, byStatusAgg, byDayPayments, byDayRequests] = await Promise.all([
    PaymentRequest.find(match).select('finalAmount paidAmount remainingAmount discountAmount status'),
    Payment.aggregate<{ _id: null; total: number; count: number }>([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    PaymentRequest.aggregate<{ _id: string; count: number; amount: number }>([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$finalAmount' } } },
    ]),
    Payment.aggregate<{ _id: string; total: number }>([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    PaymentRequest.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const dayMap = new Map<string, { collected: number; requests: number }>();
  for (const d of byDayPayments) dayMap.set(d._id, { collected: round2(d.total), requests: 0 });
  for (const d of byDayRequests) {
    const entry = dayMap.get(d._id) || { collected: 0, requests: 0 };
    entry.requests = d.count;
    dayMap.set(d._id, entry);
  }

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    totals: {
      requestsCount: requests.length,
      totalAmount: round2(requests.reduce((s, r) => s + r.finalAmount, 0)),
      paidAmount: round2(requests.reduce((s, r) => s + r.paidAmount, 0)),
      remainingAmount: round2(requests.reduce((s, r) => s + r.remainingAmount, 0)),
      discountsAmount: round2(requests.reduce((s, r) => s + (r.discountAmount || 0), 0)),
      fullyPaidCount: requests.filter((r) => r.status === 'fully_paid').length,
      partialCount: requests.filter((r) => r.status === 'partial').length,
      unpaidCount: requests.filter((r) => ['pending_payment', 'under_review', 'proof_uploaded'].includes(r.status)).length,
      paymentsCount: paymentsAgg[0]?.count || 0,
      collectedInRange: round2(paymentsAgg[0]?.total || 0),
    },
    byStatus: byStatusAgg.map((s) => ({ status: s._id, count: s.count, amount: round2(s.amount) })),
    byDay: [...dayMap.entries()].sort().map(([date, v]) => ({ date, ...v })),
  };
}

export async function buildBranchBreakdown(merchantId: Types.ObjectId, range: ReportRange) {
  const rows = await PaymentRequest.aggregate<{ _id: Types.ObjectId | null; count: number; total: number; paid: number }>([
    { $match: { merchantId, createdAt: { $gte: range.from, $lte: range.to } } },
    { $group: { _id: '$branchId', count: { $sum: 1 }, total: { $sum: '$finalAmount' }, paid: { $sum: '$paidAmount' } } },
  ]);
  const branches = await Branch.find({ merchantId }).select('name');
  const nameOf = new Map(branches.map((b) => [b._id.toString(), b.name]));
  return rows.map((r) => ({
    branchId: r._id?.toString() || null,
    branchName: r._id ? nameOf.get(r._id.toString()) || 'فرع محذوف' : 'بدون فرع',
    count: r.count,
    total: round2(r.total),
    paid: round2(r.paid),
    remaining: round2(r.total - r.paid),
  }));
}

export async function buildEmployeeBreakdown(merchantId: Types.ObjectId, range: ReportRange) {
  const rows = await PaymentRequest.aggregate<{ _id: Types.ObjectId; count: number; total: number; paid: number }>([
    { $match: { merchantId, createdAt: { $gte: range.from, $lte: range.to } } },
    { $group: { _id: '$createdBy', count: { $sum: 1 }, total: { $sum: '$finalAmount' }, paid: { $sum: '$paidAmount' } } },
  ]);
  const employees = await Employee.find({ merchantId }).select('userId fullName');
  const nameOf = new Map(employees.map((e) => [e.userId.toString(), e.fullName]));
  return rows.map((r) => ({
    userId: r._id.toString(),
    name: nameOf.get(r._id.toString()) || 'صاحب الحساب',
    count: r.count,
    total: round2(r.total),
    paid: round2(r.paid),
    remaining: round2(r.total - r.paid),
  }));
}

export async function buildSellerReport(merchantId: Types.ObjectId, range: ReportRange) {
  const match = { merchantId, createdAt: { $gte: range.from, $lte: range.to } };
  const orders = await Order.find(match).select('total paidAmount remainingAmount deliveryStatus');
  const byDelivery = new Map<string, number>();
  for (const o of orders) byDelivery.set(o.deliveryStatus, (byDelivery.get(o.deliveryStatus) || 0) + 1);
  return {
    ordersCount: orders.length,
    total: round2(orders.reduce((s, o) => s + o.total, 0)),
    collected: round2(orders.reduce((s, o) => s + o.paidAmount, 0)),
    remaining: round2(orders.reduce((s, o) => s + o.remainingAmount, 0)),
    delivered: byDelivery.get('delivered') || 0,
    returned: (byDelivery.get('returned') || 0) + (byDelivery.get('rejected') || 0),
    withCourier: byDelivery.get('with_courier') || 0,
    byDelivery: [...byDelivery.entries()].map(([status, count]) => ({ status, count })),
  };
}

export async function buildInvoiceBreakdown(merchantId: Types.ObjectId, range: ReportRange) {
  const invoices = await Invoice.find({ merchantId, createdAt: { $gte: range.from, $lte: range.to } }).select(
    'total paidAmount remainingAmount status'
  );
  return {
    count: invoices.length,
    total: round2(invoices.reduce((s, i) => s + i.total, 0)),
    paid: round2(invoices.reduce((s, i) => s + i.paidAmount, 0)),
    remaining: round2(invoices.reduce((s, i) => s + i.remainingAmount, 0)),
    unpaidCount: invoices.filter((i) => i.status === 'unpaid').length,
    partialCount: invoices.filter((i) => i.status === 'partial').length,
    paidCount: invoices.filter((i) => i.status === 'paid').length,
  };
}
