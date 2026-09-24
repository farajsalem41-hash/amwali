import { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLog } from '../models';

export interface AuditInput {
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  merchantId?: Types.ObjectId;
}

/** Records a sensitive operation. Never throws — auditing must not break the request. */
export async function audit(req: Request, input: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      merchantId: input.merchantId ?? req.auth?.merchantId,
      actorId: req.auth?.userId,
      actorName: req.auth?.fullName,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      metadata: input.metadata,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      device: (req.headers['user-agent'] as string || '').slice(0, 200),
    });
  } catch {
    /* ignore */
  }
}
