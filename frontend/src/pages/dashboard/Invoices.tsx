import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, readError } from '../../lib/api';
import { Meta, useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, Select, TableSkeleton, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { ItemsEditor, LineItem, ProductOption, emptyItem } from '../../components/ItemsEditor';
import { dateOnly, money } from '../../lib/format';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'unpaid' | 'partial' | 'paid';
  dueDate?: string;
  createdAt: string;
  customerId?: { name?: string; phone?: string } | null;
}

const STATUS: Record<string, [string, string]> = {
  unpaid: ['غير مسددة', 'bg-navy-100 text-navy-700'],
  partial: ['مسددة جزئيًا', 'bg-amber-100 text-amber-800'],
  paid: ['مسددة', 'bg-teal-100 text-teal-800'],
};

export default function Invoices() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const params = useMemo(() => ({ page, limit: 20, ...(status ? { status } : {}) }), [page, status]);
  const { data, loading, error, reload } = useApi<{ items: Invoice[]; meta: Meta }>('/invoices', params);

  return (
    <div>
      <PageHeader
        title="الفواتير"
        subtitle="فواتير ببنود وخصومات ومواعيد استحقاق، مرتبطة تلقائيًا بطلب دفع."
        action={can('invoices.manage') && <Button onClick={() => setOpen(true)}>فاتورة جديدة</Button>}
      />

      <Card className="mb-5">
        <Field label="الحالة">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:max-w-xs">
            <option value="">كل الحالات</option>
            {Object.entries(STATUS).map(([v, [label]]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </Select>
        </Field>
      </Card>

      {loading ? (
        <TableSkeleton cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="لا توجد فواتير" body="أنشئ فاتورة ببنودها، وسيُنشأ لها طلب دفع ورابط للعميل." action={can('invoices.manage') && <Button className="mt-2" onClick={() => setOpen(true)}>فاتورة جديدة</Button>} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-navy-100 bg-navy-50/60">
                <tr>
                  <th className="th">الفاتورة</th>
                  <th className="th">العميل</th>
                  <th className="th">الإجمالي</th>
                  <th className="th">المدفوع</th>
                  <th className="th">المتبقي</th>
                  <th className="th">الاستحقاق</th>
                  <th className="th">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {data.items.map((i) => (
                  <tr key={i._id} className="hover:bg-navy-50/40">
                    <td className="td"><Link className="link numeric" to={`/app/invoices/${i._id}`}>{i.invoiceNumber}</Link></td>
                    <td className="td">{i.customerId?.name || '—'}</td>
                    <td className="td numeric">{money(i.total)}</td>
                    <td className="td numeric text-teal-700">{money(i.paidAmount)}</td>
                    <td className="td numeric text-amber-700">{money(i.remainingAmount)}</td>
                    <td className="td numeric text-navy-500">{dateOnly(i.dueDate)}</td>
                    <td className="td"><Badge tone={STATUS[i.status][1]}>{STATUS[i.status][0]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />
        </>
      )}

      <CreateInvoice open={open} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void reload(); }} />
    </div>
  );
}

function CreateInvoice({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { push } = useToast();
  const products = useApi<{ items: ProductOption[] }>(open ? '/org/products' : null, { limit: 100 });
  const [form, setForm] = useState({ name: '', phone: '', discountType: 'none', discountValue: '', notes: '', dueDate: '' });
  const [items, setItems] = useState<LineItem[]>([{ ...emptyItem }]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);
  const dv = Number(form.discountValue || 0);
  const discount = form.discountType === 'fixed' ? Math.min(dv, subtotal) : form.discountType === 'percentage' ? (subtotal * Math.min(dv, 100)) / 100 : 0;

  return (
    <Modal open={open} onClose={onClose} title="فاتورة جديدة" wide>
      <form
        className="space-y-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setMessage('');
          setLoading(true);
          try {
            await api.post('/invoices', {
              customer: { name: form.name, phone: form.phone },
              items: items.map((it) => ({
                name: it.name || 'بند',
                ...(it.productId ? { productId: it.productId } : {}),
                quantity: Number(it.quantity || 0),
                unitPrice: Number(it.unitPrice || 0),
              })),
              discountType: form.discountType,
              discountValue: form.discountType === 'none' ? 0 : dv,
              ...(form.notes ? { notes: form.notes } : {}),
              ...(form.dueDate ? { dueDate: form.dueDate } : {}),
              createPaymentRequest: true,
            });
            push('تم إنشاء الفاتورة وطلب الدفع المرتبط', 'success');
            setItems([{ ...emptyItem }]);
            setForm({ ...form, name: '', phone: '', discountValue: '', notes: '' });
            onDone();
          } catch (err) {
            setMessage(readError(err).message);
          } finally {
            setLoading(false);
          }
        }}
      >
        {message && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[var(--text-sm)] font-medium text-rose-700">{message}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم العميل" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="رقم هاتف العميل" required><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" /></Field>
        </div>

        <ItemsEditor items={items} setItems={setItems} products={products.data?.items || []} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="نوع الخصم">
            <Select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
              <option value="none">بدون خصم</option>
              <option value="fixed">مبلغ ثابت</option>
              <option value="percentage">نسبة مئوية</option>
            </Select>
          </Field>
          {form.discountType !== 'none' && (
            <Field label={form.discountType === 'percentage' ? 'النسبة %' : 'القيمة'}>
              <Input type="number" min="0" step="0.01" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
            </Field>
          )}
          <Field label="تاريخ الاستحقاق">
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
        </div>

        <Field label="ملاحظات"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></Field>

        <div className="rounded-xl bg-navy-50 p-4 text-[var(--text-sm)]">
          <div className="flex justify-between"><span className="text-navy-500">المجموع الفرعي</span><span className="numeric font-bold">{money(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-navy-500">الخصم</span><span className="numeric font-bold">{money(discount)}</span></div>
          <div className="mt-2 flex justify-between border-t border-navy-200 pt-2"><span className="font-bold">الإجمالي</span><span className="numeric font-extrabold">{money(subtotal - discount)}</span></div>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>إلغاء</Button>
          <Button type="submit" className="flex-1" loading={loading}>إنشاء الفاتورة</Button>
        </div>
      </form>
    </Modal>
  );
}
