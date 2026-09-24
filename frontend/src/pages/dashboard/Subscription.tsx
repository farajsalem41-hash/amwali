import { api, readError } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, ErrorState, PageHeader, Skeleton, Stat } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { dateOnly, money, num } from '../../lib/format';

interface Plan {
  _id: string;
  code: string;
  name: string;
  price: number;
  billingPeriodDays: number;
  limits: { paymentRequestsPerMonth: number; employees: number; branches: number; paymentAccounts: number };
  features: string[];
}

interface Sub {
  _id: string;
  planCode: string;
  status: string;
  price: number;
  startsAt: string;
  endsAt: string;
  changeRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  planId?: Plan | null;
  requestedPlanId?: Plan | null;
}

interface Usage {
  plan?: string;
  status?: string;
  endsAt?: string;
  limits: Record<string, number>;
  usage: Record<string, number>;
}

const LIMIT_LABEL: Record<string, string> = {
  paymentRequestsPerMonth: 'طلبات الدفع شهريًا',
  employees: 'الموظفون',
  branches: 'الفروع',
  paymentAccounts: 'الحسابات البنكية',
};

const STATUS_LABEL: Record<string, string> = { active: 'نشط', expired: 'منتهي', cancelled: 'ملغى', pending: 'قيد التفعيل' };

export default function Subscription() {
  const { push } = useToast();
  const { user } = useAuth();
  const isOwner = !!user?.isOwner;
  const { data, loading, error, reload } = useApi<{ subscription: Sub | null; plans: Plan[] }>('/subscription');
  const usage = useApi<Usage>('/subscription/usage');

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-40" /></div>;
  if (error || !data) return <ErrorState message={error || 'تعذر تحميل الاشتراك'} onRetry={reload} />;

  const sub = data.subscription;
  const currentCode = sub?.planCode;

  const requestChange = async (planId: string) => {
    try {
      const res = await api.post<{ message: string }>('/subscription/change-request', { planId });
      push(res.data.message || 'تم إرسال الطلب', 'success');
      void reload();
    } catch (err) {
      push(readError(err).message, 'error');
    }
  };

  return (
    <div>
      <PageHeader title="الاشتراك والخطة" subtitle="أموالي لا يستقبل مدفوعات داخل النظام؛ ترقية الخطة تُراجَع من الإدارة يدويًا." />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="الخطة الحالية" value={sub?.planId?.name || 'مجانية'} />
        <Stat label="حالة الاشتراك" value={STATUS_LABEL[sub?.status || ''] || sub?.status || '—'} />
        <Stat label="ينتهي في" value={sub?.endsAt ? dateOnly(sub.endsAt) : '—'} />
      </div>

      {sub?.changeRequestStatus === 'pending' && sub.requestedPlanId && (
        <Card className="mb-5 border-amber-200 bg-amber-50">
          <p className="text-[var(--text-sm)] font-bold text-amber-900">
            لديك طلب ترقية إلى خطة {sub.requestedPlanId.name} قيد المراجعة من الإدارة.
          </p>
        </Card>
      )}

      {usage.data && (
        <Card className="mb-5">
          <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">الاستخدام مقابل حدود الخطة</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.keys(LIMIT_LABEL).map((key) => {
              const used = usage.data?.usage[key] ?? 0;
              const limit = usage.data?.limits[key] ?? 0;
              const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
              return (
                <div key={key} className="rounded-xl border border-navy-100 p-4">
                  <p className="text-[var(--text-xs)] text-navy-500">{LIMIT_LABEL[key]}</p>
                  <p className="numeric text-[var(--text-lg)] font-extrabold">
                    {num(used)} <span className="text-[var(--text-sm)] font-medium text-navy-400">/ {limit > 0 ? num(limit) : 'غير محدود'}</span>
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-navy-100">
                    <div className={`h-2 rounded-full ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-teal-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <h2 className="mb-3 text-[var(--text-xl)] font-extrabold">الخطط المتاحة</h2>
      <div className="grid gap-5 lg:grid-cols-3">
        {data.plans.map((p) => {
          const current = p.code === currentCode;
          return (
            <Card key={p._id} className={current ? 'border-2 border-navy-800' : ''}>
              <div className="flex items-center justify-between">
                <h3 className="text-[var(--text-lg)] font-extrabold">{p.name}</h3>
                {current && <Badge tone="bg-navy-900 text-white">خطتك الحالية</Badge>}
              </div>
              <p className="mt-2 numeric text-[var(--text-2xl)] font-extrabold">
                {p.price === 0 ? 'مجانًا' : money(p.price)}
                {p.price > 0 && <span className="text-[var(--text-sm)] font-medium text-navy-400"> / {p.billingPeriodDays} يوم</span>}
              </p>
              <ul className="mt-4 space-y-2 text-[var(--text-sm)] text-navy-600">
                {Object.entries(LIMIT_LABEL).map(([key, label]) => (
                  <li key={key} className="flex justify-between">
                    <span>{label}</span>
                    <span className="numeric font-bold">{p.limits[key as keyof Plan['limits']] > 0 ? num(p.limits[key as keyof Plan['limits']]) : 'غير محدود'}</span>
                  </li>
                ))}
              </ul>
              {!current && isOwner && (
                <Button className="mt-4 w-full" variant="secondary" onClick={() => void requestChange(p._id)}>
                  طلب الترقية لهذه الخطة
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
