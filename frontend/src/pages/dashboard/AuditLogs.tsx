import { useMemo, useState } from 'react';
import { Meta, useApi } from '../../lib/hooks';
import { Card, EmptyState, ErrorState, Field, Input, PageHeader, Pagination, TableSkeleton } from '../../components/ui';
import { useDebounced } from '../../lib/hooks';
import { dateTime } from '../../lib/format';

interface Log {
  _id: string;
  action: string;
  resource: string;
  resourceId?: string;
  actorLabel?: string;
  ip?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'تسجيل دخول',
  'auth.logout': 'تسجيل خروج',
  'auth.register': 'إنشاء حساب',
  'auth.password_changed': 'تغيير كلمة المرور',
  'auth.password_reset': 'استعادة كلمة المرور',
  'payment_request.created': 'إنشاء طلب دفع',
  'payment_request.updated': 'تعديل طلب دفع',
  'payment_request.cancelled': 'إلغاء طلب دفع',
  'payment_request.expired': 'انتهاء صلاحية طلب',
  'payment.created': 'تسجيل دفعة',
  'proof.reviewed': 'مراجعة إثبات دفع',
  'proof.uploaded': 'رفع إثبات دفع',
  'customer.created': 'إضافة عميل',
  'customer.updated': 'تعديل عميل',
  'customer.deleted': 'حذف عميل',
  'employee.created': 'إضافة موظف',
  'employee.updated': 'تعديل موظف',
  'employee.disabled': 'تعطيل موظف',
  'invoice.created': 'إنشاء فاتورة',
  'invoice.updated': 'تعديل فاتورة',
  'order.created': 'إنشاء طلب',
  'order.updated': 'تعديل طلب',
  'order.delivery_status_changed': 'تغيير حالة توصيل',
  'payment_account.created': 'إضافة حساب بنكي',
  'payment_account.updated': 'تعديل حساب بنكي',
  'payment_account.deleted': 'حذف حساب بنكي',
  'merchant.updated': 'تعديل بيانات النشاط',
};

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const debounced = useDebounced(action);
  const params = useMemo(() => ({ page, limit: 25, ...(debounced ? { action: debounced } : {}) }), [page, debounced]);
  const { data, loading, error, reload } = useApi<{ items: Log[]; meta: Meta }>('/org/audit-logs', params);

  return (
    <div>
      <PageHeader title="سجل العمليات" subtitle="كل عملية حساسة تُسجَّل: من قام بها، ومتى، ومن أي عنوان IP." />

      <Card className="mb-5">
        <Field label="تصفية بنوع العملية" hint="مثال: payment.created">
          <Input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="sm:max-w-sm" />
        </Field>
      </Card>

      {loading ? (
        <TableSkeleton cols={5} />
      ) : error || !data ? (
        <ErrorState message={error || 'تعذر تحميل السجل'} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState title="لا توجد عمليات مسجلة" body="سيظهر هنا سجل العمليات الحساسة داخل حسابك." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-navy-100 bg-navy-50/60">
                <tr>
                  <th className="th">العملية</th>
                  <th className="th">المورد</th>
                  <th className="th">المستخدم</th>
                  <th className="th">IP</th>
                  <th className="th">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {data.items.map((l) => (
                  <tr key={l._id} className="hover:bg-navy-50/40">
                    <td className="td font-bold">{ACTION_LABEL[l.action] || l.action}</td>
                    <td className="td text-navy-500">{l.resource}</td>
                    <td className="td">{l.actorLabel || '—'}</td>
                    <td className="td numeric text-navy-400">{l.ip || '—'}</td>
                    <td className="td numeric text-navy-500">{dateTime(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
