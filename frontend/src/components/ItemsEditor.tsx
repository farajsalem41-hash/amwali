import { Button, Field, Input, Select } from './ui';
import { money } from '../lib/format';

export interface LineItem {
  name: string;
  productId?: string;
  quantity: string;
  unitPrice: string;
}

export interface ProductOption {
  _id: string;
  name: string;
  price: number;
}

export const emptyItem: LineItem = { name: '', quantity: '1', unitPrice: '' };

/** Editable list of invoice / order line items with a live subtotal. */
export function ItemsEditor({
  items,
  setItems,
  products,
}: {
  items: LineItem[];
  setItems: (items: LineItem[]) => void;
  products: ProductOption[];
}) {
  const update = (index: number, patch: Partial<LineItem>) =>
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const subtotal = items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);

  return (
    <div className="space-y-3">
      <p className="field-label">البنود *</p>
      {items.map((item, index) => (
        <div key={index} className="grid gap-3 rounded-xl border border-navy-100 p-3 sm:grid-cols-[1.6fr_0.7fr_0.9fr_auto]">
          {products.length > 0 ? (
            <Field label="المنتج / البند">
              <Select
                value={item.productId || ''}
                onChange={(e) => {
                  const p = products.find((x) => x._id === e.target.value);
                  update(index, p ? { productId: p._id, name: p.name, unitPrice: String(p.price) } : { productId: '', name: '' });
                }}
              >
                <option value="">بند يدوي</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </Select>
              {!item.productId && (
                <input className="field-input mt-2" placeholder="اسم البند" value={item.name} onChange={(e) => update(index, { name: e.target.value })} />
              )}
            </Field>
          ) : (
            <Field label="اسم البند">
              <Input value={item.name} onChange={(e) => update(index, { name: e.target.value })} />
            </Field>
          )}
          <Field label="الكمية">
            <Input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => update(index, { quantity: e.target.value })} />
          </Field>
          <Field label="سعر الوحدة">
            <Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => update(index, { unitPrice: e.target.value })} />
          </Field>
          <div className="flex items-end">
            <Button type="button" variant="ghost" className="text-rose-600" disabled={items.length === 1} onClick={() => setItems(items.filter((_, i) => i !== index))}>
              حذف
            </Button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" onClick={() => setItems([...items, { ...emptyItem }])}>إضافة بند</Button>
        <span className="text-[var(--text-sm)]">المجموع الفرعي: <span className="numeric font-extrabold">{money(subtotal)}</span></span>
      </div>
    </div>
  );
}
