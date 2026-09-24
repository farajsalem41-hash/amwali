import { Types } from 'mongoose';
import { PaymentRequest, Invoice, Order, SupportTicket } from '../models';

function stamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function nextSequence(prefix: string, count: number): Promise<string> {
  return `${prefix}-${stamp()}-${String(count + 1).padStart(4, '0')}`;
}

export async function generateRequestNumber(merchantId: Types.ObjectId): Promise<string> {
  const count = await PaymentRequest.countDocuments({ merchantId });
  return nextSequence('PR', count);
}

export async function generateInvoiceNumber(merchantId: Types.ObjectId): Promise<string> {
  const count = await Invoice.countDocuments({ merchantId });
  return nextSequence('INV', count);
}

export async function generateOrderNumber(merchantId: Types.ObjectId): Promise<string> {
  const count = await Order.countDocuments({ merchantId });
  return nextSequence('ORD', count);
}

export async function generateTicketNumber(): Promise<string> {
  const count = await SupportTicket.countDocuments({});
  return nextSequence('TKT', count);
}
