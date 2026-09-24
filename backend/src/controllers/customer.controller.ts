import { Request, Response } from 'express';
import { Customer, PaymentRequest, Payment, PaymentProof } from '../models';
import { merchantScope } from '../middleware/auth';
import { ApiError } from '../utils/errors';
import { asyncHandler } from '../utils/async';
import { escapeRegex, meta, pagination } from '../utils/query';
import { normalizePhone } from '../utils/phone';
import { audit } from '../services/audit.service';
import { recalcCustomerTotals } from '../services/customer.service';

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const p = pagination(req.query as Record<string, unknown>);
  const search = String(req.query.search || '').trim();
  const filter: Record<string, unknown> = { ...scope };
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { phone: rx }];
  }
  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ lastActivityAt: -1, createdAt: -1 }).skip(p.skip).limit(p.limit),
    Customer.countDocuments(filter),
  ]);
  res.json({ items, meta: meta(total, p) });
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const phone = normalizePhone(String(req.body.phone || ''));
  if (!phone) throw ApiError.badRequest('رقم الهاتف مطلوب');
  const exists = await Customer.findOne({ ...scope, phone });
  if (exists) throw ApiError.conflict('العميل موجود مسبقًا');
  const customer = await Customer.create({
    ...scope,
    phone,
    name: String(req.body.name || '').trim(),
    city: req.body.city,
    address: req.body.address,
    notes: req.body.notes,
  });
  await audit(req, { action: 'customer.created', resource: 'customer', resourceId: customer._id.toString() });
  res.status(201).json({ customer });
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const customer = await Customer.findOne({ _id: req.params.id, ...scope });
  if (!customer) throw ApiError.notFound('العميل غير موجود');

  const [requests, payments, proofs] = await Promise.all([
    PaymentRequest.find({ ...scope, customerId: customer._id }).sort({ createdAt: -1 }).limit(50),
    Payment.find({ ...scope, customerId: customer._id }).sort({ createdAt: -1 }).limit(50),
    PaymentProof.find({ ...scope, customerId: customer._id }).sort({ createdAt: -1 }).limit(50),
  ]);

  res.json({
    customer,
    requests,
    payments,
    proofs,
    totals: {
      requestsCount: requests.length,
      totalPaid: customer.totalPaid,
      totalRemaining: customer.totalRemaining,
    },
  });
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const customer = await Customer.findOne({ _id: req.params.id, ...scope });
  if (!customer) throw ApiError.notFound('العميل غير موجود');
  const body = req.body as Record<string, string>;
  if (body.name) customer.name = body.name.trim();
  if (body.city !== undefined) customer.city = body.city;
  if (body.address !== undefined) customer.address = body.address;
  if (body.notes !== undefined) customer.notes = body.notes;
  if (body.phone) {
    const phone = normalizePhone(body.phone);
    if (phone !== customer.phone) {
      const dup = await Customer.findOne({ ...scope, phone });
      if (dup) throw ApiError.conflict('رقم الهاتف مستخدم لعميل آخر');
      customer.phone = phone;
    }
  }
  await customer.save();
  await audit(req, { action: 'customer.updated', resource: 'customer', resourceId: customer._id.toString() });
  res.json({ customer });
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const customer = await Customer.findOne({ _id: req.params.id, ...scope });
  if (!customer) throw ApiError.notFound('العميل غير موجود');
  const linked = await PaymentRequest.countDocuments({ ...scope, customerId: customer._id });
  if (linked > 0) throw ApiError.badRequest('لا يمكن حذف عميل لديه طلبات دفع');
  await customer.deleteOne();
  await audit(req, { action: 'customer.deleted', resource: 'customer', resourceId: customer._id.toString() });
  res.json({ message: 'تم حذف العميل' });
});

export const refreshCustomerTotals = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const customer = await Customer.findOne({ _id: req.params.id, ...scope });
  if (!customer) throw ApiError.notFound('العميل غير موجود');
  await recalcCustomerTotals(scope.merchantId, customer._id);
  const updated = await Customer.findById(customer._id);
  res.json({ customer: updated });
});
