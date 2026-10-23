type UserRole = 'admin' | 'manager' | 'employee' | 'viewer';
type Permission = 'leads:read'|'leads:create'|'leads:update'|'leads:delete'|'leads:export'|'leads:import'|'leads:share'|'deals:read'|'deals:create'|'deals:update'|'deals:delete'|'tasks:read'|'tasks:create'|'tasks:update'|'tasks:delete'|'reports:view'|'users:manage'|'settings:manage';

const rolePermissions: Record<UserRole, readonly Permission[]> = {
  admin: ['leads:read','leads:create','leads:update','leads:delete','leads:export','leads:import','leads:share','deals:read','deals:create','deals:update','deals:delete','tasks:read','tasks:create','tasks:update','tasks:delete','reports:view','users:manage','settings:manage'],
  manager: ['leads:read','leads:create','leads:update','leads:export','leads:import','leads:share','deals:read','deals:create','deals:update','tasks:read','tasks:create','tasks:update','tasks:delete','reports:view'],
  employee: ['leads:read','leads:create','leads:update','leads:share','deals:read','deals:create','deals:update','tasks:read','tasks:create','tasks:update'],
  viewer: ['leads:read','deals:read','tasks:read'],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
