import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Invoice, PaymentRequest, PaymentAccount, Product } from '../models';
import { merchantScope, requireAuth } from '../middleware/auth';
import { ApiError } from '../utils/errors';
import { asyncHandler } from '../utils/async';
import { computeDiscount, round2 } from '../utils/money';
import { generateInvoiceNumber, generateRequestNumber } from '../utils/numbering';
import { randomToken } from '../utils/tokens';
import { meta, pagination } from '../utils/query';
import { upsertCustomer, recalcCustomerTotals } from '../services/customer.service';
import { recordStatusChange } from '../services/paymentRequest.service';
import { audit } from '../services/audit.service';
import { publicPaymentUrl } from './paymentRequest.controller';

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const p = pagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { ...scope };
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('customerId', 'name phone'),
    Invoice.countDocuments(filter),
  ]);
  res.json({ items, meta: meta(total, p) });
});

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const auth = requireAuth(req);
  const body = req.body as {
    customer: { name: string; phone: string };
    items: { name: string; productId?: string; quantity: number; unitPrice: number }[];
    discountType: 'none' | 'fixed' | 'percentage';
    discountValue: number;
    notes?: string;
    dueDate?: string;
    branchId?: string;
    createPaymentRequest: boolean;
    paymentAccountIds?: string[];
  };

  // Prices are always recomputed on the backend.
  const items = [];
  for (const raw of body.items) {
    let unitPrice = round2(raw.unitPrice);
    if (raw.productId) {
      const product = await Product.findOne({ _id: raw.productId, ...scope });
      if (!product) throw ApiError.badRequest('منتج غير صالح');
      if (raw.unitPrice === undefined) unitPrice = product.price;
    }
    items.push({
      name: raw.name,
      productId: raw.productId ? new Types.ObjectId(raw.productId) : undefined,
      quantity: raw.quantity,
      unitPrice,
      lineTotal: round2(raw.quantity * unitPrice),
    });
  }
  const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
  const { discountAmount, finalAmount } = computeDiscount(subtotal, body.discountType, body.discountValue);
  if (finalAmount <= 0) throw ApiError.badRequest('إجمالي الفاتورة يجب أن يكون أكبر من صفر');

  const customer = await upsertCustomer(scope.merchantId, body.customer);

  const invoice = await Invoice.create({
    ...scope,
    branchId: body.branchId,
    customerId: customer._id,
    invoiceNumber: await generateInvoiceNumber(scope.merchantId),
    items,
    subtotal,
    discountType: body.discountType,
    discountValue: body.discountValue,
    discountAmount,
    total: finalAmount,
    paidAmount: 0,
    remainingAmount: finalAmount,
    notes: body.notes,
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    status: 'unpaid',
    createdBy: auth.userId,
  });

  let request = null;
  if (body.createPaymentRequest) {
    const accountIds = body.paymentAccountIds?.length
      ? body.paymentAccountIds
      : (await PaymentAccount.find({ ...scope, isActive: true }).select('_id')).map((a) => a._id.toString());
    if (!accountIds.length) throw ApiError.badRequest('أضف حسابًا بنكيًا أولًا');

    request = await PaymentRequest.create({
      ...scope,
      branchId: body.branchId,
      createdBy: auth.userId,
      customerId: customer._id,
      requestNumber: await generateRequestNumber(scope.merchantId),
      externalReference: invoice.invoiceNumber,
      originalAmount: subtotal,
      discountType: body.discountType,
      discountValue: body.discountValue,
      discountAmount,
      finalAmount,
      paidAmount: 0,
      remainingAmount: finalAmount,
      description: `فاتورة ${invoice.invoiceNumber}`,
      paymentAccountIds: accountIds,
      publicToken: randomToken(44),
      status: 'pending_payment',
      invoiceId: invoice._id,
      expiresAt: invoice.dueDate,
    });
    invoice.paymentRequestId = request._id;
    await invoice.save();
    await recordStatusChange({
      merchantId: scope.merchantId,
      resource: 'payment_request',
      resourceId: request._id,
      toStatus: 'pending_payment',
      actorId: auth.userId,
      actorLabel: auth.fullName,
    });
  }

  await recalcCustomerTotals(scope.merchantId, customer._id);
  await audit(req, { action: 'invoice.created', resource: 'invoice', resourceId: invoice._id.toString() });
  res.status(201).json({
    invoice,
    request,
    publicUrl: request ? publicPaymentUrl(request.publicToken) : null,
  });
});

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const invoice = await Invoice.findOne({ _id: req.params.id, ...scope }).populate('customerId', 'name phone');
  if (!invoice) throw ApiError.notFound('الفاتورة غير موجودة');
  const request = invoice.paymentRequestId ? await PaymentRequest.findOne({ _id: invoice.paymentRequestId, ...scope }) : null;
  res.json({ invoice, request, publicUrl: request ? publicPaymentUrl(request.publicToken) : null });
});

export const updateInvoice = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const invoice = await Invoice.findOne({ _id: req.params.id, ...scope });
  if (!invoice) throw ApiError.notFound('الفاتورة غير موجودة');
  if (invoice.paidAmount > 0) throw ApiError.badRequest('لا يمكن تعديل فاتورة عليها مدفوعات');
  const body = req.body as Record<string, unknown>;
  if (body.notes !== undefined) invoice.notes = body.notes as string;
  if (body.dueDate !== undefined) invoice.dueDate = body.dueDate ? new Date(body.dueDate as string) : undefined;
  await invoice.save();
  await audit(req, { action: 'invoice.updated', resource: 'invoice', resourceId: invoice._id.toString() });
  res.json({ invoice });
});
