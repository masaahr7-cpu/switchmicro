// Bootstrap admin emails — always treated as admins and cannot be demoted.
export const ADMIN_EMAILS = ['ceo@switch.co.tz', 'md@switch.co.tz', 'admin@switch.co.tz', 'masaa24@gmail.com'];
const LEGACY_ADMIN_EMAILS = ['ceo@switchmicrofinance.co.tz', 'md@switchmicrofinance.co.tz'];

export type DisplayRole = 'ADMIN' | 'STAFF';

export function getRole(email: string | undefined): DisplayRole {
  if (!email) return 'STAFF';
  const normalizedEmail = email.trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalizedEmail) ? 'ADMIN' : 'STAFF';
}

export type StaffRole = 'admin' | 'manager' | 'officer' | 'teller';

// Every capability the workspace can gate. Keep in sync with the DB CHECK list.
export const PERMISSION_CATALOG = [
  { key: 'view_applications', label: 'View loan applications', group: 'Loans' },
  { key: 'manage_applications', label: 'Create / edit applications', group: 'Loans' },
  { key: 'approve_loans', label: 'Approve loans', group: 'Loans' },
  { key: 'disburse_loans', label: 'Disburse loans', group: 'Loans' },
  { key: 'record_payments', label: 'Record repayments', group: 'Loans' },
  { key: 'reverse_payments', label: 'Reverse payments', group: 'Loans' },
  { key: 'manage_customers', label: 'Manage customers', group: 'Customers' },
  { key: 'manage_products', label: 'Manage loan products', group: 'Catalogue' },
  { key: 'manage_branches', label: 'Manage branches', group: 'Catalogue' },
  { key: 'view_reports', label: 'View reports', group: 'Insights' },
  { key: 'view_audit_log', label: 'View audit log', group: 'Insights' },
  { key: 'recovery_center', label: 'Recovery center', group: 'Insights' },
  { key: 'manage_staff', label: 'Manage staff & permissions', group: 'Administration' },
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]['key'];

export function getStaffRole(email: string | undefined): StaffRole | null {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.endsWith('@switchmicrofinance.co.tz')) return null;
  return [...ADMIN_EMAILS, ...LEGACY_ADMIN_EMAILS].includes(normalizedEmail) ? 'admin' : 'officer';
}

export function isAdminRole(role: StaffRole | null): boolean {
  return role === 'admin';
}
