import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, API_BASE, readError } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, ErrorState, Field, Input, Modal, PageHeader, Select, Skeleton, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { PAYMENT_METHOD_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, copyText, dateTime, money } from '../../lib/format';

interface Detail {
  request: {
    _id: string;
    requestNumber: string;
    originalAmount: number;
    discountType: string;
    discountValue: number;
    discountAmount: number;
    finalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    description?: string;
    externalReference?: string;
    expiresAt?: string;
    createdAt: string;
    firstOpenedAt?: string;
    publicToken: string;
    customerId?: string;
  };
  payments: { _id: string; amount: number; method: string; transactionNumber?: string; senderName?: string; createdAt: string; note?: string; confirmedByLabel?: string }[];
  proofs: { _id: string; fileId: string; reviewStatus: string; amount?: number; bankName?: string; transactionNumber?: string; senderName?: string; createdAt: string; reviewReason?: string }[];
  history: { _id: string; fromStatus?: string; toStatus: string; actorLabel?: string; reason?: string; createdAt: string; field?: string }[];
  publicUrl: string;
}

export default function PaymentRequestDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const { push } = useToast();
  const { data, loading, error, reload } = useApi<Detail>(id ? `/payment-requests/${id}` : null);
  const [payOpen, setPayOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  if (loading) return <div className="space-y-4"><Skeleton className="h-9 w-72" /><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const r = data.request;
  const shareUrl = `${window.location.origin}${window.location.pathname}#/pay/${r.publicToken}`;
  const progress = r.finalAmount > 0 ? Math.min(100, (r.paidAmount / r.finalAmount) * 100) : 0;
  const canPay = can('payments.confirm') && !['fully_paid', 'cancelled'].includes(r.status);

  return (
    <div>
      <PageHeader
        title={`طلب دفع ${r.requestNumber}`}
        subtitle={`أُنشئ ${dateTime(r.createdAt)}${r.firstOpenedAt ? ` · فُتح الرابط ${dateTime(r.firstOpenedAt)}` : ''}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={async () => push((await copyText(shareUrl)) ? 'تم نسخ الرابط' : 'تعذر النسخ', 'success')}>نسخ الرابط</Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const { data: q } = await api.get(`/payment-requests/${r._id}/qr`);
                  setQr(q.qr);
                } catch (err) {
                  push(readError(err).message, 'error');
                }
              }}
            >
              رمز QR
            </Button>
            {canPay && <Button onClick={() => setPayOpen(true)}>تسجيل دفعة</Button>}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
            {r.expiresAt && <span className="text-[var(--text-xs)] text-navy-400">ينتهي {dateTime(r.expiresAt)}</span>}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div><p className="text-[var(--text-xs)] text-navy-400">المبلغ النهائي</p><p className="numeric text-[var(--text-lg)] font-extrabold">{money(r.finalAmount)}</p></div>
            <div><p className="text-[var(--text-xs)] text-navy-400">المدفوع</p><p className="numeric text-[var(--text-lg)] font-extrabold text-teal-700">{money(r.paidAmount)}</p></div>
            <div><p className="text-[var(--text-xs)] text-navy-400">المتبقي</p><p className="numeric text-[var(--text-lg)] font-extrabold text-amber-700">{money(r.remainingAmount)}</p></div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-navy-100" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <dl className="mt-5 grid gap-3 text-[var(--text-sm)] sm:grid-cols-2">
            <div className="flex justify-between border-b border-navy-50 pb-2"><dt className="text-navy-500">المبلغ الأصلي</dt><dd className="numeric font-bold">{money(r.originalAmount)}</dd></div>
            <div className="flex justify-between border-b border-navy-50 pb-2"><dt className="text-navy-500">الخصم</dt><dd className="numeric font-bold">{money(r.discountAmount)}</dd></div>
            {r.externalReference && <div className="flex justify-between border-b border-navy-50 pb-2"><dt className="text-navy-500">مرجع خارجي</dt><dd className="font-bold">{r.externalReference}</dd></div>}
          </dl>
          {r.description && <p className="mt-4 rounded-xl bg-navy-50 p-3 text-[var(--text-sm)] text-navy-700">{r.description}</p>}
          <p className="numeric mt-4 break-all rounded-xl border border-navy-100 p-3 text-[var(--text-xs)] text-navy-500">{shareUrl}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {can('payment_requests.cancel') && !['fully_paid', 'cancelled'].includes(r.status) && (
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await api.post(`/payment-requests/${r._id}/cancel`, { reason: 'إلغاء من لوحة التاجر' });
                    push('تم إلغاء الطلب', 'success');
                    void reload();
                  } catch (err) {
                    push(readError(err).message, 'error');
                  }
                }}
              >
                إلغاء الطلب
              </Button>
            )}
            <Link to="/app/requests" className="rounded-xl border border-navy-200 px-4 py-2.5 text-[var(--text-sm)] font-bold text-navy-700 hover:bg-navy-50">
              رجوع للقائمة
            </Link>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="text-[var(--text-lg)] font-bold">الدفعات ({data.payments.length})</h2>
            {data.payments.length === 0 ? (
              <p className="mt-3 text-[var(--text-sm)] text-navy-400">لا توجد دفعات مسجلة.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {data.payments.map((p) => (
                  <li key={p._id} className="border-b border-navy-50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="numeric text-[var(--text-sm)] font-extrabold text-teal-700">{money(p.amount)}</span>
                      <span className="text-[var(--text-xs)] text-navy-400">{dateTime(p.createdAt)}</span>
                    </div>
                    <p className="text-[var(--text-xs)] text-navy-500">
                      {PAYMENT_METHOD_LABEL[p.method] || p.method}
                      {p.transactionNumber && <> · رقم العملية <span className="numeric">{p.transactionNumber}</span></>}
                      {p.senderName && <> · المحوّل {p.senderName}</>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-[var(--text-lg)] font-bold">إثباتات الدفع ({data.proofs.length})</h2>
            {data.proofs.length === 0 ? (
              <p className="mt-3 text-[var(--text-sm)] text-navy-400">لم يرفع العميل أي إثبات.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {data.proofs.map((p) => (
                  <li key={p._id} className="rounded-xl border border-navy-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={p.reviewStatus === 'approved' ? 'bg-teal-100 text-teal-800' : p.reviewStatus === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}>
                        {p.reviewStatus === 'approved' ? 'مؤكد' : p.reviewStatus === 'rejected' ? 'مرفوض' : 'بانتظار المراجعة'}
                      </Badge>
                      <a className="link text-[var(--text-xs)]" href={`${API_BASE}/api/public/files/${p.fileId}`} target="_blank" rel="noreferrer">عرض الصورة</a>
                    </div>
                    <p className="mt-2 text-[var(--text-xs)] text-navy-500">
                      {p.amount ? <>المبلغ المعلن <span className="numeric font-bold">{money(p.amount)}</span> · </> : null}
                      {p.bankName} {p.transactionNumber && <span className="numeric">#{p.transactionNumber}</span>}
                    </p>
                    <p className="text-[var(--text-xs)] text-navy-400">{dateTime(p.createdAt)}</p>
                    {p.reviewReason && <p className="mt-1 text-[var(--text-xs)] text-rose-600">السبب: {p.reviewReason}</p>}
                  </li>
                ))}
              </ul>
            )}
            <Link className="link mt-3 inline-block text-[var(--text-sm)]" to="/app/proofs">صفحة مراجعة الإثباتات</Link>
          </Card>
        </div>
      </div>

      <Card className="mt-5">
        <h2 className="text-[var(--text-lg)] font-bold">سجل الحالات</h2>
        <ol className="mt-4 space-y-3">
          {data.history.map((h) => (
            <li key={h._id} className="flex flex-wrap items-center gap-2 border-b border-navy-50 pb-3 text-[var(--text-sm)] last:border-0 last:pb-0">
              <span className="text-navy-400">{dateTime(h.createdAt)}</span>
              <span className="text-navy-500">
                {h.fromStatus ? `${REQUEST_STATUS_LABEL[h.fromStatus] || h.fromStatus} → ` : ''}
                <span className="font-bold text-navy-900">{REQUEST_STATUS_LABEL[h.toStatus] || h.toStatus}</span>
              </span>
              {h.actorLabel && <span className="text-navy-400">بواسطة {h.actorLabel}</span>}
              {h.reason && <span className="text-navy-400">· {h.reason}</span>}
            </li>
          ))}
        </ol>
      </Card>

      <Modal open={!!qr} onClose={() => setQr(null)} title="رمز QR لرابط الدفع">
        {qr && <img src={qr} alt="رمز QR" className="mx-auto h-64 w-64 rounded-xl border border-navy-100" />}
        <p className="numeric mt-3 break-all text-center text-[var(--text-xs)] text-navy-500">{shareUrl}</p>
      </Modal>

      <AddPaymentModal open={payOpen} onClose={() => setPayOpen(false)} requestId={r._id} remaining={r.remainingAmount} onDone={() => { setPayOpen(false); void reload(); }} />
    </div>
  );
}

function AddPaymentModal({ open, onClose, requestId, remaining, onDone }: { open: boolean; onClose: () => void; requestId: string; remaining: number; onDone: () => void }) {
  const { push } = useToast();
  const [form, setForm] = useState({ amount: '', method: 'bank_transfer', transactionNumber: '', senderName: '', note: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <Modal open={open} onClose={onClose} title="تسجيل دفعة">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setMessage('');
          setLoading(true);
          try {
            await api.post(`/payment-requests/${requestId}/payments`, {
              amount: Number(form.amount),
              method: form.method,
              ...(form.transactionNumber ? { transactionNumber: form.transactionNumber } : {}),
              ...(form.senderName ? { senderName: form.senderName } : {}),
              ...(form.note ? { note: form.note } : {}),
            });
            push('تم تسجيل الدفعة', 'success');
            setForm({ ...form, amount: '', transactionNumber: '', note: '' });
            onDone();
          } catch (err) {
            setMessage(readError(err).message);
          } finally {
            setLoading(false);
          }
        }}
        noValidate
      >
        {message && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[var(--text-sm)] font-medium text-rose-700">{message}</p>}
        <p className="rounded-xl bg-navy-50 px-4 py-3 text-[var(--text-sm)]">المتبقي الحالي: <span className="numeric font-extrabold">{money(remaining)}</span></p>
        <Field label="المبلغ" required>
          <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="طريقة الدفع">
          <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            <option value="bank_transfer">تحويل بنكي</option>
            <option value="cash">نقدًا</option>
            <option value="wallet">محفظة إلكترونية</option>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="رقم العملية">
            <Input value={form.transactionNumber} onChange={(e) => setForm({ ...form, transactionNumber: e.target.value })} />
          </Field>
          <Field label="اسم المحوّل">
            <Input value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} />
          </Field>
        </div>
        <Field label="ملاحظة">
          <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
        </Field>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="success" className="flex-1" loading={loading}>تأكيد الدفعة</Button>
        </div>
      </form>
    </Modal>
  );
}
