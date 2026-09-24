import { CrudPage } from '../../components/CrudPage';
import { useAuth } from '../../lib/auth';

interface Courier {
  _id: string;
  name: string;
  phone: string;
  area?: string;
  isActive: boolean;
}

export default function Couriers() {
  const { can } = useAuth();
  return (
    <CrudPage<Courier>
      title="المندوبون"
      subtitle="أضف مندوبي التوصيل، وأنشئ لكل طلب رابطًا خاصًا يحدّث حالة التوصيل فقط."
      path="/org/couriers"
      canManage={can('couriers.manage')}
      emptyTitle="لا يوجد مندوبون"
      emptyBody="أضف مندوبًا لتتمكن من إسناد الطلبات وإنشاء روابط التوصيل."
      columns={[
        { header: 'المندوب', cell: (c) => <span className="font-bold">{c.name}</span> },
        { header: 'الهاتف', cell: (c) => <span className="numeric">{c.phone}</span> },
        { header: 'المنطقة', cell: (c) => c.area || '—' },
        { header: 'الحالة', cell: (c) => (c.isActive ? 'نشط' : 'معطّل') },
      ]}
      fields={[
        { name: 'name', label: 'اسم المندوب', required: true },
        { name: 'phone', label: 'رقم الهاتف', type: 'tel', required: true },
        { name: 'area', label: 'المنطقة' },
      ]}
    />
  );
}
