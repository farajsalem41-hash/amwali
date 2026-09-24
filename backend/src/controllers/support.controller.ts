import { Request, Response } from 'express';
import { SupportTicket } from '../models';
import { merchantScope, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/async';
import { ApiError } from '../utils/errors';
import { meta, pagination } from '../utils/query';
import { generateTicketNumber } from '../utils/numbering';

export const listMyTickets = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const p = pagination(req.query as Record<string, unknown>);
  const filter = auth.merchantId ? { merchantId: auth.merchantId } : { userId: auth.userId };
  const [items, total] = await Promise.all([
    SupportTicket.find(filter).sort({ updatedAt: -1 }).skip(p.skip).limit(p.limit),
    SupportTicket.countDocuments(filter),
  ]);
  res.json({ items, meta: meta(total, p) });
});

export const createTicket = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { subject, category, description } = req.body as Record<string, string>;
  if (!subject?.trim() || !description?.trim()) throw ApiError.badRequest('العنوان والوصف مطلوبان');
  const ticket = await SupportTicket.create({
    merchantId: auth.merchantId,
    userId: auth.userId,
    ticketNumber: await generateTicketNumber(),
    subject: subject.trim(),
    category: category || 'other',
    description: description.trim(),
    status: 'open',
    messages: [
      { authorId: auth.userId, authorLabel: auth.fullName, isStaff: false, body: description.trim(), createdAt: new Date() },
    ],
  });
  res.status(201).json({ ticket });
});

async function findOwnTicket(req: Request) {
  const auth = requireAuth(req);
  const filter = auth.merchantId
    ? { _id: req.params.id, merchantId: auth.merchantId }
    : { _id: req.params.id, userId: auth.userId };
  const ticket = await SupportTicket.findOne(filter);
  if (!ticket) throw ApiError.notFound('التذكرة غير موجودة');
  return { ticket, auth };
}

export const getTicket = asyncHandler(async (req: Request, res: Response) => {
  const { ticket } = await findOwnTicket(req);
  res.json({ ticket });
});

export const replyToTicket = asyncHandler(async (req: Request, res: Response) => {
  const { ticket, auth } = await findOwnTicket(req);
  if (ticket.status === 'closed') throw ApiError.badRequest('التذكرة مغلقة');
  const { body } = req.body as { body: string };
  if (!body?.trim()) throw ApiError.badRequest('الرسالة مطلوبة');
  ticket.messages.push({
    authorId: auth.userId,
    authorLabel: auth.fullName,
    isStaff: false,
    body: body.trim(),
    attachmentIds: [],
    createdAt: new Date(),
  });
  if (ticket.status === 'waiting_user') ticket.status = 'in_progress';
  await ticket.save();
  res.json({ ticket });
});

export const closeTicket = asyncHandler(async (req: Request, res: Response) => {
  const { ticket } = await findOwnTicket(req);
  ticket.status = 'closed';
  await ticket.save();
  res.json({ ticket, message: 'تم إغلاق التذكرة' });
});
