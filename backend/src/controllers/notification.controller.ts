import { Request, Response } from 'express';
import { Notification } from '../models';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/async';
import { meta, pagination } from '../utils/query';
import { ApiError } from '../utils/errors';

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const p = pagination(req.query as Record<string, unknown>, 20);
  const filter: Record<string, unknown> = { userId: auth.userId };
  if (req.query.unread === 'true') filter.isRead = false;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: auth.userId, isRead: false }),
  ]);
  res.json({ items, meta: meta(total, p), unread });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const n = await Notification.findOne({ _id: req.params.id, userId: auth.userId });
  if (!n) throw ApiError.notFound('الإشعار غير موجود');
  n.isRead = true;
  await n.save();
  res.json({ notification: n });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  await Notification.updateMany({ userId: auth.userId, isRead: false }, { $set: { isRead: true } });
  res.json({ message: 'تم تعليم كل الإشعارات كمقروءة' });
});
