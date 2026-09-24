import { ReactNode, useState } from 'react';
import { api, readError } from '../lib/api';
import { useApi } from '../lib/hooks';
import { Button, Card, EmptyState, ErrorState, Modal, PageHeader, TableSkeleton } from './ui';
import { useToast } from './ui/Toast';

export interface CrudColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
}

export interface CrudField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'tel' | 'select' | 'textarea' | 'checkbox';
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
}

/**
 * Generic list + create/edit/delete screen for simple resources
 * (branches, products, couriers…). Keeps behaviour consistent across pages.
 */
export function CrudPage<T extends { _id: string }>({
  title,
  subtitle,
  path,
  listKey = 'items',
  columns,
  fields,
  canManage,
  emptyTitle,
  emptyBody,
  toPayload,
  toForm,
  extraFilters,
  params,
}: {
  title: string;
  subtitle?: string;
  path: string;
  listKey?: string;
  columns: CrudColumn<T>[];
  fields: CrudField[];
  canManage: boolean;
  emptyTitle: string;
  emptyBody: string;
  toPayload?: (form: Record<string, string | boolean>) => Record<string, unknown>;
  toForm?: (row: T) => Record<string, string | boolean>;
  extraFilters?: ReactNode;
  params?: Record<string, unknown>;
}) {
  const { push } = useToast();
  const { data, loading, error, reload } = useApi<Record<string, T[]>>(path, params);
  const rows = (data?.[listKey] as T[] | undefined) || [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const blank = () =>
    Object.fromEntries(
      fields.map((f) => {
        if (f.type === 'checkbox') return [f.name, false];
        if (f.type === 'select') return [f.name, f.options?.[0]?.value ?? ''];
        return [f.name, ''];
      })
    );

  const startCreate = () => {
    setEditing(null);
    setForm(blank());
    setMessage('');
    setOpen(true);
  };

  const startEdit = (row: T) => {
    setEditing(row);
    setForm(
      toForm
        ? toForm(row)
        : Object.fromEntries(
            fields.map((f) => {
              const value = (row as unknown as Record<string, unknown>)[f.name];
              return [f.name, f.type === 'checkbox' ? !!value : value == null ? '' : String(value)];
            })
          )
    );
    setMessage('');
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setSaving(true);
    try {
      const payload = toPayload
        ? toPayload(form)
        : Object.fromEntries(
            fields
              .map((f) => {
                const raw = form[f.name];
                if (f.type === 'checkbox') return [f.name, !!raw];
                if (raw === '' || raw === undefined) return [f.name, undefined];
                return [f.name, f.type === 'number' ? Number(raw) : raw];
              })
              .filter(([, v]) => v !== undefined)
          );
      if (editing) await api.patch(`${path}/${editing._id}`, payload);
      else await api.post(path, payload);
      push(editing ? 'تم التحديث' : 'تمت الإضافة', 'success');
      setOpen(false);
      void reload();
    } catch (err) {
      setMessage(readError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: T) => {
    try {
      await api.delete(`${path}/${row._id}`);
      push('تم الحذف', 'success');
      void reload();
    } catch (err) {
      push(readError(err).message, 'error');
    }
  };

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} action={canManage && <Button onClick={startCreate}>إضافة</Button>} />
      {extraFilters && <Card className="mb-5">{extraFilters}</Card>}

      {loading ? (
        <TableSkeleton cols={columns.length + 1} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} body={emptyBody} action={canManage && <Button className="mt-2" onClick={startCreate}>إضافة</Button>} />
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-navy-100 bg-navy-50/60">
              <tr>
                {columns.map((c) => (
                  <th key={c.header} className="th">{c.header}</th>
                ))}
                {canManage && <th className="th"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {rows.map((row) => (
                <tr key={row._id} className="hover:bg-navy-50/40">
                  {columns.map((c) => (
                    <td key={c.header} className="td">{c.cell(row)}</td>
                  ))}
                  {canManage && (
                    <td className="td">
                      <div className="flex gap-2">
                        <button className="link" onClick={() => startEdit(row)}>تعديل</button>
                        <button className="link text-rose-600" onClick={() => void remove(row)}>حذف</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'تعديل' : 'إضافة'}>
        <form onSubmit={save} className="space-y-4" noValidate>
          {message && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[var(--text-sm)] font-medium text-rose-700">{message}</p>}
          {fields.map((f) => (
            <div key={f.name}>
              {f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-[var(--text-sm)] text-navy-700">
                  <input type="checkbox" className="h-4 w-4 rounded border-navy-300" checked={!!form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} />
                  {f.label}
                </label>
              ) : (
                <label className="block">
                  <span className="field-label">{f.label} {f.required && <span className="text-rose-600">*</span>}</span>
                  {f.type === 'select' ? (
                    <select className="field-input" value={String(form[f.name] ?? '')} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                      {(f.options || []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea className="field-input min-h-20" value={String(form[f.name] ?? '')} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
                  ) : (
                    <input
                      className="field-input"
                      type={f.type === 'number' ? 'number' : 'text'}
                      step={f.type === 'number' ? '0.01' : undefined}
                      inputMode={f.type === 'tel' ? 'tel' : undefined}
                      value={String(form[f.name] ?? '')}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    />
                  )}
                  {f.hint && <span className="mt-1 block text-[var(--text-xs)] text-navy-400">{f.hint}</span>}
                </label>
              )}
            </div>
          ))}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" className="flex-1" loading={saving}>حفظ</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
