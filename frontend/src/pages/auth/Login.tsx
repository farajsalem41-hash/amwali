import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fieldErrors, readError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuthShell } from '../../components/layout/AuthShell';
import { Button, Field, Input } from '../../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setMessage('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { phone, password, rememberMe: remember });
      await login(data.token, remember);
      navigate(data.user?.isAdmin ? '/admin' : '/app', { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setMessage(readError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="تسجيل الدخول"
      subtitle="ادخل رقم هاتفك وكلمة المرور للوصول إلى لوحة التحكم."
      footer={
        <p>
          ما عندك حساب؟ <Link className="link" to="/register">أنشئ حساب مجاني</Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {message && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[var(--text-sm)] font-medium text-rose-700">{message}</p>}
        <Field label="رقم الهاتف" error={errors.phone} required>
          <Input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="091xxxxxxx" autoComplete="tel" />
        </Field>
        <Field label="كلمة المرور" error={errors.password} required>
          <Input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[var(--text-sm)] text-navy-600">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-navy-300" />
            تذكرني
          </label>
          <Link className="link text-[var(--text-sm)]" to="/forgot-password">نسيت كلمة المرور؟</Link>
        </div>
        <Button type="submit" loading={loading} className="w-full">دخول</Button>
      </form>
    </AuthShell>
  );
}
