import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, readError } from '../../lib/api';
import { Meta, useApi, useDebounced } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, Select, Skeleton, Stat, TableSkeleton, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { ACCOUNT_TYPE_LABEL, dateTime, money, num } from '../../lib/format';

type Tab = 'overview' | 'merchants' | 'subscriptions' | 'tickets' | 'audit' | 'backups';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'merchants', label: 'الحسابات' },
  { key: 'subscriptions', label: 'طلبات الاشتراك' },
  { key: 'tickets', label: 'تذاكر الدعم' },
  { key: 'audit', label: 'سجل العمليات' },
  { key: 'backups', label: 'النسخ الاحتياطية' },
];

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const segment = location.pathname.replace(/^\/admin\/?/, '').split('/')[0];
  const tab: Tab = (TABS.some((t) => t.key === segment) ? segment : 'overview') as Tab;
  const setTab = (next: Tab) => navigate(next === 'overview' ? '/admin' : `/admin/${next}`);

  return (
    <div className="min-h-screen bg-navy-50">
      <header className="border-b border-navy-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-[var(--text-lg)] font-extrabold">لوحة إدارة أموالي</h1>
            <p className="text-[var(--text-xs)] text-navy-400">{user?.fullName} • {user?.adminRole === 'super_admin' ? 'مدير عام' : 'فريق الإدارة'}</p>
          </div>
          <Button variant="secondary" onClick={() => void logout()}>خروج</Button>
        </div>
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-[var(--text-sm)] font-bold transition ${tab === t.key ? 'border-navy-900 text-navy-900' : 'border-transparent text-navy-400 hover:text-navy-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        {tab === 'overview' && <Overview />}
        {tab === 'merchants' && <Merchants />}
        {tab === 'subscriptions' && <SubscriptionRequests />}
        {tab === 'tickets' && <Tickets />}
        {tab === 'audit' && <Audit />}
        {tab === 'backups' && <Backups />}
      </main>
    </div>
  );
}

function Overview() {
  const { data, loading, error, reload } = useApi<{
    merchants: number;
    activeMerchants: number;
    disabledMerchants: number;
    usersCount: number;
    newMerchantsThisMonth: number;
    byAccountType: { _id: string; count: number }[];
    requestsCount: number;
    paymentsCount: number;
    platformVolume: number;
    openTickets: number;
    pendingPlanChanges: number;
  }>('/admin/overview');

  if (loading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (error || !data) return <ErrorState message={error || 'تعذر تحميل البيانات'} onRetry={reload} />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="إجمالي الحسابات" value={num(data.merchants)} />
        <Stat label="حسابات نشطة" value={num(data.activeMerchants)} tone="text-teal-700" />
        <Stat label="حسابات معطّلة" value={num(data.disabledMerchants)} tone="text-rose-700" />
        <Stat label="حسابات جديدة هذا الشهر" value={num(data.newMerchantsThisMonth)} />
        <Stat label="عدد المستخدمين" value={num(data.usersCount)} />
        <Stat label="طلبات الدفع" value={num(data.requestsCount)} />
        <Stat label="الدفعات المؤكَّدة" value={num(data.paymentsCount)} />
        <Stat label="حجم المبالغ المنظَّمة" value={money(data.platformVolume)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">الحسابات حسب النوع</h2>
          <ul className="space-y-2 text-[var(--text-sm)]">
            {data.byAccountType.map((t) => (
              <li key={t._id} className="flex justify-between border-b border-navy-50 pb-2">
                <span>{ACCOUNT_TYPE_LABEL[t._id as keyof typeof ACCOUNT_TYPE_LABEL] || t._id}</span>
                <span className="numeric font-bold">{num(t.count)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 text-[var(--text-lg)] font-extrabold">يحتاج متابعة</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat label="تذاكر دعم مفتوحة" value={num(data.openTickets)} />
            <Stat label="طلبات تغيير خطة" value={num(data.pendingPlanChanges)} />
          </div>
        </Card>
      </div>
    </div>
  );
}

interface MerchantRow {
  _id: string;
  businessName: string;
  accountType: keyof typeof ACCOUNT_TYPE_LABEL;
  city?: string;
  isActive: boolean;
  createdAt: string;
  ownerId?: { fullName?: string; phone?: string } | null;
}

function Merchants() {
  const { push } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const debounced = useDebounced(search);
  const params = useMemo(
    () => ({ page, limit: 20, ...(debounced ? { search: debounced } : {}), ...(active ? { isActive: active } : {}) }),
    [page, debounced, active]
  );
  const { data, loading, error, reload } = useApi<{ items: MerchantRow[]; meta: Meta }>('/admin/merchants', params);
  const [selected, setSelected] = useState<string | null>(null);

  const toggle = async (m: MerchantRow) => {
    try {
      await api.post(`/admin/merchants/${m._id}/status`, { isActive: !m.isActive });
      push(m.isActive ? 'تم تعطيل الحساب' : 'تم تنشيط الحساب', 'success');
      void reload();
    } catch (err) {
      push(readError(err).message, 'error');
    }
  };

  return (
    <div>
      <PageHeader title="حسابات التجار" subtitle="الإدارة ترى بيانات الحسابات والإحصائيات فقط، ولا ترى عملاء التاجر أو تفاصيلهم." />
      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="بحث باسم النشاط"><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></Field>
          <Field label="الحالة">
            <Select value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }}>
              <option value="">الكل</option>
              <option value="true">نشط</option>
              <option value="false">معطّل</option>
            </Select>
          </Field>
        </div>
      </Card>

      {loading ? (
        <TableSkeleton cols={6} />
      ) : error || !data ? (
        <ErrorState message={error || 'تعذر التحميل'} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState title="لا توجد حسابات" body="لم يُطابق البحث أي حساب." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-navy-100 bg-navy-50/60">
                <tr>
                  <th className="th">النشاط</th>
                  <th className="th">النوع</th>
                  <th className="th">المالك</th>
                  <th className="th">المدينة</th>
                  <th className="th">التسجيل</th>
                  <th className="th">الحالة</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {data.items.map((m) => (
                  <tr key={m._id} className="hover:bg-navy-50/40">
                    <td className="td font-bold">{m.businessName}</td>
                    <td className="td">{ACCOUNT_TYPE_LABEL[m.accountType] || m.accountType}</td>
                    <td className="td">
                      {m.ownerId?.fullName || '—'}
                      <div className="numeric text-[var(--text-xs)] text-navy-400">{m.ownerId?.phone}</div>
                    </td>
                    <td className="td">{m.city || '—'}</td>
                    <td className="td numeric text-navy-500">{dateTime(m.createdAt)}</td>
                    <td className="td">{m.isActive ? <Badge tone="bg-teal-100 text-teal-800">نشط</Badge> : <Badge tone="bg-rose-100 text-rose-700">معطّل</Badge>}</td>
                    <td className="td">
                      <div className="flex gap-2">
                        <button className="link" onClick={() => setSelected(m._id)}>تفاصيل</button>
                        <button className={`link ${m.isActive ? 'text-rose-600' : 'text-teal-700'}`} onClick={() => void toggle(m)}>
                          {m.isActive ? 'تعطيل' : 'تنشيط'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />
        </>
      )}

      <MerchantDetail id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function MerchantDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, loading } = useApi<{
    merchant: MerchantRow & { phone?: string; address?: string; commercialRegister?: string };
    subscription: { planCode: string; status: string; endsAt?: string } | null;
    stats: { requestsCount: number; paymentsCount: number; volume: number };
  }>(id ? `/admin/merchants/${id}` : null);

  return (
    <Modal open={!!id} onClose={onClose} title={data?.merchant.businessName || 'تفاصيل الحساب'} wide>
      {loading || !data ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="طلبات الدفع" value={num(data.stats.requestsCount)} />
            <Stat label="الدفعات" value={num(data.stats.paymentsCount)} />
            <Stat label="حجم المبالغ" value={money(data.stats.volume)} />
          </div>
          <dl className="space-y-2 text-[var(--text-sm)]">
            <div className="flex justify-between"><dt className="text-navy-500">نوع الحساب</dt><dd className="font-bold">{ACCOUNT_TYPE_LABEL[data.merchant.accountType]}</dd></div>
            <div className="flex justify-between"><dt className="text-navy-500">المالك</dt><dd>{data.merchant.ownerId?.fullName} — <span className="numeric">{data.merchant.ownerId?.phone}</span></dd></div>
            <div className="flex justify-between"><dt className="text-navy-500">المدينة</dt><dd>{data.merchant.city || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-navy-500">الخطة</dt><dd>{data.subscription?.planCode || '—'} ({data.subscription?.status || '—'})</dd></div>
          </dl>
          <p className="text-[var(--text-xs)] text-navy-400">لا تُعرض بيانات عملاء التاجر أو إثباتات الدفع في لوحة الإدارة.</p>
        </div>
      )}
    </Modal>
  );
}

interface SubRequest {
  _id: string;
  changeRequestedAt?: string;
  merchantId?: { businessName?: string; accountType?: string } | null;
  planId?: { name?: string; price?: number } | null;
  requestedPlanId?: { name?: string; price?: number } | null;
}

function SubscriptionRequests() {
  const { push } = useToast();
  const [page, setPage] = useState(1);
  const params = useMemo(() => ({ page, limit: 20 }), [page]);
  const { data, loading, error, reload } = useApi<{ items: SubRequest[]; meta: Meta }>('/admin/subscription-requests', params);

  const review = async (id: string, decision: 'approve' | 'reject') => {
    try {
      await api.post(`/admin/subscription-requests/${id}/review`, { decision });
      push(decision === 'approve' ? 'تمت الموافقة' : 'تم الرفض', 'success');
      void reload();
    } catch (err) {
      push(readError(err).message, 'error');
    }
  };

  return (
    <div>
      <PageHeader title="طلبات تغيير الخطة" subtitle="التفعيل يدوي: تأكد من استلام قيمة الخطة قبل الموافقة." />
      {loading ? (
        <TableSkeleton cols={4} />
      ) : error || !data ? (
        <ErrorState message={error || 'تعذر التحميل'} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState title="لا توجد طلبات" body="ستظهر هنا طلبات ترقية الخطط المرسلة من التجار." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-navy-100 bg-navy-50/60">
                <tr>
                  <th className="th">النشاط</th>
                  <th className="th">الخطة الحالية</th>
                  <th className="th">الخطة المطلوبة</th>
                  <th className="th">تاريخ الطلب</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {data.items.map((s) => (
                  <tr key={s._id}>
                    <td className="td font-bold">{s.merchantId?.businessName || '—'}</td>
                    <td className="td">{s.planId?.name || '—'}</td>
                    <td className="td font-bold">{s.requestedPlanId?.name || '—'}{s.requestedPlanId?.price ? ` — ${money(s.requestedPlanId.price)}` : ''}</td>
                    <td className="td numeric text-navy-500">{s.changeRequestedAt ? dateTime(s.changeRequestedAt) : '—'}</td>
                    <td className="td">
                      <div className="flex gap-2">
                        <button className="link text-teal-700" onClick={() => void review(s._id, 'approve')}>موافقة</button>
                        <button className="link text-rose-600" onClick={() => void review(s._id, 'reject')}>رفض</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

interface AdminTicket {
  _id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  category: string;
  updatedAt: string;
  messages: { authorLabel?: string; isStaff: boolean; body: string; createdAt: string }[];
  merchantId?: { businessName?: string } | null;
  userId?: { fullName?: string; phone?: string } | null;
}

const TICKET_STATUS: Record<string, string> = {
  open: 'مفتوحة',
  in_progress: 'تحت المعالجة',
  waiting_user: 'بانتظار المستخدم',
  resolved: 'تم الحل',
  closed: 'مغلقة',
};

function Tickets() {
  const { push } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const params = useMemo(() => ({ page, limit: 20, ...(status ? { status } : {}) }), [page, status]);
  const { data, loading, error, reload } = useApi<{ items: AdminTicket[]; meta: Meta }>('/admin/tickets', params);
  const [active, setActive] = useState<AdminTicket | null>(null);
  const [body, setBody] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div>
      <PageHeader title="تذاكر الدعم" subtitle="ردود الفريق تظهر للتاجر داخل حسابه مباشرة." />
      <Card className="mb-5">
        <Field label="الحالة">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:max-w-xs">
            <option value="">الكل</option>
            {Object.entries(TICKET_STATUS).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </Select>
        </Field>
      </Card>

      {loading ? (
        <TableSkeleton cols={5} />
      ) : error || !data ? (
        <ErrorState message={error || 'تعذر التحميل'} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState title="لا توجد تذاكر" body="لا توجد تذاكر مطابقة للتصفية الحالية." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-navy-100 bg-navy-50/60">
                <tr>
                  <th className="th">التذكرة</th>
                  <th className="th">النشاط</th>
                  <th className="th">الموضوع</th>
                  <th className="th">الحالة</th>
                  <th className="th">آخر تحديث</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {data.items.map((t) => (
                  <tr key={t._id}>
                    <td className="td numeric">{t.ticketNumber}</td>
                    <td className="td">{t.merchantId?.businessName || t.userId?.fullName || '—'}</td>
                    <td className="td font-bold">{t.subject}</td>
                    <td className="td"><Badge>{TICKET_STATUS[t.status] || t.status}</Badge></td>
                    <td className="td numeric text-navy-500">{dateTime(t.updatedAt)}</td>
                    <td className="td">
                      <button className="link" onClick={() => { setActive(t); setBody(''); setNewStatus(t.status); }}>عرض والرد</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />
        </>
      )}

      <Modal open={!!active} onClose={() => setActive(null)} title={active?.subject || 'التذكرة'} wide>
        {active && (
          <div className="space-y-4">
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {active.messages.map((m, i) => (
                <div key={i} className={`rounded-xl p-3 text-[var(--text-sm)] ${m.isStaff ? 'border border-brand-100 bg-brand-50' : 'bg-navy-50'}`}>
                  <p className="mb-1 text-[var(--text-xs)] font-bold text-navy-500">{m.authorLabel || (m.isStaff ? 'الدعم' : 'التاجر')} • {dateTime(m.createdAt)}</p>
                  <p className="whitespace-pre-line text-navy-700">{m.body}</p>
                </div>
              ))}
            </div>
            <Field label="الرد"><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} /></Field>
            <Field label="تحديث الحالة">
              <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {Object.entries(TICKET_STATUS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </Select>
            </Field>
            <Button
              className="w-full"
              loading={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await api.post(`/admin/tickets/${active._id}/reply`, { ...(body ? { body } : {}), status: newStatus });
                  push('تم الحفظ', 'success');
                  setActive(null);
                  void reload();
                } catch (err) {
                  push(readError(err).message, 'error');
                } finally {
                  setSaving(false);
                }
              }}
            >
              حفظ
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Audit() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const debounced = useDebounced(action);
  const params = useMemo(() => ({ page, limit: 30, ...(debounced ? { action: debounced } : {}) }), [page, debounced]);
  const { data, loading, error, reload } = useApi<{ items: { _id: string; action: string; resource: string; actorLabel?: string; ip?: string; createdAt: string }[]; meta: Meta }>('/admin/audit-logs', params);

  return (
    <div>
      <PageHeader title="سجل عمليات المنصة" subtitle="سجل كامل للعمليات الحساسة على مستوى المنصة." />
      <Card className="mb-5">
        <Field label="تصفية بنوع العملية"><Input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="sm:max-w-sm" /></Field>
      </Card>
      {loading ? (
        <TableSkeleton cols={5} />
      ) : error || !data ? (
        <ErrorState message={error || 'تعذر التحميل'} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState title="لا توجد عمليات" body="لا توجد سجلات مطابقة." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-navy-100 bg-navy-50/60">
                <tr>
                  <th className="th">العملية</th>
                  <th className="th">المورد</th>
                  <th className="th">المستخدم</th>
                  <th className="th">IP</th>
                  <th className="th">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {data.items.map((l) => (
                  <tr key={l._id}>
                    <td className="td font-bold">{l.action}</td>
                    <td className="td text-navy-500">{l.resource}</td>
                    <td className="td">{l.actorLabel || '—'}</td>
                    <td className="td numeric text-navy-400">{l.ip || '—'}</td>
                    <td className="td numeric text-navy-500">{dateTime(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function Backups() {
  const { data, loading, error, reload } = useApi<{ items: { _id: string; status: string; kind?: string; sizeBytes?: number; collections?: number; createdAt: string; error?: string }[] }>('/admin/backups');

  return (
    <div>
      <PageHeader title="النسخ الاحتياطية" subtitle="سجل عمليات النسخ الاحتياطي لقاعدة البيانات." />
      {loading ? (
        <TableSkeleton cols={4} />
      ) : error || !data ? (
        <ErrorState message={error || 'تعذر التحميل'} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState title="لا توجد نسخ مسجلة" body="سيظهر هنا سجل النسخ الاحتياطية بعد تشغيل أول نسخة." />
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-navy-100 bg-navy-50/60">
              <tr>
                <th className="th">النوع</th>
                <th className="th">الحالة</th>
                <th className="th">الحجم</th>
                <th className="th">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {data.items.map((b) => (
                <tr key={b._id}>
                  <td className="td">{b.kind || 'database'}</td>
                  <td className="td">{b.status === 'success' ? <Badge tone="bg-teal-100 text-teal-800">ناجحة</Badge> : <Badge tone="bg-rose-100 text-rose-700">فاشلة</Badge>}</td>
                  <td className="td numeric">{b.sizeBytes ? `${num(Math.round(b.sizeBytes / 1024))} KB` : '—'}</td>
                  <td className="td numeric text-navy-500">{dateTime(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
