import { useMemo, useState } from 'react';
import { api, readError } from '../../lib/api';
import { Meta, useApi } from '../../lib/hooks';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { dateTime } from '../../lib/format';

interface Notification {
  _id: string;
  type: string;
  title: string;
  body?: string;
  isRead: boolean;
  createdAt: string;
}

export default function Notifications() {
  const { push } = useToast();
  const [page, setPage] = useState(1);
  const params = useMemo(() => ({ page, limit: 20 }), [page]);
  const { data, loading, error, reload } = useApi<{ items: Notification[]; meta: Meta; unread: number }>('/notifications', params);

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all', {});
      push('تم تعليم الكل كمقروء', 'success');
      void reload();
    } catch (err) {
      push(readError(err).message, 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="التنبيهات"
        subtitle="إشعارات داخل النظام لكل إثبات دفع جديد، دفعة مؤكَّدة، وطلب اكتمل سداده."
        action={data && data.unread > 0 && <Button variant="secondary" onClick={markAll}>تعليم الكل كمقروء</Button>}
      />

      {loading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : error || !data ? (
        <ErrorState message={error || 'تعذر تحميل التنبيهات'} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState title="لا توجد تنبيهات" body="ستظهر هنا التنبيهات عند رفع إثبات دفع أو تأكيد دفعة." />
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((n) => (
              <Card key={n._id} className={n.isRead ? '' : 'border-brand-200 bg-brand-50/40'}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[var(--text-base)] font-extrabold">{n.title}</h2>
                      {!n.isRead && <Badge tone="bg-brand-100 text-brand-800">جديد</Badge>}
                    </div>
                    {n.body && <p className="mt-1 text-[var(--text-sm)] text-navy-600">{n.body}</p>}
                    <p className="mt-1 text-[var(--text-xs)] text-navy-400">{dateTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await api.post(`/notifications/${n._id}/read`, {});
                          void reload();
                        } catch (err) {
                          push(readError(err).message, 'error');
                        }
                      }}
                    >
                      تعليم كمقروء
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
