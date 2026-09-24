import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db';
import { SubscriptionPlan, User } from '../models';
import { normalizePhone } from './phone';

const PLANS = [
  {
    code: 'free',
    name: 'مجانية',
    price: 0,
    billingPeriodDays: 30,
    sortOrder: 1,
    limits: { paymentRequestsPerMonth: 20, employees: 0, branches: 1, paymentAccounts: 2 },
    features: ['طلبات دفع', 'رابط دفع عام', 'إثبات تحويل', 'دفعات جزئية'],
  },
  {
    code: 'basic',
    name: 'أساسية',
    price: 49,
    billingPeriodDays: 30,
    sortOrder: 2,
    limits: { paymentRequestsPerMonth: 300, employees: 3, branches: 3, paymentAccounts: 6 },
    features: ['كل مزايا المجانية', 'عملاء وتقارير', 'موظفون وصلاحيات', 'تصدير Excel'],
  },
  {
    code: 'pro',
    name: 'احترافية',
    price: 99,
    billingPeriodDays: 30,
    sortOrder: 3,
    limits: { paymentRequestsPerMonth: 5000, employees: 25, branches: 25, paymentAccounts: 20 },
    features: ['كل مزايا الأساسية', 'فواتير ومنتجات', 'طلبات ومندوبين', 'تقارير PDF متقدمة', 'سجل تدقيق'],
  },
];

async function run() {
  await connectDB();

  for (const plan of PLANS) {
    await SubscriptionPlan.updateOne({ code: plan.code }, { $set: plan }, { upsert: true });
  }
  console.log(`[seed] ${PLANS.length} subscription plans ready`);

  const phoneRaw = process.env.SEED_ADMIN_PHONE;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (phoneRaw && password) {
    const phone = normalizePhone(phoneRaw);
    const existing = await User.findOne({ phone });
    if (existing) {
      console.log('[seed] admin already exists, skipping');
    } else {
      await User.create({
        fullName: process.env.SEED_ADMIN_NAME || 'مدير النظام',
        phone,
        passwordHash: await bcrypt.hash(password, 12),
        isAdmin: true,
        adminRole: 'super_admin',
        adminPermissions: [],
        phoneVerified: true,
        isActive: true,
      });
      console.log(`[seed] admin created for ${phone}`);
    }
  } else {
    console.log('[seed] SEED_ADMIN_PHONE / SEED_ADMIN_PASSWORD not set — no admin created');
  }

  await disconnectDB();
}

run().catch(async (err) => {
  console.error('[seed] failed', err);
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});
