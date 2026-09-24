import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import type { Express } from 'express';
import { bootApp, resetDb, createMerchant, createRequest, Merchant } from './helpers';

let app: Express;
let m: Merchant;
const fixture = path.resolve(__dirname, '.uploads/fixture.png');

beforeAll(async () => {
  app = await bootApp();
  await resetDb();
  m = await createMerchant(app);
  fs.mkdirSync(path.dirname(fixture), { recursive: true });
  // 1x1 transparent PNG
  fs.writeFileSync(
    fixture,
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wFrdlXIAAAAAElFTkSuQmCC', 'base64')
  );
});
afterAll(async () => {
  await mongoose.disconnect();
});

const auth = () => ({ Authorization: `Bearer ${m.token}` });

describe('Public payment page', () => {
  it('rejects an unknown or guessed token', async () => {
    expect((await request(app).get('/api/public/pay/not-a-real-token-value-here-000000')).status).toBe(404);
  });

  it('exposes only public data — never employees, other customers or audit logs', async () => {
    const created = await createRequest(app, m, { originalAmount: 600 });
    const token = created.body.request.publicToken;
    expect(token.length).toBeGreaterThanOrEqual(32);

    const res = await request(app).get(`/api/public/pay/${token}`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(res.body.merchant.businessName).toBe('متجر الاختبار');
    expect(res.body.request.finalAmount).toBe(600);
    expect(res.body.accounts.length).toBe(1);
    expect(body).not.toContain('employee');
    expect(body).not.toContain('auditLog');
    expect(body).not.toContain('passwordHash');
    expect(res.body.request.customerPhone).toBeUndefined();
  });

  it('accepts a proof upload, puts the request under review and keeps the merchant decision final', async () => {
    const created = await createRequest(app, m, { originalAmount: 500 });
    const token = created.body.request.publicToken;
    const id = created.body.request._id;

    const upload = await request(app)
      .post(`/api/public/pay/${token}/proof`)
      .field('declaredAmount', '500')
      .field('declaredSender', 'أحمد')
      .field('declaredTransactionNumber', 'TX-PROOF-1')
      .attach('file', fixture);
    expect(upload.status).toBe(201);

    const pub = await request(app).get(`/api/public/pay/${token}`);
    expect(['proof_uploaded', 'under_review']).toContain(pub.body.request.status);
    expect(pub.body.request.paidAmount).toBe(0);
    expect(pub.body.request.remainingAmount).toBe(500);

    const proofs = await request(app).get('/api/proofs?reviewStatus=pending').set(auth());
    expect(proofs.body.items.length).toBeGreaterThan(0);
    const proofId = proofs.body.items.find((p: { paymentRequestId: { _id: string } }) => p.paymentRequestId._id === id)._id;

    const review = await request(app).post(`/api/proofs/${proofId}/review`).set(auth()).send({ decision: 'approve', amount: 500 });
    expect(review.status).toBe(200);
    expect(review.body.request.status).toBe('fully_paid');
    expect(review.body.request.remainingAmount).toBe(0);

    const again = await request(app).post(`/api/proofs/${proofId}/review`).set(auth()).send({ decision: 'approve', amount: 500 });
    expect(again.status).toBe(400);
  });

  it('rejects a proof and leaves the balance untouched', async () => {
    const created = await createRequest(app, m, { originalAmount: 700 });
    const token = created.body.request.publicToken;
    await request(app).post(`/api/public/pay/${token}/proof`).field('declaredAmount', '700').attach('file', fixture).expect(201);
    const proofs = await request(app).get('/api/proofs?reviewStatus=pending').set(auth());
    const proofId = proofs.body.items[0]._id;
    const review = await request(app)
      .post(`/api/proofs/${proofId}/review`)
      .set(auth())
      .send({ decision: 'reject', reason: 'الصورة غير واضحة' });
    expect(review.status).toBe(200);
    const pub = await request(app).get(`/api/public/pay/${token}`);
    expect(pub.body.request.paidAmount).toBe(0);
    expect(pub.body.request.status).toBe('rejected');
  });

  it('rejects an oversized declared amount at review time', async () => {
    const created = await createRequest(app, m, { originalAmount: 300 });
    const token = created.body.request.publicToken;
    await request(app).post(`/api/public/pay/${token}/proof`).field('declaredAmount', '300').attach('file', fixture).expect(201);
    const proofs = await request(app).get('/api/proofs?reviewStatus=pending').set(auth());
    const proofId = proofs.body.items[0]._id;
    const review = await request(app).post(`/api/proofs/${proofId}/review`).set(auth()).send({ decision: 'approve', amount: 5000 });
    expect(review.status).toBe(400);
  });

  it('blocks proof upload on a cancelled request', async () => {
    const created = await createRequest(app, m, { originalAmount: 250 });
    const token = created.body.request.publicToken;
    await request(app).post(`/api/payment-requests/${created.body.request._id}/cancel`).set(auth()).send({ reason: 'اختبار' });
    const res = await request(app).post(`/api/public/pay/${token}/proof`).field('declaredAmount', '250').attach('file', fixture);
    expect(res.status).toBe(400);
  });

  it('protects an expired link', async () => {
    const created = await createRequest(app, m, { originalAmount: 250 });
    const id = created.body.request._id;
    const token = created.body.request.publicToken;
    await request(app).post(`/api/payment-requests/${id}/expire`).set(auth()).expect(200);
    const pub = await request(app).get(`/api/public/pay/${token}`);
    expect(pub.body.request.status).toBe('expired');
    expect(pub.body.request.canUploadProof).toBe(false);
    const upload = await request(app).post(`/api/public/pay/${token}/proof`).field('declaredAmount', '250').attach('file', fixture);
    expect(upload.status).toBe(400);
  });
});

describe('Disabled account', () => {
  it('hides public data when the merchant is disabled', async () => {
    const other = await createMerchant(app, 'store', 'متجر معطل');
    const created = await createRequest(app, other, { originalAmount: 100 });
    const token = created.body.request.publicToken;
    const { Merchant: MerchantModel } = await import('../src/models');
    await MerchantModel.updateOne({ _id: other.merchantId }, { $set: { isActive: false } });
    const pub = await request(app).get(`/api/public/pay/${token}`);
    expect(pub.status).toBe(404);
    const api = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${other.token}`);
    expect(api.status).toBe(403);
  });
});
