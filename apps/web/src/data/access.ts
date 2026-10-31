import { useMemo } from 'react';
import { useDB } from './store';
import type { DB, Role, User } from './types';

/**
 * Role permissions and record scope. This mirrors what the API will enforce in
 * Phase 3; in the browser it only shapes the UI and must never be the only check.
 */
export type Perm = 'edit' | 'delete' | 'export' | 'automations' | 'invoices' | 'team' | 'company';

const ALL: Perm[] = ['edit', 'delete', 'export', 'automations', 'invoices', 'team', 'company'];
const MATRIX: Record<Role, Perm[]> = {
  Owner: ALL,
  Admin: ALL,
  Manager: ['edit', 'delete', 'export', 'automations', 'invoices'],
  'Sales rep': ['edit', 'invoices'],
  Viewer: [],
};

export const ROLES: Role[] = ['Owner', 'Admin', 'Manager', 'Sales rep', 'Viewer'];

export const ROLE_SCOPE: Record<Role, string> = {
  Owner: 'All records',
  Admin: 'All records',
  Manager: 'Their team',
  'Sales rep': 'Only their own',
  Viewer: 'All records, read only',
};

export function can(role: Role, perm: Perm) {
  return MATRIX[role].includes(perm);
}

export function useCan() {
  const d = useDB();
  const me = d.users.find((u) => u.id === d.currentUserId)!;
  return (perm: Perm) => can(me.role, perm);
}

function visibleOwners(d: DB, me: User): Set<string> | null {
  if (me.role === 'Manager') return new Set(d.users.filter((u) => u.team === me.team || u.id === me.id).map((u) => u.id));
  if (me.role === 'Sales rep') return new Set([me.id]);
  return null; // everything
}

/** The database as the current user is allowed to see it. */
export function scopeDB(d: DB): DB {
  const me = d.users.find((u) => u.id === d.currentUserId)!;
  const owners = visibleOwners(d, me);
  if (!owners) return d;
  const deals = d.deals.filter((x) => owners.has(x.ownerId));
  const dealAccounts = new Set(deals.map((x) => x.accountId));
  const accounts = d.accounts.filter((a) => owners.has(a.ownerId) || dealAccounts.has(a.id));
  const accountIds = new Set(accounts.map((a) => a.id));
  return {
    ...d,
    leads: d.leads.filter((x) => owners.has(x.ownerId)),
    deals,
    accounts,
    contacts: d.contacts.filter((c) => accountIds.has(c.accountId)),
    docs: d.docs.filter((x) => accountIds.has(x.accountId)),
    tasks: d.tasks.filter((x) => owners.has(x.assigneeId)),
    projects: d.projects.filter((x) => owners.has(x.ownerId) || x.team.some((u) => owners.has(u))),
    threads: d.threads.filter((x) => owners.has(x.assigneeId)),
  };
}

export function useScoped() {
  const d = useDB();
  return useMemo(() => scopeDB(d), [d]);
}
