import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fieldErrors, readError } from '../../lib/api';
import { AuthShell } from '../../components/layout/AuthShell';
import { Button, Field, Input } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setErrors({});
    setMessage('');
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      setErrors(fieldErrors(err));
      setMessage(readError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="استرجاع كلمة المرور"
      subtitle="نرسل رمز تحقق إلى رقم هاتفك، ثم تعيّن كلمة مرور جديدة."
      footer={<p><Link className="link" to="/login">رجوع لتسجيل الدخول</Link></p>}
    >
      {message && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[var(--text-sm)] font-medium text-rose-700">{message}</p>}

      {step === 1 && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const { data } = await api.post('/auth/forgot-password', { phone });
              if (data.devCode) setDevCode(data.devCode);
              setStep(2);
              push('إذا كان الرقم صالحًا فسيتم إرسال رمز التحقق', 'info');
            });
          }}
        >
          <Field label="رقم الهاتف" error={errors.phone} required>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="091xxxxxxx" />
          </Field>
          <Button type="submit" loading={loading} className="w-full">إرسال رمز التحقق</Button>
        </form>
      )}

      {step === 2 && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const { data } = await api.post('/auth/verify-otp', { phone, code, purpose: 'reset_password' });
              setResetToken(data.resetToken);
              setStep(3);
            });
          }}
        >
          {devCode && (
            <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-[var(--text-sm)] text-brand-800">
              رمز التحقق (وضع التطوير): <span className="numeric font-bold">{devCode}</span>
            </p>
          )}
          <Field label="رمز التحقق" error={errors.code} required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} className="text-center tracking-[0.5em]" />
          </Field>
          <Button type="submit" loading={loading} className="w-full">تحقق</Button>
        </form>
      )}

      {step === 3 && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api.post('/auth/reset-password', { phone, resetToken, password, confirmPassword });
              push('تم تحديث كلمة المرور، سجّل الدخول الآن', 'success');
              navigate('/login', { replace: true });
            });
          }}
        >
          <Field label="كلمة المرور الجديدة" error={errors.password} hint="8 أحرف على الأقل وتحتوي رقمًا" required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="تأكيد كلمة المرور" error={errors.confirmPassword} required>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </Field>
          <Button type="submit" loading={loading} className="w-full">تحديث كلمة المرور</Button>
        </form>
      )}
    </AuthShell>
  );
}
