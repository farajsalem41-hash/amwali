import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, readError } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { Badge, Button, Card, Field, Skeleton, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { Logo } from '../../components/Logo';
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_TONE, money, num } from '../../lib/format';

type DeliveryStatus = keyof typeof DELIVERY_STATUS_LABEL;

interface CourierData {
  order: {
    orderNumber: string;
    city?: string;
    address?: string;
    location?: { lat?: number; lng?: number };
    items: { name: string; quantity: number }[];
    total: number;
    paidAmount: number;
    remainingAmount: number;
    deliveryNotes?: string;
    deliveryStatus: DeliveryStatus;
  };
  customer: { name?: string; phone?: string };
  merchant: { businessName: string; phone?: string };
  courier: { name: string } | null;
  allowedStatuses: DeliveryStatus[];
}

export default function CourierPage() {
  const { token } = useParams();
  const { push } = useToast();
  const { data, loading, error, reload } = useApi<CourierData>(`/public/courier/${token}`);
  const [pending, setPending] = useState<DeliveryStatus | ''>('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="mx-auto max-w-xl p-5">
        <Skeleton className="mb-4 h-20" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-50 p-5">
        <Card className="max-w-md text-center">
          <Logo className="mx-auto mb-4 h-8 w-auto text-navy-900" />
          <h1 className="text-[var(--text-xl)] font-extrabold">الرابط غير متاح</h1>
          <p className="mt-2 text-[var(--text-sm)] text-navy-500">{error || 'تواصل مع التاجر للحصول على رابط جديد.'}</p>
          <Button className="mt-4" variant="secondary" onClick={reload}>إعادة المحاولة</Button>
        </Card>
      </div>
    );
  }

  const { order, customer, merchant, courier, allowedStatuses } = data;

  const send = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await api.post(`/public/courier/${token}/status`, { deliveryStatus: pending, ...(reason ? { reason } : {}) });
      push('تم تحديث الحالة', 'success');
      setPending('');
      setReason('');
      void reload();
    } catch (err) {
      push(readError(err).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const mapUrl =
    order.location?.lat && order.location?.lng
      ? `https://www.google.com/maps/search/?api=1&query=${order.location.lat},${order.location.lng}`
      : null;

  return (
    <div className="min-h-screen bg-navy-50 pb-16">
      <header className="border-b border-navy-100 bg-white">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-4">
          <div>
            <h1 className="text-[var(--text-lg)] font-extrabold">مهمة توصيل</h1>
            <p className="text-[var(--text-xs)] text-navy-400">{merchant.businessName}{courier ? ` • ${courier.name}` : ''}</p>
          </div>
          <Logo className="h-6 w-auto text-navy-900" />
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-5 py-6">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[var(--text-xs)] text-navy-400">رقم الطلب</p>
              <p className="numeric text-[var(--text-lg)] font-extrabold">{order.orderNumber}</p>
            </div>
            <Badge tone={DELIVERY_STATUS_TONE[order.deliveryStatus]}>{DELIVERY_STATUS_LABEL[order.deliveryStatus]}</Badge>
          </div>

          <dl className="mt-4 space-y-2 text-[var(--text-sm)]">
            <div className="flex justify-between"><dt className="text-navy-500">العميل</dt><dd className="font-bold">{customer.name || '—'}</dd></div>
            <div className="flex justify-between">
              <dt className="text-navy-500">الهاتف</dt>
              <dd>{customer.phone ? <a className="link numeric" href={`tel:${customer.phone}`}>{customer.phone}</a> : '—'}</dd>
            </div>
            <div className="flex justify-between"><dt className="text-navy-500">المدينة</dt><dd>{order.city || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-navy-500">العنوان</dt><dd className="text-left">{order.address || '—'}</dd></div>
          </dl>

          {mapUrl && (
            <a className="mt-3 inline-block" href={mapUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">فتح الموقع على الخريطة</Button>
            </a>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">محتوى الطلب</h2>
          <ul className="space-y-2 text-[var(--text-sm)]">
            {order.items.map((it, i) => (
              <li key={i} className="flex justify-between border-b border-navy-50 pb-2">
                <span>{it.name}</span>
                <span className="numeric text-navy-500">× {num(it.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-navy-50 p-3">
              <p className="text-[var(--text-xs)] text-navy-500">الإجمالي</p>
              <p className="numeric font-extrabold">{money(order.total)}</p>
            </div>
            <div className="rounded-xl bg-navy-50 p-3">
              <p className="text-[var(--text-xs)] text-navy-500">المدفوع مسبقًا</p>
              <p className="numeric font-extrabold text-teal-700">{money(order.paidAmount)}</p>
            </div>
            <div className="rounded-xl bg-navy-50 p-3">
              <p className="text-[var(--text-xs)] text-navy-500">يُحصَّل عند التسليم</p>
              <p className="numeric font-extrabold text-amber-700">{money(order.remainingAmount)}</p>
            </div>
          </div>
          {order.deliveryNotes && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[var(--text-sm)] text-amber-900">{order.deliveryNotes}</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">تحديث حالة التوصيل</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {allowedStatuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPending(s)}
                className={`rounded-xl border px-4 py-3 text-[var(--text-sm)] font-bold transition ${pending === s ? 'border-navy-900 bg-navy-900 text-white' : 'border-navy-200 hover:bg-navy-50'}`}
              >
                {DELIVERY_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {(pending === 'rejected' || pending === 'returned') && (
            <div className="mt-3">
              <Field label="سبب الرفض أو الإرجاع"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
            </div>
          )}
          <Button className="mt-3 w-full" disabled={!pending} loading={busy} onClick={send}>حفظ الحالة</Button>
          <p className="mt-3 text-[var(--text-xs)] text-navy-400">
            هذا الرابط يسمح بتحديث حالة التوصيل لهذا الطلب فقط، ولا يعطي أي وصول لبيانات التاجر أو بقية العملاء.
          </p>
        </Card>
      </main>
    </div>
  );
}
