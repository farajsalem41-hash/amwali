import { CrudPage } from '../../components/CrudPage';
import { useAuth } from '../../lib/auth';

interface Branch {
  _id: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
  isActive: boolean;
}

export default function Branches() {
  const { can } = useAuth();
  return (
    <CrudPage<Branch>
      title="الفروع"
      subtitle="اربط طلبات الدفع والموظفين بالفروع لتحصل على تقارير لكل فرع."
      path="/org/branches"
      canManage={can('branches.manage')}
      emptyTitle="لا توجد فروع"
      emptyBody="أضف فرعًا لتوزيع الطلبات والموظفين عليه."
      columns={[
        { header: 'الفرع', cell: (b) => <span className="font-bold">{b.name}</span> },
        { header: 'المدينة', cell: (b) => b.city || '—' },
        { header: 'العنوان', cell: (b) => b.address || '—' },
        { header: 'الهاتف', cell: (b) => <span className="numeric">{b.phone || '—'}</span> },
        { header: 'الحالة', cell: (b) => (b.isActive ? 'نشط' : 'معطّل') },
      ]}
      fields={[
        { name: 'name', label: 'اسم الفرع', required: true },
        { name: 'city', label: 'المدينة' },
        { name: 'address', label: 'العنوان' },
        { name: 'phone', label: 'الهاتف', type: 'tel' },
      ]}
    />
  );
}
