import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, readError } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, ErrorState, Field, PageHeader, Select, Skeleton, Stat, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import {
  DELIVERY_STATUS_LABEL,
  DELIVERY_STATUS_TONE,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  copyText,
  dateTime,
  money,
  num,
} from '../../lib/format';

type DeliveryStatus = keyof typeof DELIVERY_STATUS_LABEL;

interface Item { name: string; quantity: number; unitPrice: number; lineTotal: number }

interface Order {
  _id: string;
  orderNumber: string;
  items: Item[];
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  deliveryStatus: DeliveryStatus;
  deliveryNotes?: string;
  city?: string;
  address?: string;
  createdAt: string;
  customerId?: { name?: string; phone?: string; city?: string; address?: string } | null;
  courierId?: { _id: string; name?: string; phone?: string; area?: string } | null;
}

interface Request { _id: string; requestNumber: string; status: keyof typeof REQUEST_STATUS_LABEL }
interface History { _id: string; fromStatus?: string; toStatus: string; actorLabel?: string; reason?: string; createdAt: string }
interface Courier { _id: string; name: string }

export default function OrderDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const { push } = useToast();
  const { data, loading, error, reload } = useApi<{
    order: Order;
    request: Request | null;
    history: History[];
    customerPaymentUrl: string | null;
    courierUrl: string;
  }>(`/orders/${id}`);
  const couriers = useApi<{ items: Courier[] }>(can('orders.manage') ? '/org/couriers' : null);
  const [newStatus, setNewStatus] = useState<DeliveryStatus | ''>('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-48" /></div>;
  if (error || !data) return <ErrorState message={error || 'الطلب غير موجود'} onRetry={reload} />;

  const { order, request, history, customerPaymentUrl, courierUrl } = data;
  const manage = can('orders.manage');

  const changeStatus = async () => {
    if (!newStatus) return;
    setBusy(true);
    try {
      await api.post(`/orders/${order._id}/delivery-status`, { deliveryStatus: newStatus, ...(reason ? { reason } : {}) });
      push('تم تحديث حالة التوصيل', 'success');
      setNewStatus('');
      setReason('');
      void reload();
    } catch (err) {
      push(readError(err).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={`طلب ${order.orderNumber}`}
        subtitle={`${order.customerId?.name || 'عميل'} • ${order.customerId?.phone || ''} • ${dateTime(order.createdAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/app/orders"><Button variant="ghost">رجوع</Button></Link>
            {customerPaymentUrl && (
              <Button variant="secondary" onClick={async () => { await copyText(customerPaymentUrl); push('تم نسخ رابط الدفع', 'success'); }}>
                نسخ رابط الدفع
              </Button>
            )}
            {manage && (
              <Button variant="secondary" onClick={async () => { await copyText(courierUrl); push('تم نسخ رابط المندوب', 'success'); }}>
                نسخ رابط المندوب
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="الإجمالي" value={money(order.total)} />
        <Stat label="المدفوع" value={money(order.paidAmount)} tone="text-teal-700" />
        <Stat label="المتبقي" value={money(order.remainingAmount)} tone="text-amber-700" />
        <Stat label="حالة التوصيل" value={DELIVERY_STATUS_LABEL[order.deliveryStatus]} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">البنود</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-navy-100">
                  <tr>
                    <th className="th">البند</th>
                    <th className="th">الكمية</th>
                    <th className="th">سعر الوحدة</th>
                    <th className="th">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {order.items.map((it, i) => (
                    <tr key={i}>
                      <td className="td font-bold">{it.name}</td>
                      <td className="td numeric">{num(it.quantity)}</td>
                      <td className="td numeric">{money(it.unitPrice)}</td>
                      <td className="td numeric">{money(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 space-y-1 border-t border-navy-100 pt-4 text-[var(--text-sm)]">
              <div className="flex justify-between"><span className="text-navy-500">المجموع الفرعي</span><span className="numeric font-bold">{money(order.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-navy-500">أجرة التوصيل</span><span className="numeric font-bold">{money(order.deliveryFee)}</span></div>
              <div className="flex justify-between"><span className="text-navy-500">الخصم</span><span className="numeric font-bold">{money(order.discountAmount)}</span></div>
              <div className="flex justify-between text-[var(--text-base)]"><span className="font-extrabold">الإجمالي</span><span className="numeric font-extrabold">{money(order.total)}</span></div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">سجل حالات التوصيل</h2>
            {history.length === 0 ? (
              <p className="text-[var(--text-sm)] text-navy-500">لا توجد تغييرات مسجلة بعد.</p>
            ) : (
              <ol className="space-y-3">
                {history.map((h) => (
                  <li key={h._id} className="flex flex-wrap items-center gap-2 border-r-2 border-navy-100 pr-3 text-[var(--text-sm)]">
                    <Badge tone={DELIVERY_STATUS_TONE[h.toStatus as DeliveryStatus] || 'bg-navy-100 text-navy-700'}>
                      {DELIVERY_STATUS_LABEL[h.toStatus as DeliveryStatus] || h.toStatus}
                    </Badge>
                    {h.fromStatus && <span className="text-navy-400">من {DELIVERY_STATUS_LABEL[h.fromStatus as DeliveryStatus] || h.fromStatus}</span>}
                    <span className="text-navy-400">{dateTime(h.createdAt)}</span>
                    {h.actorLabel && <span className="text-navy-500">— {h.actorLabel}</span>}
                    {h.reason && <span className="w-full text-navy-500">السبب: {h.reason}</span>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">التوصيل</h2>
            <dl className="space-y-2 text-[var(--text-sm)]">
              <div className="flex justify-between"><dt className="text-navy-500">المدينة</dt><dd>{order.city || order.customerId?.city || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-navy-500">العنوان</dt><dd className="text-left">{order.address || order.customerId?.address || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-navy-500">المندوب</dt><dd>{order.courierId?.name || '—'}</dd></div>
              {order.deliveryNotes && <div><dt className="text-navy-500">ملاحظات</dt><dd className="mt-1 whitespace-pre-line text-navy-600">{order.deliveryNotes}</dd></div>}
            </dl>

            {manage && (
              <div className="mt-4 space-y-3 border-t border-navy-100 pt-4">
                <Field label="إسناد لمندوب">
                  <Select
                    value={order.courierId?._id || ''}
                    onChange={async (e) => {
                      try {
                        await api.patch(`/orders/${order._id}`, { courierId: e.target.value || null });
                        push('تم تحديث المندوب', 'success');
                        void reload();
                      } catch (err) {
                        push(readError(err).message, 'error');
                      }
                    }}
                  >
                    <option value="">بدون مندوب</option>
                    {(couriers.data?.items || []).map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </Select>
                </Field>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    try {
                      const res = await api.post<{ courierUrl: string }>(`/orders/${order._id}/courier-link`, {});
                      await copyText(res.data.courierUrl);
                      push('تم إنشاء رابط جديد ونسخه', 'success');
                      void reload();
                    } catch (err) {
                      push(readError(err).message, 'error');
                    }
                  }}
                >
                  إنشاء رابط مندوب جديد
                </Button>
              </div>
            )}
          </Card>

          {manage && (
            <Card>
              <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">تحديث حالة التوصيل</h2>
              <Field label="الحالة الجديدة">
                <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value as DeliveryStatus | '')}>
                  <option value="">اختر الحالة</option>
                  {Object.entries(DELIVERY_STATUS_LABEL).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </Select>
              </Field>
              {(newStatus === 'rejected' || newStatus === 'returned' || newStatus === 'cancelled') && (
                <Field label="السبب"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
              )}
              <Button className="mt-2 w-full" disabled={!newStatus} loading={busy} onClick={changeStatus}>حفظ الحالة</Button>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">طلب الدفع</h2>
            {request ? (
              <div className="flex items-center justify-between text-[var(--text-sm)]">
                <Link className="link numeric" to={`/app/requests/${request._id}`}>{request.requestNumber}</Link>
                <Badge tone={REQUEST_STATUS_TONE[request.status]}>{REQUEST_STATUS_LABEL[request.status]}</Badge>
              </div>
            ) : (
              <p className="text-[var(--text-sm)] text-navy-500">لا يوجد طلب دفع مرتبط.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
