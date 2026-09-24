import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { Branch, Employee, User, Product, Courier, PaymentRequest } from '../models';
import { merchantScope, requireAuth } from '../middleware/auth';
import { ApiError } from '../utils/errors';
import { asyncHandler } from '../utils/async';
import { meta, pagination, escapeRegex } from '../utils/query';
import { normalizePhone } from '../utils/phone';
import { audit } from '../services/audit.service';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../config/constants';
import { randomNumericCode } from '../utils/tokens';

/* ---------- Branches ---------- */

export const listBranches = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const branches = await Branch.find(scope).sort({ createdAt: 1 });
  res.json({ items: branches });
});

export const createBranch = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const branch = await Branch.create({ ...req.body, ...scope });
  await audit(req, { action: 'branch.created', resource: 'branch', resourceId: branch._id.toString() });
  res.status(201).json({ branch });
});

export const updateBranch = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const branch = await Branch.findOneAndUpdate({ _id: req.params.id, ...scope }, { $set: req.body }, { new: true });
  if (!branch) throw ApiError.notFound('الفرع غير موجود');
  await audit(req, { action: 'branch.updated', resource: 'branch', resourceId: branch._id.toString() });
  res.json({ branch });
});

export const deleteBranch = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const branch = await Branch.findOne({ _id: req.params.id, ...scope });
  if (!branch) throw ApiError.notFound('الفرع غير موجود');
  const linked = await PaymentRequest.countDocuments({ ...scope, branchId: branch._id });
  if (linked > 0) throw ApiError.badRequest('لا يمكن حذف فرع مرتبط بطلبات، يمكنك تعطيله');
  await branch.deleteOne();
  await audit(req, { action: 'branch.deleted', resource: 'branch', resourceId: branch._id.toString() });
  res.json({ message: 'تم حذف الفرع' });
});

/* ---------- Employees (RBAC) ---------- */

export const listEmployees = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const employees = await Employee.find(scope).sort({ createdAt: -1 });
  res.json({ items: employees, availablePermissions: PERMISSIONS, rolePermissions: ROLE_PERMISSIONS });
});

export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const body = req.body as {
    fullName: string;
    phone: string;
    password?: string;
    role: 'manager' | 'accountant' | 'cashier' | 'custom';
    permissions?: string[];
    branchIds?: string[];
  };
  const phone = normalizePhone(body.phone);
  const existing = await User.findOne({ phone });
  if (existing) throw ApiError.conflict('رقم الهاتف مستخدم في حساب آخر');

  if (body.branchIds?.length) {
    const count = await Branch.countDocuments({ ...scope, _id: { $in: body.branchIds } });
    if (count !== body.branchIds.length) throw ApiError.badRequest('أحد الفروع غير صالح');
  }

  const tempPassword = body.password || `Am${randomNumericCode(6)}`;
  const user = await User.create({
    fullName: body.fullName,
    phone,
    passwordHash: await bcrypt.hash(tempPassword, 12),
    merchantId: scope.merchantId,
    phoneVerified: true,
  });

  const permissions =
    body.role === 'custom'
      ? (body.permissions || []).filter((p) => (PERMISSIONS as readonly string[]).includes(p))
      : ROLE_PERMISSIONS[body.role];

  const employee = await Employee.create({
    ...scope,
    userId: user._id,
    fullName: body.fullName,
    phone,
    role: body.role,
    permissions,
    branchIds: body.branchIds?.map((id) => new Types.ObjectId(id)) || [],
  });

  user.employeeId = employee._id;
  await user.save();

  await audit(req, {
    action: 'employee.created',
    resource: 'employee',
    resourceId: employee._id.toString(),
    metadata: { role: body.role },
  });
  res.status(201).json({ employee, temporaryPassword: body.password ? undefined : tempPassword });
});

export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const employee = await Employee.findOne({ _id: req.params.id, ...scope });
  if (!employee) throw ApiError.notFound('الموظف غير موجود');
  const body = req.body as Record<string, unknown>;

  if (body.fullName) employee.fullName = body.fullName as string;
  if (body.role) {
    employee.role = body.role as never;
    if (body.role !== 'custom') employee.permissions = ROLE_PERMISSIONS[body.role as 'manager'];
  }
  if (body.permissions && employee.role === 'custom') {
    employee.permissions = (body.permissions as string[]).filter((p) => (PERMISSIONS as readonly string[]).includes(p));
  }
  if (body.branchIds) {
    const ids = body.branchIds as string[];
    const count = await Branch.countDocuments({ ...scope, _id: { $in: ids } });
    if (count !== ids.length) throw ApiError.badRequest('أحد الفروع غير صالح');
    employee.branchIds = ids.map((id) => new Types.ObjectId(id));
  }
  if (body.isActive !== undefined) {
    employee.isActive = Boolean(body.isActive);
    await User.updateOne({ _id: employee.userId }, { $set: { isActive: employee.isActive } });
  }
  if (body.password) {
    await User.updateOne({ _id: employee.userId }, { $set: { passwordHash: await bcrypt.hash(body.password as string, 12) } });
  }

  await employee.save();
  await audit(req, { action: 'employee.updated', resource: 'employee', resourceId: employee._id.toString() });
  res.json({ employee });
});

export const deleteEmployee = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const employee = await Employee.findOne({ _id: req.params.id, ...scope });
  if (!employee) throw ApiError.notFound('الموظف غير موجود');
  employee.isActive = false;
  await employee.save();
  await User.updateOne({ _id: employee.userId }, { $set: { isActive: false } });
  await audit(req, { action: 'employee.disabled', resource: 'employee', resourceId: employee._id.toString() });
  res.json({ message: 'تم تعطيل الموظف' });
});

/* ---------- Products / Services ---------- */

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const p = pagination(req.query as Record<string, unknown>, 50);
  const filter: Record<string, unknown> = { ...scope };
  const search = String(req.query.search || '').trim();
  if (search) filter.name = new RegExp(escapeRegex(search), 'i');
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    Product.countDocuments(filter),
  ]);
  res.json({ items, meta: meta(total, p) });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const product = await Product.create({ ...req.body, ...scope });
  await audit(req, { action: 'product.created', resource: 'product', resourceId: product._id.toString() });
  res.status(201).json({ product });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const product = await Product.findOneAndUpdate({ _id: req.params.id, ...scope }, { $set: req.body }, { new: true });
  if (!product) throw ApiError.notFound('المنتج غير موجود');
  res.json({ product });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const product = await Product.findOneAndDelete({ _id: req.params.id, ...scope });
  if (!product) throw ApiError.notFound('المنتج غير موجود');
  res.json({ message: 'تم حذف المنتج' });
});

/* ---------- Couriers ---------- */

export const listCouriers = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const items = await Courier.find(scope).sort({ createdAt: -1 });
  res.json({ items });
});

export const createCourier = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const courier = await Courier.create({ ...req.body, phone: normalizePhone(req.body.phone), ...scope });
  await audit(req, { action: 'courier.created', resource: 'courier', resourceId: courier._id.toString() });
  res.status(201).json({ courier });
});

export const updateCourier = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const courier = await Courier.findOneAndUpdate({ _id: req.params.id, ...scope }, { $set: req.body }, { new: true });
  if (!courier) throw ApiError.notFound('المندوب غير موجود');
  res.json({ courier });
});

export const deleteCourier = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  const courier = await Courier.findOneAndDelete({ _id: req.params.id, ...scope });
  if (!courier) throw ApiError.notFound('المندوب غير موجود');
  res.json({ message: 'تم حذف المندوب' });
});

/* ---------- Audit log (merchant scope) ---------- */

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const scope = merchantScope(req);
  requireAuth(req);
  const p = pagination(req.query as Record<string, unknown>, 30);
  const { AuditLog } = await import('../models');
  const [items, total] = await Promise.all([
    AuditLog.find(scope).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    AuditLog.countDocuments(scope),
  ]);
  res.json({ items, meta: meta(total, p) });
});
