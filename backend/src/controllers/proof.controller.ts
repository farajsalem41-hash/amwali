import { Request, Response } from 'express';
import { PaymentProof, PaymentRequest, Payment } from '../models';
import { merchantScope, requireAuth } from '../middleware/auth';
import { ApiError } from '../utils/errors';
import { asyncHandler } from '../utils/async';
import { meta, pagination } from '../utils/query';
import { round2 } from '../utils/money';
import { recalcPaymentRequest } from '../services/paymentRequest.service';
import { audit } from '../services/audit.service';
import { notifyMerchant } from '../services/notification.service';

export const listProofs = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const p = pagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { ...scope };
  if (req.query.reviewStatus) filter.reviewStatus = req.query.reviewStatus;
  const [items, total] = await Promise.all([
    PaymentProof.find(filter)
      .sort({ createdAt: -1 })
      .skip(p.skip)
      .limit(p.limit)
      .populate('paymentRequestId', 'requestNumber finalAmount remainingAmount status')
      .populate('customerId', 'name phone'),
    PaymentProof.countDocuments(filter),
  ]);
  res.json({ items, meta: meta(total, p) });
});

/**
 * Final payment confirmation. Automatic matching is only a hint —
 * the merchant (or an authorized employee) makes the decision here.
 */
export const reviewProof = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const auth = requireAuth(req);
  const proof = await PaymentProof.findOne({ _id: req.params.id, ...scope });
  if (!proof) throw ApiError.notFound('الإثبات غير موجود');
  if (proof.reviewStatus !== 'pending') throw ApiError.badRequest('تمت مراجعة هذا الإثبات مسبقًا');

  const request = await PaymentRequest.findOne({ _id: proof.paymentRequestId, ...scope });
  if (!request) throw ApiError.notFound('طلب الدفع غير موجود');

  const { decision, amount, reason } = req.body as { decision: 'approve' | 'reject'; amount?: number; reason?: string };

  if (decision === 'reject') {
    proof.reviewStatus = 'rejected';
    proof.reviewedBy = auth.userId;
    proof.reviewedAt = new Date();
    proof.rejectionReason = reason;
    await proof.save();
    await recalcPaymentRequest(request._id, { id: auth.userId, label: auth.fullName, reason: 'تم رفض الإثبات' });
    await audit(req, { action: 'proof.rejected', resource: 'payment_proof', resourceId: proof._id.toString() });
    return res.json({ proof, message: 'تم رفض الإثبات' });
  }

  const payAmount = round2(amount ?? proof.declaredAmount ?? request.remainingAmount);
  if (!Number.isFinite(payAmount) || payAmount <= 0) throw ApiError.badRequest('أدخل المبلغ المؤكد');
  if (payAmount > request.remainingAmount + 0.001) {
    throw ApiError.badRequest(`المبلغ أكبر من المتبقي (${request.remainingAmount})`);
  }
  if (proof.declaredTransactionNumber) {
    const dup = await Payment.findOne({ ...scope, transactionNumber: proof.declaredTransactionNumber });
    if (dup) throw ApiError.conflict('رقم العملية مستخدم مسبقًا في دفعة أخرى');
  }

  const payment = await Payment.create({
    merchantId: scope.merchantId,
    paymentRequestId: request._id,
    customerId: request.customerId,
    amount: payAmount,
    method: 'bank_transfer',
    paymentAccountId: proof.targetPaymentAccountId,
    transactionNumber: proof.declaredTransactionNumber,
    transferredAt: proof.declaredTransferDate || new Date(),
    senderName: proof.declaredSender,
    proofId: proof._id,
    confirmedBy: auth.userId,
  });

  proof.reviewStatus = 'approved';
  proof.reviewedBy = auth.userId;
  proof.reviewedAt = new Date();
  proof.paymentId = payment._id;
  await proof.save();

  const updated = await recalcPaymentRequest(request._id, { id: auth.userId, label: auth.fullName, reason: 'تم تأكيد الدفع' });
  await audit(req, {
    action: 'proof.approved',
    resource: 'payment_proof',
    resourceId: proof._id.toString(),
    metadata: { amount: payAmount },
  });
  await notifyMerchant({
    merchantId: scope.merchantId,
    type: 'payment_confirmed',
    title: `تم تأكيد دفعة على الطلب ${request.requestNumber}`,
    body: `المبلغ ${payAmount} — المتبقي ${updated.remainingAmount}`,
    resource: 'payment_request',
    resourceId: request._id,
  });

  res.json({ proof, payment, request: updated, message: 'تم تأكيد الدفع' });
});
