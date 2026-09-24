import { Types } from 'mongoose';
import { PaymentRequest, Payment, StatusHistory, PaymentProof, Invoice, Order } from '../models';
import { PaymentRequestStatus } from '../config/constants';
import { computeBalances, round2 } from '../utils/money';
import { ApiError } from '../utils/errors';
import { recalcCustomerTotals } from './customer.service';

export async function recordStatusChange(params: {
  merchantId?: Types.ObjectId;
  resource: 'payment_request' | 'order' | 'invoice' | 'support_ticket' | 'subscription';
  resourceId: Types.ObjectId;
  fromStatus?: string;
  toStatus: string;
  field?: string;
  actorId?: Types.ObjectId;
  actorLabel?: string;
  reason?: string;
}) {
  if (params.fromStatus === params.toStatus) return;
  await StatusHistory.create({
    merchantId: params.merchantId,
    resource: params.resource,
    resourceId: params.resourceId,
    field: params.field || 'status',
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    actorId: params.actorId,
    actorLabel: params.actorLabel,
    reason: params.reason,
  });
}

// Only cancellation is final: a rejected proof still allows the customer to re-upload.
const TERMINAL: PaymentRequestStatus[] = ['cancelled'];

/**
 * Single source of truth for payment request money + status.
 * Recomputes paid/remaining from Payment records and derives the status.
 */
export async function recalcPaymentRequest(
  requestId: Types.ObjectId,
  actor?: { id?: Types.ObjectId; label?: string; reason?: string }
) {
  const request = await PaymentRequest.findById(requestId);
  if (!request) throw ApiError.notFound('طلب الدفع غير موجود');

  const agg = await Payment.aggregate<{ _id: null; total: number }>([
    { $match: { paymentRequestId: request._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const paidRaw = round2(agg[0]?.total || 0);
  const { paid, remaining } = computeBalances(request.finalAmount, Math.min(paidRaw, request.finalAmount));

  const pendingProofs = await PaymentProof.countDocuments({
    paymentRequestId: request._id,
    reviewStatus: 'pending',
  });
  const lastProof = await PaymentProof.findOne({ paymentRequestId: request._id }).sort({ createdAt: -1 }).select('reviewStatus');

  const previous = request.status;
  let next: PaymentRequestStatus = previous;

  if (!TERMINAL.includes(previous)) {
    if (remaining <= 0 && paid > 0) next = 'fully_paid';
    else if (paid > 0) next = 'partial';
    else if (pendingProofs > 0) next = 'under_review';
    else if (previous === 'expired') next = 'expired';
    else if (lastProof?.reviewStatus === 'rejected') next = 'rejected';
    else next = 'pending_payment';

    if (next !== 'fully_paid' && request.expiresAt && request.expiresAt.getTime() < Date.now() && paid === 0) {
      next = 'expired';
    }
  }

  request.paidAmount = paid;
  request.remainingAmount = remaining;
  request.status = next;
  await request.save();

  if (previous !== next) {
    await recordStatusChange({
      merchantId: request.merchantId,
      resource: 'payment_request',
      resourceId: request._id,
      fromStatus: previous,
      toStatus: next,
      actorId: actor?.id,
      actorLabel: actor?.label,
      reason: actor?.reason,
    });
  }

  await recalcCustomerTotals(request.merchantId, request.customerId);
  await syncLinkedDocuments(request._id);
  return request;
}

/** Keeps the linked invoice / order totals aligned with the payment request. */
async function syncLinkedDocuments(requestId: Types.ObjectId) {
  const request = await PaymentRequest.findById(requestId).select(
    'invoiceId orderId paidAmount remainingAmount finalAmount merchantId'
  );
  if (!request) return;

  if (request.invoiceId) {
    const invoice = await Invoice.findById(request.invoiceId);
    if (invoice) {
      invoice.paidAmount = request.paidAmount;
      invoice.remainingAmount = round2(Math.max(0, invoice.total - request.paidAmount));
      const previous = invoice.status;
      invoice.status = invoice.remainingAmount <= 0 && invoice.paidAmount > 0 ? 'paid' : invoice.paidAmount > 0 ? 'partial' : 'unpaid';
      await invoice.save();
      if (previous !== invoice.status) {
        await recordStatusChange({
          merchantId: invoice.merchantId,
          resource: 'invoice',
          resourceId: invoice._id,
          fromStatus: previous,
          toStatus: invoice.status,
        });
      }
    }
  }

  if (request.orderId) {
    const order = await Order.findById(request.orderId);
    if (order) {
      order.paidAmount = request.paidAmount;
      order.remainingAmount = round2(Math.max(0, order.total - request.paidAmount));
      await order.save();
    }
  }
}

/** Marks overdue, unpaid requests as expired. Safe to run repeatedly. */
export async function expireOverdueRequests(): Promise<number> {
  const now = new Date();
  const candidates = await PaymentRequest.find({
    expiresAt: { $lt: now },
    status: { $in: ['pending_payment', 'proof_uploaded', 'under_review'] },
    paidAmount: 0,
  }).select('_id merchantId status');

  for (const r of candidates) {
    await PaymentRequest.updateOne({ _id: r._id }, { $set: { status: 'expired' } });
    await recordStatusChange({
      merchantId: r.merchantId,
      resource: 'payment_request',
      resourceId: r._id,
      fromStatus: r.status,
      toStatus: 'expired',
      actorLabel: 'system',
      reason: 'انتهت صلاحية الطلب',
    });
  }
  return candidates.length;
}
