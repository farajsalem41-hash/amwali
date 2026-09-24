import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, Stat } from '../../components/ui';
import { DELIVERY_STATUS_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, dateTime, money, num } from '../../lib/format';

interface DashboardData {
  totals: {
    totalAmount: number;
    totalPaid: number;
    totalRemaining: number;
    requestsCount: number;
    collectedToday: number;
    paymentsToday: number;
    pendingRequests: number;
    proofsNeedingReview: number;
    customersCount: number;
  };
  recentRequests: {
    _id: string;
    requestNumber: string;
    finalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    createdAt: string;
    customerId?: { name?: string; phone?: string } | null;
  }[];
  recentPayments: { _id: string; amount: number; method: string; createdAt: string; customerId?: { name?: string } | null }[];
  seller?: {
    ordersCount: number;
    ordersToday: number;
    collected: number;
    remaining: number;
    partialCount: number;
    withCourier: number;
    delivered: number;
    returned: number;
  };
  company?: { invoicesCount: number; invoicesUnpaid: number; invoicesTotal: number; invoicesRemaining: number; dueSoon: number };
}

export default function DashboardHome() {
  const { merchant, user } = useAuth();
  const { data, loading, error, reload } = useApi<DashboardData>('/dashboard');

  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const t = data.totals;

  return (
    <div>
      <PageHeader
        title={`مرحبًا، ${user?.fullName?.split(' ')[0] || ''}`}
        subtitle={merchant ? `${merchant.businessName} · ملخص نشاطك اليوم` : 'ملخص نشاطك'}
        action={
          <Link to="/app/requests" className="rounded-xl bg-navy-800 px-4 py-2.5 text-[var(--text-sm)] font-bold text-white hover:bg-navy-900">
            طلب دفع جديد
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="إجمالي الطلبات" value={money(t.totalAmount)} hint={`${num(t.requestsCount)} طلب`} />
        <Stat label="إجمالي المحصّل" value={money(t.totalPaid)} tone="text-teal-700" />
        <Stat label="المتبقي" value={money(t.totalRemaining)} tone="text-amber-700" />
        <Stat label="تحصيل اليوم" value={money(t.collectedToday)} hint={`${num(t.paymentsToday)} دفعة`} />
        <Stat label="طلبات قيد التحصيل" value={num(t.pendingRequests)} />
        <Stat label="إثباتات بانتظار المراجعة" value={num(t.proofsNeedingReview)} tone={t.proofsNeedingReview ? 'text-rose-700' : undefined} />
        <Stat label="عدد العملاء" value={num(t.customersCount)} />
        {data.company && <Stat label="فواتير غير مسددة" value={num(data.company.invoicesUnpaid)} hint={`مستحقة قريبًا: ${num(data.company.dueSoon)}`} />}
        {data.seller && <Stat label="طلبات التوصيل" value={num(data.seller.ordersCount)} hint={`اليوم: ${num(data.seller.ordersToday)}`} />}
      </div>

      {data.seller && (
        <Card className="mt-6">
          <h2 className="text-[var(--text-lg)] font-bold">حالة التوصيل</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ['مع المندوب', data.seller.withCourier],
              ['تم التوصيل', data.seller.delivered],
              ['مرتجع / مرفوض', data.seller.returned],
              ['طلبات مدفوعة جزئيًا', data.seller.partialCount],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-navy-50 p-4">
                <p className="text-[var(--text-xs)] font-bold text-navy-500">{label}</p>
                <p className="numeric mt-1 text-[var(--text-lg)] font-extrabold">{num(value as number)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <h2 className="mb-3 text-[var(--text-lg)] font-bold">آخر طلبات الدفع</h2>
          {data.recentRequests.length === 0 ? (
            <EmptyState title="لا توجد طلبات بعد" body="أنشئ أول طلب دفع وأرسل الرابط لعميلك." />
          ) : (
            <div className="table-wrap">
              <table className="w-full">
                <thead className="border-b border-navy-100 bg-navy-50/60">
                  <tr>
                    <th className="th">الطلب</th>
                    <th className="th">العميل</th>
                    <th className="th">المبلغ</th>
                    <th className="th">المتبقي</th>
                    <th className="th">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {data.recentRequests.map((r) => (
                    <tr key={r._id} className="hover:bg-navy-50/40">
                      <td className="td">
                        <Link className="link numeric" to={`/app/requests/${r._id}`}>{r.requestNumber}</Link>
                      </td>
                      <td className="td">{r.customerId?.name || '—'}</td>
                      <td className="td numeric">{money(r.finalAmount)}</td>
                      <td className="td numeric">{money(r.remainingAmount)}</td>
                      <td className="td">
                        <Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-[var(--text-lg)] font-bold">آخر الدفعات</h2>
          {data.recentPayments.length === 0 ? (
            <EmptyState title="لا توجد دفعات" body="ستظهر هنا الدفعات بعد تأكيدها." />
          ) : (
            <Card className="space-y-3">
              {data.recentPayments.map((p) => (
                <div key={p._id} className="flex items-center justify-between border-b border-navy-50 pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-[var(--text-sm)] font-bold">{p.customerId?.name || 'عميل'}</p>
                    <p className="text-[var(--text-xs)] text-navy-400">{dateTime(p.createdAt)}</p>
                  </div>
                  <span className="numeric text-[var(--text-sm)] font-extrabold text-teal-700">{money(p.amount)}</span>
                </div>
              ))}
            </Card>
          )}
          {data.seller && (
            <p className="mt-3 text-[var(--text-xs)] text-navy-400">
              حالات التوصيل المتاحة: {Object.values(DELIVERY_STATUS_LABEL).slice(0, 4).join(' · ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
