import { roleLabels, type Profile, type UserRole } from '@nexora/shared';
import { appUrl, supabase } from '../lib/supabase';
import { toast } from '../ui';
import { DB_VERSION } from './seed';
import type { Activity, Automation, Company, Currency, DB, Role, SalesDoc, Stage, Task, User } from './types';

/**
 * Supabase-backed workspace. Every CRM record lives in the database, so the whole team shares it
 * and row level security decides who sees what. Only notifications stay in this browser.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Optional fields are undefined in the app and null in the database. */
const opt = <T,>(v: T | null | undefined) => (v ?? undefined) as T | undefined;
const nil = <T,>(v: T | undefined) => v ?? null;
/** Date columns take the day part of an ISO timestamp. */
const day = (v: string | undefined) => (v ? v.slice(0, 10) : null);

/** Pipeline stage ids by name and back; filled when the workspace loads. */
let stageId: Partial<Record<Stage, string>> = {};
let stageName: Record<string, Stage> = {};

/* ---------- Users ---------- */
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
const roleValue = (role: Role) => (Object.keys(roleLabels) as UserRole[]).find((r) => roleLabels[r] === role)!;

/* ---------- Tables ---------- */

/**
 * How each table maps to the app's records. `rows` flattens the workspace into database rows;
 * `key` names a row for diffing (default: its id). Insert-only tables never update or delete rows,
 * and `mine` limits what is sent to rows the signed-in user wrote (the database insists on it).
 */
interface Table {
  name: string;
  rows: (d: DB) => Row[];
  key?: (r: Row) => string;
  insertOnly?: boolean;
  mine?: (r: Row) => boolean;
}

let author = '';

// Parents before children, so foreign keys always resolve; deletes run in reverse.
const TABLES: Table[] = [
  {
    name: 'accounts',
    rows: (d) =>
      d.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        industry: a.industry,
        city: a.city,
        country: a.country,
        website: a.website,
        phone: a.phone,
        currency: a.currency,
        owner_id: a.ownerId,
        tags: a.tags,
        notes: a.notes,
        created_at: a.createdAt,
      })),
  },
  {
    name: 'contacts',
    rows: (d) =>
      d.contacts.map((c) => ({
        id: c.id,
        account_id: c.accountId,
        name: c.name,
        title: c.title,
        email: c.email,
        phone: c.phone,
        city: c.city,
        birthday: day(c.birthday),
        owner_id: c.ownerId,
        tags: c.tags,
        created_at: c.createdAt,
      })),
  },
  {
    name: 'products',
    rows: (d) =>
      d.products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        price: p.price,
        cost: p.cost,
        currency: p.currency,
        unit: p.unit,
        tax_pct: p.taxPct,
        status: p.status,
      })),
  },
  {
    name: 'deals',
    rows: (d) =>
      d.deals.map((x) => ({
        id: x.id,
        title: x.title,
        account_id: x.accountId,
        contact_id: nil(x.contactId),
        amount: x.amount,
        currency: x.currency,
        stage_id: stageId[x.stage],
        owner_id: x.ownerId,
        close_date: day(x.closeDate),
        source: x.source,
        lost_reason: nil(x.lostReason),
        next_step: nil(x.nextStep),
        created_at: x.createdAt,
      })),
  },
  {
    name: 'deal_stage_history',
    rows: (d) => d.deals.flatMap((x) => x.history.map((h) => ({ deal_id: x.id, stage_id: stageId[h.stage], changed_by: h.by, changed_at: h.at }))),
    key: (r) => `${r.deal_id}:${r.changed_at}:${r.stage_id}`,
    insertOnly: true,
    mine: (r) => r.changed_by === author,
  },
  {
    name: 'leads',
    rows: (d) =>
      d.leads.map((l) => ({
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
        converted_deal_id: nil(l.convertedDealId),
        created_at: l.createdAt,
        last_activity_at: l.lastActivityAt,
      })),
  },
  {
    name: 'sales_docs',
    rows: (d) =>
      d.docs.map((x) => ({
        id: x.id,
        kind: x.kind,
        number: x.number,
        account_id: x.accountId,
        contact_id: nil(x.contactId),
        deal_id: nil(x.dealId),
        currency: x.currency,
        issue_date: day(x.issueDate),
        due_date: day(x.dueDate),
        status: x.status,
        notes: x.notes,
        terms: x.terms,
        created_by: x.createdBy,
        converted_from: nil(x.convertedFrom),
      })),
  },
  {
    name: 'sales_doc_lines',
    rows: (d) =>
      d.docs.flatMap((x) =>
        x.lines.map((l, i) => ({
          id: l.id,
          doc_id: x.id,
          position: i,
          product_id: nil(l.productId),
          description: l.description,
          qty: l.qty,
          unit_price: l.unitPrice,
          discount_pct: l.discountPct,
          tax_pct: l.taxPct,
        })),
      ),
  },
  {
    name: 'payments',
    rows: (d) => d.docs.flatMap((x) => x.payments.map((p) => ({ id: p.id, doc_id: x.id, amount: p.amount, paid_at: p.at, method: p.method }))),
  },
  {
    name: 'activities',
    rows: (d) =>
      d.activities.map((a) => {
        const ref = (kind: Activity['related'][number]['kind']) => a.related.find((r) => r.kind === kind)?.id ?? null;
        return {
          id: a.id,
          type: a.type,
          title: a.title,
          body: nil(a.body),
          occurred_at: a.at,
          user_id: a.userId,
          lead_id: ref('lead'),
          deal_id: ref('deal'),
          account_id: ref('account'),
          contact_id: ref('contact'),
        };
      }),
    mine: (r) => r.user_id === author,
  },
  {
    name: 'tasks',
    rows: (d) =>
      d.tasks.map((t) => {
        const ref = (kind: NonNullable<Task['related']>['kind']) => (t.related?.kind === kind ? t.related.id : null);
        return {
          id: t.id,
          title: t.title,
          kind: nil(t.kind),
          detail: t.detail,
          status: t.column,
          priority: t.priority,
          due_at: t.due || null,
          assignee_id: t.assigneeId,
          tag: t.tag,
          lead_id: ref('lead'),
          deal_id: ref('deal'),
          account_id: ref('account'),
          contact_id: ref('contact'),
          created_at: t.createdAt,
        };
      }),
  },
  {
    name: 'task_checklist_items',
    rows: (d) => d.tasks.flatMap((t) => t.checklist.map((c, i) => ({ id: c.id, task_id: t.id, position: i, text: c.text, done: c.done }))),
  },
  {
    name: 'task_comments',
    rows: (d) => d.tasks.flatMap((t) => t.comments.map((c) => ({ id: c.id, task_id: t.id, user_id: c.userId, body: c.text, created_at: c.at }))),
    mine: (r) => r.user_id === author,
  },
  {
    name: 'projects',
    rows: (d) =>
      d.projects.map((p) => ({
        id: p.id,
        name: p.name,
        account_id: p.accountId,
        contact_id: nil(p.contactId),
        deal_id: nil(p.dealId),
        owner_id: p.ownerId,
        status: p.status,
        due_date: day(p.due),
        created_at: p.createdAt,
      })),
  },
  {
    name: 'project_members',
    rows: (d) => d.projects.flatMap((p) => p.team.map((id) => ({ project_id: p.id, profile_id: id }))),
    key: (r) => `${r.project_id}:${r.profile_id}`,
  },
  {
    name: 'project_steps',
    rows: (d) => d.projects.flatMap((p) => p.steps.map((s, i) => ({ id: s.id, project_id: p.id, position: i, name: s.name, done: s.done }))),
  },
  {
    name: 'threads',
    rows: (d) =>
      d.threads.map((t) => ({
        id: t.id,
        contact_id: t.contactId,
        deal_id: nil(t.dealId),
        channel: t.channel,
        subject: t.subject,
        assignee_id: t.assigneeId,
        unread: t.unread,
        starred: t.starred,
        done: t.done,
      })),
  },
  {
    // Customer replies arrive through the server, so staff only ever send their own messages.
    name: 'messages',
    rows: (d) => d.threads.flatMap((t) => t.messages.map((m) => ({ id: m.id, thread_id: t.id, sender_id: m.from === 'contact' ? null : m.from, body: m.body, sent_at: m.at }))),
    insertOnly: true,
    mine: (r) => r.sender_id === author,
  },
  {
    name: 'automations',
    rows: (d) =>
      d.automations.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        enabled: a.enabled,
        trigger_type: a.trigger.type,
        trigger_stage_id: a.trigger.stage ? (stageId[a.trigger.stage] ?? null) : null,
        steps: a.steps,
        reentry: a.reentry,
        updated_by: a.updatedBy,
      })),
  },
  {
    name: 'automation_runs',
    rows: (d) =>
      d.automations.flatMap((a) =>
        a.runs.map((r) => ({
          id: r.id,
          automation_id: a.id,
          label: r.label,
          status: r.status,
          log: r.log,
          is_test: !!r.test,
          ref_kind: r.ref?.kind ?? null,
          ref_id: r.ref?.id ?? null,
          next_step: nil(r.next),
          resume_at: nil(r.resumeAt),
          created_at: r.at,
        })),
      ),
  },
  {
    name: 'audit_log',
    rows: (d) => d.audit.map((e) => ({ id: e.id, actor_id: e.userId, action: e.action, target: e.target, created_at: e.at })),
    insertOnly: true,
    mine: (r) => r.actor_id === author,
  },
];

/* ---------- Loading ---------- */

/** Reads every row of a table, 1000 at a time (the API's page limit). */
async function all(table: string, order = 'id'): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase!.from(table).select('*').order(order).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** Groups child rows under their parent id, keeping the given order. */
function byParent(rows: Row[], parent: string, sort?: (a: Row, b: Row) => number) {
  const map = new Map<string, Row[]>();
  for (const r of sort ? [...rows].sort(sort) : rows) {
    const list = map.get(r[parent]) ?? [];
    list.push(r);
    map.set(r[parent], list);
  }
  return (id: string) => map.get(id) ?? [];
}
const byPosition = (a: Row, b: Row) => a.position - b.position;
const byTime = (field: string) => (a: Row, b: Row) => String(a[field]).localeCompare(String(b[field]));
const newestFirst = (a: { at: string }, b: { at: string }) => b.at.localeCompare(a.at);

const cacheKey = (userId: string) => `nexora:db:remote:${userId}`;

/** Builds the signed-in workspace from the database, plus notifications kept from the last visit. */
export async function loadRemote(userId: string): Promise<{ db: DB; key: string }> {
  const key = cacheKey(userId);
  let base = emptyDB(userId);
  try {
    const cached = JSON.parse(localStorage.getItem(key) ?? 'null') as DB | null;
    if (cached?.version === DB_VERSION) base = cached;
  } catch {
    /* no cache */
  }

  const names = [
    'profiles', 'pipeline_stages', 'accounts', 'contacts', 'products', 'deals', 'deal_stage_history', 'leads',
    'sales_docs', 'sales_doc_lines', 'payments', 'activities', 'tasks', 'task_checklist_items', 'task_comments',
    'projects', 'project_steps', 'threads', 'messages', 'automations', 'automation_runs', 'audit_log',
  ] as const;
  const [loaded, members, settings, rates] = await Promise.all([
    Promise.all(names.map((n) => all(n))),
    all('project_members', 'project_id'),
    supabase!.from('company_settings').select('*').maybeSingle(),
    supabase!.from('currency_rates').select('currency, rate_to_base'),
  ]);
  const t = Object.fromEntries(names.map((n, i) => [n, loaded[i]!])) as Record<(typeof names)[number], Row[]>;

  stageId = Object.fromEntries(t.pipeline_stages.map((s) => [s.name, s.id]));
  stageName = Object.fromEntries(t.pipeline_stages.map((s) => [s.id, s.name]));

  const history = byParent(t.deal_stage_history, 'deal_id', byTime('changed_at'));
  const lines = byParent(t.sales_doc_lines, 'doc_id', byPosition);
  const payments = byParent(t.payments, 'doc_id', byTime('paid_at'));
  const checklist = byParent(t.task_checklist_items, 'task_id', byPosition);
  const comments = byParent(t.task_comments, 'task_id', byTime('created_at'));
  const team = byParent(members, 'project_id');
  const steps = byParent(t.project_steps, 'project_id', byPosition);
  const messages = byParent(t.messages, 'thread_id', byTime('sent_at'));
  const runs = byParent(t.automation_runs, 'automation_id', (a, b) => String(b.created_at).localeCompare(String(a.created_at)));

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
      notify: { ...company.notify, ...s.notify },
    });
  }
  for (const r of rates.data ?? []) if (CURRENCIES.includes(r.currency)) company.rates[r.currency as Currency] = Number(r.rate_to_base);

  const docs: SalesDoc[] = t.sales_docs.map((x) => ({
    id: x.id,
    kind: x.kind,
    number: x.number,
    accountId: x.account_id,
    contactId: opt(x.contact_id),
    dealId: opt(x.deal_id),
    currency: x.currency,
    issueDate: x.issue_date,
    dueDate: x.due_date,
    status: x.status,
    lines: lines(x.id).map((l) => ({
      id: l.id,
      productId: opt(l.product_id),
      description: l.description,
      qty: Number(l.qty),
      unitPrice: Number(l.unit_price),
      discountPct: Number(l.discount_pct),
      taxPct: Number(l.tax_pct),
    })),
    notes: x.notes,
    terms: x.terms,
    payments: payments(x.id).map((p) => ({ id: p.id, amount: Number(p.amount), at: p.paid_at, method: p.method })),
    createdBy: x.created_by,
    convertedFrom: opt(x.converted_from),
  }));
  // Someone else may have issued numbers since the counter was saved: never reuse one.
  const highest = (kind: SalesDoc['kind'], prefix: string) =>
    Math.max(0, ...docs.filter((x) => x.kind === kind && x.number.startsWith(prefix)).map((x) => Number(x.number.slice(prefix.length)) || 0));
  company.nextInvoiceNo = Math.max(company.nextInvoiceNo, highest('invoice', company.invoicePrefix) + 1);
  company.nextQuoteNo = Math.max(company.nextQuoteNo, highest('quote', company.quotePrefix) + 1);

  const related = (r: Row) =>
    (['lead', 'deal', 'account', 'contact'] as const).filter((k) => r[`${k}_id`]).map((k) => ({ kind: k, id: r[`${k}_id`] as string }));

  const db: DB = {
    ...base,
    currentUserId: userId,
    company,
    users: (t.profiles as (Profile & { quota: number; avatar_hue: number })[]).map(toUser),
    accounts: t.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      industry: a.industry,
      city: a.city,
      country: a.country,
      website: a.website,
      phone: a.phone,
      currency: a.currency,
      ownerId: a.owner_id,
      tags: a.tags,
      notes: a.notes,
      createdAt: a.created_at,
    })),
    contacts: t.contacts.map((c) => ({
      id: c.id,
      accountId: c.account_id,
      name: c.name,
      title: c.title,
      email: c.email,
      phone: c.phone,
      city: c.city,
      ownerId: c.owner_id,
      tags: c.tags,
      createdAt: c.created_at,
      birthday: opt(c.birthday),
    })),
    products: t.products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      price: Number(p.price),
      cost: Number(p.cost),
      currency: p.currency,
      unit: p.unit,
      taxPct: Number(p.tax_pct),
      status: p.status,
    })),
    deals: t.deals.map((x) => ({
      id: x.id,
      title: x.title,
      accountId: x.account_id,
      contactId: opt(x.contact_id),
      amount: Number(x.amount),
      currency: x.currency,
      stage: stageName[x.stage_id]!,
      ownerId: x.owner_id,
      closeDate: x.close_date ?? '',
      createdAt: x.created_at,
      source: x.source,
      history: history(x.id).map((h) => ({ stage: stageName[h.stage_id]!, at: h.changed_at, by: h.changed_by })),
      lostReason: opt(x.lost_reason),
      nextStep: opt(x.next_step),
    })),
    leads: t.leads
      .map((l) => ({
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
        ownerId: l.owner_id,
        estValue: Number(l.est_value),
        currency: l.currency,
        tags: l.tags,
        createdAt: l.created_at,
        lastActivityAt: l.last_activity_at,
        convertedDealId: opt(l.converted_deal_id),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    docs,
    activities: t.activities
      .map((a) => ({ id: a.id, type: a.type, title: a.title, body: opt(a.body), at: a.occurred_at, userId: a.user_id, related: related(a) }))
      .sort(newestFirst),
    tasks: t.tasks.map((x) => ({
      id: x.id,
      title: x.title,
      kind: opt(x.kind),
      detail: x.detail,
      column: x.status,
      priority: x.priority,
      due: x.due_at ?? '',
      assigneeId: x.assignee_id,
      tag: x.tag,
      related: related(x)[0],
      checklist: checklist(x.id).map((c) => ({ id: c.id, text: c.text, done: c.done })),
      comments: comments(x.id).map((c) => ({ id: c.id, userId: c.user_id, text: c.body, at: c.created_at })),
      createdAt: x.created_at,
    })),
    projects: t.projects.map((p) => ({
      id: p.id,
      name: p.name,
      accountId: p.account_id,
      contactId: opt(p.contact_id),
      dealId: opt(p.deal_id),
      ownerId: p.owner_id,
      team: team(p.id).map((m) => m.profile_id),
      status: p.status,
      steps: steps(p.id).map((x) => ({ id: x.id, name: x.name, done: x.done })),
      due: p.due_date ?? '',
      createdAt: p.created_at,
    })),
    threads: t.threads.map((x) => ({
      id: x.id,
      contactId: x.contact_id,
      dealId: opt(x.deal_id),
      channel: x.channel,
      subject: x.subject,
      messages: messages(x.id).map((m) => ({ id: m.id, from: m.sender_id ?? 'contact', body: m.body, at: m.sent_at })),
      unread: x.unread,
      starred: x.starred,
      done: x.done,
      assigneeId: x.assignee_id,
    })),
    automations: t.automations.map(
      (a): Automation => ({
        id: a.id,
        name: a.name,
        description: a.description,
        enabled: a.enabled,
        trigger: { type: a.trigger_type, stage: a.trigger_stage_id ? stageName[a.trigger_stage_id] : undefined },
        steps: a.steps,
        runs: runs(a.id).map((r) => ({
          id: r.id,
          label: r.label,
          at: r.created_at,
          status: r.status,
          log: r.log,
          test: r.is_test || undefined,
          ref: r.ref_kind ? { kind: r.ref_kind, id: r.ref_id } : undefined,
          next: opt(r.next_step),
          resumeAt: opt(r.resume_at),
        })),
        reentry: a.reentry,
        updatedAt: a.updated_at,
        updatedBy: a.updated_by,
      }),
    ),
    audit: t.audit_log.map((e) => ({ id: e.id, at: e.created_at, userId: e.actor_id, action: e.action, target: e.target })).sort(newestFirst),
  };
  return { db: uploadBrowserOnly(db, base, userId), key };
}

/** Areas that used to live only in this browser, before they moved to the database. */
const MOVED = ['accounts', 'contacts', 'products', 'deals', 'docs', 'activities', 'tasks', 'projects', 'threads', 'automations', 'audit'] as const;

/** Once per account: sends records this browser kept on its own to the database, so nothing is lost in the move. */
function uploadBrowserOnly(db: DB, cached: DB, userId: string) {
  const flag = `nexora:uploaded:${userId}`;
  try {
    if (localStorage.getItem(flag)) return db;
    localStorage.setItem(flag, new Date().toISOString());
  } catch {
    return db;
  }
  const merged = structuredClone(db);
  for (const area of MOVED) {
    const have = new Set((db[area] as { id: string }[]).map((x) => x.id));
    (merged[area] as { id: string }[]).push(...(cached[area] as { id: string }[]).filter((x) => !have.has(x.id)));
  }
  author = userId;
  syncCommit(db, merged);
  return merged;
}

/* ---------- Invites ---------- */
/** Invites a teammate through the invite-user edge function. `link` is set when no email went out and the admin must share it. */
export async function sendInvite(email: string, role: Role, team: string): Promise<{ link: string | null }> {
  const { data, error } = await supabase!.functions.invoke('invite-user', { body: { email, role: roleValue(role), team, redirectTo: appUrl() } });
  if (error) {
    const body = await (error.context as Response | undefined)?.json?.().catch(() => null);
    throw new Error(body?.error ?? body?.message ?? error.message);
  }
  return data;
}

/* ---------- Saving changes ---------- */
function diff(table: Table, prev: DB, next: DB) {
  const key = table.key ?? ((r: Row) => r.id as string);
  const before = new Map(table.rows(prev).map((r) => [key(r), JSON.stringify(r)]));
  const after = table.rows(next);
  const ids = new Set(after.map(key));
  const changed = after.filter((r) => (table.insertOnly ? !before.has(key(r)) : before.get(key(r)) !== JSON.stringify(r)));
  return {
    changed: table.mine ? changed.filter(table.mine) : changed,
    removed: table.insertOnly ? [] : table.rows(prev).filter((r) => !ids.has(key(r))),
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

/** The signed-in user; only what they wrote themselves is saved ("View as" previews stay in this browser). */
export function setAuthor(id: string) {
  author = id;
}

let queue = Promise.resolve();

/** Sends what a commit changed to Supabase, in order. Row level security decides what's allowed. */
export function syncCommit(prev: DB, next: DB) {
  if (!supabase) return;
  const db = supabase;
  const changes = TABLES.map((table) => ({ table, ...diff(table, prev, next) }));

  // Team edits by admins: only people who already have a profile (fresh invites are saved by the invite function).
  const known = new Map(prev.users.map((u) => [u.id, JSON.stringify(u)]));
  const people = next.users.filter((u) => known.has(u.id) && known.get(u.id) !== JSON.stringify(u) && u.status !== 'Invited');
  const me = next.users.find((u) => u.id === author);
  const admin = me?.role === 'Owner' || me?.role === 'Admin';
  const companyChanged = admin && JSON.stringify(prev.company) !== JSON.stringify(next.company);
  if (!people.length && !companyChanged && changes.every((c) => !c.changed.length && !c.removed.length)) return;

  queue = queue.then(async () => {
    for (const u of people)
      report((await db.from('profiles').update({ full_name: u.name, role: roleValue(u.role), team: u.team, quota: u.quota, active: u.status === 'Active' }).eq('id', u.id)).error);
    if (companyChanged) {
      const c = next.company;
      report(
        (
          await db
            .from('company_settings')
            .update({
              name: c.name,
              legal_name: c.legalName,
              address: c.address,
              tax_id: c.taxId,
              email: c.email,
              phone: c.phone,
              base_currency: c.baseCurrency,
              timezone: c.timezone,
              invoice_prefix: c.invoicePrefix,
              quote_prefix: c.quotePrefix,
              next_invoice_no: c.nextInvoiceNo,
              next_quote_no: c.nextQuoteNo,
              payment_terms: c.paymentTerms,
              bank_details: c.bankDetails,
              notify: c.notify,
            })
            .eq('id', true)
        ).error,
      );
      if (JSON.stringify(prev.company.rates) !== JSON.stringify(next.company.rates))
        report((await db.from('currency_rates').upsert(CURRENCIES.map((cur) => ({ currency: cur, rate_to_base: c.rates[cur] })))).error);
    }
    for (const { table, changed } of changes) {
      if (!changed.length) continue;
      // Keyed and insert-only tables only ever gain rows; the rest are created or updated.
      const q = db.from(table.name);
      report((await (table.insertOnly || table.key ? q.insert(changed) : q.upsert(changed))).error);
    }
    for (const { table, removed } of [...changes].reverse()) {
      if (!removed.length) continue;
      if (table.key) for (const r of removed) report((await db.from(table.name).delete().match(r)).error);
      else report((await db.from(table.name).delete().in('id', removed.map((r) => r.id))).error);
    }
  });
}
