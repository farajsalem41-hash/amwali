import { useEffect, useState } from 'react';
import { api, readError, API_BASE } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Button, Card, ErrorState, Field, Input, PageHeader, Skeleton, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { ACCOUNT_TYPE_LABEL } from '../../lib/format';

interface Merchant {
  _id: string;
  accountType: keyof typeof ACCOUNT_TYPE_LABEL;
  businessName: string;
  phone?: string;
  city?: string;
  address?: string;
  description?: string;
  whatsapp?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  website?: string;
  commercialRegister?: string;
  taxNumber?: string;
  logoFileId?: string;
}

const FIELDS: { name: keyof Merchant; label: string }[] = [
  { name: 'businessName', label: 'اسم النشاط' },
  { name: 'phone', label: 'رقم الهاتف' },
  { name: 'city', label: 'المدينة' },
  { name: 'address', label: 'العنوان' },
  { name: 'whatsapp', label: 'واتساب' },
  { name: 'facebook', label: 'فيسبوك' },
  { name: 'instagram', label: 'إنستغرام' },
  { name: 'tiktok', label: 'تيك توك' },
  { name: 'website', label: 'الموقع الإلكتروني' },
];

export default function Settings() {
  const { push } = useToast();
  const { can, refresh, user } = useAuth();
  const { data, loading, error, reload } = useApi<{ merchant: Merchant; features: string[] }>('/merchant/profile');
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', password: '', confirm: '' });
  const [pwMessage, setPwMessage] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const editable = can('merchant.settings');

  useEffect(() => {
    if (!data) return;
    const m = data.merchant as unknown as Record<string, unknown>;
    const next: Record<string, string> = {};
    for (const f of FIELDS) next[f.name as string] = (m[f.name as string] as string) || '';
    next.description = (m.description as string) || '';
    next.commercialRegister = (m.commercialRegister as string) || '';
    next.taxNumber = (m.taxNumber as string) || '';
    setForm(next);
  }, [data]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  if (error || !data) return <ErrorState message={error || 'تعذر تحميل البيانات'} onRetry={reload} />;

  const merchant = data.merchant;
  const showRegister = merchant.accountType === 'store' || merchant.accountType === 'company';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/merchant/profile', form);
      push('تم حفظ البيانات', 'success');
      await refresh();
      void reload();
    } catch (err) {
      push(readError(err).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post('/merchant/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      push('تم تحديث الشعار', 'success');
      await refresh();
      void reload();
    } catch (err) {
      push(readError(err).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage('');
    if (pw.password !== pw.confirm) {
      setPwMessage('كلمتا المرور غير متطابقتين');
      return;
    }
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pw.currentPassword, password: pw.password });
      push('تم تحديث كلمة المرور', 'success');
      setPw({ currentPassword: '', password: '', confirm: '' });
    } catch (err) {
      setPwMessage(readError(err).message);
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle={`نوع الحساب: ${ACCOUNT_TYPE_LABEL[merchant.accountType]}`} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-[var(--text-lg)] font-extrabold">بيانات النشاط</h2>
          <form onSubmit={save} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <Field key={f.name as string} label={f.label}>
                  <Input
                    value={form[f.name as string] || ''}
                    disabled={!editable}
                    onChange={(e) => setForm({ ...form, [f.name as string]: e.target.value })}
                  />
                </Field>
              ))}
              {showRegister && (
                <>
                  <Field label="رقم السجل التجاري">
                    <Input value={form.commercialRegister || ''} disabled={!editable} onChange={(e) => setForm({ ...form, commercialRegister: e.target.value })} />
                  </Field>
                  <Field label="الرقم الضريبي">
                    <Input value={form.taxNumber || ''} disabled={!editable} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} />
                  </Field>
                </>
              )}
            </div>
            <Field label="وصف النشاط">
              <Textarea value={form.description || ''} disabled={!editable} rows={3} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            {editable && <Button type="submit" loading={saving}>حفظ التغييرات</Button>}
            {!editable && <p className="text-[var(--text-sm)] text-navy-500">لا تملك صلاحية تعديل بيانات النشاط.</p>}
          </form>
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">شعار النشاط</h2>
            <p className="mb-3 text-[var(--text-xs)] text-navy-400">يظهر الشعار في صفحة الدفع العامة. الصيغ المدعومة: JPG أو PNG أو WEBP.</p>
            {merchant.logoFileId ? (
              <img
                src={`${API_BASE}/api/public/files/${merchant.logoFileId}`}
                alt="شعار النشاط"
                className="mb-3 h-24 w-24 rounded-2xl border border-navy-100 object-contain p-2"
              />
            ) : (
              <div className="mb-3 flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-navy-200 text-[var(--text-xs)] text-navy-400">
                بدون شعار
              </div>
            )}
            {editable && (
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-navy-200 px-4 py-2 text-[var(--text-sm)] font-bold hover:bg-navy-50">
                {uploading ? 'جاري الرفع…' : 'اختر صورة'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadLogo(file);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">كلمة المرور</h2>
            <p className="mb-3 text-[var(--text-xs)] text-navy-400">الحساب: <span className="numeric">{user?.phone}</span></p>
            <form onSubmit={changePassword} className="space-y-3" noValidate>
              {pwMessage && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[var(--text-sm)] font-medium text-rose-700">{pwMessage}</p>}
              <Field label="كلمة المرور الحالية" required>
                <Input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
              </Field>
              <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل وتحتوي رقمًا" required>
                <Input type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
              </Field>
              <Field label="تأكيد كلمة المرور" required>
                <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </Field>
              <Button type="submit" variant="secondary" loading={pwSaving}>تحديث كلمة المرور</Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
