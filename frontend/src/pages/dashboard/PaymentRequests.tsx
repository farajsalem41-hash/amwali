import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, readError } from '../../lib/api';
import { Meta, useApi, useDebounced } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, Select, TableSkeleton, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, copyText, dateOnly, money } from '../../lib/format';

interface RequestRow {
  _id: string;
  requestNumber: string;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  createdAt: string;
  expiresAt?: string;
  publicToken: string;
  customerId?: { name?: string; phone?: string } | null;
}

interface Account {
  _id: string;
  provider: string;
  accountHolder: string;
  accountNumber?: string;
  iban?: string;
  type: string;
  isDefault?: boolean;
}

interface Branch {
  _id: string;
  name: string;
}

const STATUS_OPTIONS = Object.entries(REQUEST_STATUS_LABEL);

export default function PaymentRequests() {
  const { can, hasFeature } = useAuth();
  const { push } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [open, setOpen] = useState(false);

  const params = useMemo(
    () => ({ page, limit: 20, ...(status ? { status } : {}), ...(debounced ? { search: debounced } : {}) }),
    [page, status, debounced]
  );
  const { data, loading, error, reload } = useApi<{ items: RequestRow[]; meta: Meta }>('/payment-requests', params);
  const accounts = useApi<{ accounts: Account[] }>(open ? '/merchant/payment-accounts' : null);
  const branches = useApi<{ items: Branch[] }>(open && hasFeature('branches') ? '/org/branches' : null);

  return (
    <div>
      <PageHeader
        title="طلبات الدفع"
        subtitle="أنشئ طلبًا، أرسل الرابط لعميلك، وتابع المدفوع والمتبقي."
        action={can('payment_requests.create') && <Button onClick={() => setOpen(true)}>طلب دفع جديد</Button>}
      />

      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <Field label="بحث">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="رقم الطلب، اسم العميل، أو رقم هاتفه"
            />
          </Field>
          <Field label="الحالة">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">كل الحالات</option>
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {loading ? (
        <TableSkeleton cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات دفع"
          body="أنشئ طلب دفع جديدًا وشارك الرابط مع عميلك ليتم الدفع ورفع الإثبات."
          action={can('payment_requests.create') && <Button className="mt-2" onClick={() => setOpen(true)}>طلب دفع جديد</Button>}
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-navy-100 bg-navy-50/60">
                <tr>
                  <th className="th">الطلب</th>
                  <th className="th">العميل</th>
                  <th className="th">النهائي</th>
                  <th className="th">المدفوع</th>
                  <th className="th">المتبقي</th>
                  <th className="th">الحالة</th>
                  <th className="th">تاريخ</th>
                  <th className="th">الرابط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {data.items.map((r) => (
                  <tr key={r._id} className="hover:bg-navy-50/40">
                    <td className="td">
                      <Link className="link numeric" to={`/app/requests/${r._id}`}>{r.requestNumber}</Link>
                    </td>
                    <td className="td">
                      {r.customerId?.name || '—'}
                      <span className="numeric block text-[var(--text-xs)] text-navy-400">{r.customerId?.phone}</span>
                    </td>
                    <td className="td numeric">{money(r.finalAmount)}</td>
                    <td className="td numeric text-teal-700">{money(r.paidAmount)}</td>
                    <td className="td numeric">{money(r.remainingAmount)}</td>
                    <td className="td"><Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge></td>
                    <td className="td numeric text-navy-500">{dateOnly(r.createdAt)}</td>
                    <td className="td">
                      <button
                        className="link"
                        onClick={async () => {
                          const url = `${window.location.origin}${window.location.pathname}#/pay/${r.publicToken}`;
                          const ok = await copyText(url);
                          push(ok ? 'تم نسخ رابط الدفع' : 'تعذر النسخ، افتح الطلب لعرض الرابط', ok ? 'success' : 'error');
                        }}
                      >
                        نسخ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />
        </>
      )}

      <CreateRequestModal
        open={open}
        onClose={() => setOpen(false)}
        accounts={accounts.data?.accounts || []}
        branches={branches.data?.items || []}
        onCreated={() => {
          setOpen(false);
          void reload();
        }}
      />
    </div>
  );
}

function CreateRequestModal({
  open,
  onClose,
  accounts,
  branches,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  branches: Branch[];
  onCreated: () => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    city: '',
    address: '',
    originalAmount: '',
    discountType: 'none',
    discountValue: '',
    description: '',
    externalReference: '',
    expiresInDays: '',
    branchId: '',
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const defaults = accounts.filter((a) => a.isDefault).map((a) => a._id);
  const chosen = selected.length ? selected : defaults;

  const amount = Number(form.originalAmount || 0);
  const discountValue = Number(form.discountValue || 0);
  const discountAmount =
    form.discountType === 'fixed' ? Math.min(discountValue, amount) : form.discountType === 'percentage' ? (amount * Math.min(discountValue, 100)) / 100 : 0;
  const finalAmount = Math.max(0, amount - discountAmount);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setMessage('');
    if (chosen.length === 0) {
      setMessage('اختر حسابًا بنكيًا واحدًا على الأقل، أو أضف حسابًا من صفحة الحسابات البنكية.');
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        customer: { name: form.name, phone: form.phone, ...(form.city ? { city: form.city } : {}), ...(form.address ? { address: form.address } : {}) },
        originalAmount: amount,
        discountType: form.discountType,
        discountValue: form.discountType === 'none' ? 0 : discountValue,
        paymentAccountIds: chosen,
        ...(form.description ? { description: form.description } : {}),
        ...(form.externalReference ? { externalReference: form.externalReference } : {}),
        ...(form.expiresInDays ? { expiresInDays: Number(form.expiresInDays) } : {}),
        ...(form.branchId ? { branchId: form.branchId } : {}),
      };
      await api.post('/payment-requests', payload);
      push('تم إنشاء طلب الدفع', 'success');
      setForm({ ...form, name: '', phone: '', originalAmount: '', discountValue: '', description: '', externalReference: '' });
      setSelected([]);
      onCreated();
    } catch (err) {
      const raw = readError(err);
      const fe: Record<string, string> = {};
      for (const d of raw.details || []) fe[d.field.replace('customer.', '')] = d.message;
      setErrors(fe);
      setMessage(raw.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="طلب دفع جديد" wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {message && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[var(--text-sm)] font-medium text-rose-700">{message}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم العميل" error={errors.name} required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="رقم هاتف العميل" error={errors.phone} required>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" placeholder="0912345678" />
          </Field>
          <Field label="المدينة">
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="العنوان">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="المبلغ" error={errors.originalAmount} required>
            <Input type="number" step="0.01" min="0" value={form.originalAmount} onChange={(e) => setForm({ ...form, originalAmount: e.target.value })} />
          </Field>
          <Field label="نوع الخصم">
            <Select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
              <option value="none">بدون خصم</option>
              <option value="fixed">مبلغ ثابت</option>
              <option value="percentage">نسبة مئوية</option>
            </Select>
          </Field>
          {form.discountType !== 'none' && (
            <Field label={form.discountType === 'percentage' ? 'نسبة الخصم %' : 'قيمة الخصم'} error={errors.discountValue}>
              <Input type="number" step="0.01" min="0" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
            </Field>
          )}
          <Field label="صلاحية الرابط (أيام)" error={errors.expiresInDays} hint="اتركه فارغًا لرابط بدون انتهاء">
            <Input type="number" min="1" max="365" value={form.expiresInDays} onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })} />
          </Field>
          <Field label="مرجع خارجي">
            <Input value={form.externalReference} onChange={(e) => setForm({ ...form, externalReference: e.target.value })} />
          </Field>
          {branches.length > 0 && (
            <Field label="الفرع">
              <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                <option value="">بدون فرع</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <Field label="وصف الطلب">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        </Field>

        <div>
          <p className="field-label">الحسابات البنكية الظاهرة للعميل *</p>
          {accounts.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[var(--text-sm)] text-amber-800">
              لا توجد حسابات بنكية. أضف حسابًا من صفحة «الحسابات البنكية» أولًا.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {accounts.map((a) => (
                <label key={a._id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${chosen.includes(a._id) ? 'border-navy-800 bg-navy-50' : 'border-navy-200'}`}>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-navy-300"
                    checked={chosen.includes(a._id)}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const base = prev.length ? prev : defaults;
                        return e.target.checked ? [...new Set([...base, a._id])] : base.filter((id) => id !== a._id);
                      })
                    }
                  />
                  <span>
                    <span className="block text-[var(--text-sm)] font-bold text-navy-900">{a.provider}</span>
                    <span className="block text-[var(--text-xs)] text-navy-500">{a.accountHolder}</span>
                    <span className="numeric block text-[var(--text-xs)] text-navy-400">{a.accountNumber || a.iban}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-navy-50 p-4 text-[var(--text-sm)]">
          <div className="flex justify-between"><span className="text-navy-500">المبلغ</span><span className="numeric font-bold">{money(amount)}</span></div>
          <div className="flex justify-between"><span className="text-navy-500">الخصم</span><span className="numeric font-bold">{money(discountAmount)}</span></div>
          <div className="mt-2 flex justify-between border-t border-navy-200 pt-2"><span className="font-bold text-navy-700">المبلغ النهائي</span><span className="numeric font-extrabold">{money(finalAmount)}</span></div>
          <p className="mt-2 text-[var(--text-xs)] text-navy-400">القيم النهائية تُحسب في الخادم عند الحفظ.</p>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">إلغاء</Button>
          <Button type="submit" loading={loading} className="flex-1">إنشاء الطلب</Button>
        </div>
      </form>
    </Modal>
  );
}
