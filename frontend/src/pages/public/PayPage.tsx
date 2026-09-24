import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, readError, API_BASE } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { Badge, Button, Card, Field, Input, Select, Skeleton, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { Logo } from '../../components/Logo';
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, copyText, dateOnly, money } from '../../lib/format';

interface Account {
  _id: string;
  type: 'bank' | 'wallet';
  provider: string;
  accountHolder: string;
  accountNumber?: string;
  iban?: string;
  walletIdentifier?: string;
}

interface PublicData {
  merchant: { businessName: string; logoFileId?: string; city?: string; phone?: string; whatsapp?: string };
  request: {
    requestNumber: string;
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    currency: string;
    description?: string;
    status: keyof typeof REQUEST_STATUS_LABEL;
    expiresAt?: string;
    customerName?: string;
    canUploadProof: boolean;
  };
  accounts: Account[];
  qr: string;
  publicUrl: string;
}

export default function PayPage() {
  const { token } = useParams();
  const { push } = useToast();
  const { data, loading, error, reload } = useApi<PublicData>(`/public/pay/${token}`);
  const [form, setForm] = useState({ amount: '', bankName: '', transactionNumber: '', transferDate: '', senderName: '', paymentAccountId: '', notes: '' });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-5">
        <Skeleton className="mb-4 h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-50 p-5">
        <Card className="max-w-md text-center">
          <Logo className="mx-auto mb-4 h-8 w-auto text-navy-900" />
          <h1 className="text-[var(--text-xl)] font-extrabold">الرابط غير متاح</h1>
          <p className="mt-2 text-[var(--text-sm)] text-navy-500">{error || 'تأكد من الرابط مع الجهة التي أرسلته لك.'}</p>
          <Button className="mt-4" variant="secondary" onClick={reload}>إعادة المحاولة</Button>
        </Card>
      </div>
    );
  }

  const { merchant, request, accounts, qr, publicUrl } = data;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!file) {
      setMessage('يجب اختيار صورة إثبات التحويل');
      return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (form.amount) fd.append('amount', form.amount);
      if (form.bankName) fd.append('bankName', form.bankName);
      if (form.transactionNumber) fd.append('transactionNumber', form.transactionNumber);
      if (form.transferDate) fd.append('transferDate', form.transferDate);
      if (form.senderName) fd.append('senderName', form.senderName);
      if (form.paymentAccountId) fd.append('paymentAccountId', form.paymentAccountId);
      if (form.notes) fd.append('notes', form.notes);
      await api.post(`/public/pay/${token}/proof`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSent(true);
      push('تم إرسال إثبات التحويل', 'success');
      void reload();
    } catch (err) {
      setMessage(readError(err).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-50 pb-16">
      <header className="border-b border-navy-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          {merchant.logoFileId ? (
            <img src={`${API_BASE}/api/public/files/${merchant.logoFileId}`} alt={merchant.businessName} className="h-12 w-12 rounded-xl border border-navy-100 object-contain p-1" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900 text-white font-extrabold">{merchant.businessName.slice(0, 1)}</div>
          )}
          <div>
            <h1 className="text-[var(--text-lg)] font-extrabold">{merchant.businessName}</h1>
            <p className="text-[var(--text-xs)] text-navy-400">{merchant.city || 'ليبيا'}</p>
          </div>
          <div className="mr-auto text-left">
            <Logo className="h-6 w-auto text-navy-900" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-5 py-6">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[var(--text-xs)] text-navy-400">رقم الطلب</p>
              <p className="numeric text-[var(--text-lg)] font-extrabold">{request.requestNumber}</p>
              {request.customerName && <p className="mt-1 text-[var(--text-sm)] text-navy-500">باسم: {request.customerName}</p>}
            </div>
            <Badge tone={REQUEST_STATUS_TONE[request.status]}>{REQUEST_STATUS_LABEL[request.status]}</Badge>
          </div>

          {request.description && <p className="mt-3 whitespace-pre-line text-[var(--text-sm)] text-navy-600">{request.description}</p>}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-navy-50 p-4">
              <p className="text-[var(--text-xs)] text-navy-500">المبلغ المطلوب</p>
              <p className="numeric text-[var(--text-lg)] font-extrabold">{money(request.finalAmount)}</p>
            </div>
            <div className="rounded-xl bg-navy-50 p-4">
              <p className="text-[var(--text-xs)] text-navy-500">المدفوع</p>
              <p className="numeric text-[var(--text-lg)] font-extrabold text-teal-700">{money(request.paidAmount)}</p>
            </div>
            <div className="rounded-xl bg-navy-50 p-4">
              <p className="text-[var(--text-xs)] text-navy-500">المتبقي</p>
              <p className="numeric text-[var(--text-lg)] font-extrabold text-amber-700">{money(request.remainingAmount)}</p>
            </div>
          </div>

          {request.discountAmount > 0 && (
            <p className="mt-3 text-[var(--text-sm)] text-navy-500">
              المبلغ الأصلي <span className="numeric">{money(request.originalAmount)}</span> وخصم <span className="numeric">{money(request.discountAmount)}</span>.
            </p>
          )}
          {request.expiresAt && <p className="mt-2 text-[var(--text-xs)] text-navy-400">صلاحية الرابط حتى {dateOnly(request.expiresAt)}</p>}
        </Card>

        <Card>
          <h2 className="mb-1 text-[var(--text-lg)] font-extrabold">حوّل المبلغ إلى أحد الحسابات التالية</h2>
          <p className="mb-4 text-[var(--text-sm)] text-navy-500">انسخ رقم الحساب أو الـIBAN، وحوّل من تطبيق مصرفك أو محفظتك، ثم ارفع صورة الإشعار بالأسفل.</p>
          <div className="space-y-3">
            {accounts.map((a) => (
              <div key={a._id} className="rounded-xl border border-navy-100 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-extrabold">{a.provider}</p>
                  <Badge>{a.type === 'wallet' ? 'محفظة' : 'مصرف'}</Badge>
                </div>
                <p className="mt-1 text-[var(--text-sm)] text-navy-500">صاحب الحساب: {a.accountHolder}</p>
                {[
                  ['رقم الحساب', a.accountNumber],
                  ['IBAN', a.iban],
                  ['رقم المحفظة', a.walletIdentifier],
                ]
                  .filter(([, v]) => !!v)
                  .map(([label, value]) => (
                    <div key={label as string} className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-navy-50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[var(--text-xs)] text-navy-500">{label}</p>
                        <p className="numeric truncate font-bold">{value}</p>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          await copyText(String(value));
                          push('تم النسخ', 'success');
                        }}
                      >
                        نسخ
                      </Button>
                    </div>
                  ))}
              </div>
            ))}
            {accounts.length === 0 && <p className="text-[var(--text-sm)] text-navy-500">لم يحدّد التاجر حسابات لهذا الطلب. تواصل معه مباشرة.</p>}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-navy-100 pt-5">
            <img src={qr} alt="QR رابط الدفع" className="h-28 w-28 rounded-xl border border-navy-100" />
            <div>
              <p className="text-[var(--text-sm)] font-bold">شارك هذا الرابط أو امسح الرمز</p>
              <p className="numeric mt-1 break-all text-[var(--text-xs)] text-navy-400">{publicUrl}</p>
              <Button className="mt-2" variant="secondary" onClick={async () => { await copyText(publicUrl); push('تم نسخ الرابط', 'success'); }}>نسخ الرابط</Button>
            </div>
          </div>
        </Card>

        {sent ? (
          <Card className="border-teal-200 bg-teal-50">
            <h2 className="text-[var(--text-lg)] font-extrabold text-teal-900">تم استلام إثبات التحويل</h2>
            <p className="mt-2 text-[var(--text-sm)] text-teal-800">
              سيراجع التاجر الإثبات ويؤكّد الدفعة. المراجعة اليدوية من التاجر هي القرار النهائي. يمكنك العودة لهذه الصفحة لمتابعة الحالة.
            </p>
            <Button className="mt-3" variant="secondary" onClick={() => setSent(false)}>رفع إثبات آخر</Button>
          </Card>
        ) : request.canUploadProof ? (
          <Card>
            <h2 className="mb-1 text-[var(--text-lg)] font-extrabold">ارفع إثبات التحويل</h2>
            <p className="mb-4 text-[var(--text-sm)] text-navy-500">صورة واضحة لإشعار التحويل. المراجعة تتم من التاجر، وأي قراءة آلية للبيانات ليست قرارًا نهائيًا.</p>
            <form onSubmit={submit} className="space-y-4" noValidate>
              {message && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[var(--text-sm)] font-medium text-rose-700">{message}</p>}
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-navy-200 p-6 text-center hover:bg-navy-50">
                <span className="text-[var(--text-sm)] font-bold">{file ? file.name : 'اختر صورة الإشعار'}</span>
                <span className="mt-1 text-[var(--text-xs)] text-navy-400">JPG أو PNG أو WEBP — حتى 5 ميجابايت</span>
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="المبلغ المحوَّل" hint="اتركه فارغًا إذا حوّلت كامل المبلغ">
                  <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </Field>
                <Field label="الحساب الذي حوّلت إليه">
                  <Select value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
                    <option value="">غير محدد</option>
                    {accounts.map((a) => (
                      <option key={a._id} value={a._id}>{a.provider} — {a.accountHolder}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="اسم المصرف / المحفظة"><Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></Field>
                <Field label="رقم العملية"><Input value={form.transactionNumber} onChange={(e) => setForm({ ...form, transactionNumber: e.target.value })} /></Field>
                <Field label="تاريخ التحويل"><Input type="date" value={form.transferDate} onChange={(e) => setForm({ ...form, transferDate: e.target.value })} /></Field>
                <Field label="اسم المُحوِّل"><Input value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} /></Field>
              </div>

              <Field label="ملاحظات"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></Field>

              <Button type="submit" className="w-full" loading={sending}>إرسال الإثبات</Button>
            </form>
          </Card>
        ) : (
          <Card className="text-center">
            <p className="text-[var(--text-sm)] font-bold text-navy-700">
              {request.status === 'fully_paid' ? 'تم سداد هذا الطلب بالكامل. شكرًا لك.' : 'لا يمكن رفع إثبات لهذا الطلب حاليًا.'}
            </p>
          </Card>
        )}

        <p className="text-center text-[var(--text-xs)] text-navy-400">
          أموالي منصة لتنظيم طلبات الدفع فقط، ولا تستلم أو تحتفظ بأي أموال. التحويل يتم مباشرة إلى حساب التاجر.
        </p>
      </main>
    </div>
  );
}
