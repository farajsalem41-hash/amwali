import { Types } from 'mongoose';
import { Customer, Payment, PaymentRequest } from '../models';
import { round2 } from '../utils/money';
import { normalizePhone } from '../utils/phone';

/** Finds or creates the customer, always reusing merchantId + phone. */
export async function upsertCustomer(
  merchantId: Types.ObjectId,
  data: { name: string; phone: string; city?: string; address?: string }
) {
  const phone = normalizePhone(data.phone);
  let customer = await Customer.findOne({ merchantId, phone });
  if (!customer) {
    customer = await Customer.create({
      merchantId,
      phone,
      name: data.name.trim(),
      city: data.city,
      address: data.address,
      lastActivityAt: new Date(),
    });
  } else {
    let dirty = false;
    if (data.name && data.name.trim() && data.name.trim() !== customer.name) {
      customer.name = data.name.trim();
      dirty = true;
    }
    if (data.city && data.city !== customer.city) {
      customer.city = data.city;
      dirty = true;
    }
    if (data.address && data.address !== customer.address) {
      customer.address = data.address;
      dirty = true;
    }
    customer.lastActivityAt = new Date();
    if (dirty) await customer.save();
    else await customer.save();
  }
  return customer;
}

/** Recomputes aggregate customer totals from source records (no debt/credit system). */
export async function recalcCustomerTotals(merchantId: Types.ObjectId, customerId: Types.ObjectId) {
  const [requests, payments] = await Promise.all([
    PaymentRequest.find({ merchantId, customerId, status: { $nin: ['cancelled', 'rejected'] } }).select(
      'remainingAmount'
    ),
    Payment.aggregate<{ _id: null; total: number }>([
      { $match: { merchantId, customerId } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  const totalPaid = round2(payments[0]?.total || 0);
  const totalRemaining = round2(requests.reduce((s, r) => s + (r.remainingAmount || 0), 0));
  const requestsCount = await PaymentRequest.countDocuments({ merchantId, customerId });
  await Customer.updateOne(
    { _id: customerId, merchantId },
    { $set: { totalPaid, totalRemaining, requestsCount, lastActivityAt: new Date() } }
  );
}
