import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, readError } from '../../lib/api';
import { Meta, useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, Select, TableSkeleton, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { ItemsEditor, LineItem, ProductOption, emptyItem } from '../../components/ItemsEditor';
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_TONE, dateTime, money } from '../../lib/format';

interface Order {
  _id: string;
  orderNumber: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  deliveryStatus: keyof typeof DELIVERY_STATUS_LABEL;
  city?: string;
  createdAt: string;
  customerId?: { name?: string; phone?: string } | null;
  courierId?: { name?: string; phone?: string } | null;
}

interface Courier { _id: string; name: string }

export default function Orders() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const params = useMemo(() => ({ page, limit: 20, ...(status ? { deliveryStatus: status } : {}) }), [page, status]);
  const { data, loading, error, reload } = useApi<{ items: Order[]; meta: Meta }>('/orders', params);

  return (
    <div>
      <PageHeader
        title="الطلبات والتوصيل"
        subtitle="أنشئ طلبًا مع أجرة التوصيل، أسنده لمندوب، وتابع حالة التوصيل خطوة بخطوة."
        action={can('orders.manage') && <Button onClick={() => setOpen(true)}>طلب جديد</Button>}
      />

      <Card className="mb-5">
        <Field label="حالة التوصيل">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:max-w-xs">
            <option value="">كل الحالات</option>
            {Object.entries(DELIVERY_STATUS_LABEL).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </Select>
        </Field>
      </Card>

      {loading ? (
        <TableSkeleton cols={7} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="لا توجد طلبات" body="أنشئ طلبًا لعميل، وسيصله رابط دفع، ويصل المندوب رابط تحديث التوصيل." action={can('orders.manage') && <Button className="mt-2" onClick={() => setOpen(true)}>طلب جديد</Button>} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-navy-100 bg-navy-50/60">
                <tr>
                  <th className="th">الطلب</th>
                  <th className="th">العميل</th>
                  <th className="th">المدينة</th>
                  <th className="th">الإجمالي</th>
                  <th className="th">المتبقي</th>
                  <th className="th">المندوب</th>
                  <th className="th">حالة التوصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {data.items.map((o) => (
                  <tr key={o._id} className="hover:bg-navy-50/40">
                    <td className="td">
                      <Link className="link numeric" to={`/app/orders/${o._id}`}>{o.orderNumber}</Link>
                      <div className="text-[var(--text-xs)] text-navy-400">{dateTime(o.createdAt)}</div>
                    </td>
                    <td className="td">{o.customerId?.name || '—'}</td>
                    <td className="td">{o.city || '—'}</td>
                    <td className="td numeric">{money(o.total)}</td>
                    <td className="td numeric text-amber-700">{money(o.remainingAmount)}</td>
                    <td className="td">{o.courierId?.name || '—'}</td>
                    <td className="td"><Badge tone={DELIVERY_STATUS_TONE[o.deliveryStatus]}>{DELIVERY_STATUS_LABEL[o.deliveryStatus]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />
        </>
      )}

      <CreateOrder open={open} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void reload(); }} />
    </div>
  );
}

function CreateOrder({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { push } = useToast();
  const products = useApi<{ items: ProductOption[] }>(open ? '/org/products' : null, { limit: 100 });
  const couriers = useApi<{ items: Courier[] }>(open ? '/org/couriers' : null);
  const [form, setForm] = useState({ name: '', phone: '', city: '', address: '', deliveryFee: '', discountAmount: '', deliveryNotes: '', courierId: '' });
  const [items, setItems] = useState<LineItem[]>([{ ...emptyItem }]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);
  const total = Math.max(0, subtotal + Number(form.deliveryFee || 0) - Number(form.discountAmount || 0));

  return (
    <Modal open={open} onClose={onClose} title="طلب جديد" wide>
      <form
        className="space-y-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setMessage('');
          setLoading(true);
          try {
            await api.post('/orders', {
              customer: { name: form.name, phone: form.phone, ...(form.city ? { city: form.city } : {}), ...(form.address ? { address: form.address } : {}) },
              items: items.map((it) => ({
                name: it.name || 'بند',
                ...(it.productId ? { productId: it.productId } : {}),
                quantity: Number(it.quantity || 0),
                unitPrice: Number(it.unitPrice || 0),
              })),
              deliveryFee: Number(form.deliveryFee || 0),
              discountAmount: Number(form.discountAmount || 0),
              ...(form.deliveryNotes ? { deliveryNotes: form.deliveryNotes } : {}),
              ...(form.courierId ? { courierId: form.courierId } : {}),
              createPaymentRequest: true,
            });
            push('تم إنشاء الطلب', 'success');
            setItems([{ ...emptyItem }]);
            setForm({ ...form, name: '', phone: '', address: '', deliveryNotes: '' });
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
          <Field label="المدينة"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="العنوان"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        </div>

        <ItemsEditor items={items} setItems={setItems} products={products.data?.items || []} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="أجرة التوصيل"><Input type="number" min="0" step="0.01" value={form.deliveryFee} onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })} /></Field>
          <Field label="خصم"><Input type="number" min="0" step="0.01" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} /></Field>
          <Field label="المندوب">
            <Select value={form.courierId} onChange={(e) => setForm({ ...form, courierId: e.target.value })}>
              <option value="">بدون مندوب</option>
              {(couriers.data?.items || []).map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="ملاحظات التوصيل"><Textarea value={form.deliveryNotes} onChange={(e) => setForm({ ...form, deliveryNotes: e.target.value })} rows={2} /></Field>

        <div className="rounded-xl bg-navy-50 p-4 text-[var(--text-sm)]">
          <div className="flex justify-between"><span className="text-navy-500">المجموع الفرعي</span><span className="numeric font-bold">{money(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-navy-500">التوصيل</span><span className="numeric font-bold">{money(Number(form.deliveryFee || 0))}</span></div>
          <div className="mt-2 flex justify-between border-t border-navy-200 pt-2"><span className="font-bold">الإجمالي</span><span className="numeric font-extrabold">{money(total)}</span></div>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>إلغاء</Button>
          <Button type="submit" className="flex-1" loading={loading}>إنشاء الطلب</Button>
        </div>
      </form>
    </Modal>
  );
}
