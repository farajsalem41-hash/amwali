import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import type { Express } from 'express';
import { bootApp, resetDb, createMerchant, createRequest, uniquePhone, Merchant } from './helpers';

let app: Express;
let owner: Merchant;

beforeAll(async () => {
  app = await bootApp();
  await resetDb();
  owner = await createMerchant(app, 'company', 'شركة الصلاحيات');
});
afterAll(async () => {
  await mongoose.disconnect();
});

async function addEmployee(role: 'manager' | 'accountant' | 'cashier' | 'custom', permissions?: string[]) {
  const phone = uniquePhone();
  const res = await request(app)
    .post('/api/org/employees')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ fullName: `موظف ${role}`, phone, password: 'Emp#12345', role, permissions });
  expect(res.status).toBe(201);
  const login = await request(app).post('/api/auth/login').send({ phone, password: 'Emp#12345' });
  expect(login.status).toBe(200);
  return { token: login.body.token as string, employeeId: res.body.employee._id as string };
}

describe('Employees and RBAC', () => {
  it('gives a cashier create access but not confirmation access', async () => {
    const cashier = await addEmployee('cashier');
    const created = await request(app)
      .post('/api/payment-requests')
      .set('Authorization', `Bearer ${cashier.token}`)
      .send({
        customer: { name: 'عميل الكاشير', phone: '0925550001' },
        originalAmount: 300,
        discountType: 'none',
        discountValue: 0,
        paymentAccountIds: [owner.accountId],
      });
    expect(created.status).toBe(201);

    const pay = await request(app)
      .post(`/api/payment-requests/${created.body.request._id}/payments`)
      .set('Authorization', `Bearer ${cashier.token}`)
      .send({ amount: 100, method: 'cash' });
    expect(pay.status).toBe(403);

    const employees = await request(app).get('/api/org/employees').set('Authorization', `Bearer ${cashier.token}`);
    expect(employees.status).toBe(403);
  });

  it('scopes a cashier to the requests they created', async () => {
    const cashier = await addEmployee('cashier');
    await createRequest(app, owner, { originalAmount: 111, customer: { name: 'عميل المالك', phone: '0925550002' } });
    const list = await request(app).get('/api/payment-requests').set('Authorization', `Bearer ${cashier.token}`);
    expect(list.status).toBe(200);
    expect(list.body.items.every((r: { finalAmount: number }) => r.finalAmount !== 111)).toBe(true);
  });

  it('lets an accountant confirm payments but not manage employees', async () => {
    const accountant = await addEmployee('accountant');
    const created = await createRequest(app, owner, { originalAmount: 400, customer: { name: 'عميل المحاسب', phone: '0925550003' } });
    const pay = await request(app)
      .post(`/api/payment-requests/${created.body.request._id}/payments`)
      .set('Authorization', `Bearer ${accountant.token}`)
      .send({ amount: 400, method: 'cash' });
    expect(pay.status).toBe(201);
    const emp = await request(app)
      .post('/api/org/employees')
      .set('Authorization', `Bearer ${accountant.token}`)
      .send({ fullName: 'ممنوع', phone: uniquePhone(), role: 'cashier' });
    expect(emp.status).toBe(403);
  });

  it('honours an explicit custom permission set', async () => {
    const custom = await addEmployee('custom', ['payment_requests.view', 'reports.view']);
    expect((await request(app).get('/api/payment-requests').set('Authorization', `Bearer ${custom.token}`)).status).toBe(200);
    expect((await request(app).get('/api/reports/summary?period=monthly').set('Authorization', `Bearer ${custom.token}`)).status).toBe(200);
    const create = await request(app)
      .post('/api/payment-requests')
      .set('Authorization', `Bearer ${custom.token}`)
      .send({
        customer: { name: 'ممنوع', phone: '0925550004' },
        originalAmount: 50,
        discountType: 'none',
        discountValue: 0,
        paymentAccountIds: [owner.accountId],
      });
    expect(create.status).toBe(403);
  });

  it('blocks a disabled employee immediately', async () => {
    const emp = await addEmployee('manager');
    expect((await request(app).get('/api/dashboard').set('Authorization', `Bearer ${emp.token}`)).status).toBe(200);
    await request(app).delete(`/api/org/employees/${emp.employeeId}`).set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect((await request(app).get('/api/dashboard').set('Authorization', `Bearer ${emp.token}`)).status).toBe(401);
  });
});
