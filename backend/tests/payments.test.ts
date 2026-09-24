import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import type { Express } from 'express';
import { bootApp, resetDb, createMerchant, createRequest, Merchant } from './helpers';

let app: Express;
let m: Merchant;

beforeAll(async () => {
  app = await bootApp();
  await resetDb();
  m = await createMerchant(app);
});
afterAll(async () => {
  await mongoose.disconnect();
});

const auth = () => ({ Authorization: `Bearer ${m.token}` });

describe('Discount calculations (backend is the only source of truth)', () => {
  it('applies a percentage discount', async () => {
    const res = await createRequest(app, m, { originalAmount: 1000, discountType: 'percentage', discountValue: 15 });
    expect(res.body.request.discountAmount).toBe(150);
    expect(res.body.request.finalAmount).toBe(850);
    expect(res.body.request.remainingAmount).toBe(850);
  });

  it('applies a fixed discount', async () => {
    const res = await createRequest(app, m, { originalAmount: 500, discountType: 'fixed', discountValue: 120.5 });
    expect(res.body.request.discountAmount).toBe(120.5);
    expect(res.body.request.finalAmount).toBe(379.5);
  });

  it('rejects a discount larger than the amount', async () => {
    const res = await createRequest(app, m, { originalAmount: 100, discountType: 'fixed', discountValue: 200 });
    expect(res.status).toBe(400);
  });

  it('rejects a percentage above 100', async () => {
    const res = await createRequest(app, m, { originalAmount: 100, discountType: 'percentage', discountValue: 150 });
    expect(res.status).toBe(400);
  });

  it('rejects a zero or negative amount', async () => {
    expect((await createRequest(app, m, { originalAmount: 0 })).status).toBe(400);
    expect((await createRequest(app, m, { originalAmount: -50 })).status).toBe(400);
  });
});

describe('Partial payments and remaining balance', () => {
  it('tracks partial then full payment and keeps every payment as a separate record', async () => {
    const created = await createRequest(app, m, { originalAmount: 900 });
    const id = created.body.request._id;

    const p1 = await request(app).post(`/api/payment-requests/${id}/payments`).set(auth()).send({ amount: 300, method: 'cash' });
    expect(p1.status).toBe(201);
    expect(p1.body.request.status).toBe('partial');
    expect(p1.body.request.paidAmount).toBe(300);
    expect(p1.body.request.remainingAmount).toBe(600);

    const p2 = await request(app)
      .post(`/api/payment-requests/${id}/payments`)
      .set(auth())
      .send({ amount: 250.25, method: 'bank_transfer' });
    expect(p2.body.request.paidAmount).toBe(550.25);
    expect(p2.body.request.remainingAmount).toBe(349.75);

    const p3 = await request(app).post(`/api/payment-requests/${id}/payments`).set(auth()).send({ amount: 349.75, method: 'cash' });
    expect(p3.body.request.status).toBe('fully_paid');
    expect(p3.body.request.remainingAmount).toBe(0);

    const payments = await request(app).get(`/api/payment-requests/${id}/payments`).set(auth());
    expect(payments.body.items).toHaveLength(3);

    const detail = await request(app).get(`/api/payment-requests/${id}`).set(auth());
    expect(detail.body.history.length).toBeGreaterThanOrEqual(2);
  });

  it('never allows the remaining balance to go below zero', async () => {
    const created = await createRequest(app, m, { originalAmount: 200 });
    const id = created.body.request._id;
    await request(app).post(`/api/payment-requests/${id}/payments`).set(auth()).send({ amount: 150, method: 'cash' });
    const over = await request(app).post(`/api/payment-requests/${id}/payments`).set(auth()).send({ amount: 100, method: 'cash' });
    expect(over.status).toBe(400);
    const detail = await request(app).get(`/api/payment-requests/${id}`).set(auth());
    expect(detail.body.request.remainingAmount).toBe(50);
    expect(detail.body.request.paidAmount).toBe(150);
  });

  it('rejects a zero or negative payment', async () => {
    const created = await createRequest(app, m, { originalAmount: 200 });
    const id = created.body.request._id;
    expect((await request(app).post(`/api/payment-requests/${id}/payments`).set(auth()).send({ amount: 0, method: 'cash' })).status).toBe(400);
    expect((await request(app).post(`/api/payment-requests/${id}/payments`).set(auth()).send({ amount: -5, method: 'cash' })).status).toBe(400);
  });

  it('rejects a duplicate transaction number', async () => {
    const created = await createRequest(app, m, { originalAmount: 400 });
    const id = created.body.request._id;
    const first = await request(app)
      .post(`/api/payment-requests/${id}/payments`)
      .set(auth())
      .send({ amount: 100, method: 'bank_transfer', transactionNumber: 'TX-DUP-1' });
    expect(first.status).toBe(201);
    const second = await request(app)
      .post(`/api/payment-requests/${id}/payments`)
      .set(auth())
      .send({ amount: 100, method: 'bank_transfer', transactionNumber: 'TX-DUP-1' });
    expect(second.status).toBe(409);
  });

  it('blocks payments on a cancelled request', async () => {
    const created = await createRequest(app, m, { originalAmount: 300 });
    const id = created.body.request._id;
    const cancelled = await request(app).post(`/api/payment-requests/${id}/cancel`).set(auth()).send({ reason: 'اختبار' });
    expect(cancelled.status).toBe(200);
    const pay = await request(app).post(`/api/payment-requests/${id}/payments`).set(auth()).send({ amount: 10, method: 'cash' });
    expect(pay.status).toBe(400);
  });

  it('blocks editing the amount after a payment exists', async () => {
    const created = await createRequest(app, m, { originalAmount: 500 });
    const id = created.body.request._id;
    await request(app).post(`/api/payment-requests/${id}/payments`).set(auth()).send({ amount: 100, method: 'cash' });
    const patch = await request(app).patch(`/api/payment-requests/${id}`).set(auth()).send({ originalAmount: 2000 });
    expect(patch.status).toBe(400);
  });
});

describe('Customer reuse', () => {
  it('reuses the same customer record for the same phone number', async () => {
    const before = await request(app).get('/api/customers?search=0925559999').set(auth());
    expect(before.body.items).toHaveLength(0);
    await createRequest(app, m, { customer: { name: 'خالد', phone: '0925559999' }, originalAmount: 100 });
    await createRequest(app, m, { customer: { name: 'خالد م.', phone: '0925559999' }, originalAmount: 200 });
    const after = await request(app).get('/api/customers?search=0925559999').set(auth());
    expect(after.body.items).toHaveLength(1);
    expect(after.body.items[0].requestsCount).toBe(2);
    expect(after.body.items[0].totalRemaining).toBe(300);
  });
});
