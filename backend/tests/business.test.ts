import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import type { Express } from 'express';
import { bootApp, resetDb, createMerchant, seedPlans, Merchant } from './helpers';

let app: Express;
let company: Merchant;
let seller: Merchant;

beforeAll(async () => {
  app = await bootApp();
  await resetDb();
  await seedPlans();
  company = await createMerchant(app, 'company', 'شركة الفواتير');
  seller = await createMerchant(app, 'online_seller', 'بائع أونلاين');
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('Invoices', () => {
  it('computes line totals, discount and the linked payment request', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${company.token}`)
      .send({
        customer: { name: 'شركة عميل', phone: '0925551111' },
        items: [
          { name: 'خدمة أ', quantity: 2, unitPrice: 150 },
          { name: 'خدمة ب', quantity: 3, unitPrice: 100 },
        ],
        discountType: 'percentage',
        discountValue: 10,
        createPaymentRequest: true,
        paymentAccountIds: [company.accountId],
      });
    expect(res.status).toBe(201);
    expect(res.body.invoice.subtotal).toBe(600);
    expect(res.body.invoice.discountAmount).toBe(60);
    expect(res.body.invoice.total).toBe(540);
    expect(res.body.invoice.remainingAmount).toBe(540);
    expect(res.body.request.finalAmount).toBe(540);
    expect(res.body.publicUrl).toContain('/#/pay/');
  });

  it('syncs invoice paid and remaining amounts when a payment is confirmed', async () => {
    const created = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${company.token}`)
      .send({
        customer: { name: 'عميل ثاني', phone: '0925551112' },
        items: [{ name: 'خدمة', quantity: 1, unitPrice: 400 }],
        discountType: 'none',
        discountValue: 0,
        createPaymentRequest: true,
        paymentAccountIds: [company.accountId],
      });
    const invoiceId = created.body.invoice._id;
    const requestId = created.body.request._id;

    await request(app)
      .post(`/api/payment-requests/${requestId}/payments`)
      .set('Authorization', `Bearer ${company.token}`)
      .send({ amount: 150, method: 'cash' })
      .expect(201);

    const partial = await request(app).get(`/api/invoices/${invoiceId}`).set('Authorization', `Bearer ${company.token}`);
    expect(partial.body.invoice.paidAmount).toBe(150);
    expect(partial.body.invoice.remainingAmount).toBe(250);
    expect(partial.body.invoice.status).toBe('partial');

    await request(app)
      .post(`/api/payment-requests/${requestId}/payments`)
      .set('Authorization', `Bearer ${company.token}`)
      .send({ amount: 250, method: 'cash' })
      .expect(201);

    const paid = await request(app).get(`/api/invoices/${invoiceId}`).set('Authorization', `Bearer ${company.token}`);
    expect(paid.body.invoice.status).toBe('paid');
    expect(paid.body.invoice.remainingAmount).toBe(0);
  });
});

describe('Orders, delivery and courier links', () => {
  it('computes the order total with delivery fee and discount', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({
        customer: { name: 'مشتري', phone: '0925552222', city: 'طرابلس', address: 'حي الأندلس' },
        items: [{ name: 'منتج', quantity: 2, unitPrice: 75 }],
        deliveryFee: 20,
        discountAmount: 10,
        createPaymentRequest: true,
        paymentAccountIds: [seller.accountId],
      });
    expect(res.status).toBe(201);
    expect(res.body.order.subtotal).toBe(150);
    expect(res.body.order.total).toBe(160);
    expect(res.body.order.remainingAmount).toBe(160);
    expect(res.body.courierUrl).toContain('/#/courier/');
    expect(res.body.order.courierToken.length).toBeGreaterThanOrEqual(32);
  });

  it('lets a courier read and update delivery status through the public token only', async () => {
    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({
        customer: { name: 'مشتري ٢', phone: '0925552223', city: 'مصراتة' },
        items: [{ name: 'منتج', quantity: 1, unitPrice: 200 }],
        deliveryFee: 15,
        discountAmount: 0,
        createPaymentRequest: false,
      });
    const token = created.body.order.courierToken;

    const view = await request(app).get(`/api/public/courier/${token}`);
    expect(view.status).toBe(200);
    expect(view.body.order.total).toBe(215);
    expect(JSON.stringify(view.body)).not.toContain('auditLog');

    const update = await request(app).post(`/api/public/courier/${token}/status`).send({ deliveryStatus: 'with_courier' });
    expect(update.status).toBe(200);

    const after = await request(app).get(`/api/orders/${created.body.order._id}`).set('Authorization', `Bearer ${seller.token}`);
    expect(after.body.order.deliveryStatus).toBe('with_courier');
    expect(after.body.history.length).toBeGreaterThanOrEqual(2);

    expect((await request(app).get('/api/public/courier/invalid-token-123456789012345678')).status).toBe(404);
  });

  it('rotates the courier link and invalidates the old one', async () => {
    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({
        customer: { name: 'مشتري ٣', phone: '0925552224' },
        items: [{ name: 'منتج', quantity: 1, unitPrice: 100 }],
        deliveryFee: 0,
        discountAmount: 0,
        createPaymentRequest: false,
      });
    const oldToken = created.body.order.courierToken;
    await request(app).post(`/api/orders/${created.body.order._id}/courier-link`).set('Authorization', `Bearer ${seller.token}`).expect(200);
    expect((await request(app).get(`/api/public/courier/${oldToken}`)).status).toBe(404);
  });
});

describe('Subscriptions', () => {
  it('starts on the free plan and records a pending upgrade request', async () => {
    const sub = await request(app).get('/api/subscription').set('Authorization', `Bearer ${company.token}`);
    expect(sub.status).toBe(200);
    expect(sub.body.subscription).toBeTruthy();

    const plans = await request(app).get('/api/plans');
    const pro = plans.body.items.find((p: { code: string }) => p.code === 'pro');
    const req1 = await request(app)
      .post('/api/subscription/change-request')
      .set('Authorization', `Bearer ${company.token}`)
      .send({ planId: pro._id });
    expect(req1.status).toBe(200);
    expect(req1.body.subscription.changeRequestStatus).toBe('pending');

    const usage = await request(app).get('/api/subscription/usage').set('Authorization', `Bearer ${company.token}`);
    expect(usage.status).toBe(200);
    expect(usage.body.limits.paymentRequestsPerMonth).toBeGreaterThan(0);
  });
});

describe('Reports export', () => {
  it('exports Excel and PDF files', async () => {
    const excel = await request(app)
      .get('/api/reports/export/excel?period=monthly')
      .set('Authorization', `Bearer ${company.token}`)
      .buffer()
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(excel.status).toBe(200);
    expect((excel.body as Buffer).length).toBeGreaterThan(2000);

    const pdf = await request(app)
      .get('/api/reports/export/pdf?period=monthly')
      .set('Authorization', `Bearer ${company.token}`)
      .buffer()
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });
});
