import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect } from 'react';

/* ---------- Button ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-navy-800 text-white hover:bg-navy-900 active:bg-navy-950 disabled:bg-navy-300',
  secondary: 'border border-navy-200 bg-white text-navy-800 hover:bg-navy-50 disabled:text-navy-300',
  ghost: 'text-navy-600 hover:bg-navy-100 disabled:text-navy-300',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  success: 'bg-teal-600 text-white hover:bg-teal-700 disabled:bg-teal-300',
};

export function Button({
  variant = 'primary',
  loading,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[var(--text-sm)] font-bold transition
        disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  );
}

/* ---------- Form fields ---------- */

export function Field({
  label,
  error,
  hint,
  children,
  required,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="field-label">
        {label} {required && <span className="text-rose-600">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[var(--text-xs)] text-navy-400">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`field-input ${className}`} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={`field-input min-h-24 resize-y ${className}`} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`field-input ${className}`}>
      {children}
    </select>
  );
}

/* ---------- Layout primitives ---------- */

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`card p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[var(--text-xl)] font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[var(--text-sm)] text-navy-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = 'bg-navy-100 text-navy-700' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[var(--text-xs)] font-bold ${tone}`}>{children}</span>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'text-navy-900',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-[var(--text-xs)] font-bold uppercase tracking-wide text-navy-400">{label}</p>
      <p className={`mt-2 text-[var(--text-lg)] font-extrabold ${tone}`}>
        <span className="numeric">{value}</span>
      </p>
      {hint && <p className="mt-1 text-[var(--text-xs)] text-navy-400">{hint}</p>}
    </div>
  );
}

/* ---------- States ---------- */

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-navy-100 ${className}`} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-navy-50 py-3 last:border-0">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-400" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M4 12h10M4 17h7" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-[var(--text-lg)] font-bold">{title}</h3>
      {body && <p className="max-w-md text-[var(--text-sm)] text-navy-500">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card border-rose-100 bg-rose-50 px-6 py-8 text-center">
      <p className="text-[var(--text-sm)] font-bold text-rose-800">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/45 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <button className="absolute inset-0 cursor-default" aria-label="إغلاق" onClick={onClose} />
      <div
        className={`animate-fade-up relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-pop sm:rounded-2xl sm:p-6 ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-[var(--text-lg)] font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Pagination ---------- */

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        السابق
      </Button>
      <span className="text-[var(--text-sm)] text-navy-500">
        صفحة <span className="numeric font-bold">{page}</span> من <span className="numeric font-bold">{pages}</span>
      </span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        التالي
      </Button>
    </div>
  );
}
