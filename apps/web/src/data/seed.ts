import { PROJECT_STEPS } from './projectSteps';
import {
  OPEN_STAGES,
  type Account,
  type Activity,
  type Automation,
  type Contact,
  type Currency,
  type DB,
  type Deal,
  type DocLine,
  type Lead,
  type LeadSource,
  type Product,
  type SalesDoc,
  type Stage,
  type Project,
  type Task,
  type Thread,
  type User,
} from './types';

export const DB_VERSION = 5;

/** Deterministic PRNG so every fresh workspace looks the same. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSeed(now = new Date()): DB {
  const rand = mulberry32(7207);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
  const between = (a: number, b: number) => Math.round(a + rand() * (b - a));
  const ago = (days: number, hours = 0) => new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString();
  const ahead = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  let seq = 0;
  const id = (p: string) => `${p}${(++seq).toString(36)}`;

  const users: User[] = [
    { id: 'u1', name: 'Dinesh S.', email: 'dinesh@nexora.example', role: 'Owner', team: 'Leadership', status: 'Active', quota: 300_000, hue: 212 },
    { id: 'u2', name: 'Priya Sharma', email: 'priya@nexora.example', role: 'Manager', team: 'Enterprise', status: 'Active', quota: 500_000, hue: 330 },
    { id: 'u3', name: 'Rahul Verma', email: 'rahul@nexora.example', role: 'Sales rep', team: 'Enterprise', status: 'Active', quota: 400_000, hue: 150 },
    { id: 'u4', name: 'Ananya Iyer', email: 'ananya@nexora.example', role: 'Sales rep', team: 'Mid-market', status: 'Active', quota: 350_000, hue: 32 },
    { id: 'u5', name: 'Karthik Rao', email: 'karthik@nexora.example', role: 'Sales rep', team: 'Mid-market', status: 'Active', quota: 350_000, hue: 265 },
    { id: 'u6', name: 'Meera Nair', email: 'meera@nexora.example', role: 'Viewer', team: 'Finance', status: 'Invited', quota: 0, hue: 95 },
  ];
  const reps = ['u2', 'u3', 'u4', 'u5', 'u1'];

  const accountDefs: [string, string, string, string, Currency][] = [
    ['Acme Logistics', 'Logistics', 'Mumbai', 'India', 'INR'],
    ['Brightwave Retail', 'Retail', 'Bengaluru', 'India', 'INR'],
    ['Cobalt Health', 'Healthcare', 'Chennai', 'India', 'INR'],
    ['Deltaforge Steel', 'Manufacturing', 'Pune', 'India', 'INR'],
    ['Evergreen Foods', 'FMCG', 'Hyderabad', 'India', 'INR'],
    ['Falcon Fintech', 'Financial services', 'Gurugram', 'India', 'INR'],
    ['Gulfline Trading', 'Distribution', 'Dubai', 'UAE', 'AED'],
    ['Harbor & Co', 'Professional services', 'London', 'United Kingdom', 'GBP'],
    ['Ionix Labs', 'Software', 'Singapore', 'Singapore', 'SGD'],
    ['Juniper Motors', 'Automotive', 'Chennai', 'India', 'INR'],
    ['Kestrel Systems', 'Software', 'Austin', 'United States', 'USD'],
    ['Lumen Education', 'Education', 'Delhi', 'India', 'INR'],
    ['Meridian Hotels', 'Hospitality', 'Goa', 'India', 'INR'],
    ['Northstar Pharma', 'Pharma', 'Ahmedabad', 'India', 'INR'],
    ['Orbit Telecom', 'Telecom', 'Noida', 'India', 'INR'],
    ['Pinnacle Realty', 'Real estate', 'Mumbai', 'India', 'INR'],
    ['Quantum Retail EU', 'Retail', 'Dublin', 'Ireland', 'EUR'],
    ['Riverstone Agro', 'Agriculture', 'Nagpur', 'India', 'INR'],
    ['Saffron Media', 'Media', 'Kolkata', 'India', 'INR'],
    ['Tidewater Shipping', 'Logistics', 'Kochi', 'India', 'INR'],
    ['Urbanest Interiors', 'Construction', 'Bengaluru', 'India', 'INR'],
    ['Vertex Analytics', 'Software', 'San Jose', 'United States', 'USD'],
  ];
  const tagPool = ['Enterprise', 'Mid-market', 'Strategic', 'Partner', 'Renewal due'];
  const accounts: Account[] = accountDefs.map(([name, industry, city, country, currency], i) => ({
    id: `a${i + 1}`,
    name,
    industry,
    city,
    country,
    currency,
    website: `${name.toLowerCase().replace(/[^a-z]+/g, '')}.example`,
    phone: `+91 98${between(10, 99)} ${between(100000, 999999)}`,
    ownerId: reps[i % reps.length]!,
    tags: rand() > 0.5 ? [pick(tagPool)] : [],
    notes: '',
    createdAt: ago(between(200, 520)),
  }));

  const firsts = ['Arjun', 'Kavya', 'Rohan', 'Sneha', 'Vikram', 'Divya', 'Aditya', 'Neha', 'Sanjay', 'Pooja', 'Omar', 'Fatima', 'James', 'Emma', 'Wei', 'Lucas', 'Sara', 'Ishaan', 'Tara', 'Nikhil'];
  const lasts = ['Mehta', 'Kapoor', 'Reddy', 'Gupta', 'Singh', 'Joshi', 'Pillai', 'Das', 'Khan', 'Bose', 'Hassan', 'Clarke', 'Tan', 'Silva', 'Menon', 'Patel'];
  const titles = ['CEO', 'Head of Operations', 'CFO', 'Procurement Manager', 'IT Director', 'Sales Director', 'COO', 'Finance Manager'];
  const contacts: Contact[] = [];
  for (const acc of accounts) {
    const n = between(1, 3);
    for (let k = 0; k < n; k++) {
      const name = `${pick(firsts)} ${pick(lasts)}`;
      contacts.push({
        id: id('c'),
        accountId: acc.id,
        name,
        title: k === 0 ? pick(titles.slice(0, 3)) : pick(titles),
        email: `${name.split(' ')[0]!.toLowerCase()}@${acc.website}`,
        phone: `+91 9${between(100000000, 999999999)}`,
        city: acc.city,
        ownerId: acc.ownerId,
        tags: k === 0 ? ['Decision maker'] : [],
        createdAt: acc.createdAt,
        birthday: rand() > 0.6 ? `${String(between(1, 12)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}` : undefined,
      });
    }
  }
  const primaryContact = (accountId: string) => contacts.find((c) => c.accountId === accountId)!;

  // Deal sizes in INR; converted for foreign accounts.
  const toCur: Record<Currency, number> = { INR: 1, USD: 1 / 84, EUR: 1 / 91, GBP: 1 / 107, AED: 1 / 22.9, SGD: 1 / 63 };
  const products: Product[] = [
    { id: 'p1', name: 'Nexora Cloud, Business plan', sku: 'NX-CLD-BUS', category: 'Subscription', price: 2400, cost: 600, currency: 'INR', unit: 'user / month', taxPct: 18, status: 'Active' },
    { id: 'p2', name: 'Nexora Cloud, Enterprise plan', sku: 'NX-CLD-ENT', category: 'Subscription', price: 4200, cost: 900, currency: 'INR', unit: 'user / month', taxPct: 18, status: 'Active' },
    { id: 'p3', name: 'Implementation package', sku: 'SRV-IMPL', category: 'Services', price: 250000, cost: 120000, currency: 'INR', unit: 'project', taxPct: 18, status: 'Active' },
    { id: 'p4', name: 'Data migration', sku: 'SRV-MIG', category: 'Services', price: 120000, cost: 50000, currency: 'INR', unit: 'project', taxPct: 18, status: 'Active' },
    { id: 'p5', name: 'On-site training (day)', sku: 'SRV-TRN', category: 'Training', price: 45000, cost: 18000, currency: 'INR', unit: 'day', taxPct: 18, status: 'Active' },
    { id: 'p6', name: 'Premium support', sku: 'SUP-PRM', category: 'Support', price: 60000, cost: 20000, currency: 'INR', unit: 'year', taxPct: 18, status: 'Active' },
    { id: 'p7', name: 'API add-on', sku: 'ADD-API', category: 'Add-on', price: 15000, cost: 3000, currency: 'INR', unit: 'month', taxPct: 18, status: 'Active' },
    { id: 'p8', name: 'Custom integration', sku: 'SRV-INT', category: 'Services', price: 180000, cost: 90000, currency: 'INR', unit: 'project', taxPct: 18, status: 'Active' },
    { id: 'p9', name: 'Analytics add-on', sku: 'ADD-ANL', category: 'Add-on', price: 22000, cost: 5000, currency: 'INR', unit: 'month', taxPct: 18, status: 'Draft' },
    { id: 'p10', name: 'Legacy on-prem licence', sku: 'LIC-OLD', category: 'Licence', price: 300000, cost: 60000, currency: 'INR', unit: 'licence', taxPct: 18, status: 'Archived' },
  ];

  const sources: LeadSource[] = ['Website', 'Referral', 'LinkedIn', 'Cold call', 'Event', 'Partner'];
  const dealKinds = ['Annual subscription', 'Enterprise rollout', 'Implementation', 'Expansion', 'Renewal', 'Pilot'];
  const deals: Deal[] = [];

  function makeDeal(stage: Stage, createdDaysAgo: number, closeOffset: number) {
    const acc = pick(accounts);
    const contact = primaryContact(acc.id);
    const inr = between(3, 40) * 25_000;
    const amount = Math.round((inr * toCur[acc.currency]) / 100) * 100;
    const ownerId = acc.ownerId;
    const path: Stage[] = [];
    const idx = (OPEN_STAGES as readonly string[]).indexOf(stage);
    const reached = stage === 'Won' ? OPEN_STAGES.length : stage === 'Lost' ? between(1, 4) : idx + 1;
    for (let s = 0; s < reached; s++) path.push(OPEN_STAGES[s]!);
    if (stage === 'Won' || stage === 'Lost') path.push(stage);
    const span = Math.max(1, createdDaysAgo - Math.max(0, -closeOffset));
    const history = path.map((st, i) => ({
      stage: st,
      at: ago(createdDaysAgo - (span * i) / Math.max(1, path.length - 1)),
      by: ownerId,
    }));
    const deal: Deal = {
      id: id('d'),
      title: `${acc.name}: ${pick(dealKinds)}`,
      accountId: acc.id,
      contactId: contact.id,
      amount,
      currency: acc.currency,
      stage,
      ownerId,
      closeDate: closeOffset >= 0 ? ahead(closeOffset) : ago(-closeOffset),
      createdAt: ago(createdDaysAgo),
      source: pick(sources),
      history,
      lostReason: stage === 'Lost' ? pick(['Price', 'Chose a competitor', 'No budget', 'Timing']) : undefined,
      nextStep: stage === 'Won' || stage === 'Lost' ? undefined : pick(['Send revised proposal', 'Demo for finance team', 'Security review call', 'Confirm user count', 'Negotiate payment terms']),
    };
    deals.push(deal);
    return deal;
  }

  // Twelve months of closed business, growing towards this month.
  for (let m = 11; m >= 0; m--) {
    const wins = between(2, 4) + (m < 4 ? 1 : 0);
    for (let k = 0; k < wins; k++) {
      const closedAgo = m * 30 + between(0, 27);
      makeDeal('Won', closedAgo + between(20, 60), -closedAgo);
    }
    if (rand() > 0.35) {
      const closedAgo = m * 30 + between(0, 27);
      makeDeal('Lost', closedAgo + between(20, 50), -closedAgo);
    }
  }
  // Open pipeline.
  const openMix: Stage[] = ['New', 'New', 'New', 'Contacted', 'Contacted', 'Contacted', 'Qualified', 'Qualified', 'Qualified', 'Proposal', 'Proposal', 'Proposal', 'Negotiation', 'Negotiation', 'New', 'Qualified', 'Contacted', 'Proposal'];
  openMix.forEach((stage) => makeDeal(stage, between(3, 60), between(-6, 75)));

  const leadStatuses = ['New', 'New', 'New', 'New', 'Contacted', 'Contacted', 'Contacted', 'Qualified', 'Qualified', 'Unqualified', 'Converted'] as const;
  const leadCompanies = ['Aurora Textiles', 'Bluepeak Solar', 'Crestline Clinics', 'Dynamo Fitness', 'Echo Ventures', 'Fernhill Schools', 'Granite Infra', 'Helix Biotech', 'Indigo Travels', 'Jade Cosmetics', 'Kinetic Robotics', 'Lotus Jewellers', 'Monsoon Beverages', 'Nimbus Cloudworks', 'Opal Furnishings', 'Prism Advertising', 'Quill Publishing', 'Redwood Packaging', 'Sterling Legal', 'Terra Ceramics', 'Uplift Staffing', 'Vista Opticals', 'Willow Dairy', 'Zenith Couriers'];
  const leads: Lead[] = leadCompanies.map((company, i) => {
    const name = `${pick(firsts)} ${pick(lasts)}`;
    const status = i < 3 ? 'New' : pick(leadStatuses);
    const created = i < 3 ? between(0, 1) : between(1, 45);
    return {
      id: id('l'),
      name,
      company,
      title: pick(titles),
      email: `${name.split(' ')[0]!.toLowerCase()}@${company.toLowerCase().replace(/[^a-z]+/g, '')}.example`,
      phone: `+91 9${between(100000000, 999999999)}`,
      city: pick(['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Pune', 'Hyderabad', 'Kochi', 'Jaipur']),
      source: pick(sources),
      status,
      score: status === 'Qualified' ? between(70, 95) : status === 'Unqualified' ? between(5, 30) : between(25, 80),
      ownerId: pick(reps),
      estValue: between(2, 30) * 25_000,
      currency: 'INR',
      tags: rand() > 0.6 ? [pick(['Hot', 'Inbound', 'Webinar', 'Trade show'])] : [],
      createdAt: ago(created, between(0, 20)),
      lastActivityAt: ago(Math.max(0, created - between(0, created)), between(0, 20)),
    };
  });

  // Quotes for late-stage deals, invoices for recent wins.
  const docs: SalesDoc[] = [];
  let invNo = 1;
  let quoteNo = 1;
  const year = now.getFullYear();
  const linesFor = (amount: number): DocLine[] => {
    const p = pick([products[0]!, products[1]!]);
    const impl = products[2]!;
    const users = Math.max(5, Math.round((amount * 0.6) / (p.price * 12)));
    const lines: DocLine[] = [
      { id: id('ln'), productId: p.id, description: `${p.name} (12 months)`, qty: users, unitPrice: p.price * 12, discountPct: rand() > 0.6 ? 10 : 0, taxPct: 18 },
    ];
    if (amount > 300_000) lines.push({ id: id('ln'), productId: impl.id, description: impl.name, qty: 1, unitPrice: impl.price, discountPct: 0, taxPct: 18 });
    return lines;
  };
  const scaleLines = (lines: DocLine[], cur: Currency) =>
    lines.map((l) => ({ ...l, unitPrice: Math.round(l.unitPrice * toCur[cur]), taxPct: cur === 'INR' ? l.taxPct : 0 }));

  deals
    .filter((d) => d.stage === 'Won')
    .sort((a, b) => a.closeDate.localeCompare(b.closeDate))
    .slice(-14)
    .forEach((d) => {
      const issued = new Date(d.closeDate);
      const issueAgo = Math.round((now.getTime() - issued.getTime()) / 86_400_000);
      const due = new Date(issued.getTime() + 30 * 86_400_000);
      const overdue = due < now;
      const paid = overdue ? rand() > 0.3 : rand() > 0.75;
      const lines = scaleLines(linesFor(d.amount / toCur[d.currency]), d.currency);
      const doc: SalesDoc = {
        id: id('inv'),
        kind: 'invoice',
        number: `NX-INV-${year}-${String(invNo++).padStart(4, '0')}`,
        accountId: d.accountId,
        contactId: d.contactId,
        dealId: d.id,
        currency: d.currency,
        issueDate: issued.toISOString(),
        dueDate: due.toISOString(),
        status: paid ? 'Paid' : overdue ? 'Overdue' : issueAgo < 2 ? 'Draft' : 'Sent',
        lines,
        notes: 'Thank you for your business.',
        terms: 'Payment due within 30 days.',
        payments: [],
        createdBy: d.ownerId,
      };
      if (paid) doc.payments.push({ id: id('pay'), amount: docTotal(doc), at: new Date(issued.getTime() + between(5, 28) * 86_400_000).toISOString(), method: pick(['Bank transfer', 'UPI', 'Card']) });
      docs.push(doc);
    });
  deals
    .filter((d) => d.stage === 'Proposal' || d.stage === 'Negotiation')
    .slice(0, 6)
    .forEach((d, i) => {
      docs.push({
        id: id('q'),
        kind: 'quote',
        number: `NX-QUO-${year}-${String(quoteNo++).padStart(4, '0')}`,
        accountId: d.accountId,
        contactId: d.contactId,
        dealId: d.id,
        currency: d.currency,
        issueDate: ago(between(2, 12)),
        dueDate: ahead(between(5, 20)),
        status: i === 0 ? 'Accepted' : i < 4 ? 'Sent' : 'Draft',
        lines: scaleLines(linesFor(d.amount / toCur[d.currency]), d.currency),
        notes: 'Prices valid for 30 days.',
        terms: '50% advance, balance on go-live.',
        payments: [],
        createdBy: d.ownerId,
      });
    });

  // Activity history across deals and leads.
  const activities: Activity[] = [];
  const actTemplates: [Activity['type'], string][] = [
    ['call', 'Discovery call'],
    ['email', 'Sent product overview'],
    ['meeting', 'Product demo'],
    ['note', 'Budget confirmed for this quarter'],
    ['call', 'Pricing discussion'],
    ['email', 'Shared case study'],
    ['meeting', 'Security review'],
  ];
  for (const d of deals) {
    d.history.forEach((h, i) => {
      if (i === 0) return;
      activities.push({ id: id('act'), type: 'stage', title: `Stage changed to ${h.stage}`, at: h.at, userId: h.by, related: [{ kind: 'deal', id: d.id }, { kind: 'account', id: d.accountId }] });
    });
    const n = between(1, 3);
    for (let k = 0; k < n; k++) {
      const [type, title] = pick(actTemplates);
      const created = new Date(d.createdAt).getTime();
      const end = Math.min(now.getTime(), new Date(d.closeDate).getTime());
      const at = new Date(created + rand() * Math.max(0, end - created)).toISOString();
      activities.push({ id: id('act'), type, title, at, userId: d.ownerId, related: [{ kind: 'deal', id: d.id }, { kind: 'account', id: d.accountId }, ...(d.contactId ? [{ kind: 'contact' as const, id: d.contactId }] : [])] });
    }
  }
  for (const l of leads) {
    activities.push({ id: id('act'), type: 'note', title: `Lead captured from ${l.source}`, at: l.createdAt, userId: l.ownerId, related: [{ kind: 'lead', id: l.id }] });
    if (l.status !== 'New') activities.push({ id: id('act'), type: pick(['call', 'email']), title: pick(['Intro call', 'Sent intro email', 'Left voicemail']), at: l.lastActivityAt, userId: l.ownerId, related: [{ kind: 'lead', id: l.id }] });
  }

  const openDeals = deals.filter((d) => OPEN_STAGES.includes(d.stage as (typeof OPEN_STAGES)[number]));
  const taskDefs: [string, Task['column'], Task['priority'], number, string][] = [
    ['Send revised proposal', 'To do', 'High', 1, 'Proposal'],
    ['Prepare demo environment', 'In progress', 'Medium', 2, 'Demo'],
    ['Follow up on security questionnaire', 'To do', 'High', 0, 'Follow-up'],
    ['Confirm user count with procurement', 'Review', 'Medium', 3, 'Follow-up'],
    ['Draft master services agreement', 'In progress', 'High', 4, 'Contract'],
    ['Quarterly business review deck', 'To do', 'Low', 9, 'Account'],
    ['Call back about pricing', 'To do', 'Medium', -1, 'Follow-up'],
    ['Kick-off call scheduling', 'Done', 'Medium', -3, 'Onboarding'],
    ['Update forecast for review', 'Review', 'Medium', 1, 'Internal'],
    ['Collect signed order form', 'In progress', 'High', 2, 'Contract'],
    ['Renewal reminder email', 'Done', 'Low', -5, 'Account'],
    ['Book on-site training dates', 'To do', 'Low', 12, 'Onboarding'],
  ];
  const tasks: Task[] = taskDefs.map(([title, column, priority, due, tag], i) => {
    const d = openDeals[i % openDeals.length]!;
    const items = between(2, 4);
    return {
      id: id('t'),
      title,
      detail: `${title} for ${accounts.find((a) => a.id === d.accountId)!.name}.`,
      column,
      priority,
      due: ahead(due),
      assigneeId: d.ownerId,
      tag,
      related: { kind: 'deal', id: d.id },
      checklist: Array.from({ length: items }, (_, k) => ({ id: id('ck'), text: ['Draft', 'Review internally', 'Share with client', 'Log outcome'][k]!, done: column === 'Done' || k < items / 2 })),
      comments: rand() > 0.5 ? [{ id: id('cm'), userId: 'u2', text: 'Loop me in before sending.', at: ago(1) }] : [],
      createdAt: ago(between(2, 14)),
      kind: 'Task',
    };
  });

  // Calls, meetings and emails on the calendar: a few today, the rest spread over six weeks.
  const at = (dayOffset: number, hour: number, minute = 0) => {
    const t = new Date(now);
    t.setDate(t.getDate() + dayOffset);
    t.setHours(hour, minute, 0, 0);
    return t.toISOString();
  };
  const agenda: [string, Task['kind'], number, number, number][] = [
    ['Send revised quote', 'Email', 0, 11, 0],
    ['Pipeline review', 'Meeting', 0, 11, 30],
    ['Discovery call', 'Call', 0, 15, 30],
    ['Demo for finance team', 'Meeting', 1, 10, 0],
    ['Pricing follow-up', 'Call', 1, 14, 0],
    ['Security review', 'Meeting', 2, 12, 0],
    ['Share case study', 'Email', 2, 16, 0],
    ['Renewal check-in', 'Call', 3, 11, 0],
    ['Contract walkthrough', 'Meeting', 4, 15, 0],
    ['Quarterly business review', 'Meeting', 6, 10, 30],
    ['Intro call', 'Call', 8, 12, 0],
    ['Proposal presentation', 'Meeting', 10, 14, 0],
    ['Onboarding kick-off', 'Meeting', 13, 11, 0],
    ['Expansion pitch', 'Call', 17, 16, 0],
    ['Follow up on invoice', 'Email', -1, 10, 0],
    ['Reference call', 'Call', -2, 15, 0],
    ['Site visit', 'Meeting', -4, 11, 0],
    ['Check-in call', 'Call', -6, 12, 30],
  ];
  agenda.forEach(([title, kind, day, h, m], i) => {
    const dl = openDeals[(i * 3) % openDeals.length]!;
    const acc = accounts.find((a) => a.id === dl.accountId)!;
    tasks.push({
      id: id('t'),
      title,
      kind,
      detail: `${title} with ${acc.name}.`,
      column: day < -1 ? 'Done' : 'To do',
      priority: i % 4 === 0 ? 'High' : 'Medium',
      due: at(day, h, m),
      assigneeId: day === 0 || i % 3 === 0 ? 'u1' : dl.ownerId,
      tag: kind === 'Meeting' ? 'Demo' : 'Follow-up',
      related: { kind: 'deal', id: dl.id },
      checklist: [],
      comments: [],
      createdAt: ago(between(3, 12)),
    });
  });

  // Onboarding projects for recent wins.
  const STEP_NAMES = PROJECT_STEPS;
  const projects: Project[] = deals
    .filter((x) => x.stage === 'Won')
    .sort((a, b) => b.closeDate.localeCompare(a.closeDate))
    .slice(0, 9)
    .map((x, i) => {
      const doneCount = [1, 2, 1, 4, 5, 3, 0, 5, 2][i]!;
      const acc = accounts.find((a) => a.id === x.accountId)!;
      const status: Project['status'] = doneCount === 5 ? 'Done' : doneCount === 4 ? 'In review' : doneCount === 0 ? 'Planning' : 'In progress';
      return {
        id: id('pr'),
        name: `${acc.name} onboarding`,
        accountId: x.accountId,
        contactId: x.contactId,
        dealId: x.id,
        ownerId: x.ownerId,
        team: [...new Set([x.ownerId, reps[(i + 1) % reps.length]!, reps[(i + 3) % reps.length]!])],
        status,
        steps: STEP_NAMES.map((n, k) => ({ id: id('st'), name: n, done: k < doneCount })),
        due: ahead(status === 'Done' ? -between(1, 20) : between(4, 40)),
        createdAt: x.closeDate,
      };
    });

  const threadDefs: [string, Thread['channel'], string[]][] = [
    ['Revised pricing for 120 seats', 'email', ['Hi, could you share revised pricing for 120 seats with annual billing?', 'Sure, I will send the updated quote today.', 'Thanks! Also, do you offer a discount for a 2-year commitment?']],
    ['Implementation timeline', 'email', ['What is the typical implementation timeline for a team our size?', 'Usually 4 to 6 weeks including data migration.']],
    ['Demo follow-up', 'whatsapp', ['Thanks for the demo yesterday. The team loved the pipeline view.', 'Great to hear! Shall we schedule a call with your finance head?', 'Yes, Thursday works.']],
    ['Invoice copy needed', 'email', ['Can you resend the latest invoice? Our accounts team needs a copy.']],
    ['Question about API limits', 'web', ['Hi, what are the API rate limits on the Enterprise plan?']],
    ['Renewal discussion', 'email', ['Our renewal is coming up next month. Can we discuss adding 20 users?', 'Absolutely, I will prepare an expansion quote.']],
    ['Training dates', 'whatsapp', ['Can we move the on-site training to the first week of next month?']],
  ];
  const threads: Thread[] = threadDefs.map(([subject, channel, msgs], i) => {
    const d = openDeals[(i * 2) % openDeals.length]!;
    const contact = contacts.find((c) => c.id === d.contactId)!;
    const base = between(1, 70);
    return {
      id: id('th'),
      contactId: contact.id,
      dealId: d.id,
      channel,
      subject,
      messages: msgs.map((body, k) => ({ id: id('m'), from: k % 2 === 0 ? 'contact' : d.ownerId, body, at: ago(0, base - k * 0.5 + (i > 3 ? 24 : 0)) })),
      unread: i < 3,
      starred: i === 0,
      done: i === 6,
      assigneeId: d.ownerId,
    };
  });

  const automations: Automation[] = [
    {
      id: 'au1',
      name: 'New lead follow-up',
      description: 'Every new lead gets a call task within a day, and the owner is nudged if it stays untouched.',
      enabled: true,
      trigger: { type: 'lead.created' },
      reentry: 'once',
      steps: [
        { id: 's1', type: 'task', name: 'Create call task for the owner', config: { title: 'Call {{name}} at {{company}}', dueDays: 1, assignee: 'owner' } },
        { id: 's2', type: 'wait', name: 'Wait 2 days', config: { days: 2 } },
        { id: 's3', type: 'condition', name: 'Lead is still New?', config: { condition: { field: 'status', op: 'eq', value: 'New' } } },
        { id: 's4', type: 'notify', name: 'Nudge the owner', config: { message: '{{name}} from {{company}} has not been contacted yet.' } },
      ],
      runs: [],
      updatedAt: ago(6),
      updatedBy: 'u1',
    },
    {
      id: 'au2',
      name: 'Proposal follow-up',
      description: 'When a deal reaches Proposal, follow up after 3 days and create a check-in task.',
      enabled: true,
      trigger: { type: 'deal.stage_changed', stage: 'Proposal' },
      reentry: 'every',
      steps: [
        { id: 's1', type: 'wait', name: 'Wait 3 days', config: { days: 3 } },
        { id: 's2', type: 'email', name: 'Send follow-up email', config: { subject: 'Any questions on the proposal?', body: 'Hi {{contact}},\n\nJust checking whether you had a chance to review our proposal for {{deal}}. Happy to walk your team through it.\n\nBest,\n{{owner}}' } },
        { id: 's3', type: 'task', name: 'Check-in call', config: { title: 'Check-in call on {{deal}}', dueDays: 2, assignee: 'owner' } },
      ],
      runs: [],
      updatedAt: ago(12),
      updatedBy: 'u2',
    },
    {
      id: 'au3',
      name: 'Deal won onboarding',
      description: 'Tag the account as a customer, send a welcome email and book the kick-off.',
      enabled: true,
      trigger: { type: 'deal.won' },
      reentry: 'every',
      steps: [
        { id: 's1', type: 'tag', name: 'Tag account "Customer"', config: { tag: 'Customer' } },
        { id: 's2', type: 'email', name: 'Welcome email', config: { subject: 'Welcome to Nexora', body: 'Hi {{contact}},\n\nThank you for choosing us. Your onboarding manager will reach out to schedule the kick-off.\n\n{{owner}}' } },
        { id: 's3', type: 'task', name: 'Schedule kick-off call', config: { title: 'Kick-off call with {{account}}', dueDays: 3, assignee: 'owner' } },
        { id: 's4', type: 'notify', name: 'Tell the team', config: { message: '{{owner}} won {{deal}} ({{amount}}).' } },
      ],
      runs: [],
      updatedAt: ago(20),
      updatedBy: 'u1',
    },
    {
      id: 'au4',
      name: 'Overdue invoice reminder',
      description: 'Remind the client when an invoice is overdue and escalate after a week.',
      enabled: true,
      trigger: { type: 'invoice.overdue' },
      reentry: 'every',
      steps: [
        { id: 's1', type: 'email', name: 'Payment reminder', config: { subject: 'Reminder: invoice {{number}} is overdue', body: 'Hi {{contact}},\n\nInvoice {{number}} for {{amount}} was due on {{due}}. Could you please arrange payment?\n\nThank you.' } },
        { id: 's2', type: 'wait', name: 'Wait 7 days', config: { days: 7 } },
        { id: 's3', type: 'condition', name: 'Still unpaid?', config: { condition: { field: 'status', op: 'neq', value: 'Paid' } } },
        { id: 's4', type: 'task', name: 'Call accounts team', config: { title: 'Call {{account}} about {{number}}', dueDays: 1, assignee: 'owner' } },
      ],
      runs: [],
      updatedAt: ago(30),
      updatedBy: 'u1',
    },
    {
      id: 'au5',
      name: 'Lost deal win-back',
      description: 'Ninety days after a loss, create a task to reconnect.',
      enabled: false,
      trigger: { type: 'deal.lost' },
      reentry: 'once',
      steps: [
        { id: 's1', type: 'wait', name: 'Wait 90 days', config: { days: 90 } },
        { id: 's2', type: 'task', name: 'Reconnect task', config: { title: 'Reconnect with {{account}}', dueDays: 3, assignee: 'owner' } },
      ],
      runs: [],
      updatedAt: ago(45),
      updatedBy: 'u2',
    },
  ];
  // Historical runs so the list has real-looking stats.
  const runCounts = [24, 17, 30, 9, 0];
  automations.forEach((a, i) => {
    for (let k = 0; k < runCounts[i]!; k++) {
      const label = i === 0 ? pick(leads).company : pick(accounts).name;
      a.runs.push({
        id: id('run'),
        label,
        at: ago(between(0, 29), between(0, 23)),
        status: rand() > 0.88 ? 'Stopped' : 'Completed',
        log: a.steps.map((s) => `✓ ${s.name}`),
      });
    }
    a.runs.sort((x, y) => y.at.localeCompare(x.at));
  });

  const name = (uid: string) => users.find((u) => u.id === uid)!.name;
  const recentWin = deals.filter((d) => d.stage === 'Won').sort((a, b) => b.closeDate.localeCompare(a.closeDate))[0]!;
  const overdueInv = docs.find((d) => d.status === 'Overdue');

  return {
    version: DB_VERSION,
    seededAt: now.toISOString(),
    currentUserId: 'u1',
    company: {
      name: 'Nexora',
      legalName: 'Nexora Technologies Pvt. Ltd.',
      address: '4th Floor, Prestige Tech Park\nBengaluru, Karnataka 560103\nIndia',
      taxId: 'GSTIN 29ABCDE1234F1Z5',
      email: 'accounts@nexora.example',
      phone: '+91 80 4000 1234',
      baseCurrency: 'INR',
      timezone: 'Asia/Kolkata',
      invoicePrefix: 'NX-INV',
      quotePrefix: 'NX-QUO',
      nextInvoiceNo: invNo,
      nextQuoteNo: quoteNo,
      paymentTerms: 'Payment due within 30 days.',
      bankDetails: 'HDFC Bank · A/C 50200012345678 · IFSC HDFC0001234',
      rates: { INR: 1, USD: 84, EUR: 91, GBP: 107, AED: 22.9, SGD: 63 },
      notify: { newLead: true, dealWon: true, invoiceOverdue: true, messages: true, weeklyReport: true },
    },
    users,
    accounts,
    contacts,
    leads,
    deals,
    products,
    docs,
    activities,
    tasks,
    projects,
    threads,
    automations,
    notifications: [
      { id: id('n'), kind: 'lead', title: 'New lead', body: `${leads[0]!.name} from ${leads[0]!.company}`, at: leads[0]!.createdAt, read: false, link: `/leads/${leads[0]!.id}` },
      { id: id('n'), kind: 'deal', title: 'Deal won', body: `${name(recentWin.ownerId)} won ${recentWin.title}`, at: recentWin.closeDate, read: false, link: `/pipeline/${recentWin.id}` },
      { id: id('n'), kind: 'message', title: 'New message', body: threads[0]!.subject, at: threads[0]!.messages.at(-1)!.at, read: false, link: `/inbox/${threads[0]!.id}` },
      ...(overdueInv ? [{ id: id('n'), kind: 'invoice' as const, title: 'Invoice overdue', body: `${overdueInv.number} is past due`, at: overdueInv.dueDate, read: true, link: `/finance/${overdueInv.id}` }] : []),
      { id: id('n'), kind: 'automation', title: 'Automation ran', body: 'Proposal follow-up sent 3 emails today', at: ago(0, 3), read: true, link: '/automations/au2' },
    ],
    audit: [
      { id: id('au'), at: ago(0, 2), userId: 'u1', action: 'Signed in', target: 'Web' },
      { id: id('au'), at: ago(1, 4), userId: 'u2', action: 'Exported deals CSV', target: 'Deals' },
      { id: id('au'), at: ago(2, 1), userId: 'u1', action: 'Enabled automation', target: 'Proposal follow-up' },
      { id: id('au'), at: ago(4, 6), userId: 'u1', action: 'Invited user', target: 'meera@nexora.example' },
    ],
  };
}

export function lineTotals(l: DocLine) {
  const gross = l.qty * l.unitPrice;
  const net = gross * (1 - l.discountPct / 100);
  const tax = net * (l.taxPct / 100);
  return { gross, net, tax, total: net + tax };
}

export function docTotals(doc: Pick<SalesDoc, 'lines' | 'payments'>) {
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  for (const l of doc.lines) {
    const t = lineTotals(l);
    subtotal += t.gross;
    discount += t.gross - t.net;
    tax += t.tax;
  }
  const total = subtotal - discount + tax;
  const paid = doc.payments.reduce((s, p) => s + p.amount, 0);
  return { subtotal, discount, tax, total, paid, balance: Math.max(0, total - paid) };
}

export function docTotal(doc: Pick<SalesDoc, 'lines' | 'payments'>) {
  return Math.round(docTotals(doc).total * 100) / 100;
}
