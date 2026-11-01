import { roleLabels, type Profile } from '@nexora/shared';
import { appUrl, supabase } from '../lib/supabase';
import { toast } from '../ui';
import { DB_VERSION } from './seed';
import type { Activity, Company, Currency, DB, Lead, Role, User } from './types';

/**
 * Supabase-backed workspace. Leads and their notes, the team and company settings live in the
 * database; the other areas (deals, invoices, tasks…) still live in this browser until they move too.
 */

const CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

function emptyDB(userId: string): DB {
  return {
    version: DB_VERSION,
    seededAt: new Date().toISOString(),
    currentUserId: userId,
    company: {
      name: 'Nexora',
      legalName: '',
      address: '',
      taxId: '',
      email: '',
      phone: '',
      baseCurrency: 'INR',
      timezone: 'Asia/Kolkata',
      invoicePrefix: 'INV-',
      quotePrefix: 'QT-',
      nextInvoiceNo: 1,
      nextQuoteNo: 1,
      paymentTerms: '',
      bankDetails: '',
      rates: { INR: 1, USD: 1, EUR: 1, GBP: 1, AED: 1, SGD: 1 },
      notify: { newLead: true, dealWon: true, invoiceOverdue: true, messages: true, weeklyReport: true },
    },
    users: [],
    accounts: [],
    contacts: [],
    leads: [],
    deals: [],
    products: [],
    docs: [],
    activities: [],
    tasks: [],
    projects: [],
    threads: [],
    automations: [],
    notifications: [],
    audit: [],
  };
}

/* ---------- Row mapping ---------- */
interface LeadRow {
  id: string;
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  city: string;
  source: Lead['source'];
  status: Lead['status'];
  score: number;
  est_value: number;
  currency: Currency;
  owner_id: string;
  tags: string[];
  created_at: string;
  last_activity_at: string;
}
interface ActivityRow {
  id: string;
  type: Activity['type'];
  title: string;
  body: string | null;
  occurred_at: string;
  user_id: string;
  lead_id: string | null;
}

const toLead = (r: LeadRow): Lead => ({
  id: r.id,
  name: r.name,
  company: r.company,
  title: r.title,
  email: r.email,
  phone: r.phone,
  city: r.city,
  source: r.source,
  status: r.status,
  score: r.score,
  ownerId: r.owner_id,
  estValue: Number(r.est_value),
  currency: r.currency,
  tags: r.tags,
  createdAt: r.created_at,
  lastActivityAt: r.last_activity_at,
});
const fromLead = (l: Lead): LeadRow => ({
  id: l.id,
  name: l.name,
  company: l.company,
  title: l.title,
  email: l.email,
  phone: l.phone,
  city: l.city,
  source: l.source,
  status: l.status,
  score: l.score,
  est_value: l.estValue,
  currency: l.currency,
  owner_id: l.ownerId,
  tags: l.tags,
  created_at: l.createdAt,
  last_activity_at: l.lastActivityAt,
});

const leadOf = (a: Activity) => a.related.find((r) => r.kind === 'lead')?.id ?? null;
const toActivity = (r: ActivityRow): Activity => ({
  id: r.id,
  type: r.type,
  title: r.title,
  body: r.body ?? undefined,
  at: r.occurred_at,
  userId: r.user_id,
  related: r.lead_id ? [{ kind: 'lead', id: r.lead_id }] : [],
});
const fromActivity = (a: Activity): ActivityRow => ({
  id: a.id,
  type: a.type,
  title: a.title,
  body: a.body ?? null,
  occurred_at: a.at,
  user_id: a.userId,
  lead_id: leadOf(a),
});

const toUser = (p: Profile & { quota: number; avatar_hue: number }): User => ({
  id: p.id,
  name: p.full_name,
  email: p.work_email,
  role: roleLabels[p.role] as Role,
  team: p.team ?? 'Unassigned',
  status: p.active ? 'Active' : 'Deactivated',
  quota: Number(p.quota),
  hue: p.avatar_hue,
});

/** Reads every row of a table, 1000 at a time (the API's page limit). */
async function all<T>(table: string, columns: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase!.from(table).select(columns).order('id').range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

const cacheKey = (userId: string) => `nexora:db:remote:${userId}`;

/** Builds the signed-in workspace: database records, plus browser-only areas kept from the last visit. */
export async function loadRemote(userId: string): Promise<{ db: DB; key: string }> {
  const key = cacheKey(userId);
  let base = emptyDB(userId);
  try {
    const cached = JSON.parse(localStorage.getItem(key) ?? 'null') as DB | null;
    if (cached?.version === DB_VERSION) base = cached;
  } catch {
    /* no cache */
  }

  const [profiles, leads, notes, settings, rates] = await Promise.all([
    all<Profile & { quota: number; avatar_hue: number }>('profiles', 'id, full_name, work_email, role, team, manager_id, scope, active, quota, avatar_hue'),
    all<LeadRow>('leads', 'id, name, company, title, email, phone, city, source, status, score, est_value, currency, owner_id, tags, created_at, last_activity_at'),
    all<ActivityRow>('activities', 'id, type, title, body, occurred_at, user_id, lead_id', (q) => q.not('lead_id', 'is', null)),
    supabase!.from('company_settings').select('*').maybeSingle(),
    supabase!.from('currency_rates').select('currency, rate_to_base'),
  ]);

  const company: Company = { ...base.company };
  const s = settings.data;
  if (s) {
    Object.assign(company, {
      name: s.name,
      legalName: s.legal_name,
      address: s.address,
      taxId: s.tax_id,
      email: s.email,
      phone: s.phone,
      baseCurrency: s.base_currency,
      timezone: s.timezone,
      invoicePrefix: s.invoice_prefix,
      quotePrefix: s.quote_prefix,
      nextInvoiceNo: s.next_invoice_no,
      nextQuoteNo: s.next_quote_no,
      paymentTerms: s.payment_terms,
      bankDetails: s.bank_details,
    });
  }
  for (const r of rates.data ?? []) if (CURRENCIES.includes(r.currency)) company.rates[r.currency as Currency] = Number(r.rate_to_base);

  const db: DB = {
    ...base,
    currentUserId: userId,
    company,
    users: profiles.map(toUser),
    leads: leads.map(toLead).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    // Lead notes come from the database; other activity stays as cached in this browser.
    activities: [...notes.map(toActivity), ...base.activities.filter((a) => !leadOf(a))].sort((a, b) => b.at.localeCompare(a.at)),
  };
  return { db, key };
}

/* ---------- Invites ---------- */
/** Invites a teammate through the invite-user edge function. `link` is set when no email went out and the admin must share it. */
export async function sendInvite(email: string, role: Role, team: string): Promise<{ link: string | null }> {
  const value = (Object.keys(roleLabels) as (keyof typeof roleLabels)[]).find((r) => roleLabels[r] === role);
  const { data, error } = await supabase!.functions.invoke('invite-user', { body: { email, role: value, team, redirectTo: appUrl() } });
  if (error) {
    const body = await (error.context as Response | undefined)?.json?.().catch(() => null);
    throw new Error(body?.error ?? body?.message ?? error.message);
  }
  return data;
}

/* ---------- Saving changes ---------- */
function diff<T extends { id: string }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((x) => [x.id, JSON.stringify(x)]));
  const ids = new Set(next.map((x) => x.id));
  return {
    changed: next.filter((x) => before.get(x.id) !== JSON.stringify(x)),
    removed: prev.filter((x) => !ids.has(x.id)).map((x) => x.id),
  };
}

let failing = false;
function report(error: { message: string } | null) {
  if (!error) return;
  console.error('Supabase sync failed:', error.message);
  if (!failing) toast(`Couldn't save to the database: ${error.message}`);
  failing = true;
  setTimeout(() => (failing = false), 5000);
}

let author = '';
/** The signed-in user; only their own notes are saved ("View as" previews stay in this browser). */
export function setAuthor(id: string) {
  author = id;
}

let queue = Promise.resolve();

/** Sends the leads and lead notes a commit changed to Supabase, in order. Row level security decides what's allowed. */
export function syncCommit(prev: DB, next: DB) {
  if (!supabase) return;
  const leads = diff(prev.leads, next.leads);
  const known = new Set(next.leads.map((l) => l.id));
  const leadNotes = (xs: Activity[]) => xs.filter((a) => known.has(leadOf(a) ?? ''));
  const notes = diff(leadNotes(prev.activities), leadNotes(next.activities));
  const mine = notes.changed.filter((a) => a.userId === author);
  if (!leads.changed.length && !leads.removed.length && !mine.length && !notes.removed.length) return;

  const db = supabase;
  // Leads first, so a new note never arrives before its lead. Deleting a lead also deletes its notes.
  queue = queue.then(async () => {
    if (leads.changed.length) report((await db.from('leads').upsert(leads.changed.map(fromLead))).error);
    if (leads.removed.length) report((await db.from('leads').delete().in('id', leads.removed)).error);
    if (mine.length) report((await db.from('activities').upsert(mine.map(fromActivity))).error);
    if (notes.removed.length) report((await db.from('activities').delete().in('id', notes.removed)).error);
  });
}
