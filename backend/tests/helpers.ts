import request from 'supertest';
import mongoose from 'mongoose';
import type { Express } from 'express';

export async function bootApp(): Promise<Express> {
  const { createApp } = await import('../src/app');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI as string);
  }
  return createApp();
}

export async function resetDb() {
  const db = mongoose.connection.db;
  if (!db) return;
  const cols = await db.listCollections().toArray();
  await Promise.all(cols.map((c) => db.collection(c.name).deleteMany({})));
}

let counter = 0;
export function uniquePhone(): string {
  counter += 1;
  return `09${String(20000000 + Date.now() % 10000000 + counter).slice(0, 8)}`;
}

export interface Merchant {
  token: string;
  phone: string;
  merchantId: string;
  userId: string;
  accountId: string;
}

export async function createMerchant(
  app: Express,
  accountType: 'store' | 'company' | 'freelancer' | 'online_seller' = 'store',
  businessName = 'متجر الاختبار'
): Promise<Merchant> {
  const phone = uniquePhone();
  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      fullName: 'صاحب الحساب',
      phone,
      password: 'Test#1234',
      confirmPassword: 'Test#1234',
      accountType,
      businessName,
      city: 'طرابلس',
    })
    .expect(201);

  const verify = await request(app)
    .post('/api/auth/verify-otp')
    .send({ phone, code: reg.body.devCode, purpose: 'register' })
    .expect(201);

  const token = verify.body.token as string;

  const acc = await request(app)
    .post('/api/merchant/payment-accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      type: 'bank',
      provider: 'مصرف الجمهورية',
      accountHolder: businessName,
      accountNumber: '1234567890',
      isDefault: true,
    })
    .expect(201);

  return {
    token,
    phone,
    merchantId: verify.body.merchant.id,
    userId: verify.body.user.id,
    accountId: acc.body.account._id,
  };
}

export async function createRequest(
  app: Express,
  m: Merchant,
  body: Record<string, unknown> = {}
) {
  const res = await request(app)
    .post('/api/payment-requests')
    .set('Authorization', `Bearer ${m.token}`)
    .send({
      customer: { name: 'عميل تجربة', phone: '0925551234' },
      originalAmount: 1000,
      discountType: 'none',
      discountValue: 0,
      description: 'طلب اختبار',
      paymentAccountIds: [m.accountId],
      ...body,
    });
  return res;
}

/** Seeds the subscription plans the app expects (reset wipes every collection). */
export async function seedPlans() {
  const { SubscriptionPlan } = await import('../src/models');
  const plans = [
    { code: 'free', name: 'مجانية', price: 0, billingPeriodDays: 30, sortOrder: 1, limits: { paymentRequestsPerMonth: 20, employees: 0, branches: 1, paymentAccounts: 2 }, features: [] },
    { code: 'basic', name: 'أساسية', price: 49, billingPeriodDays: 30, sortOrder: 2, limits: { paymentRequestsPerMonth: 300, employees: 3, branches: 3, paymentAccounts: 6 }, features: [] },
    { code: 'pro', name: 'احترافية', price: 99, billingPeriodDays: 30, sortOrder: 3, limits: { paymentRequestsPerMonth: 5000, employees: 25, branches: 25, paymentAccounts: 20 }, features: [] },
  ];
  for (const plan of plans) {
    await SubscriptionPlan.updateOne({ code: plan.code }, { $set: plan }, { upsert: true });
  }
}
