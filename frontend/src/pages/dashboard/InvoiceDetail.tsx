import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, readError } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, ErrorState, Field, Input, Modal, PageHeader, Skeleton, Stat, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, copyText, dateOnly, money, num } from '../../lib/format';

interface Item { name: string; quantity: number; unitPrice: number; lineTotal: number }

interface Invoice {
  _id: string;
  invoiceNumber: string;
  items: Item[];
  subtotal: number;
  discountAmount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  notes?: string;
  dueDate?: string;
  createdAt: string;
  customerId?: { name?: string; phone?: string } | null;
}

interface Request { _id: string; requestNumber: string; status: keyof typeof REQUEST_STATUS_LABEL }

const STATUS_LABEL: Record<string, string> = { unpaid: 'غير مسددة', partial: 'مسددة جزئيًا', paid: 'مسددة' };

export default function InvoiceDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const { push } = useToast();
  const { data, loading, error, reload } = useApi<{ invoice: Invoice; request: Request | null; publicUrl: string | null }>(`/invoices/${id}`);
  const [editOpen, setEditOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-48" /></div>;
  if (error || !data) return <ErrorState message={error || 'الفاتورة غير موجودة'} onRetry={reload} />;

  const { invoice, request, publicUrl } = data;

  return (
    <div>
      <PageHeader
        title={`فاتورة ${invoice.invoiceNumber}`}
        subtitle={`${invoice.customerId?.name || 'عميل'} • ${invoice.customerId?.phone || ''} • أُنشئت ${dateOnly(invoice.createdAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/app/invoices"><Button variant="ghost">رجوع</Button></Link>
            {publicUrl && <Button variant="secondary" onClick={async () => { await copyText(publicUrl); push('تم نسخ رابط الدفع', 'success'); }}>نسخ رابط الدفع</Button>}
            {can('invoices.manage') && invoice.paidAmount === 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  setNotes(invoice.notes || '');
                  setDueDate(invoice.dueDate ? invoice.dueDate.slice(0, 10) : '');
                  setEditOpen(true);
                }}
              >
                تعديل
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="الإجمالي" value={money(invoice.total)} />
        <Stat label="المدفوع" value={money(invoice.paidAmount)} tone="text-teal-700" />
        <Stat label="المتبقي" value={money(invoice.remainingAmount)} tone="text-amber-700" />
        <Stat label="الحالة" value={STATUS_LABEL[invoice.status] || invoice.status} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
                {invoice.items.map((it, i) => (
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
            <div className="flex justify-between"><span className="text-navy-500">المجموع الفرعي</span><span className="numeric font-bold">{money(invoice.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-navy-500">الخصم</span><span className="numeric font-bold">{money(invoice.discountAmount)}</span></div>
            <div className="flex justify-between text-[var(--text-base)]"><span className="font-extrabold">الإجمالي</span><span className="numeric font-extrabold">{money(invoice.total)}</span></div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">طلب الدفع المرتبط</h2>
            {request ? (
              <div className="space-y-2 text-[var(--text-sm)]">
                <div className="flex items-center justify-between">
                  <Link className="link numeric" to={`/app/requests/${request._id}`}>{request.requestNumber}</Link>
                  <Badge tone={REQUEST_STATUS_TONE[request.status]}>{REQUEST_STATUS_LABEL[request.status]}</Badge>
                </div>
                <p className="text-navy-500">تُحدَّث حالة الفاتورة تلقائيًا مع كل دفعة مؤكَّدة على الطلب.</p>
              </div>
            ) : (
              <p className="text-[var(--text-sm)] text-navy-500">لا يوجد طلب دفع مرتبط بهذه الفاتورة.</p>
            )}
          </Card>

          {invoice.dueDate && (
            <Card>
              <h2 className="mb-2 text-[var(--text-lg)] font-extrabold">الاستحقاق</h2>
              <p className="numeric text-[var(--text-sm)]">{dateOnly(invoice.dueDate)}</p>
            </Card>
          )}

          {invoice.notes && (
            <Card>
              <h2 className="mb-2 text-[var(--text-lg)] font-extrabold">ملاحظات</h2>
              <p className="whitespace-pre-line text-[var(--text-sm)] text-navy-600">{invoice.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="تعديل الفاتورة">
        <form
          className="space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await api.patch(`/invoices/${invoice._id}`, { notes, dueDate: dueDate || null });
              push('تم تحديث الفاتورة', 'success');
              setEditOpen(false);
              void reload();
            } catch (err) {
              push(readError(err).message, 'error');
            } finally {
              setSaving(false);
            }
          }}
        >
          <Field label="تاريخ الاستحقاق"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <Field label="ملاحظات"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></Field>
          <p className="text-[var(--text-xs)] text-navy-400">لا يمكن تعديل البنود أو المبالغ بعد إنشاء الفاتورة، ولا يمكن التعديل نهائيًا بعد تسجيل أي دفعة.</p>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button type="submit" className="flex-1" loading={saving}>حفظ</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
