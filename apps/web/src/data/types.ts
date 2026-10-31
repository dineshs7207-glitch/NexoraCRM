export type ID = string;
export type ISODate = string;

export type Role = 'Owner' | 'Admin' | 'Manager' | 'Sales rep' | 'Viewer';
export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD';
export type Priority = 'High' | 'Medium' | 'Low';

export interface User {
  id: ID;
  name: string;
  email: string;
  role: Role;
  team: string;
  status: 'Active' | 'Invited' | 'Deactivated';
  quota: number; // monthly quota in base currency
  hue: number; // avatar tint
}

export interface Account {
  id: ID;
  name: string;
  industry: string;
  city: string;
  country: string;
  website: string;
  phone: string;
  currency: Currency;
  ownerId: ID;
  tags: string[];
  notes: string;
  createdAt: ISODate;
}

export interface Contact {
  id: ID;
  accountId: ID;
  name: string;
  title: string;
  email: string;
  phone: string;
  city: string;
  ownerId: ID;
  tags: string[];
  createdAt: ISODate;
  birthday?: string;
}

export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_SOURCES = ['Website', 'Referral', 'LinkedIn', 'Cold call', 'Event', 'Partner'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export interface Lead {
  id: ID;
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  city: string;
  source: LeadSource;
  status: LeadStatus;
  score: number;
  ownerId: ID;
  estValue: number;
  currency: Currency;
  tags: string[];
  createdAt: ISODate;
  lastActivityAt: ISODate;
  convertedDealId?: ID;
}

export const OPEN_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation'] as const;
export const STAGES = [...OPEN_STAGES, 'Won', 'Lost'] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_PROBABILITY: Record<Stage, number> = {
  New: 10,
  Contacted: 20,
  Qualified: 40,
  Proposal: 60,
  Negotiation: 80,
  Won: 100,
  Lost: 0,
};

export interface StageChange {
  stage: Stage;
  at: ISODate;
  by: ID;
}

export interface Deal {
  id: ID;
  title: string;
  accountId: ID;
  contactId?: ID;
  amount: number;
  currency: Currency;
  stage: Stage;
  ownerId: ID;
  closeDate: ISODate;
  createdAt: ISODate;
  source: LeadSource;
  history: StageChange[];
  lostReason?: string;
  nextStep?: string;
}

export interface Product {
  id: ID;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  currency: Currency;
  unit: string;
  taxPct: number;
  status: 'Active' | 'Draft' | 'Archived';
}

export interface DocLine {
  id: ID;
  productId?: ID;
  description: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  taxPct: number;
}

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Void';
export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined';

export interface Payment {
  id: ID;
  amount: number;
  at: ISODate;
  method: string;
}

export interface SalesDoc {
  id: ID;
  kind: 'invoice' | 'quote';
  number: string;
  accountId: ID;
  contactId?: ID;
  dealId?: ID;
  currency: Currency;
  issueDate: ISODate;
  dueDate: ISODate;
  status: InvoiceStatus | QuoteStatus;
  lines: DocLine[];
  notes: string;
  terms: string;
  payments: Payment[];
  createdBy: ID;
  convertedFrom?: ID;
}

export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'stage' | 'task' | 'invoice' | 'automation';

export interface Activity {
  id: ID;
  type: ActivityType;
  title: string;
  body?: string;
  at: ISODate;
  userId: ID;
  related: { kind: 'lead' | 'deal' | 'account' | 'contact'; id: ID }[];
}

export const TASK_COLUMNS = ['To do', 'In progress', 'Review', 'Done'] as const;
export type TaskColumn = (typeof TASK_COLUMNS)[number];

export const TASK_KINDS = ['Call', 'Meeting', 'Task', 'Email'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export interface Task {
  id: ID;
  title: string;
  kind?: TaskKind;
  detail: string;
  column: TaskColumn;
  priority: Priority;
  due: ISODate;
  assigneeId: ID;
  tag: string;
  related?: { kind: 'lead' | 'deal' | 'account' | 'contact'; id: ID };
  checklist: { id: ID; text: string; done: boolean }[];
  comments: { id: ID; userId: ID; text: string; at: ISODate }[];
  createdAt: ISODate;
}

export const PROJECT_STATUSES = ['Planning', 'In progress', 'In review', 'Done'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Customer onboarding after a deal is won. */
export interface Project {
  id: ID;
  name: string;
  accountId: ID;
  contactId?: ID;
  dealId?: ID;
  ownerId: ID;
  team: ID[];
  status: ProjectStatus;
  steps: { id: ID; name: string; done: boolean }[];
  due: ISODate;
  createdAt: ISODate;
}

export interface Message {
  id: ID;
  from: 'contact' | ID;
  body: string;
  at: ISODate;
}

export interface Thread {
  id: ID;
  contactId: ID;
  dealId?: ID;
  channel: 'email' | 'whatsapp' | 'web';
  subject: string;
  messages: Message[];
  unread: boolean;
  starred: boolean;
  done: boolean;
  assigneeId: ID;
}

export type TriggerType =
  | 'lead.created'
  | 'deal.created'
  | 'deal.stage_changed'
  | 'deal.won'
  | 'deal.lost'
  | 'invoice.overdue'
  | 'invoice.paid'
  | 'task.overdue';

export type StepType = 'wait' | 'condition' | 'email' | 'task' | 'tag' | 'notify' | 'update';

export interface Condition {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
  value: string;
}

export interface Step {
  id: ID;
  type: StepType;
  name: string;
  config: {
    days?: number;
    hours?: number;
    condition?: Condition;
    subject?: string;
    body?: string;
    title?: string;
    dueDays?: number;
    assignee?: 'owner' | ID;
    tag?: string;
    message?: string;
    field?: string;
    value?: string;
  };
}

export type RefKind = 'lead' | 'deal' | 'doc' | 'task';
export interface RecordRef {
  kind: RefKind;
  id: ID;
}

export interface Run {
  id: ID;
  label: string;
  at: ISODate;
  status: 'Completed' | 'Stopped' | 'Waiting' | 'Failed' | 'Passed (test)';
  log: string[];
  test?: boolean;
  ref?: RecordRef;
  /** Index of the step to resume at when a Wait step finishes. */
  next?: number;
  resumeAt?: ISODate;
}

export interface DomainEvent {
  type: TriggerType;
  ref: RecordRef;
}

export interface Automation {
  id: ID;
  name: string;
  description: string;
  enabled: boolean;
  trigger: { type: TriggerType; stage?: Stage };
  steps: Step[];
  runs: Run[];
  reentry: 'once' | 'every';
  updatedAt: ISODate;
  updatedBy: ID;
}

export interface Notification {
  id: ID;
  kind: 'lead' | 'deal' | 'invoice' | 'message' | 'task' | 'automation';
  title: string;
  body: string;
  at: ISODate;
  read: boolean;
  link: string;
}

export interface AuditEntry {
  id: ID;
  at: ISODate;
  userId: ID;
  action: string;
  target: string;
}

export interface Company {
  name: string;
  legalName: string;
  address: string;
  taxId: string;
  email: string;
  phone: string;
  baseCurrency: Currency;
  timezone: string;
  invoicePrefix: string;
  quotePrefix: string;
  nextInvoiceNo: number;
  nextQuoteNo: number;
  paymentTerms: string;
  bankDetails: string;
  rates: Record<Currency, number>; // value of 1 unit in base currency
  notify: Record<string, boolean>;
}

export interface DB {
  version: number;
  seededAt: ISODate;
  currentUserId: ID;
  company: Company;
  users: User[];
  accounts: Account[];
  contacts: Contact[];
  leads: Lead[];
  deals: Deal[];
  products: Product[];
  docs: SalesDoc[];
  activities: Activity[];
  tasks: Task[];
  projects: Project[];
  threads: Thread[];
  automations: Automation[];
  notifications: Notification[];
  audit: AuditEntry[];
}
