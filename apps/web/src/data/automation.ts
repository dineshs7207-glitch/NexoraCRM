import { money, shortDate } from '../lib/format';
import { docTotals } from './seed';
import { commit, getDB, newId, setEventHandler } from './store';
import type { Automation, Condition, DB, DomainEvent, RecordRef, RefKind, Run, StepType, TriggerType } from './types';

export const TRIGGERS: Record<TriggerType, { label: string; kind: RefKind; hint: string }> = {
  'lead.created': { label: 'Lead is created', kind: 'lead', hint: 'Any new lead, from a form, import or by hand' },
  'deal.created': { label: 'Deal is created', kind: 'deal', hint: 'A new deal is added to the pipeline' },
  'deal.stage_changed': { label: 'Deal moves to a stage', kind: 'deal', hint: 'Runs when a deal enters the chosen stage' },
  'deal.won': { label: 'Deal is won', kind: 'deal', hint: 'A deal is marked Won' },
  'deal.lost': { label: 'Deal is lost', kind: 'deal', hint: 'A deal is marked Lost' },
  'invoice.overdue': { label: 'Invoice becomes overdue', kind: 'doc', hint: 'A sent invoice passes its due date unpaid' },
  'invoice.paid': { label: 'Invoice is paid', kind: 'doc', hint: 'Full payment is recorded' },
  'task.overdue': { label: 'Task is overdue', kind: 'task', hint: 'An open task passes its due date' },
};

export const STEPS: Record<StepType, { label: string; hint: string }> = {
  wait: { label: 'Wait', hint: 'Pause before the next step' },
  condition: { label: 'Condition', hint: 'Only continue when this is true' },
  email: { label: 'Send email', hint: 'Email the linked contact from the owner' },
  task: { label: 'Create task', hint: 'Assign a to-do to a teammate' },
  tag: { label: 'Add tag', hint: 'Tag the lead or account' },
  notify: { label: 'Notify team', hint: 'In-app notification' },
  update: { label: 'Update field', hint: 'Change a field on the record' },
};

/** Fields a Condition or Update step may read or write, per record kind. */
export const FIELDS: Record<RefKind, { key: string; label: string }[]> = {
  lead: [
    { key: 'status', label: 'Status' },
    { key: 'source', label: 'Source' },
    { key: 'score', label: 'Score' },
    { key: 'estValue', label: 'Estimated value' },
  ],
  deal: [
    { key: 'stage', label: 'Stage' },
    { key: 'amount', label: 'Amount' },
    { key: 'source', label: 'Source' },
    { key: 'nextStep', label: 'Next step' },
  ],
  doc: [
    { key: 'status', label: 'Status' },
    { key: 'currency', label: 'Currency' },
  ],
  task: [
    { key: 'column', label: 'Column' },
    { key: 'priority', label: 'Priority' },
  ],
};

interface Ctx {
  entity: Record<string, unknown>;
  label: string;
  ownerId: string;
  contactId?: string;
  accountId?: string;
  vars: Record<string, string>;
}

function resolve(d: DB, ref: RecordRef): Ctx | null {
  const userName = (id?: string) => d.users.find((u) => u.id === id)?.name ?? '';
  if (ref.kind === 'lead') {
    const l = d.leads.find((x) => x.id === ref.id);
    if (!l) return null;
    return {
      entity: l as never,
      label: `${l.name}, ${l.company}`,
      ownerId: l.ownerId,
      vars: { name: l.name, company: l.company, contact: l.name.split(' ')[0]!, owner: userName(l.ownerId), amount: money(l.estValue, l.currency) },
    };
  }
  if (ref.kind === 'deal') {
    const x = d.deals.find((y) => y.id === ref.id);
    if (!x) return null;
    const acc = d.accounts.find((a) => a.id === x.accountId);
    const c = d.contacts.find((y) => y.id === x.contactId);
    return {
      entity: x as never,
      label: x.title,
      ownerId: x.ownerId,
      contactId: x.contactId,
      accountId: x.accountId,
      vars: { deal: x.title, account: acc?.name ?? '', company: acc?.name ?? '', contact: c?.name.split(' ')[0] ?? 'there', name: c?.name ?? '', owner: userName(x.ownerId), amount: money(x.amount, x.currency) },
    };
  }
  if (ref.kind === 'doc') {
    const x = d.docs.find((y) => y.id === ref.id);
    if (!x) return null;
    const acc = d.accounts.find((a) => a.id === x.accountId);
    const c = d.contacts.find((y) => y.id === x.contactId);
    const ownerId = acc?.ownerId ?? x.createdBy;
    return {
      entity: x as never,
      label: `${x.number}, ${acc?.name ?? ''}`,
      ownerId,
      contactId: x.contactId,
      accountId: x.accountId,
      vars: { number: x.number, account: acc?.name ?? '', company: acc?.name ?? '', contact: c?.name.split(' ')[0] ?? 'there', name: c?.name ?? '', owner: userName(ownerId), amount: money(docTotals(x).balance, x.currency), due: shortDate(x.dueDate) },
    };
  }
  const t = d.tasks.find((y) => y.id === ref.id);
  if (!t) return null;
  return { entity: t as never, label: t.title, ownerId: t.assigneeId, vars: { task: t.title, owner: userName(t.assigneeId), name: t.title } };
}

export function fill(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}

export function evalCondition(entity: Record<string, unknown>, c: Condition) {
  const raw = entity[c.field];
  const a = String(raw ?? '').toLowerCase();
  const b = c.value.toLowerCase();
  switch (c.op) {
    case 'eq':
      return a === b;
    case 'neq':
      return a !== b;
    case 'gt':
      return Number(raw) > Number(c.value);
    case 'lt':
      return Number(raw) < Number(c.value);
    case 'contains':
      return a.includes(b);
  }
}

export const OPS: Record<Condition['op'], string> = { eq: 'is', neq: 'is not', gt: 'is greater than', lt: 'is less than', contains: 'contains' };

function execute(d: DB, a: Automation, run: Run, start: number, test: boolean) {
  const ctx = run.ref ? resolve(d, run.ref) : null;
  if (!ctx) {
    run.status = 'Failed';
    run.log.push('✕ The record no longer exists');
    return;
  }
  const now = Date.now();
  for (let i = start; i < a.steps.length; i++) {
    const step = a.steps[i]!;
    const cfg = step.config;
    switch (step.type) {
      case 'wait': {
        const ms = ((cfg.days ?? 0) * 24 + (cfg.hours ?? 0)) * 3_600_000;
        if (test) {
          run.log.push(`⏸ Would wait ${cfg.days ?? 0}d ${cfg.hours ?? 0}h`);
          break;
        }
        run.status = 'Waiting';
        run.next = i + 1;
        run.resumeAt = new Date(now + ms).toISOString();
        run.log.push(`⏸ Waiting until ${new Date(now + ms).toLocaleString('en-GB')}`);
        return;
      }
      case 'condition': {
        const c = cfg.condition;
        if (!c) break;
        const ok = evalCondition(ctx.entity, c);
        run.log.push(`${ok ? '✓' : '✕'} ${c.field} ${OPS[c.op]} "${c.value}"`);
        if (!ok) {
          run.status = test ? 'Passed (test)' : 'Stopped';
          run.log.push('Condition not met, the run ended here');
          return;
        }
        break;
      }
      case 'email': {
        const subject = fill(cfg.subject ?? '', ctx.vars);
        const body = fill(cfg.body ?? '', ctx.vars);
        const contact = d.contacts.find((c) => c.id === ctx.contactId);
        if (test) {
          run.log.push(`✉ Would email ${contact?.name ?? ctx.vars.name ?? 'the record'}: "${subject}"`);
          break;
        }
        if (contact) {
          let thread = d.threads.find((t) => t.contactId === contact.id && t.channel === 'email' && t.subject === subject);
          if (!thread) {
            thread = { id: newId('th'), contactId: contact.id, dealId: run.ref?.kind === 'deal' ? run.ref.id : undefined, channel: 'email', subject, messages: [], unread: false, starred: false, done: false, assigneeId: ctx.ownerId };
            d.threads.unshift(thread);
          }
          thread.messages.push({ id: newId('m'), from: ctx.ownerId, body, at: new Date().toISOString() });
        }
        d.activities.unshift({
          id: newId('act'),
          type: 'email',
          title: `Automated email: ${subject}`,
          body,
          at: new Date().toISOString(),
          userId: ctx.ownerId,
          related: relatedFor(run.ref!, ctx),
        });
        run.log.push(`✉ Emailed ${contact?.name ?? ctx.vars.name}: "${subject}"`);
        break;
      }
      case 'task': {
        const title = fill(cfg.title ?? step.name, ctx.vars);
        const assignee = !cfg.assignee || cfg.assignee === 'owner' ? ctx.ownerId : cfg.assignee;
        if (test) {
          run.log.push(`☑ Would create task "${title}"`);
          break;
        }
        const related = run.ref && run.ref.kind !== 'doc' && run.ref.kind !== 'task' ? { kind: run.ref.kind, id: run.ref.id } : ctx.accountId ? { kind: 'account' as const, id: ctx.accountId } : undefined;
        d.tasks.unshift({
          id: newId('t'),
          title,
          detail: `Created by the "${a.name}" automation.`,
          column: 'To do',
          priority: 'Medium',
          due: new Date(now + (cfg.dueDays ?? 1) * 86_400_000).toISOString(),
          assigneeId: assignee,
          tag: 'Automation',
          related,
          checklist: [],
          comments: [],
          createdAt: new Date().toISOString(),
        });
        run.log.push(`☑ Created task "${title}"`);
        break;
      }
      case 'tag': {
        const tag = cfg.tag ?? '';
        if (test) {
          run.log.push(`# Would add tag "${tag}"`);
          break;
        }
        const target = run.ref!.kind === 'lead' ? d.leads.find((l) => l.id === run.ref!.id) : d.accounts.find((x) => x.id === ctx.accountId);
        if (target && tag && !target.tags.includes(tag)) target.tags.push(tag);
        run.log.push(`# Added tag "${tag}"`);
        break;
      }
      case 'notify': {
        const message = fill(cfg.message ?? '', ctx.vars);
        if (test) {
          run.log.push(`🔔 Would notify: ${message}`);
          break;
        }
        d.notifications.unshift({ id: newId('n'), kind: 'automation', title: a.name, body: message, at: new Date().toISOString(), read: false, link: linkFor(run.ref!) });
        run.log.push(`🔔 Notified: ${message}`);
        break;
      }
      case 'update': {
        if (!cfg.field) break;
        if (test) {
          run.log.push(`✎ Would set ${cfg.field} to "${cfg.value}"`);
          break;
        }
        const current = ctx.entity[cfg.field];
        ctx.entity[cfg.field] = typeof current === 'number' ? Number(cfg.value) : cfg.value;
        run.log.push(`✎ Set ${cfg.field} to "${cfg.value}"`);
        break;
      }
    }
  }
  run.status = test ? 'Passed (test)' : 'Completed';
  delete run.next;
  delete run.resumeAt;
}

function relatedFor(ref: RecordRef, ctx: Ctx) {
  const out: { kind: 'lead' | 'deal' | 'account' | 'contact'; id: string }[] = [];
  if (ref.kind === 'lead' || ref.kind === 'deal') out.push({ kind: ref.kind, id: ref.id });
  if (ctx.accountId) out.push({ kind: 'account', id: ctx.accountId });
  if (ctx.contactId) out.push({ kind: 'contact', id: ctx.contactId });
  return out;
}

export function linkFor(ref: RecordRef) {
  if (ref.kind === 'lead') return `/leads/${ref.id}`;
  if (ref.kind === 'deal') return `/pipeline/${ref.id}`;
  if (ref.kind === 'doc') return `/finance/${ref.id}`;
  return `/tasks?open=${ref.id}`;
}

function matches(a: Automation, ev: DomainEvent) {
  if (!a.enabled || a.trigger.type !== ev.type) return false;
  if (ev.type === 'deal.stage_changed' && a.trigger.stage) {
    const deal = getDB().deals.find((x) => x.id === ev.ref.id);
    return deal?.stage === a.trigger.stage;
  }
  return true;
}

function handleEvents(events: DomainEvent[]) {
  const due = getDB().automations.filter((a) => events.some((ev) => matches(a, ev)));
  if (!due.length) return;
  commit((d) => {
    for (const ev of events) {
      for (const a of d.automations) {
        if (!matches(a, ev)) continue;
        if (a.reentry === 'once' && a.runs.some((r) => !r.test && r.ref?.id === ev.ref.id)) continue;
        const ctx = resolve(d, ev.ref);
        const run: Run = { id: newId('run'), label: ctx?.label ?? ev.ref.id, at: new Date().toISOString(), status: 'Completed', log: [`⚡ ${TRIGGERS[ev.type].label}`], ref: ev.ref };
        a.runs.unshift(run);
        execute(d, a, run, 0, false);
        a.runs.length = Math.min(a.runs.length, 200);
      }
    }
  });
}

/** Resumes runs whose Wait step has finished. */
export function resumeDue(force = false) {
  const now = Date.now();
  const has = getDB().automations.some((a) => a.runs.some((r) => r.status === 'Waiting' && r.resumeAt && (force || new Date(r.resumeAt).getTime() <= now)));
  if (!has) return 0;
  let count = 0;
  commit((d) => {
    for (const a of d.automations) {
      for (const r of a.runs) {
        if (r.status !== 'Waiting' || !r.resumeAt || r.next == null) continue;
        if (!force && new Date(r.resumeAt).getTime() > now) continue;
        r.status = 'Completed';
        r.log.push(force ? '⏩ Wait skipped (demo)' : '▶ Resumed');
        execute(d, a, r, r.next, false);
        count++;
      }
    }
  });
  return count;
}

/** Marks sent invoices past due as Overdue and raises the trigger. */
function scanOverdue() {
  const now = Date.now();
  const late = getDB().docs.filter((x) => x.kind === 'invoice' && x.status === 'Sent' && new Date(x.dueDate).getTime() < now);
  if (!late.length) return;
  const ids = new Set(late.map((x) => x.id));
  commit(
    (d) => {
      for (const x of d.docs) if (ids.has(x.id)) x.status = 'Overdue';
    },
    { events: late.map((x) => ({ type: 'invoice.overdue' as const, ref: { kind: 'doc' as const, id: x.id } })) },
  );
}

export function testRun(automationId: string) {
  const d = getDB();
  const a = d.automations.find((x) => x.id === automationId);
  if (!a) return null;
  const kind = TRIGGERS[a.trigger.type].kind;
  const sample =
    kind === 'lead' ? d.leads[0] : kind === 'deal' ? d.deals.find((x) => (a.trigger.stage ? x.stage === a.trigger.stage : true)) ?? d.deals[0] : kind === 'doc' ? d.docs.find((x) => x.kind === 'invoice') : d.tasks[0];
  if (!sample) return null;
  let result: Run | null = null;
  commit((draft) => {
    const auto = draft.automations.find((x) => x.id === automationId)!;
    const ref = { kind, id: sample.id };
    const run: Run = { id: newId('run'), label: `${resolve(draft, ref)?.label ?? ''} (test)`, at: new Date().toISOString(), status: 'Passed (test)', log: [`⚡ Test: ${TRIGGERS[auto.trigger.type].label}`], ref, test: true };
    auto.runs.unshift(run);
    execute(draft, auto, run, 0, true);
    result = run;
  });
  return result as Run | null;
}

export function startEngine() {
  setEventHandler(handleEvents);
  scanOverdue();
  resumeDue();
  const timer = window.setInterval(() => {
    scanOverdue();
    resumeDue();
  }, 30_000);
  return () => window.clearInterval(timer);
}
