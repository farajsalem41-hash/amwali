import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fieldErrors, readError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuthShell } from '../../components/layout/AuthShell';
import { Button, Field, Input, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';

type AccountType = 'store' | 'company' | 'freelancer' | 'online_seller';

const TYPES: { value: AccountType; title: string; body: string }[] = [
  { value: 'store', title: 'متجر', body: 'بيع مباشر للعملاء، طلبات دفع وإثباتات تحويل.' },
  { value: 'company', title: 'شركة', body: 'فواتير رسمية، منتجات، فروع، موظفون، وتقارير متقدمة.' },
  { value: 'freelancer', title: 'مستقل / عمل حر', body: 'دفعات مقدمة ونهائية لكل مشروع أو خدمة.' },
  { value: 'online_seller', title: 'بائع أونلاين', body: 'طلبات وتوصيل وروابط مندوبين وحالات توصيل.' },
];

interface FormState {
  fullName: string;
  phone: string;
  password: string;
  confirmPassword: string;
  accountType: AccountType | '';
  businessName: string;
  city: string;
  address: string;
  description: string;
  whatsapp: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  website: string;
  commercialRegister: string;
  taxNumber: string;
}

const EMPTY: FormState = {
  fullName: '', phone: '', password: '', confirmPassword: '', accountType: '',
  businessName: '', city: '', address: '', description: '', whatsapp: '',
  facebook: '', instagram: '', tiktok: '', website: '', commercialRegister: '', taxNumber: '',
};

const STEP_TITLES = ['البيانات الأساسية', 'نوع الحساب', 'بيانات النشاط', 'تأكيد رقم الهاتف'];

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const localValidateStep1 = () => {
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 3) e.fullName = 'الاسم قصير';
    if (!/^09[1-6]\d{7}$/.test(form.phone.trim())) e.phone = 'رقم هاتف ليبي غير صالح (مثال: 0912345678)';
    if (form.password.length < 8) e.password = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    else if (!/\d/.test(form.password)) e.password = 'يجب أن تحتوي كلمة المرور على رقم';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'كلمتا المرور غير متطابقتين';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitRegistration = async () => {
    setErrors({});
    setMessage('');
    setLoading(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      const { data } = await api.post('/auth/register', payload);
      if (data.devCode) setDevCode(data.devCode);
      setStep(4);
      push('تم إرسال رمز التحقق إلى رقم هاتفك', 'info');
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      setMessage(readError(err).message);
      if (fe.fullName || fe.phone || fe.password || fe.confirmPassword) setStep(1);
      else if (fe.accountType) setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setErrors({});
    setMessage('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { phone: form.phone, code, purpose: 'register' });
      await login(data.token, true);
      push('تم إنشاء حسابك بنجاح', 'success');
      navigate('/app', { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setMessage(readError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const isCompany = form.accountType === 'company';
  const isSeller = form.accountType === 'online_seller';

  return (
    <AuthShell
      title="حساب جديد"
      subtitle={`الخطوة ${step} من 4 · ${STEP_TITLES[step - 1]}`}
      footer={<p>عندك حساب؟ <Link className="link" to="/login">تسجيل الدخول</Link></p>}
    >
      <div className="mb-6 flex gap-2" aria-hidden>
        {[1, 2, 3, 4].map((s) => (
          <span key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-navy-800' : 'bg-navy-100'}`} />
        ))}
      </div>

      {message && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[var(--text-sm)] font-medium text-rose-700">{message}</p>}

      {step === 1 && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (localValidateStep1()) setStep(2);
          }}
          noValidate
        >
          <Field label="الاسم الكامل" error={errors.fullName} required>
            <Input value={form.fullName} onChange={set('fullName')} />
          </Field>
          <Field label="رقم الهاتف" error={errors.phone} hint="يبدأ بـ 091 / 092 / 093 / 094 / 095 / 096" required>
            <Input value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="0912345678" />
          </Field>
          <Field label="كلمة المرور" error={errors.password} hint="8 أحرف على الأقل وتحتوي رقمًا" required>
            <Input type="password" value={form.password} onChange={set('password')} />
          </Field>
          <Field label="تأكيد كلمة المرور" error={errors.confirmPassword} required>
            <Input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} />
          </Field>
          <Button type="submit" className="w-full">التالي</Button>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-3">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, accountType: t.value }))}
                className={`rounded-2xl border p-4 text-right transition ${
                  form.accountType === t.value ? 'border-navy-800 bg-navy-50 ring-1 ring-navy-800' : 'border-navy-200 hover:border-navy-300'
                }`}
              >
                <p className="text-[var(--text-sm)] font-bold text-navy-900">{t.title}</p>
                <p className="mt-1 text-[var(--text-xs)] text-navy-500">{t.body}</p>
              </button>
            ))}
          </div>
          {errors.accountType && <p className="field-error">{errors.accountType}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">رجوع</Button>
            <Button className="flex-1" disabled={!form.accountType} onClick={() => setStep(3)}>التالي</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.businessName.trim().length < 2) {
              setErrors({ businessName: 'اسم النشاط مطلوب' });
              return;
            }
            void submitRegistration();
          }}
          noValidate
        >
          <Field label={isCompany ? 'اسم الشركة' : form.accountType === 'freelancer' ? 'اسم النشاط أو التخصص' : 'اسم النشاط'} error={errors.businessName} required>
            <Input value={form.businessName} onChange={set('businessName')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="المدينة" error={errors.city}>
              <Input value={form.city} onChange={set('city')} placeholder="طرابلس" />
            </Field>
            <Field label="رقم واتساب" error={errors.whatsapp}>
              <Input value={form.whatsapp} onChange={set('whatsapp')} inputMode="tel" />
            </Field>
          </div>
          <Field label="العنوان" error={errors.address}>
            <Input value={form.address} onChange={set('address')} />
          </Field>
          <Field label="وصف النشاط" error={errors.description}>
            <Textarea value={form.description} onChange={set('description')} rows={3} />
          </Field>
          {isCompany && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="رقم السجل التجاري" error={errors.commercialRegister}>
                <Input value={form.commercialRegister} onChange={set('commercialRegister')} />
              </Field>
              <Field label="الرقم الضريبي" error={errors.taxNumber}>
                <Input value={form.taxNumber} onChange={set('taxNumber')} />
              </Field>
            </div>
          )}
          {(isSeller || form.accountType === 'store' || form.accountType === 'freelancer') && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="فيسبوك" error={errors.facebook}>
                <Input value={form.facebook} onChange={set('facebook')} placeholder="facebook.com/..." />
              </Field>
              <Field label="إنستغرام" error={errors.instagram}>
                <Input value={form.instagram} onChange={set('instagram')} />
              </Field>
              <Field label="تيك توك" error={errors.tiktok}>
                <Input value={form.tiktok} onChange={set('tiktok')} />
              </Field>
              <Field label="الموقع الإلكتروني" error={errors.website}>
                <Input value={form.website} onChange={set('website')} />
              </Field>
            </div>
          )}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep(2)} className="flex-1">رجوع</Button>
            <Button type="submit" loading={loading} className="flex-1">إنشاء الحساب</Button>
          </div>
        </form>
      )}

      {step === 4 && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
          noValidate
        >
          <p className="text-[var(--text-sm)] text-navy-600">
            أدخل الرمز المرسل إلى <span className="numeric font-bold">{form.phone}</span>
          </p>
          {devCode && (
            <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-[var(--text-sm)] text-brand-800">
              رمز التحقق (وضع التطوير): <span className="numeric font-bold">{devCode}</span>
            </p>
          )}
          <Field label="رمز التحقق" error={errors.code} required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} className="text-center tracking-[0.5em]" />
          </Field>
          <Button type="submit" loading={loading} className="w-full">تأكيد وإكمال التسجيل</Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              void (async () => {
                try {
                  const { data } = await api.post('/auth/resend-otp', { phone: form.phone, purpose: 'register' });
                  if (data.devCode) setDevCode(data.devCode);
                  push('تم إرسال الرمز مرة أخرى', 'info');
                } catch (err) {
                  push(readError(err).message, 'error');
                }
              })();
            }}
          >
            إعادة إرسال الرمز
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
