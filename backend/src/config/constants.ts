export const ACCOUNT_TYPES = ['store', 'company', 'freelancer', 'online_seller'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const PAYMENT_REQUEST_STATUSES = [
  'pending_payment',
  'partial',
  'proof_uploaded',
  'under_review',
  'fully_paid',
  'rejected',
  'expired',
  'cancelled',
] as const;
export type PaymentRequestStatus = (typeof PAYMENT_REQUEST_STATUSES)[number];

export const DELIVERY_STATUSES = [
  'new',
  'preparing',
  'with_courier',
  'delivered',
  'rejected',
  'returned',
  'cancelled',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const INVOICE_STATUSES = ['unpaid', 'partial', 'paid'] as const;
export const PROOF_MATCH_RESULTS = ['matched', 'needs_review', 'not_matched'] as const;
export const PROOF_REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'] as const;
export const EMPLOYEE_ROLES = ['manager', 'accountant', 'cashier', 'custom'] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];
export const ADMIN_ROLES = ['super_admin', 'support', 'reviewer', 'custom_admin'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Granular permissions used by RBAC. */
export const PERMISSIONS = [
  'payment_requests.view',
  'payment_requests.create',
  'payment_requests.update',
  'payment_requests.cancel',
  'payments.view',
  'payments.confirm',
  'proofs.review',
  'customers.view',
  'customers.manage',
  'payment_accounts.view',
  'payment_accounts.manage',
  'invoices.view',
  'invoices.manage',
  'products.manage',
  'branches.manage',
  'employees.manage',
  'orders.view',
  'orders.manage',
  'couriers.manage',
  'reports.view',
  'merchant.settings',
  'audit.view',
  'subscription.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<EmployeeRole, Permission[]> = {
  manager: [...PERMISSIONS],
  accountant: [
    'payment_requests.view',
    'payments.view',
    'payments.confirm',
    'proofs.review',
    'customers.view',
    'invoices.view',
    'invoices.manage',
    'reports.view',
    'payment_accounts.view',
  ],
  cashier: [
    'payment_requests.view',
    'payment_requests.create',
    'customers.view',
    'customers.manage',
    'payment_accounts.view',
    'orders.view',
  ],
  custom: [],
};

/** Features available per account type — drives menus and API guards. */
export const ACCOUNT_TYPE_FEATURES: Record<AccountType, string[]> = {
  store: ['payment_requests', 'customers', 'payment_accounts', 'branches', 'employees', 'reports', 'notifications', 'products'],
  company: [
    'payment_requests',
    'customers',
    'payment_accounts',
    'branches',
    'employees',
    'reports',
    'notifications',
    'invoices',
    'products',
  ],
  freelancer: ['payment_requests', 'customers', 'payment_accounts', 'reports', 'notifications'],
  online_seller: [
    'payment_requests',
    'customers',
    'payment_accounts',
    'reports',
    'notifications',
    'orders',
    'couriers',
    'delivery',
    'products',
    'branches',
    'employees',
  ],
};

export const NOTIFICATION_TYPES = [
  'request_created',
  'link_opened',
  'proof_uploaded',
  'proof_matched',
  'proof_needs_review',
  'payment_confirmed',
  'partial_payment',
  'fully_paid',
  'request_expiring',
  'request_expired',
  'invoice_due_soon',
  'delivery_status_changed',
  'subscription_activated',
  'subscription_updated',
  'ticket_reply',
  'ticket_updated',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
