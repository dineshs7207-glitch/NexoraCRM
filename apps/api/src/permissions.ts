import type { Permission, UserRole } from '@nexora/shared';

const rolePermissions: Record<UserRole, readonly Permission[]> = {
  owner: ['leads:read','leads:create','leads:update','leads:delete','leads:export','leads:import','leads:share','deals:read','deals:create','deals:update','deals:delete','tasks:read','tasks:create','tasks:update','tasks:delete','reports:view','users:manage','settings:manage'],
  admin: ['leads:read','leads:create','leads:update','leads:delete','leads:export','leads:import','leads:share','deals:read','deals:create','deals:update','deals:delete','tasks:read','tasks:create','tasks:update','tasks:delete','reports:view','users:manage','settings:manage'],
  manager: ['leads:read','leads:create','leads:update','leads:export','leads:import','leads:share','deals:read','deals:create','deals:update','tasks:read','tasks:create','tasks:update','tasks:delete','reports:view'],
  sales_rep: ['leads:read','leads:create','leads:update','leads:share','deals:read','deals:create','deals:update','tasks:read','tasks:create','tasks:update'],
  viewer: ['leads:read','deals:read','tasks:read'],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
