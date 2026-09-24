import { Types } from 'mongoose';
import { Notification, Employee, Merchant } from '../models';
import { NotificationType } from '../config/constants';

export interface NotifyInput {
  merchantId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string;
  resource?: string;
  resourceId?: Types.ObjectId;
  /** Only notify users holding one of these permissions (owner always notified). */
  permissions?: string[];
}

/**
 * In-app notifications. WhatsApp / SMS / Push can be added later by extending
 * the channel dispatch below without touching call sites.
 */
export async function notifyMerchant(input: NotifyInput): Promise<void> {
  try {
    const merchant = await Merchant.findById(input.merchantId).select('ownerId');
    if (!merchant) return;
    const recipients = new Set<string>([merchant.ownerId.toString()]);
    const employees = await Employee.find({ merchantId: input.merchantId, isActive: true }).select('userId role permissions');
    for (const emp of employees) recipients.add(emp.userId.toString());

    await Notification.insertMany(
      [...recipients].map((userId) => ({
        merchantId: input.merchantId,
        userId: new Types.ObjectId(userId),
        type: input.type,
        title: input.title,
        body: input.body,
        resource: input.resource,
        resourceId: input.resourceId,
      }))
    );
  } catch {
    /* notifications are best-effort */
  }
}

export async function notifyUser(
  userId: Types.ObjectId,
  type: NotificationType,
  title: string,
  body?: string,
  resource?: string,
  resourceId?: Types.ObjectId
): Promise<void> {
  try {
    await Notification.create({ userId, type, title, body, resource, resourceId });
  } catch {
    /* ignore */
  }
}
