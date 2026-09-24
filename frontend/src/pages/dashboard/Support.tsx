import { useMemo, useState } from 'react';
import { api, readError } from '../../lib/api';
import { Meta, useApi } from '../../lib/hooks';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, Select, Skeleton, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { dateTime } from '../../lib/format';

interface Message { authorLabel?: string; isStaff: boolean; body: string; createdAt: string }

interface Ticket {
  _id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

const STATUS: Record<string, [string, string]> = {
  open: ['مفتوحة', 'bg-brand-100 text-brand-800'],
  in_progress: ['تحت المعالجة', 'bg-amber-100 text-amber-800'],
  waiting_user: ['بانتظار ردك', 'bg-amber-100 text-amber-800'],
  resolved: ['تم الحل', 'bg-teal-100 text-teal-800'],
  closed: ['مغلقة', 'bg-navy-100 text-navy-600'],
};

const CATEGORY: Record<string, string> = {
  technical: 'مشكلة تقنية',
  payment: 'مشكلة في الدفع',
  account: 'الحساب',
  subscription: 'الاشتراك',
  other: 'أخرى',
};

export default function Support() {
  const { push } = useToast();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const params = useMemo(() => ({ page, limit: 20 }), [page]);
  const { data, loading, error, reload } = useApi<{ items: Ticket[]; meta: Meta }>('/support/tickets', params);
  const [form, setForm] = useState({ subject: '', category: 'technical', description: '' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div>
      <PageHeader title="الدعم الفني" subtitle="أرسل تذكرة لفريق أموالي وتابع الردود داخل النظام." action={<Button onClick={() => setOpen(true)}>تذكرة جديدة</Button>} />

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : error || !data ? (
        <ErrorState message={error || 'تعذر تحميل التذاكر'} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState title="لا توجد تذاكر" body="افتح تذكرة لأي استفسار أو مشكلة، وسيردّ عليك الفريق هنا." action={<Button className="mt-2" onClick={() => setOpen(true)}>تذكرة جديدة</Button>} />
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((t) => (
              <Card key={t._id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="numeric text-[var(--text-xs)] text-navy-400">{t.ticketNumber}</span>
                      <h2 className="text-[var(--text-base)] font-extrabold">{t.subject}</h2>
                      <Badge tone={STATUS[t.status][1]}>{STATUS[t.status][0]}</Badge>
                    </div>
                    <p className="mt-1 text-[var(--text-xs)] text-navy-400">{CATEGORY[t.category] || t.category} • آخر تحديث {dateTime(t.updatedAt)}</p>
                  </div>
                  <Button variant="secondary" onClick={() => setSelected(t._id)}>عرض المحادثة</Button>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="تذكرة دعم جديدة">
        <form
          className="space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setMessage('');
            setSaving(true);
            try {
              await api.post('/support/tickets', form);
              push('تم إرسال التذكرة', 'success');
              setForm({ subject: '', category: 'technical', description: '' });
              setOpen(false);
              void reload();
            } catch (err) {
              setMessage(readError(err).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {message && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[var(--text-sm)] font-medium text-rose-700">{message}</p>}
          <Field label="عنوان التذكرة" required><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
          <Field label="التصنيف">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {Object.entries(CATEGORY).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="وصف المشكلة" required><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} /></Field>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" className="flex-1" loading={saving}>إرسال</Button>
          </div>
        </form>
      </Modal>

      <TicketThread id={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </div>
  );
}

function TicketThread({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { push } = useToast();
  const { data, loading, reload } = useApi<{ ticket: Ticket }>(id ? `/support/tickets/${id}` : null);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const ticket = data?.ticket;

  return (
    <Modal open={!!id} onClose={onClose} title={ticket ? ticket.subject : 'التذكرة'} wide>
      {loading || !ticket ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="numeric text-[var(--text-xs)] text-navy-400">{ticket.ticketNumber}</span>
            <Badge tone={STATUS[ticket.status][1]}>{STATUS[ticket.status][0]}</Badge>
            <span className="text-[var(--text-xs)] text-navy-400">{CATEGORY[ticket.category] || ticket.category}</span>
          </div>

          <div className="max-h-72 space-y-3 overflow-y-auto">
            {ticket.messages.map((m, i) => (
              <div key={i} className={`rounded-xl p-3 text-[var(--text-sm)] ${m.isStaff ? 'bg-brand-50 border border-brand-100' : 'bg-navy-50'}`}>
                <p className="mb-1 text-[var(--text-xs)] font-bold text-navy-500">
                  {m.isStaff ? 'فريق أموالي' : m.authorLabel || 'أنت'} • {dateTime(m.createdAt)}
                </p>
                <p className="whitespace-pre-line text-navy-700">{m.body}</p>
              </div>
            ))}
          </div>

          {ticket.status !== 'closed' && (
            <form
              className="space-y-3"
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                if (!body.trim()) return;
                setSaving(true);
                try {
                  await api.post(`/support/tickets/${ticket._id}/reply`, { body });
                  setBody('');
                  push('تم إرسال الرد', 'success');
                  void reload();
                  onChanged();
                } catch (err) {
                  push(readError(err).message, 'error');
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Field label="ردك"><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} /></Field>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={async () => {
                    try {
                      await api.post(`/support/tickets/${ticket._id}/close`, {});
                      push('تم إغلاق التذكرة', 'success');
                      void reload();
                      onChanged();
                    } catch (err) {
                      push(readError(err).message, 'error');
                    }
                  }}
                >
                  إغلاق التذكرة
                </Button>
                <Button type="submit" className="flex-1" loading={saving}>إرسال الرد</Button>
              </div>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}
