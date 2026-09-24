export function money(value: number | undefined | null, currency = 'د.ل'): string {
  const n = Number(value || 0);
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function num(value: number | undefined | null): string {
  return Number(value || 0).toLocaleString('en-US');
}

export function dateTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return `${d.toLocaleDateString('ar-LY-u-nu-latn')} ${d.toLocaleTimeString('ar-LY-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}`;
}

export function dateOnly(value?: string | Date | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-LY-u-nu-latn');
}

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending_payment: 'بانتظار الدفع',
  partial: 'مدفوع جزئيًا',
  proof_uploaded: 'تم رفع إثبات',
  under_review: 'قيد المراجعة',
  fully_paid: 'مدفوع كليًا',
  rejected: 'مرفوض',
  expired: 'منتهي',
  cancelled: 'ملغى',
};

export const REQUEST_STATUS_TONE: Record<string, string> = {
  pending_payment: 'bg-navy-100 text-navy-700',
  partial: 'bg-amber-100 text-amber-800',
  proof_uploaded: 'bg-brand-100 text-brand-800',
  under_review: 'bg-brand-100 text-brand-800',
  fully_paid: 'bg-teal-100 text-teal-800',
  rejected: 'bg-rose-100 text-rose-700',
  expired: 'bg-navy-100 text-navy-500',
  cancelled: 'bg-navy-100 text-navy-500',
};

export const DELIVERY_STATUS_LABEL: Record<string, string> = {
  new: 'جديد',
  preparing: 'قيد التحضير',
  with_courier: 'مع المندوب',
  delivered: 'تم التوصيل',
  rejected: 'رفض الاستلام',
  returned: 'مرتجع',
  cancelled: 'ملغى',
};

export const DELIVERY_STATUS_TONE: Record<string, string> = {
  new: 'bg-navy-100 text-navy-700',
  preparing: 'bg-amber-100 text-amber-800',
  with_courier: 'bg-brand-100 text-brand-800',
  delivered: 'bg-teal-100 text-teal-800',
  rejected: 'bg-rose-100 text-rose-700',
  returned: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-navy-100 text-navy-500',
};

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  store: 'متجر',
  company: 'شركة',
  freelancer: 'مستقل / حر',
  online_seller: 'بائع أونلاين',
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'تحويل بنكي',
  cash: 'نقدًا',
  wallet: 'محفظة إلكترونية',
};

export const PERMISSION_LABEL: Record<string, string> = {
  'payment_requests.view': 'عرض طلبات الدفع',
  'payment_requests.create': 'إنشاء طلبات دفع',
  'payment_requests.update': 'تعديل طلبات الدفع',
  'payment_requests.cancel': 'إلغاء طلبات الدفع',
  'payments.view': 'عرض الدفعات',
  'payments.confirm': 'تأكيد الدفعات',
  'proofs.review': 'مراجعة إثباتات الدفع',
  'customers.view': 'عرض العملاء',
  'customers.manage': 'إدارة العملاء',
  'payment_accounts.view': 'عرض الحسابات البنكية',
  'payment_accounts.manage': 'إدارة الحسابات البنكية',
  'invoices.view': 'عرض الفواتير',
  'invoices.manage': 'إدارة الفواتير',
  'products.manage': 'إدارة المنتجات',
  'branches.manage': 'إدارة الفروع',
  'employees.manage': 'إدارة الموظفين',
  'orders.view': 'عرض الطلبات',
  'orders.manage': 'إدارة الطلبات',
  'couriers.manage': 'إدارة المندوبين',
  'reports.view': 'عرض التقارير',
  'merchant.settings': 'إعدادات الحساب',
  'audit.view': 'سجل العمليات',
  'subscription.manage': 'إدارة الاشتراك',
};

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}
