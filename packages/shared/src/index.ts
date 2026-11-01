export const permissions = ['leads:read','leads:create','leads:update','leads:delete','leads:export','leads:import','leads:share','deals:read','deals:create','deals:update','deals:delete','tasks:read','tasks:create','tasks:update','tasks:delete','reports:view','users:manage','settings:manage'] as const;
export type Permission = typeof permissions[number];
export const userRoles = ['owner', 'admin', 'manager', 'sales_rep', 'viewer'] as const;
export type UserRole = typeof userRoles[number];
export type DataScope = 'own' | 'team' | 'all';

/** Display names, matching the labels the web app shows. */
export const roleLabels: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  sales_rep: 'Sales rep',
  viewer: 'Viewer',
};

/** A row of public.profiles. */
export interface Profile {
  id: string;
  full_name: string;
  work_email: string;
  role: UserRole;
  team: string | null;
  manager_id: string | null;
  scope: DataScope;
  active: boolean;
}
