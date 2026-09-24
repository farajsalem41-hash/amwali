import { CrudPage } from '../../components/CrudPage';
import { useAuth } from '../../lib/auth';
import { money } from '../../lib/format';

interface Product {
  _id: string;
  name: string;
  kind: 'product' | 'service';
  sku?: string;
  price: number;
  unit?: string;
  isActive: boolean;
}

export default function Products() {
  const { can } = useAuth();
  return (
    <CrudPage<Product>
      title="المنتجات والخدمات"
      subtitle="استخدمها لتسريع إنشاء الفواتير والطلبات."
      path="/org/products"
      canManage={can('products.manage')}
      emptyTitle="لا توجد منتجات"
      emptyBody="أضف منتجًا أو خدمة بسعرها لتستخدمها في الفواتير والطلبات."
      columns={[
        { header: 'الاسم', cell: (p) => <span className="font-bold">{p.name}</span> },
        { header: 'النوع', cell: (p) => (p.kind === 'service' ? 'خدمة' : 'منتج') },
        { header: 'SKU', cell: (p) => <span className="numeric">{p.sku || '—'}</span> },
        { header: 'السعر', cell: (p) => <span className="numeric">{money(p.price)}</span> },
        { header: 'الوحدة', cell: (p) => p.unit || '—' },
      ]}
      fields={[
        { name: 'name', label: 'الاسم', required: true },
        { name: 'kind', label: 'النوع', type: 'select', options: [{ value: 'product', label: 'منتج' }, { value: 'service', label: 'خدمة' }] },
        { name: 'price', label: 'السعر', type: 'number', required: true },
        { name: 'sku', label: 'SKU' },
        { name: 'unit', label: 'الوحدة', hint: 'قطعة، كيلو، ساعة…' },
        { name: 'description', label: 'الوصف', type: 'textarea' },
      ]}
    />
  );
}
