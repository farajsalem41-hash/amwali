import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api, API_BASE } from '../../lib/api';
import { Logo } from '../Logo';
import { ACCOUNT_TYPE_LABEL } from '../../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  perms?: string[];
  feature?: string;
  ownerOnly?: boolean;
}

const ICONS: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z',
  requests: 'M7 4h10v16l-5-3-5 3z',
  proof: 'M4 5h16v12H4zM8 21h8M9 11l2 2 4-4',
  users: 'M16 19v-1a4 4 0 00-8 0v1M12 11a3 3 0 100-6 3 3 0 000 6z',
  bank: 'M3 9l9-5 9 5M5 9v10h14V9M9 19v-5h6v5',
  invoice: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  box: 'M3 8l9-4 9 4-9 4zM3 8v8l9 4 9-4V8',
  truck: 'M3 7h11v8H3zM14 11h4l3 3v1h-7M6 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z',
  branch: 'M6 4v6a4 4 0 004 4h4M18 10v10M6 4h.01',
  chart: 'M4 20V9M10 20V4M16 20v-7M22 20H2',
  bell: 'M6 9a6 6 0 1112 0v4l2 3H4l2-3z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  card: 'M3 7h18v10H3zM3 11h18',
  chat: 'M4 5h16v10H9l-5 4z',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM4 12h2m12 0h2M12 4v2m0 12v2',
};

const NAV: NavItem[] = [
  { to: '/app', label: 'لوحة التحكم', icon: 'home' },
  { to: '/app/requests', label: 'طلبات الدفع', icon: 'requests', perms: ['payment_requests.view'] },
  { to: '/app/proofs', label: 'إثباتات الدفع', icon: 'proof', perms: ['proofs.review', 'payments.view'] },
  { to: '/app/customers', label: 'العملاء', icon: 'users', perms: ['customers.view'] },
  { to: '/app/bank-accounts', label: 'الحسابات البنكية', icon: 'bank', perms: ['payment_accounts.view', 'payment_accounts.manage'] },
  { to: '/app/invoices', label: 'الفواتير', icon: 'invoice', perms: ['invoices.view'], feature: 'invoices' },
  { to: '/app/products', label: 'المنتجات والخدمات', icon: 'box', perms: ['products.manage'], feature: 'products' },
  { to: '/app/orders', label: 'الطلبات', icon: 'truck', perms: ['orders.view'], feature: 'orders' },
  { to: '/app/couriers', label: 'المندوبون', icon: 'truck', perms: ['couriers.manage'], feature: 'delivery' },
  { to: '/app/branches', label: 'الفروع', icon: 'branch', perms: ['branches.manage'], feature: 'branches' },
  { to: '/app/employees', label: 'الموظفون والصلاحيات', icon: 'shield', perms: ['employees.manage'], feature: 'employees' },
  { to: '/app/reports', label: 'التقارير', icon: 'chart', perms: ['reports.view'] },
  { to: '/app/notifications', label: 'الإشعارات', icon: 'bell' },
  { to: '/app/audit-logs', label: 'سجل العمليات', icon: 'shield', perms: ['audit.view'] },
  { to: '/app/subscription', label: 'الاشتراك', icon: 'card', ownerOnly: true },
  { to: '/app/support', label: 'الدعم الفني', icon: 'chat' },
  { to: '/app/settings', label: 'الإعدادات', icon: 'gear' },
];

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d={ICONS[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DashboardLayout() {
  const { user, merchant, can, hasFeature, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data } = await api.get('/notifications', { params: { limit: 1 } });
        if (alive) setUnread(data.unread || 0);
      } catch {
        /* ignore */
      }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [location.pathname]);

  const items = NAV.filter((item) => {
    if (item.feature && !hasFeature(item.feature)) return false;
    if (item.ownerOnly && !user?.isOwner) return false;
    if (item.perms && !can(...item.perms)) return false;
    return true;
  });

  const logoUrl = merchant?.logoFileId ? `${API_BASE}/api/public/files/${merchant.logoFileId}` : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,.07),transparent_30%)] lg:flex">
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-72 overflow-y-auto bg-slate-950 px-4 py-6 text-slate-200 shadow-2xl shadow-slate-950/20 transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <Link to="/app" className="mb-8 block px-2">
          <Logo light />
        </Link>
        <nav className="space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/app'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[var(--text-sm)] font-medium transition ${
                  isActive ? 'bg-gradient-to-l from-emerald-400/20 to-cyan-400/10 text-white shadow-inner shadow-emerald-400/10' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.to === '/app/notifications' && unread > 0 && (
                <span className="numeric mr-auto rounded-full bg-teal-500 px-2 py-0.5 text-[var(--text-xs)] font-bold text-navy-950">
                  {unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        {user?.isAdmin && (
          <Link to="/admin" className="mt-6 block rounded-xl bg-gradient-to-l from-emerald-400 to-cyan-400 px-3 py-2.5 text-[var(--text-sm)] font-black text-slate-950 shadow-lg shadow-emerald-500/10">
            لوحة الإدارة
          </Link>
        )}
      </aside>

      {open && <button className="fixed inset-0 z-30 bg-navy-950/40 lg:hidden" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button
            className="rounded-lg p-2 text-navy-600 hover:bg-navy-50 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="القائمة"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-cyan-100 text-[var(--text-sm)] font-black text-emerald-700">
                {(merchant?.businessName || user?.fullName || '؟').slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[var(--text-sm)] font-bold">{merchant?.businessName || 'أموالي'}</p>
              <p className="truncate text-[var(--text-xs)] text-navy-400">
                {merchant ? ACCOUNT_TYPE_LABEL[merchant.accountType] : 'مدير النظام'} · {user?.fullName}
              </p>
            </div>
          </div>
          <div className="mr-auto flex items-center gap-2">
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[var(--text-sm)] font-bold text-slate-700 shadow-sm hover:border-emerald-200 hover:bg-emerald-50"
            >
              خروج
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
