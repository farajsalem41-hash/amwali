import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { downloadFile, useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Button, Card, ErrorState, Field, Input, PageHeader, Select, Skeleton, Stat } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { REQUEST_STATUS_LABEL, money, num } from '../../lib/format';
import { readError } from '../../lib/api';

interface Summary {
  totals: {
    requestsCount: number;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    discountsAmount: number;
    fullyPaidCount: number;
    partialCount: number;
    unpaidCount: number;
    paymentsCount: number;
    collectedInRange: number;
  };
  byStatus: { status: string; count: number; amount: number }[];
  byDay: { date: string; collected: number; requests: number }[];
}

interface Row { name?: string; branchName?: string; count: number; total: number; paid: number }

interface ReportResponse {
  summary: Summary;
  branches?: Row[];
  employees?: Row[];
  seller?: Record<string, unknown>;
  invoices?: Record<string, number>;
  periodLabel: string;
}

export default function Reports() {
  const { push } = useToast();
  const { merchant } = useAuth();
  const accountType = merchant?.accountType;
  const [period, setPeriod] = useState('monthly');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState('');

  const params = useMemo(
    () => ({ period, ...(period === 'custom' && from && to ? { from, to } : {}) }),
    [period, from, to]
  );
  const { data, loading, error, reload } = useApi<ReportResponse>('/reports/summary', params);

  const exportAs = async (format: 'excel' | 'pdf') => {
    setBusy(format);
    try {
      await downloadFile(`/reports/export/${format}`, format === 'excel' ? 'amwali-report.xlsx' : 'amwali-report.pdf', params);
      push('تم تنزيل التقرير', 'success');
    } catch (err) {
      push(readError(err).message, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <PageHeader
        title="التقارير"
        subtitle="ملخص التحصيل والمتبقي والخصومات، مع تفصيل لكل فرع وموظف، وتصدير Excel أو PDF."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" loading={busy === 'excel'} onClick={() => void exportAs('excel')}>تصدير Excel</Button>
            <Button variant="secondary" loading={busy === 'pdf'} onClick={() => void exportAs('pdf')}>تصدير PDF</Button>
          </div>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="الفترة">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="daily">اليوم</option>
              <option value="weekly">هذا الأسبوع</option>
              <option value="monthly">هذا الشهر</option>
              <option value="custom">فترة مخصصة</option>
            </Select>
          </Field>
          {period === 'custom' && (
            <>
              <Field label="من"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="إلى"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            </>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : error || !data ? (
        <ErrorState message={error || 'تعذر تحميل التقرير'} onRetry={reload} />
      ) : (
        <div className="space-y-5">
          <p className="text-[var(--text-sm)] text-navy-500">{data.periodLabel}</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="عدد الطلبات" value={num(data.summary.totals.requestsCount)} />
            <Stat label="إجمالي المبالغ" value={money(data.summary.totals.totalAmount)} />
            <Stat label="المحصَّل في الفترة" value={money(data.summary.totals.collectedInRange)} tone="text-teal-700" />
            <Stat label="المتبقي" value={money(data.summary.totals.remainingAmount)} tone="text-amber-700" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="مسددة كاملًا" value={num(data.summary.totals.fullyPaidCount)} />
            <Stat label="مسددة جزئيًا" value={num(data.summary.totals.partialCount)} />
            <Stat label="غير مسددة" value={num(data.summary.totals.unpaidCount)} />
            <Stat label="إجمالي الخصومات" value={money(data.summary.totals.discountsAmount)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 text-[var(--text-lg)] font-extrabold">التحصيل اليومي</h2>
              {data.summary.byDay.length === 0 ? (
                <p className="text-[var(--text-sm)] text-navy-500">لا توجد بيانات في هذه الفترة.</p>
              ) : (
                <div className="h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.summary.byDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => money(v)} />
                      <Line type="monotone" dataKey="collected" stroke="#0f766e" strokeWidth={2} dot={{ r: 3, fill: '#0f766e' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-4 text-[var(--text-lg)] font-extrabold">الطلبات حسب الحالة</h2>
              {data.summary.byStatus.length === 0 ? (
                <p className="text-[var(--text-sm)] text-navy-500">لا توجد بيانات في هذه الفترة.</p>
              ) : (
                <div className="h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.summary.byStatus.map((s) => ({ name: REQUEST_STATUS_LABEL[s.status as keyof typeof REQUEST_STATUS_LABEL] || s.status, count: s.count }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          <Breakdown title="حسب الفرع" rows={data.branches} emptyBody="لم تُسجَّل طلبات مرتبطة بفروع في هذه الفترة." />
          <Breakdown title="حسب الموظف" rows={data.employees} emptyBody="لم يُسجَّل نشاط موظفين في هذه الفترة." />

          {accountType === 'online_seller' && data.seller && (
            <Card>
              <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">تقرير البائع أونلاين</h2>
              <KeyValues data={data.seller} />
            </Card>
          )}
          {accountType === 'company' && data.invoices && (
            <Card>
              <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">تقرير الفواتير</h2>
              <KeyValues data={data.invoices} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

const KV_MONEY = new Set(['deliveryFees', 'total', 'paid', 'unpaid', 'remaining', 'collected', 'amount']);

const KV_LABEL: Record<string, string> = {
  ordersCount: 'عدد الطلبات',
  delivered: 'تم التوصيل',
  returned: 'مرتجعة',
  rejected: 'مرفوضة',
  deliveryFees: 'أجور التوصيل',
  total: 'الإجمالي',
  invoicesCount: 'عدد الفواتير',
  paid: 'المسدد',
  unpaid: 'غير المسدد',
  partial: 'المسدد جزئيًا',
  remaining: 'المتبقي',
  collected: 'المحصَّل',
  withCourier: 'مع المندوب',
  count: 'العدد',
  unpaidCount: 'غير مسددة',
  partialCount: 'مسددة جزئيًا',
  paidCount: 'مسددة',
};

function KeyValues({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => typeof v === 'number') as [string, number][];
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-xl bg-navy-50 px-4 py-3">
          <dt className="text-[var(--text-xs)] text-navy-500">{KV_LABEL[k] || k}</dt>
          <dd className="numeric text-[var(--text-lg)] font-extrabold">{KV_MONEY.has(k) ? money(v) : num(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Breakdown({ title, rows, emptyBody }: { title: string; rows?: Row[]; emptyBody: string }) {
  if (!rows) return null;
  return (
    <Card>
      <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-[var(--text-sm)] text-navy-500">{emptyBody}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-navy-100">
              <tr>
                <th className="th">الاسم</th>
                <th className="th">عدد الطلبات</th>
                <th className="th">الإجمالي</th>
                <th className="th">المحصَّل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="td font-bold">{r.name || r.branchName}</td>
                  <td className="td numeric">{num(r.count)}</td>
                  <td className="td numeric">{money(r.total)}</td>
                  <td className="td numeric text-teal-700">{money(r.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
