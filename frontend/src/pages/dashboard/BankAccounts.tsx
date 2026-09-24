import { useState } from 'react';
import { api, readError } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Skeleton } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { copyText } from '../../lib/format';

interface Account {
  _id: string;
  type: 'bank' | 'wallet';
  provider: string;
  accountHolder: string;
  accountNumber?: string;
  iban?: string;
  walletIdentifier?: string;
  isActive: boolean;
  isDefault: boolean;
}

const EMPTY = { type: 'bank', provider: '', accountHolder: '', accountNumber: '', iban: '', walletIdentifier: '', isDefault: false };

export default function BankAccounts() {
  const { can } = useAuth();
  const { push } = useToast();
  const { data, loading, error, reload } = useApi<{ accounts: Account[] }>('/merchant/payment-accounts');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const startCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setMessage('');
    setOpen(true);
  };

  const startEdit = (a: Account) => {
    setEditing(a);
    setForm({
      type: a.type,
      provider: a.provider,
      accountHolder: a.accountHolder,
      accountNumber: a.accountNumber || '',
      iban: a.iban || '',
      walletIdentifier: a.walletIdentifier || '',
      isDefault: a.isDefault,
    });
    setMessage('');
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        provider: form.provider,
        accountHolder: form.accountHolder,
        ...(form.accountNumber ? { accountNumber: form.accountNumber } : {}),
        ...(form.iban ? { iban: form.iban } : {}),
        ...(form.walletIdentifier ? { walletIdentifier: form.walletIdentifier } : {}),
        isDefault: form.isDefault,
      };
      if (editing) await api.patch(`/merchant/payment-accounts/${editing._id}`, payload);
      else await api.post('/merchant/payment-accounts', payload);
      push(editing ? 'تم تحديث الحساب' : 'تم إضافة الحساب', 'success');
      setOpen(false);
      void reload();
    } catch (err) {
      setMessage(readError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, okMessage: string) => {
    try {
      await fn();
      push(okMessage, 'success');
      void reload();
    } catch (err) {
      push(readError(err).message, 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="الحسابات البنكية"
        subtitle="هذه الحسابات تظهر لعميلك في صفحة الدفع مع أزرار نسخ."
        action={can('payment_accounts.manage') && <Button onClick={startCreate}>حساب جديد</Button>}
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.accounts.length === 0 ? (
        <EmptyState
          title="لا توجد حسابات بنكية"
          body="أضف حسابك المصرفي أو محفظتك الإلكترونية ليتمكن العميل من التحويل."
          action={can('payment_accounts.manage') && <Button className="mt-2" onClick={startCreate}>حساب جديد</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.accounts.map((a) => (
            <Card key={a._id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[var(--text-lg)] font-bold">{a.provider}</h3>
                  <p className="text-[var(--text-sm)] text-navy-500">{a.accountHolder}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={a.type === 'bank' ? 'bg-brand-100 text-brand-800' : 'bg-teal-100 text-teal-800'}>{a.type === 'bank' ? 'مصرف' : 'محفظة'}</Badge>
                  {a.isDefault && <Badge tone="bg-navy-800 text-white">افتراضي</Badge>}
                  {!a.isActive && <Badge tone="bg-navy-100 text-navy-500">معطّل</Badge>}
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-[var(--text-sm)]">
                {a.accountNumber && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-navy-500">رقم الحساب</dt>
                    <dd className="flex items-center gap-2">
                      <span className="numeric font-bold">{a.accountNumber}</span>
                      <button className="link" onClick={async () => push((await copyText(a.accountNumber!)) ? 'تم النسخ' : 'تعذر النسخ', 'info')}>نسخ</button>
                    </dd>
                  </div>
                )}
                {a.iban && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-navy-500">IBAN</dt>
                    <dd className="flex items-center gap-2">
                      <span className="numeric font-bold">{a.iban}</span>
                      <button className="link" onClick={async () => push((await copyText(a.iban!)) ? 'تم النسخ' : 'تعذر النسخ', 'info')}>نسخ</button>
                    </dd>
                  </div>
                )}
                {a.walletIdentifier && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-navy-500">معرّف المحفظة</dt>
                    <dd className="numeric font-bold">{a.walletIdentifier}</dd>
                  </div>
                )}
              </dl>
              {can('payment_accounts.manage') && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => startEdit(a)}>تعديل</Button>
                  {!a.isDefault && (
                    <Button variant="ghost" onClick={() => void act(() => api.post(`/merchant/payment-accounts/${a._id}/default`), 'تم تعيين الحساب كافتراضي')}>
                      تعيين افتراضي
                    </Button>
                  )}
                  <Button variant="ghost" className="text-rose-600" onClick={() => void act(() => api.delete(`/merchant/payment-accounts/${a._id}`), 'تم حذف الحساب')}>
                    حذف
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'تعديل حساب' : 'حساب جديد'}>
        <form onSubmit={save} className="space-y-4" noValidate>
          {message && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[var(--text-sm)] font-medium text-rose-700">{message}</p>}
          <Field label="النوع">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="bank">حساب مصرفي</option>
              <option value="wallet">محفظة إلكترونية</option>
            </Select>
          </Field>
          <Field label={form.type === 'bank' ? 'اسم المصرف' : 'اسم المحفظة'} required>
            <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="مصرف الجمهورية" />
          </Field>
          <Field label="اسم صاحب الحساب" required>
            <Input value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} />
          </Field>
          {form.type === 'bank' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="رقم الحساب"><Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} inputMode="numeric" /></Field>
              <Field label="IBAN"><Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></Field>
            </div>
          ) : (
            <Field label="رقم أو معرّف المحفظة"><Input value={form.walletIdentifier} onChange={(e) => setForm({ ...form, walletIdentifier: e.target.value })} /></Field>
          )}
          <label className="flex items-center gap-2 text-[var(--text-sm)] text-navy-700">
            <input type="checkbox" className="h-4 w-4 rounded border-navy-300" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            تعيين كحساب افتراضي في طلبات الدفع
          </label>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" className="flex-1" loading={saving}>حفظ</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
