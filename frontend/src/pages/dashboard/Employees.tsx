import { useState } from 'react';
import { api, readError } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, TableSkeleton } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { PERMISSION_LABEL } from '../../lib/format';

interface Employee {
  _id: string;
  fullName: string;
  phone: string;
  role: 'manager' | 'accountant' | 'cashier' | 'custom';
  permissions: string[];
  branchIds: string[];
  isActive: boolean;
}

interface Branch { _id: string; name: string }

const ROLE_LABEL: Record<string, string> = { manager: 'مدير', accountant: 'محاسب', cashier: 'كاشير', custom: 'صلاحيات مخصصة' };

export default function Employees() {
  const { can } = useAuth();
  const { push } = useToast();
  const { data, loading, error, reload } = useApi<{ items: Employee[]; availablePermissions: string[]; rolePermissions: Record<string, string[]> }>('/org/employees');
  const branches = useApi<{ items: Branch[] }>('/org/branches');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({ fullName: '', phone: '', password: '', role: 'cashier' as Employee['role'] });
  const [perms, setPerms] = useState<string[]>([]);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const available = data?.availablePermissions || [];
  const rolePermissions = data?.rolePermissions || {};

  const startCreate = () => {
    setEditing(null);
    setForm({ fullName: '', phone: '', password: '', role: 'cashier' });
    setPerms(rolePermissions.cashier || []);
    setBranchIds([]);
    setMessage('');
    setOpen(true);
  };

  const startEdit = (e: Employee) => {
    setEditing(e);
    setForm({ fullName: e.fullName, phone: e.phone, password: '', role: e.role });
    setPerms(e.permissions || []);
    setBranchIds(e.branchIds || []);
    setMessage('');
    setOpen(true);
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setMessage('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: form.fullName,
        phone: form.phone,
        role: form.role,
        permissions: perms,
        branchIds,
      };
      if (form.password) payload.password = form.password;
      if (editing) await api.patch(`/org/employees/${editing._id}`, payload);
      else await api.post('/org/employees', payload);
      push(editing ? 'تم تحديث الموظف' : 'تم إضافة الموظف', 'success');
      setOpen(false);
      void reload();
    } catch (err) {
      setMessage(readError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="الموظفون والصلاحيات"
        subtitle="كل موظف يدخل برقم هاتفه وكلمة مروره، ويرى ما تسمح له صلاحياته فقط."
        action={can('employees.manage') && <Button onClick={startCreate}>موظف جديد</Button>}
      />

      {loading ? (
        <TableSkeleton cols={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="لا يوجد موظفون" body="أضف موظفًا وحدّد دوره: مدير، محاسب، كاشير، أو صلاحيات مخصصة." action={can('employees.manage') && <Button className="mt-2" onClick={startCreate}>موظف جديد</Button>} />
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-navy-100 bg-navy-50/60">
              <tr>
                <th className="th">الموظف</th>
                <th className="th">الهاتف</th>
                <th className="th">الدور</th>
                <th className="th">عدد الصلاحيات</th>
                <th className="th">الحالة</th>
                {can('employees.manage') && <th className="th"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {data.items.map((e) => (
                <tr key={e._id} className="hover:bg-navy-50/40">
                  <td className="td font-bold">{e.fullName}</td>
                  <td className="td numeric">{e.phone}</td>
                  <td className="td">{ROLE_LABEL[e.role]}</td>
                  <td className="td numeric">{e.permissions?.length || 0}</td>
                  <td className="td">{e.isActive ? <Badge tone="bg-teal-100 text-teal-800">نشط</Badge> : <Badge>معطّل</Badge>}</td>
                  {can('employees.manage') && (
                    <td className="td">
                      <div className="flex gap-2">
                        <button className="link" onClick={() => startEdit(e)}>تعديل</button>
                        <button
                          className="link text-rose-600"
                          onClick={async () => {
                            try {
                              await api.delete(`/org/employees/${e._id}`);
                              push('تم تعطيل الموظف', 'success');
                              void reload();
                            } catch (err) {
                              push(readError(err).message, 'error');
                            }
                          }}
                        >
                          تعطيل
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'تعديل موظف' : 'موظف جديد'} wide>
        <form onSubmit={save} className="space-y-4" noValidate>
          {message && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[var(--text-sm)] font-medium text-rose-700">{message}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم الكامل" required><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <Field label="رقم الهاتف" required><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" /></Field>
            <Field label={editing ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'} hint="8 أحرف على الأقل وتحتوي رقمًا" required={!editing}>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="الدور">
              <Select
                value={form.role}
                onChange={(e) => {
                  const role = e.target.value as Employee['role'];
                  setForm({ ...form, role });
                  if (role !== 'custom') setPerms(rolePermissions[role] || []);
                }}
              >
                <option value="manager">مدير</option>
                <option value="accountant">محاسب</option>
                <option value="cashier">كاشير</option>
                <option value="custom">صلاحيات مخصصة</option>
              </Select>
            </Field>
          </div>

          {branches.data && branches.data.items.length > 0 && (
            <div>
              <p className="field-label">الفروع المسموح بها</p>
              <div className="flex flex-wrap gap-2">
                {branches.data.items.map((b) => (
                  <label key={b._id} className={`cursor-pointer rounded-xl border px-3 py-2 text-[var(--text-sm)] ${branchIds.includes(b._id) ? 'border-navy-800 bg-navy-50 font-bold' : 'border-navy-200'}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={branchIds.includes(b._id)}
                      onChange={(e) => setBranchIds((prev) => (e.target.checked ? [...prev, b._id] : prev.filter((id) => id !== b._id)))}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[var(--text-xs)] text-navy-400">اتركها فارغة للسماح بكل الفروع.</p>
            </div>
          )}

          <div>
            <p className="field-label">الصلاحيات</p>
            <Card className="max-h-64 overflow-y-auto">
              <div className="grid gap-2 sm:grid-cols-2">
                {available.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-[var(--text-sm)] text-navy-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-navy-300"
                      checked={perms.includes(p)}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, role: 'custom' }));
                        setPerms((prev) => (e.target.checked ? [...prev, p] : prev.filter((x) => x !== p)));
                      }}
                    />
                    {PERMISSION_LABEL[p] || p}
                  </label>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" className="flex-1" loading={saving}>حفظ</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
