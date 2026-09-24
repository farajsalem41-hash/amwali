import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import type { Express } from 'express';
import { bootApp, resetDb, uniquePhone, createMerchant } from './helpers';

let app: Express;

beforeAll(async () => {
  app = await bootApp();
  await resetDb();
});
afterAll(async () => {
  await mongoose.disconnect();
});

describe('Authentication', () => {
  it('rejects a weak password and mismatched confirmation', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'مستخدم',
      phone: uniquePhone(),
      password: '123',
      confirmPassword: '456',
      accountType: 'store',
      businessName: 'متجر',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('rejects an invalid Libyan phone number', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'مستخدم',
      phone: '12345',
      password: 'Test#1234',
      confirmPassword: 'Test#1234',
      accountType: 'store',
      businessName: 'متجر',
    });
    expect(res.status).toBe(400);
  });

  it('does not issue a token before OTP verification', async () => {
    const phone = uniquePhone();
    const reg = await request(app).post('/api/auth/register').send({
      fullName: 'مستخدم',
      phone,
      password: 'Test#1234',
      confirmPassword: 'Test#1234',
      accountType: 'store',
      businessName: 'متجر',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeUndefined();

    const login = await request(app).post('/api/auth/login').send({ phone, password: 'Test#1234' });
    expect([401, 403]).toContain(login.status);
  });

  it('rejects a wrong OTP code', async () => {
    const phone = uniquePhone();
    await request(app).post('/api/auth/register').send({
      fullName: 'مستخدم',
      phone,
      password: 'Test#1234',
      confirmPassword: 'Test#1234',
      accountType: 'store',
      businessName: 'متجر',
    });
    const res = await request(app).post('/api/auth/verify-otp').send({ phone, code: '000000', purpose: 'register' });
    expect(res.status).toBe(400);
  });

  it('registers, verifies and logs in successfully', async () => {
    const m = await createMerchant(app);
    const login = await request(app).post('/api/auth/login').send({ phone: m.phone, password: 'Test#1234' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.merchant.businessName).toBe('متجر الاختبار');
  });

  it('rejects a wrong password', async () => {
    const m = await createMerchant(app);
    const res = await request(app).post('/api/auth/login').send({ phone: m.phone, password: 'Wrong#1234' });
    expect(res.status).toBe(401);
  });

  it('never reveals whether a phone number exists on password reset', async () => {
    const m = await createMerchant(app);
    const known = await request(app).post('/api/auth/forgot-password').send({ phone: m.phone });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ phone: uniquePhone() });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
  });

  it('rejects requests without a token and with a tampered token', async () => {
    expect((await request(app).get('/api/dashboard')).status).toBe(401);
    expect((await request(app).get('/api/dashboard').set('Authorization', 'Bearer not.a.token')).status).toBe(401);
  });
});
