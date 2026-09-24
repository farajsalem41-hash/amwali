import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../Logo';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="mb-8 inline-block"><Logo /></Link>
          <h1 className="text-[var(--text-xl)] font-extrabold">{title}</h1>
          {subtitle && <p className="mt-2 text-[var(--text-sm)] text-slate-500">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-[var(--text-sm)] text-slate-500">{footer}</div>}
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" aria-hidden />
        <div className="relative max-w-lg">
          <h2 className="text-[var(--text-xl)] font-black text-white">نظّم طلبات الدفع والتحويلات في مكان واحد</h2>
          <p className="mt-4 text-[var(--text-sm)] leading-relaxed text-slate-300">
            روابط دفع آمنة، دفعات جزئية محسوبة تلقائيًا، إثباتات تحويل مرتبة، وتقارير جاهزة — بدون جداول ولا صور
            ضائعة في المحادثات.
          </p>
          <ul className="mt-8 space-y-3 text-[var(--text-sm)] text-slate-300">
            {['لا يحتاج عميلك حسابًا ليدفع', 'المتبقي يُحسب في الخادم ولا يكون سالبًا', 'التأكيد النهائي بيدك أنت'].map((i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-emerald-300">✓</span> {i}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
