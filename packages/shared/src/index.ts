export const permissions = ['leads:read','leads:create','leads:update','leads:delete','leads:export','leads:import','leads:share','deals:read','deals:create','deals:update','deals:delete','tasks:read','tasks:create','tasks:update','tasks:delete','reports:view','users:manage','settings:manage'] as const;
export type Permission = typeof permissions[number];
export type UserRole = 'admin' | 'manager' | 'employee' | 'viewer';
export type DataScope = 'own' | 'team' | 'all';
