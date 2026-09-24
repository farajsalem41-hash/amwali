import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, readError } from '../../lib/api';
import { Meta, useApi, useDebounced } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, TableSkeleton } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, dateOnly, money, num } from '../../lib/format';

interface Customer {
  _id: string;
  name: string;
  phone: string;
  city?: string;
  address?: string;
  notes?: string;
  requestsCount?: number;
  totalPaid: number;
  totalRemaining: number;
  lastActivityAt?: string;
}

export default function Customers() {
  const { can } = useAuth();
  const { push } = useToast();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const params = useMemo(() => ({ page, limit: 20, ...(debounced ? { search: debounced } : {}) }), [page, debounced]);
  const { data, loading, error, reload } = useApi<{ items: Customer[]; meta: Meta }>('/customers', params);

  return (
    <div>
      <PageHeader
        title="العملاء"
        subtitle="يُنشأ العميل تلقائيًا عند أول طلب دفع، ويُعاد استخدامه برقم هاتفه."
        action={can('customers.manage') && <Button onClick={() => { setEditing(null); setFormOpen(true); }}>عميل جديد</Button>}
      />

      <Card className="mb-5">
        <Field label="بحث">
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="الاسم أو رقم الهاتف" />
        </Field>
      </Card>

      {loading ? (
        <TableSkeleton cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="لا يوجد عملاء" body="سيظهر العميل هنا تلقائيًا بعد أول طلب دفع." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-navy-100 bg-navy-50/60">
                <tr>
                  <th className="th">العميل</th>
                  <th className="th">الهاتف</th>
                  <th className="th">المدينة</th>
                  <th className="th">الطلبات</th>
                  <th className="th">المدفوع</th>
                  <th className="th">المتبقي</th>
                  <th className="th">آخر نشاط</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {data.items.map((c) => (
                  <tr key={c._id} className="hover:bg-navy-50/40">
                    <td className="td font-bold">{c.name}</td>
                    <td className="td numeric">{c.phone}</td>
                    <td className="td">{c.city || '—'}</td>
                    <td className="td numeric">{num(c.requestsCount || 0)}</td>
                    <td className="td numeric text-teal-700">{money(c.totalPaid)}</td>
                    <td className="td numeric text-amber-700">{money(c.totalRemaining)}</td>
                    <td className="td numeric text-navy-500">{dateOnly(c.lastActivityAt)}</td>
                    <td className="td">
                      <div className="flex gap-2">
                        <button className="link" onClick={() => setDetailId(c._id)}>تفاصيل</button>
                        {can('customers.manage') && (
                          <button className="link" onClick={() => { setEditing(c); setFormOpen(true); }}>تعديل</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />
        </>
      )}

      <CustomerDetail id={detailId} onClose={() => setDetailId(null)} />

      <CustomerForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onDone={() => {
          setFormOpen(false);
          push(editing ? 'تم تحديث بيانات العميل' : 'تم إضافة العميل', 'success');
          void reload();
        }}
      />
    </div>
  );
}

function CustomerForm({ open, editing, onClose, onDone }: { open: boolean; editing: Customer | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', city: '', address: '', notes: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState<string | null>(null);

  const key = editing?._id || 'new';
  if (open && initialized !== key) {
    setInitialized(key);
    setForm({
      name: editing?.name || '',
      phone: editing?.phone || '',
      city: editing?.city || '',
      address: editing?.address || '',
      notes: editing?.notes || '',
    });
    setMessage('');
  }
  if (!open && initialized !== null) setInitialized(null);

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'تعديل عميل' : 'عميل جديد'}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setMessage('');
          setLoading(true);
          try {
            const payload = { name: form.name, phone: form.phone, city: form.city || undefined, address: form.address || undefined, notes: form.notes || undefined };
            if (editing) await api.patch(`/customers/${editing._id}`, payload);
            else await api.post('/customers', payload);
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
        <Field label="الاسم" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="رقم الهاتف" required><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المدينة"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="العنوان"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        </div>
        <Field label="ملاحظات"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>إلغاء</Button>
          <Button type="submit" className="flex-1" loading={loading}>حفظ</Button>
        </div>
      </form>
    </Modal>
  );
}

function CustomerDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, loading, error } = useApi<{
    customer: Customer;
    requests: { _id: string; requestNumber: string; finalAmount: number; remainingAmount: number; status: string; createdAt: string }[];
    payments: { _id: string; amount: number; createdAt: string }[];
    totals: { requestsCount: number; totalPaid: number; totalRemaining: number };
  }>(id ? `/customers/${id}` : null);

  return (
    <Modal open={!!id} onClose={onClose} title="تفاصيل العميل" wide>
      {loading && <p className="text-[var(--text-sm)] text-navy-500">جارٍ التحميل…</p>}
      {error && <p className="text-[var(--text-sm)] text-rose-600">{error}</p>}
      {data && (
        <div className="space-y-5">
          <div>
            <h3 className="text-[var(--text-lg)] font-bold">{data.customer.name}</h3>
            <p className="numeric text-[var(--text-sm)] text-navy-500">{data.customer.phone}</p>
            {data.customer.city && <p className="text-[var(--text-sm)] text-navy-500">{data.customer.city}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-navy-50 p-3"><p className="text-[var(--text-xs)] text-navy-500">عدد الطلبات</p><p className="numeric font-extrabold">{num(data.totals.requestsCount)}</p></div>
            <div className="rounded-xl bg-navy-50 p-3"><p className="text-[var(--text-xs)] text-navy-500">إجمالي المدفوع</p><p className="numeric font-extrabold text-teal-700">{money(data.totals.totalPaid)}</p></div>
            <div className="rounded-xl bg-navy-50 p-3"><p className="text-[var(--text-xs)] text-navy-500">إجمالي المتبقي</p><p className="numeric font-extrabold text-amber-700">{money(data.totals.totalRemaining)}</p></div>
          </div>
          <div>
            <h4 className="mb-2 text-[var(--text-sm)] font-bold">طلبات العميل</h4>
            {data.requests.length === 0 ? (
              <p className="text-[var(--text-sm)] text-navy-400">لا توجد طلبات.</p>
            ) : (
              <ul className="space-y-2">
                {data.requests.slice(0, 10).map((r) => (
                  <li key={r._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-100 px-3 py-2 text-[var(--text-sm)]">
                    <Link className="link numeric" to={`/app/requests/${r._id}`} onClick={onClose}>{r.requestNumber}</Link>
                    <span className="numeric">{money(r.finalAmount)}</span>
                    <span className="numeric text-amber-700">متبقي {money(r.remainingAmount)}</span>
                    <Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
                    <span className="numeric text-[var(--text-xs)] text-navy-400">{dateOnly(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
