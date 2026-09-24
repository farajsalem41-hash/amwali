import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import type { Express } from 'express';
import { bootApp, resetDb, createMerchant, createRequest } from './helpers';

let app: Express;

beforeAll(async () => {
  app = await bootApp();
  await resetDb();
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('Merchant isolation and IDOR protection', () => {
  it('never returns another merchant data (list, read, update, payment, cancel)', async () => {
    const a = await createMerchant(app, 'store', 'متجر أ');
    const b = await createMerchant(app, 'store', 'متجر ب');
    const created = await createRequest(app, a);
    expect(created.status).toBe(201);
    const id = created.body.request._id;

    const list = await request(app).get('/api/payment-requests').set('Authorization', `Bearer ${b.token}`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(0);

    const read = await request(app).get(`/api/payment-requests/${id}`).set('Authorization', `Bearer ${b.token}`);
    expect(read.status).toBe(404);

    const patch = await request(app)
      .patch(`/api/payment-requests/${id}`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ description: 'اختراق' });
    expect(patch.status).toBe(404);

    const pay = await request(app)
      .post(`/api/payment-requests/${id}/payments`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ amount: 10, method: 'cash' });
    expect(pay.status).toBe(404);

    const cancel = await request(app).post(`/api/payment-requests/${id}/cancel`).set('Authorization', `Bearer ${b.token}`);
    expect(cancel.status).toBe(404);
  });

  it('cannot use another merchant bank account on a request', async () => {
    const a = await createMerchant(app, 'store', 'متجر ج');
    const b = await createMerchant(app, 'store', 'متجر د');
    const res = await createRequest(app, a, { paymentAccountIds: [b.accountId] });
    expect(res.status).toBe(400);
  });

  it('keeps customers scoped per merchant', async () => {
    const a = await createMerchant(app, 'store', 'متجر هـ');
    const b = await createMerchant(app, 'store', 'متجر و');
    await createRequest(app, a);
    const listB = await request(app).get('/api/customers').set('Authorization', `Bearer ${b.token}`);
    expect(listB.body.items).toHaveLength(0);
    const listA = await request(app).get('/api/customers').set('Authorization', `Bearer ${a.token}`);
    expect(listA.body.items).toHaveLength(1);
  });

  it('blocks the admin panel for merchant accounts', async () => {
    const a = await createMerchant(app);
    const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(403);
  });
});

describe('Account type features', () => {
  it('blocks invoices for a store account and allows them for a company', async () => {
    const store = await createMerchant(app, 'store', 'متجر ز');
    const company = await createMerchant(app, 'company', 'شركة ح');
    expect((await request(app).get('/api/invoices').set('Authorization', `Bearer ${store.token}`)).status).toBe(403);
    expect((await request(app).get('/api/invoices').set('Authorization', `Bearer ${company.token}`)).status).toBe(200);
  });

  it('blocks orders for a freelancer and allows them for an online seller', async () => {
    const freelancer = await createMerchant(app, 'freelancer', 'مستقل ط');
    const seller = await createMerchant(app, 'online_seller', 'بائع ي');
    expect((await request(app).get('/api/orders').set('Authorization', `Bearer ${freelancer.token}`)).status).toBe(403);
    expect((await request(app).get('/api/orders').set('Authorization', `Bearer ${seller.token}`)).status).toBe(200);
  });
});
