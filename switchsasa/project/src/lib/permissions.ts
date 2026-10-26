import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isAdminRole, type StaffRole, type PermissionKey } from '@/config/roles';

export type StaffMember = {
  user_id: string;
  email: string;
  display_name: string;
  role: StaffRole;
  permissions: PermissionKey[];
};

type RawPermission = { permission_key: PermissionKey };

export function usePermissions(sessionUserId: string | undefined, role: StaffRole | null) {
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!sessionUserId) {
      setPermissions(new Set());
      setLoading(false);
      return;
    }
    if (isAdminRole(role)) {
      // Admins implicitly hold every permission.
      setPermissions(new Set(
        ([
          'view_applications', 'manage_applications', 'approve_loans', 'disburse_loans',
          'manage_customers', 'manage_products', 'manage_branches', 'view_reports',
          'manage_staff', 'view_audit_log', 'recovery_center', 'record_payments',
          'reverse_payments',
        ] as PermissionKey[])
      ));
      setLoading(false);
      return;
    }
    const rpcResult = await supabase.rpc('get_staff_permissions');
    const data = (rpcResult.data ?? []) as RawPermission[];
    if (rpcResult.error) {
      setPermissions(new Set());
    } else {
      setPermissions(new Set(data.map((row) => row.permission_key)));
    }
    setLoading(false);
  }, [sessionUserId, role]);

  useEffect(() => { void refresh(); }, [refresh]);

  const has = useCallback(
    (key: PermissionKey) => isAdminRole(role) || permissions.has(key),
    [role, permissions],
  );

  return { permissions, has, loading, refresh };
}

export async function loadStaffDirectory(): Promise<StaffMember[]> {
  const { data: profiles, error } = await supabase
    .from('staff_profiles')
    .select('user_id, email, display_name, role')
    .order('email');
  if (error || !profiles) return [];

  const permissionRows = await supabase
    .from('staff_permissions')
    .select('user_id, permission_key');

  const rows = (permissionRows.data ?? []) as { user_id: string; permission_key: PermissionKey }[];

  const byUser = new Map<string, PermissionKey[]>();
  rows.forEach((row) => {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row.permission_key);
    byUser.set(row.user_id, list);
  });

  return (profiles as StaffMember[]).map((profile) => ({
    ...profile,
    permissions: isAdminRole(profile.role as StaffRole)
      ? ([] as PermissionKey[])
      : (byUser.get(profile.user_id) ?? []),
  }));
}

export async function grantPermission(userId: string, key: PermissionKey) {
  return supabase.rpc('grant_staff_permission', { p_user_id: userId, p_key: key });
}

export async function revokePermission(userId: string, key: PermissionKey) {
  return supabase.rpc('revoke_staff_permission', { p_user_id: userId, p_key: key });
}

export async function setStaffRole(userId: string, newRole: StaffRole) {
  return supabase.rpc('set_staff_role', { p_user_id: userId, p_role: newRole });
}
