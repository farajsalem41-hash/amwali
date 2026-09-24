import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API_BASE, readError } from '../../lib/api';
import { Meta, useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, Select, TableSkeleton, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { dateTime, money } from '../../lib/format';

interface Proof {
  _id: string;
  fileId: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  amount?: number;
  bankName?: string;
  transactionNumber?: string;
  senderName?: string;
  transferDate?: string;
  createdAt: string;
  reviewReason?: string;
  paymentRequestId?: { _id: string; requestNumber: string; finalAmount: number; remainingAmount: number } | null;
  customerId?: { name?: string; phone?: string } | null;
}

const STATUS = { pending: ['بانتظار المراجعة', 'bg-amber-100 text-amber-800'], approved: ['مؤكد', 'bg-teal-100 text-teal-800'], rejected: ['مرفوض', 'bg-rose-100 text-rose-700'] } as const;

export default function Proofs() {
  const { can } = useAuth();
  const { push } = useToast();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<Proof | null>(null);
  const params = useMemo(() => ({ page, limit: 20, ...(status ? { reviewStatus: status } : {}) }), [page, status]);
  const { data, loading, error, reload } = useApi<{ items: Proof[]; meta: Meta }>('/proofs', params);

  return (
    <div>
      <PageHeader title="إثباتات الدفع" subtitle="راجع صور التحويل التي رفعها العملاء، ثم أكّد أو ارفض. التأكيد النهائي بيدك." />

      <Card className="mb-5">
        <Field label="الحالة">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:max-w-xs">
            <option value="pending">بانتظار المراجعة</option>
            <option value="approved">مؤكدة</option>
            <option value="rejected">مرفوضة</option>
            <option value="">الكل</option>
          </Select>
        </Field>
      </Card>

      {loading ? (
        <TableSkeleton cols={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="لا توجد إثباتات" body="ستظهر هنا صور التحويل التي يرفعها العملاء من صفحة الدفع." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((p) => (
              <Card key={p._id} className="flex flex-col">
                <div className="flex items-center justify-between">
                  <Badge tone={STATUS[p.reviewStatus][1]}>{STATUS[p.reviewStatus][0]}</Badge>
                  <span className="text-[var(--text-xs)] text-navy-400">{dateTime(p.createdAt)}</span>
                </div>
                <a href={`${API_BASE}/api/public/files/${p.fileId}`} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-xl border border-navy-100">
                  <img src={`${API_BASE}/api/public/files/${p.fileId}`} alt="إثبات تحويل" className="h-40 w-full bg-navy-50 object-contain" loading="lazy" />
                </a>
                <div className="mt-3 space-y-1 text-[var(--text-sm)]">
                  {p.paymentRequestId && (
                    <p>
                      <Link className="link numeric" to={`/app/requests/${p.paymentRequestId._id}`}>{p.paymentRequestId.requestNumber}</Link>
                      <span className="text-navy-400"> · المتبقي <span className="numeric">{money(p.paymentRequestId.remainingAmount)}</span></span>
                    </p>
                  )}
                  <p className="text-navy-600">{p.customerId?.name || 'عميل'} <span className="numeric text-navy-400">{p.customerId?.phone}</span></p>
                  <p className="text-navy-500">
                    {p.amount ? <>المبلغ المعلن <span className="numeric font-bold">{money(p.amount)}</span></> : 'بدون مبلغ معلن'}
                    {p.bankName && <> · {p.bankName}</>}
                  </p>
                  {p.transactionNumber && <p className="numeric text-[var(--text-xs)] text-navy-400">رقم العملية: {p.transactionNumber}</p>}
                  {p.reviewReason && <p className="text-[var(--text-xs)] text-rose-600">السبب: {p.reviewReason}</p>}
                </div>
                {p.reviewStatus === 'pending' && can('proofs.review') && (
                  <Button className="mt-4" onClick={() => setActive(p)}>مراجعة</Button>
                )}
              </Card>
            ))}
          </div>
          <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />
        </>
      )}

      <ReviewModal
        proof={active}
        onClose={() => setActive(null)}
        onDone={(msg) => {
          setActive(null);
          push(msg, 'success');
          void reload();
        }}
      />
    </div>
  );
}

function ReviewModal({ proof, onClose, onDone }: { proof: Proof | null; onClose: () => void; onDone: (message: string) => void }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (decision: 'approve' | 'reject') => {
    if (!proof) return;
    setMessage('');
    setLoading(true);
    try {
      const body: Record<string, unknown> = { decision };
      if (decision === 'approve' && amount) body.amount = Number(amount);
      if (reason) body.reason = reason;
      const { data } = await api.post(`/proofs/${proof._id}/review`, body);
      setAmount('');
      setReason('');
      onDone(data.message || 'تم تنفيذ القرار');
    } catch (err) {
      setMessage(readError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={!!proof} onClose={onClose} title="مراجعة إثبات الدفع" wide>
      {proof && (
        <div className="space-y-4">
          {message && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[var(--text-sm)] font-medium text-rose-700">{message}</p>}
          <img src={`${API_BASE}/api/public/files/${proof.fileId}`} alt="إثبات تحويل" className="max-h-80 w-full rounded-xl border border-navy-100 bg-navy-50 object-contain" />
          <div className="grid gap-3 text-[var(--text-sm)] sm:grid-cols-2">
            <p className="text-navy-600">العميل: <span className="font-bold">{proof.customerId?.name}</span></p>
            <p className="text-navy-600">المبلغ المعلن: <span className="numeric font-bold">{proof.amount ? money(proof.amount) : '—'}</span></p>
            <p className="text-navy-600">المصرف: <span className="font-bold">{proof.bankName || '—'}</span></p>
            <p className="text-navy-600">رقم العملية: <span className="numeric font-bold">{proof.transactionNumber || '—'}</span></p>
            {proof.paymentRequestId && <p className="text-navy-600">المتبقي على الطلب: <span className="numeric font-bold">{money(proof.paymentRequestId.remainingAmount)}</span></p>}
          </div>
          <Field label="المبلغ المؤكد" hint="اتركه فارغًا لاستخدام المبلغ المعلن من العميل">
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="سبب / ملاحظة">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button variant="success" loading={loading} onClick={() => void submit('approve')} className="flex-1">تأكيد الدفع</Button>
            <Button variant="danger" loading={loading} onClick={() => void submit('reject')} className="flex-1">رفض الإثبات</Button>
          </div>
          <p className="text-[var(--text-xs)] text-navy-400">القراءة الآلية للصورة مساعدة فقط ولا تُعتمد كتأكيد نهائي.</p>
        </div>
      )}
    </Modal>
  );
}
