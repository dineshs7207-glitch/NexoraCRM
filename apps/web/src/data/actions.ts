import { commit, getDB, newId } from './store';
import { docTotals } from './seed';
import { PROJECT_STEPS } from './projectSteps';
import type { Account, Activity, Automation, Company, Contact, Deal, DocLine, Lead, Product, Project, Role, SalesDoc, Stage, Step, Task, TaskColumn, User } from './types';

const now = () => new Date().toISOString();
const me = () => getDB().currentUserId;

/* ---------- Leads ---------- */
export function createLead(input: Omit<Lead, 'id' | 'createdAt' | 'lastActivityAt' | 'score' | 'status' | 'tags'> & Partial<Lead>) {
  const id = newId('l');
  commit(
    (d) => {
      d.leads.unshift({ score: 40, status: 'New', tags: [], ...input, id, createdAt: now(), lastActivityAt: now() });
      d.activities.unshift({ id: newId('act'), type: 'note', title: `Lead captured from ${input.source}`, at: now(), userId: me(), related: [{ kind: 'lead', id }] });
      if (d.company.notify.newLead) d.notifications.unshift({ id: newId('n'), kind: 'lead', title: 'New lead', body: `${input.name} from ${input.company}`, at: now(), read: false, link: `/leads/${id}` });
    },
    { audit: { action: 'Created lead', target: input.name }, events: [{ type: 'lead.created', ref: { kind: 'lead', id } }] },
  );
  return id;
}

export function updateLead(id: string, patch: Partial<Lead>, action = 'Updated lead') {
  commit(
    (d) => {
      const l = d.leads.find((x) => x.id === id);
      if (l) Object.assign(l, patch, { lastActivityAt: now() });
    },
    { audit: { action, target: getDB().leads.find((x) => x.id === id)?.name ?? id } },
  );
}

export function deleteLeads(ids: string[]) {
  const set = new Set(ids);
  commit((d) => void (d.leads = d.leads.filter((l) => !set.has(l.id))), { audit: { action: `Deleted ${ids.length} lead(s)`, target: 'Leads' } });
}

/** Converts a lead into an account, contact and deal, keeping the history linked. */
export function convertLead(id: string, deal: { title: string; amount: number }) {
  const lead = getDB().leads.find((x) => x.id === id);
  if (!lead) return null;
  const accountId = newId('a');
  const contactId = newId('c');
  const dealId = newId('d');
  commit(
    (d) => {
      let account = d.accounts.find((a) => a.name.toLowerCase() === lead.company.toLowerCase());
      if (!account) {
        account = { id: accountId, name: lead.company, industry: '', city: lead.city, country: 'India', website: '', phone: lead.phone, currency: lead.currency, ownerId: lead.ownerId, tags: [], notes: '', createdAt: now() };
        d.accounts.unshift(account);
      }
      d.contacts.unshift({ id: contactId, accountId: account.id, name: lead.name, title: lead.title, email: lead.email, phone: lead.phone, city: lead.city, ownerId: lead.ownerId, tags: [], createdAt: now() });
      d.deals.unshift({
        id: dealId,
        title: deal.title,
        accountId: account.id,
        contactId,
        amount: deal.amount,
        currency: lead.currency,
        stage: 'Qualified',
        ownerId: lead.ownerId,
        closeDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        createdAt: now(),
        source: lead.source,
        history: [
          { stage: 'New', at: lead.createdAt, by: lead.ownerId },
          { stage: 'Qualified', at: now(), by: me() },
        ],
      });
      const l = d.leads.find((x) => x.id === id)!;
      l.status = 'Converted';
      l.convertedDealId = dealId;
      d.activities.unshift({ id: newId('act'), type: 'note', title: 'Lead converted to deal', at: now(), userId: me(), related: [{ kind: 'lead', id }, { kind: 'deal', id: dealId }, { kind: 'account', id: account.id }, { kind: 'contact', id: contactId }] });
    },
    { audit: { action: 'Converted lead', target: lead.name }, events: [{ type: 'deal.created', ref: { kind: 'deal', id: dealId } }] },
  );
  return dealId;
}

/* ---------- Deals ---------- */
export function createDeal(input: Pick<Deal, 'title' | 'accountId' | 'amount' | 'currency' | 'ownerId' | 'closeDate' | 'source'> & Partial<Deal>) {
  const id = newId('d');
  const stage: Stage = input.stage ?? 'New';
  commit(
    (d) => {
      d.deals.unshift({ ...input, id, stage, createdAt: now(), history: [{ stage, at: now(), by: me() }] });
    },
    { audit: { action: 'Created deal', target: input.title }, events: [{ type: 'deal.created', ref: { kind: 'deal', id } }] },
  );
  return id;
}

export function updateDeal(id: string, patch: Partial<Deal>) {
  commit(
    (d) => {
      const x = d.deals.find((y) => y.id === id);
      if (x) Object.assign(x, patch);
    },
    { audit: { action: 'Updated deal', target: getDB().deals.find((x) => x.id === id)?.title ?? id } },
  );
}

export function moveDeal(id: string, stage: Stage, lostReason?: string) {
  const deal = getDB().deals.find((x) => x.id === id);
  if (!deal || deal.stage === stage) return;
  const events = [{ type: 'deal.stage_changed' as const, ref: { kind: 'deal' as const, id } }];
  if (stage === 'Won') events.push({ type: 'deal.won' as never, ref: { kind: 'deal', id } });
  if (stage === 'Lost') events.push({ type: 'deal.lost' as never, ref: { kind: 'deal', id } });
  commit(
    (d) => {
      const x = d.deals.find((y) => y.id === id)!;
      x.stage = stage;
      x.history.push({ stage, at: now(), by: me() });
      if (stage === 'Won' || stage === 'Lost') x.closeDate = now();
      if (lostReason) x.lostReason = lostReason;
      d.activities.unshift({ id: newId('act'), type: 'stage', title: `Stage changed to ${stage}`, at: now(), userId: me(), related: [{ kind: 'deal', id }, { kind: 'account', id: x.accountId }] });
      if (stage === 'Won' && d.company.notify.dealWon) d.notifications.unshift({ id: newId('n'), kind: 'deal', title: 'Deal won', body: x.title, at: now(), read: false, link: `/pipeline/${id}` });
      if (stage === 'Won' && !d.projects.some((p) => p.dealId === id)) {
        const acc = d.accounts.find((a) => a.id === x.accountId);
        d.projects.unshift(projectFor(x, acc?.name ?? x.title));
      }
    },
    { audit: { action: `Moved deal to ${stage}`, target: deal.title }, events },
  );
}

export function deleteDeal(id: string) {
  const deal = getDB().deals.find((x) => x.id === id);
  commit((d) => void (d.deals = d.deals.filter((x) => x.id !== id)), { audit: { action: 'Deleted deal', target: deal?.title ?? id } });
}

/* ---------- Accounts & contacts ---------- */
export function createAccount(input: Omit<Account, 'id' | 'createdAt' | 'tags' | 'notes'> & Partial<Account>) {
  const id = newId('a');
  commit((d) => void d.accounts.unshift({ tags: [], notes: '', ...input, id, createdAt: now() }), { audit: { action: 'Created account', target: input.name } });
  return id;
}

export function updateAccount(id: string, patch: Partial<Account>) {
  commit(
    (d) => {
      const a = d.accounts.find((x) => x.id === id);
      if (a) Object.assign(a, patch);
    },
    { audit: { action: 'Updated account', target: getDB().accounts.find((x) => x.id === id)?.name ?? id } },
  );
}

export function createContact(input: Omit<Contact, 'id' | 'createdAt' | 'tags'> & Partial<Contact>) {
  const id = newId('c');
  commit((d) => void d.contacts.unshift({ tags: [], ...input, id, createdAt: now() }), { audit: { action: 'Created contact', target: input.name } });
  return id;
}

export function updateContact(id: string, patch: Partial<Contact>) {
  commit((d) => {
    const c = d.contacts.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
  });
}

export function logActivity(input: Omit<Activity, 'id' | 'at' | 'userId'>) {
  commit((d) => {
    d.activities.unshift({ ...input, id: newId('act'), at: now(), userId: me() });
    for (const r of input.related) if (r.kind === 'lead') {
      const l = d.leads.find((x) => x.id === r.id);
      if (l) {
        l.lastActivityAt = now();
        if (l.status === 'New' && input.type !== 'note') l.status = 'Contacted';
      }
    }
  });
}

/* ---------- Products ---------- */
export function saveProduct(p: Omit<Product, 'id'> & { id?: string }) {
  const isNew = !p.id;
  const id = p.id ?? newId('p');
  commit(
    (d) => {
      const existing = d.products.find((x) => x.id === id);
      if (existing) Object.assign(existing, p);
      else d.products.unshift({ ...p, id });
    },
    { audit: { action: isNew ? 'Created product' : 'Updated product', target: p.name } },
  );
  return id;
}

/* ---------- Quotes & invoices ---------- */
export function blankLine(): DocLine {
  return { id: newId('ln'), description: '', qty: 1, unitPrice: 0, discountPct: 0, taxPct: 18 };
}

/** Allocates the next gap-free number for the document kind (the API will do this in a DB transaction). */
function nextNumber(d: { company: Company }, kind: SalesDoc['kind']) {
  const c = d.company;
  const year = new Date().getFullYear();
  if (kind === 'invoice') return `${c.invoicePrefix}-${year}-${String(c.nextInvoiceNo++).padStart(4, '0')}`;
  return `${c.quotePrefix}-${year}-${String(c.nextQuoteNo++).padStart(4, '0')}`;
}

export function saveDoc(doc: Omit<SalesDoc, 'id' | 'number' | 'createdBy' | 'payments'> & { id?: string }) {
  const id = doc.id ?? newId(doc.kind === 'invoice' ? 'inv' : 'q');
  let number = '';
  commit(
    (d) => {
      const existing = d.docs.find((x) => x.id === id);
      if (existing) {
        Object.assign(existing, doc);
        number = existing.number;
      } else {
        number = nextNumber(d, doc.kind);
        d.docs.unshift({ ...doc, id, number, createdBy: me(), payments: [] });
      }
    },
    { audit: { action: doc.id ? `Updated ${doc.kind}` : `Created ${doc.kind}`, target: doc.id ? getDB().docs.find((x) => x.id === doc.id)?.number ?? id : 'new' } },
  );
  return { id, number };
}

export function setDocStatus(id: string, status: SalesDoc['status']) {
  const doc = getDB().docs.find((x) => x.id === id);
  if (!doc) return;
  commit(
    (d) => {
      const x = d.docs.find((y) => y.id === id)!;
      x.status = status;
      d.activities.unshift({ id: newId('act'), type: 'invoice', title: `${x.kind === 'invoice' ? 'Invoice' : 'Quote'} ${x.number} marked ${status}`, at: now(), userId: me(), related: [{ kind: 'account', id: x.accountId }, ...(x.dealId ? [{ kind: 'deal' as const, id: x.dealId }] : [])] });
    },
    { audit: { action: `Marked ${status}`, target: doc.number }, events: status === 'Paid' ? [{ type: 'invoice.paid', ref: { kind: 'doc', id } }] : [] },
  );
}

export function recordPayment(id: string, amount: number, method: string) {
  const doc = getDB().docs.find((x) => x.id === id);
  if (!doc) return;
  const willBePaid = docTotals(doc).balance - amount <= 0.009;
  commit(
    (d) => {
      const x = d.docs.find((y) => y.id === id)!;
      x.payments.push({ id: newId('pay'), amount, at: now(), method });
      if (willBePaid) x.status = 'Paid';
      d.activities.unshift({ id: newId('act'), type: 'invoice', title: `Payment received on ${x.number}`, at: now(), userId: me(), related: [{ kind: 'account', id: x.accountId }] });
    },
    { audit: { action: 'Recorded payment', target: doc.number }, events: willBePaid ? [{ type: 'invoice.paid', ref: { kind: 'doc', id } }] : [] },
  );
}

export function convertQuote(id: string) {
  const q = getDB().docs.find((x) => x.id === id);
  if (!q) return null;
  const { id: invId } = saveDoc({
    kind: 'invoice',
    accountId: q.accountId,
    contactId: q.contactId,
    dealId: q.dealId,
    currency: q.currency,
    issueDate: now(),
    dueDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    status: 'Draft',
    lines: q.lines.map((l) => ({ ...l, id: newId('ln') })),
    notes: q.notes,
    terms: getDB().company.paymentTerms,
    convertedFrom: q.id,
  });
  commit((d) => {
    const x = d.docs.find((y) => y.id === id);
    if (x) x.status = 'Accepted';
  });
  return invId;
}

/* ---------- Tasks ---------- */
export function saveTask(t: Partial<Task> & Pick<Task, 'title'>) {
  const id = t.id ?? newId('t');
  commit(
    (d) => {
      const existing = d.tasks.find((x) => x.id === id);
      if (existing) Object.assign(existing, t);
      else d.tasks.unshift({ detail: '', column: 'To do', priority: 'Medium', due: new Date(Date.now() + 86_400_000).toISOString(), assigneeId: me(), tag: 'Follow-up', checklist: [], comments: [], createdAt: now(), ...t, id });
    },
    { audit: { action: t.id ? 'Updated task' : 'Created task', target: t.title } },
  );
  return id;
}

export function moveTask(id: string, column: TaskColumn) {
  commit((d) => {
    const t = d.tasks.find((x) => x.id === id);
    if (t) t.column = column;
  });
}

export function deleteTask(id: string) {
  const t = getDB().tasks.find((x) => x.id === id);
  commit((d) => void (d.tasks = d.tasks.filter((x) => x.id !== id)), { audit: { action: 'Deleted task', target: t?.title ?? id } });
}

/* ---------- Inbox ---------- */
export function sendMessage(threadId: string, body: string) {
  commit((d) => {
    const t = d.threads.find((x) => x.id === threadId);
    if (!t) return;
    t.messages.push({ id: newId('m'), from: me(), body, at: now() });
    t.done = false;
    const c = d.contacts.find((x) => x.id === t.contactId);
    d.activities.unshift({ id: newId('act'), type: 'email', title: `Replied: ${t.subject}`, body, at: now(), userId: me(), related: [...(t.dealId ? [{ kind: 'deal' as const, id: t.dealId }] : []), ...(c ? [{ kind: 'contact' as const, id: c.id }, { kind: 'account' as const, id: c.accountId }] : [])] });
  });
}

export function patchThread(threadId: string, patch: Partial<{ unread: boolean; starred: boolean; done: boolean; assigneeId: string }>) {
  commit((d) => {
    const t = d.threads.find((x) => x.id === threadId);
    if (t) Object.assign(t, patch);
  });
}

/** Demo only: a simulated customer reply so the inbox feels alive before real email sync (Phase 6). */
export function simulateReply(threadId: string) {
  commit((d) => {
    const t = d.threads.find((x) => x.id === threadId);
    if (!t) return;
    t.messages.push({ id: newId('m'), from: 'contact', body: 'Thanks, that helps. I will get back to you shortly.', at: now() });
  });
}

/* ---------- Automations ---------- */
export function saveAutomation(a: Automation, action = 'Updated automation') {
  commit(
    (d) => {
      const i = d.automations.findIndex((x) => x.id === a.id);
      // Runs are owned by the engine; an editor's copy may be stale.
      const next = { ...a, runs: i >= 0 ? d.automations[i]!.runs : a.runs, updatedAt: now(), updatedBy: me() };
      if (i >= 0) d.automations[i] = next;
      else d.automations.unshift(next);
    },
    { audit: { action, target: a.name } },
  );
}

export function newAutomation(template: Pick<Automation, 'name' | 'description' | 'trigger'> & { steps: Omit<Step, 'id'>[] }): string {
  const id = newId('au');
  saveAutomation({ ...template, id, enabled: false, runs: [], reentry: 'every', updatedAt: now(), updatedBy: me(), steps: template.steps.map((s): Step => ({ ...s, id: newId('s') })) }, 'Created automation');
  return id;
}

export function deleteAutomation(id: string) {
  const a = getDB().automations.find((x) => x.id === id);
  commit((d) => void (d.automations = d.automations.filter((x) => x.id !== id)), { audit: { action: 'Deleted automation', target: a?.name ?? id } });
}

/* ---------- Notifications, settings, team ---------- */
export function markNotifications(ids?: string[]) {
  commit((d) => {
    for (const n of d.notifications) if (!ids || ids.includes(n.id)) n.read = true;
  });
}

export function updateCompany(patch: Partial<Company>) {
  commit((d) => Object.assign(d.company, patch), { audit: { action: 'Updated company settings', target: 'Settings' } });
}

export function updateUser(id: string, patch: Partial<User>) {
  commit(
    (d) => {
      const u = d.users.find((x) => x.id === id);
      if (u) Object.assign(u, patch);
    },
    { audit: { action: 'Updated user', target: getDB().users.find((x) => x.id === id)?.email ?? id } },
  );
}

export function inviteUser(email: string, role: User['role'], team: string) {
  commit(
    (d) => {
      d.users.push({ id: newId('u'), name: email.split('@')[0]!, email, role, team, status: 'Invited', quota: 0, hue: Math.floor(Math.random() * 360) });
    },
    { audit: { action: 'Invited user', target: email } },
  );
}

export function switchUser(id: string) {
  commit((d) => void (d.currentUserId = id), { audit: { action: 'Switched view to user', target: getDB().users.find((u) => u.id === id)?.name ?? id } });
}

/** Makes the signed-in account the current user of this workspace, adding or refreshing its team entry. */
export function adoptProfile(p: { id: string; name: string; email: string; role: Role; team: string }) {
  const known = getDB().users.find((u) => u.id === p.id);
  const fresh = !known || known.name !== p.name || known.email !== p.email || known.role !== p.role || known.team !== p.team;
  if (!fresh && getDB().currentUserId === p.id) return;
  commit(
    (d) => {
      const u = d.users.find((x) => x.id === p.id);
      if (u) Object.assign(u, p, { status: 'Active' });
      else d.users.unshift({ ...p, status: 'Active', quota: 0, hue: 212 });
      d.currentUserId = p.id;
    },
    { audit: { action: 'Signed in', target: p.email } },
  );
}

export function logAudit(action: string, target: string) {
  commit(() => {}, { audit: { action, target } });
}

/* ---------- Projects ---------- */
function projectFor(deal: Deal, accountName: string): Project {
  return {
    id: newId('pr'),
    name: `${accountName} onboarding`,
    accountId: deal.accountId,
    contactId: deal.contactId,
    dealId: deal.id,
    ownerId: deal.ownerId,
    team: [deal.ownerId],
    status: 'Planning',
    steps: PROJECT_STEPS.map((name) => ({ id: newId('st'), name, done: false })),
    due: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    createdAt: now(),
  };
}

/** Status follows the steps: none done = Planning, all but one = In review, all = Done. */
function statusFor(steps: Project['steps']): Project['status'] {
  const done = steps.filter((s) => s.done).length;
  if (!done) return 'Planning';
  if (done === steps.length) return 'Done';
  return done === steps.length - 1 ? 'In review' : 'In progress';
}

export function saveProject(p: Partial<Project> & Pick<Project, 'name' | 'accountId' | 'ownerId'>) {
  const id = p.id ?? newId('pr');
  commit(
    (d) => {
      const existing = d.projects.find((x) => x.id === id);
      if (existing) Object.assign(existing, p);
      else
        d.projects.unshift({
          team: [p.ownerId],
          status: 'Planning',
          steps: PROJECT_STEPS.map((name) => ({ id: newId('st'), name, done: false })),
          due: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          createdAt: now(),
          ...p,
          id,
        });
    },
    { audit: { action: p.id ? 'Updated project' : 'Created project', target: p.name } },
  );
  return id;
}

export function toggleProjectStep(projectId: string, stepId: string) {
  commit((d) => {
    const p = d.projects.find((x) => x.id === projectId);
    const s = p?.steps.find((x) => x.id === stepId);
    if (!p || !s) return;
    s.done = !s.done;
    p.status = statusFor(p.steps);
  });
}
