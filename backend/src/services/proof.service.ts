import { Types } from 'mongoose';
import { PaymentProof, PaymentRequest } from '../models';
import { round2 } from '../utils/money';

export interface MatchOutcome {
  matchResult: 'matched' | 'needs_review' | 'not_matched';
  matchReasons: string[];
}

/**
 * Rule-based verification of a declared transfer against the request.
 * This is NEVER a final payment confirmation — the merchant must confirm.
 * A future OCR/AI step can fill the declared* fields before calling this.
 */
export async function evaluateProof(params: {
  merchantId: Types.ObjectId;
  paymentRequestId: Types.ObjectId;
  declaredAmount?: number;
  declaredTransactionNumber?: string;
  targetPaymentAccountId?: Types.ObjectId;
  declaredTransferDate?: Date;
}): Promise<MatchOutcome> {
  const reasons: string[] = [];
  let score = 0;
  let hard = false;

  const request = await PaymentRequest.findById(params.paymentRequestId).select(
    'remainingAmount finalAmount paymentAccountIds createdAt'
  );
  if (!request) return { matchResult: 'needs_review', matchReasons: ['طلب الدفع غير موجود'] };

  if (params.declaredAmount != null) {
    const amount = round2(params.declaredAmount);
    if (Math.abs(amount - request.remainingAmount) < 0.01) {
      reasons.push('المبلغ يطابق المتبقي');
      score += 2;
    } else if (amount > 0 && amount < request.remainingAmount) {
      reasons.push('المبلغ أقل من المتبقي (دفعة جزئية)');
      score += 1;
    } else if (amount > request.remainingAmount) {
      reasons.push('المبلغ أكبر من المتبقي');
      hard = true;
    }
  } else {
    reasons.push('لم يتم إدخال المبلغ');
  }

  if (params.targetPaymentAccountId) {
    const belongs = request.paymentAccountIds.some((id) => id.equals(params.targetPaymentAccountId!));
    if (belongs) {
      reasons.push('الحساب المستقبل من حسابات الطلب');
      score += 1;
    } else {
      reasons.push('الحساب المستقبل غير مرتبط بالطلب');
      hard = true;
    }
  }

  if (params.declaredTransactionNumber) {
    const duplicate = await PaymentProof.countDocuments({
      merchantId: params.merchantId,
      declaredTransactionNumber: params.declaredTransactionNumber,
    });
    if (duplicate > 0) {
      reasons.push('رقم العملية مستخدم سابقًا');
      hard = true;
    } else {
      score += 1;
    }
  } else {
    reasons.push('لم يتم إدخال رقم العملية');
  }

  if (params.declaredTransferDate) {
    const t = params.declaredTransferDate.getTime();
    if (t > Date.now() + 24 * 3600 * 1000) {
      reasons.push('تاريخ التحويل في المستقبل');
      hard = true;
    } else if (t < request.createdAt.getTime() - 24 * 3600 * 1000) {
      reasons.push('تاريخ التحويل قبل إنشاء الطلب');
      hard = true;
    } else {
      score += 1;
    }
  }

  if (hard) return { matchResult: 'not_matched', matchReasons: reasons };
  if (score >= 4) return { matchResult: 'matched', matchReasons: reasons };
  return { matchResult: 'needs_review', matchReasons: reasons };
}
