import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Order, PaymentRequest, PaymentAccount, Courier, Product, StatusHistory } from '../models';
import { merchantScope, requireAuth } from '../middleware/auth';
import { ApiError } from '../utils/errors';
import { asyncHandler } from '../utils/async';
import { round2 } from '../utils/money';
import { generateOrderNumber, generateRequestNumber } from '../utils/numbering';
import { randomToken } from '../utils/tokens';
import { meta, pagination } from '../utils/query';
import { upsertCustomer, recalcCustomerTotals } from '../services/customer.service';
import { recordStatusChange } from '../services/paymentRequest.service';
import { audit } from '../services/audit.service';
import { publicPaymentUrl } from './paymentRequest.controller';
import { env } from '../config/env';

export function courierUrl(token: string): string {
  return `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/#/courier/${token}`;
}

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const p = pagination(req.query as Record<string, unknown>);
  const filter: Record<string, unknown> = { ...scope };
  if (req.query.deliveryStatus) filter.deliveryStatus = { $in: String(req.query.deliveryStatus).split(',') };
  if (req.query.courierId) filter.courierId = req.query.courierId;
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(p.skip)
      .limit(p.limit)
      .populate('customerId', 'name phone')
      .populate('courierId', 'name phone'),
    Order.countDocuments(filter),
  ]);
  res.json({ items, meta: meta(total, p) });
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const auth = requireAuth(req);
  const body = req.body as {
    customer: { name: string; phone: string; city?: string; address?: string };
    location?: { lat?: number; lng?: number };
    items: { name: string; productId?: string; quantity: number; unitPrice: number }[];
    deliveryFee: number;
    discountAmount: number;
    deliveryNotes?: string;
    courierId?: string;
    createPaymentRequest: boolean;
    paymentAccountIds?: string[];
  };

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
  const total = round2(Math.max(0, subtotal + round2(body.deliveryFee) - round2(body.discountAmount)));
  if (total <= 0) throw ApiError.badRequest('إجمالي الطلب يجب أن يكون أكبر من صفر');

  if (body.courierId) {
    const courier = await Courier.findOne({ _id: body.courierId, ...scope, isActive: true });
    if (!courier) throw ApiError.badRequest('المندوب غير صالح');
  }

  const customer = await upsertCustomer(scope.merchantId, body.customer);

  const order = await Order.create({
    ...scope,
    orderNumber: await generateOrderNumber(scope.merchantId),
    customerId: customer._id,
    city: body.customer.city,
    address: body.customer.address,
    location: body.location,
    items,
    subtotal,
    deliveryFee: round2(body.deliveryFee),
    discountAmount: round2(body.discountAmount),
    total,
    paidAmount: 0,
    remainingAmount: total,
    deliveryNotes: body.deliveryNotes,
    courierId: body.courierId,
    courierToken: randomToken(44),
    deliveryStatus: 'new',
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
      createdBy: auth.userId,
      customerId: customer._id,
      requestNumber: await generateRequestNumber(scope.merchantId),
      externalReference: order.orderNumber,
      originalAmount: total,
      discountType: 'none',
      discountValue: 0,
      discountAmount: 0,
      finalAmount: total,
      paidAmount: 0,
      remainingAmount: total,
      description: `طلب ${order.orderNumber}`,
      paymentAccountIds: accountIds,
      publicToken: randomToken(44),
      status: 'pending_payment',
      orderId: order._id,
    });
    order.paymentRequestId = request._id;
    await order.save();
    await recordStatusChange({
      merchantId: scope.merchantId,
      resource: 'payment_request',
      resourceId: request._id,
      toStatus: 'pending_payment',
      actorId: auth.userId,
      actorLabel: auth.fullName,
    });
  }

  await recordStatusChange({
    merchantId: scope.merchantId,
    resource: 'order',
    resourceId: order._id,
    field: 'deliveryStatus',
    toStatus: 'new',
    actorId: auth.userId,
    actorLabel: auth.fullName,
  });
  await recalcCustomerTotals(scope.merchantId, customer._id);
  await audit(req, { action: 'order.created', resource: 'order', resourceId: order._id.toString() });

  res.status(201).json({
    order,
    request,
    customerPaymentUrl: request ? publicPaymentUrl(request.publicToken) : null,
    courierUrl: courierUrl(order.courierToken),
  });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const order = await Order.findOne({ _id: req.params.id, ...scope })
    .populate('customerId', 'name phone city address')
    .populate('courierId', 'name phone area');
  if (!order) throw ApiError.notFound('الطلب غير موجود');
  const [request, history] = await Promise.all([
    order.paymentRequestId ? PaymentRequest.findOne({ _id: order.paymentRequestId, ...scope }) : null,
    StatusHistory.find({ resource: 'order', resourceId: order._id }).sort({ createdAt: -1 }),
  ]);
  res.json({
    order,
    request,
    history,
    customerPaymentUrl: request ? publicPaymentUrl(request.publicToken) : null,
    courierUrl: courierUrl(order.courierToken),
  });
});

export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const order = await Order.findOne({ _id: req.params.id, ...scope });
  if (!order) throw ApiError.notFound('الطلب غير موجود');
  const body = req.body as Record<string, unknown>;
  if (body.deliveryNotes !== undefined) order.deliveryNotes = body.deliveryNotes as string;
  if (body.address !== undefined) order.address = body.address as string;
  if (body.city !== undefined) order.city = body.city as string;
  if (body.courierId !== undefined) {
    if (body.courierId) {
      const courier = await Courier.findOne({ _id: body.courierId as string, ...scope, isActive: true });
      if (!courier) throw ApiError.badRequest('المندوب غير صالح');
      order.courierId = courier._id;
    } else {
      order.courierId = undefined;
    }
  }
  await order.save();
  await audit(req, { action: 'order.updated', resource: 'order', resourceId: order._id.toString() });
  res.json({ order });
});

export const updateDeliveryStatus = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const auth = requireAuth(req);
  const order = await Order.findOne({ _id: req.params.id, ...scope });
  if (!order) throw ApiError.notFound('الطلب غير موجود');
  const { deliveryStatus, reason } = req.body as { deliveryStatus: string; reason?: string };
  const previous = order.deliveryStatus;
  order.deliveryStatus = deliveryStatus as never;
  await order.save();
  await recordStatusChange({
    merchantId: scope.merchantId,
    resource: 'order',
    resourceId: order._id,
    field: 'deliveryStatus',
    fromStatus: previous,
    toStatus: deliveryStatus,
    actorId: auth.userId,
    actorLabel: auth.fullName,
    reason,
  });
  await audit(req, {
    action: 'order.delivery_status_changed',
    resource: 'order',
    resourceId: order._id.toString(),
    metadata: { from: previous, to: deliveryStatus },
  });
  res.json({ order });
});

export const regenerateCourierLink = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const order = await Order.findOne({ _id: req.params.id, ...scope });
  if (!order) throw ApiError.notFound('الطلب غير موجود');
  order.courierToken = randomToken(44);
  await order.save();
  await audit(req, { action: 'order.courier_link_rotated', resource: 'order', resourceId: order._id.toString() });
  res.json({ courierUrl: courierUrl(order.courierToken) });
});
