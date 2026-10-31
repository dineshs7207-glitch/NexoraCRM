import { docTotals } from './seed';
import { OPEN_STAGES, STAGE_PROBABILITY, type Currency, type DB, type Deal, type SalesDoc, type Stage } from './types';

const DAY = 86_400_000;

export function toBase(d: DB, amount: number, currency: Currency) {
  return amount * (d.company.rates[currency] ?? 1);
}

export function dealBase(d: DB, deal: Deal) {
  return toBase(d, deal.amount, deal.currency);
}

export function isOpen(stage: Stage) {
  return (OPEN_STAGES as readonly Stage[]).includes(stage);
}

export function monthStart(date: Date, offset = 0) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function inRange(iso: string, from: number, to: number) {
  const t = new Date(iso).getTime();
  return t >= from && t < to;
}

export function wonBetween(d: DB, from: number, to: number) {
  return d.deals.filter((x) => x.stage === 'Won' && inRange(x.closeDate, from, to));
}

export function sumBase(d: DB, deals: Deal[]) {
  return deals.reduce((s, x) => s + dealBase(d, x), 0);
}

export interface MonthPoint {
  key: string;
  date: Date;
  revenue: number;
  deals: number;
  kind: 'past' | 'current' | 'forecast';
  prevYear: number;
}

/** Twelve calendar months of a year: closed-won revenue, forecast for future months from the weighted pipeline. */
export function monthlyRevenue(d: DB, year: number, now = new Date()): MonthPoint[] {
  const pts: MonthPoint[] = [];
  for (let m = 0; m < 12; m++) {
    const from = new Date(year, m, 1).getTime();
    const to = new Date(year, m + 1, 1).getTime();
    const won = wonBetween(d, from, to);
    const prev = wonBetween(d, new Date(year - 1, m, 1).getTime(), new Date(year - 1, m + 1, 1).getTime());
    const isCurrent = now.getFullYear() === year && now.getMonth() === m;
    const isFuture = from > now.getTime();
    let revenue = sumBase(d, won);
    if (isFuture) {
      revenue = d.deals
        .filter((x) => isOpen(x.stage) && inRange(x.closeDate, from, to))
        .reduce((s, x) => s + (dealBase(d, x) * STAGE_PROBABILITY[x.stage]) / 100, 0);
    }
    pts.push({
      key: `${year}-${m}`,
      date: new Date(year, m, 1),
      revenue,
      deals: won.length,
      kind: isCurrent ? 'current' : isFuture ? 'forecast' : 'past',
      prevYear: sumBase(d, prev),
    });
  }
  return pts;
}

export function pipeline(d: DB) {
  const open = d.deals.filter((x) => isOpen(x.stage));
  const value = sumBase(d, open);
  const weighted = open.reduce((s, x) => s + (dealBase(d, x) * STAGE_PROBABILITY[x.stage]) / 100, 0);
  return { open, value, weighted };
}

export function winRate(d: DB, from: number, to: number) {
  const closed = d.deals.filter((x) => (x.stage === 'Won' || x.stage === 'Lost') && inRange(x.closeDate, from, to));
  const won = closed.filter((x) => x.stage === 'Won').length;
  return closed.length ? (won / closed.length) * 100 : 0;
}

export function periodBounds(days: number, now = Date.now()) {
  return { from: now - days * DAY, to: now, prevFrom: now - 2 * days * DAY, prevTo: now - days * DAY };
}

/** Activity heatmap: weekday rows (Mon–Sun) × time bands. */
export const BANDS = ['Morning', 'Midday', 'Afternoon', 'Evening'] as const;
/** Weekday (Mon = 0) and time band of a timestamp, as used by the heatmap. */
export function activitySlot(iso: string) {
  const t = new Date(iso);
  const h = t.getHours();
  return [(t.getDay() + 6) % 7, h < 11 ? 0 : h < 14 ? 1 : h < 17 ? 2 : 3] as const;
}

export function heatmapActivities(d: DB, days = 60, now = Date.now()) {
  return d.activities.filter((a) => a.type !== 'stage' && now - new Date(a.at).getTime() <= days * DAY);
}

export function activityHeatmap(d: DB, days = 60, now = Date.now()) {
  const grid = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  for (const a of heatmapActivities(d, days, now)) {
    const [row, band] = activitySlot(a.at);
    grid[row]![band]! += 1;
  }
  return grid;
}

export function countBy<T>(items: T[], key: (x: T) => string) {
  const out = new Map<string, number>();
  for (const it of items) out.set(key(it), (out.get(key(it)) ?? 0) + 1);
  return [...out.entries()].sort((a, b) => b[1] - a[1]);
}

/** Number of deals that reached each stage among deals created in the window. */
export function stageFunnel(d: DB, from: number, to: number) {
  const deals = d.deals.filter((x) => inRange(x.createdAt, from, to));
  return OPEN_STAGES.map((stage) => ({
    stage,
    count: deals.filter((x) => x.history.some((h) => h.stage === stage)).length,
  })).concat([{ stage: 'Won' as never, count: deals.filter((x) => x.stage === 'Won').length }]);
}

export function repBoard(d: DB, from: number, to: number) {
  return d.users
    .filter((u) => u.role !== 'Viewer')
    .map((u) => {
      const won = d.deals.filter((x) => x.ownerId === u.id && x.stage === 'Won' && inRange(x.closeDate, from, to));
      const open = d.deals.filter((x) => x.ownerId === u.id && isOpen(x.stage));
      return { user: u, won: sumBase(d, won), count: won.length, open: sumBase(d, open) };
    })
    .sort((a, b) => b.won - a.won);
}

export function dailySeries(d: DB, days: number, now = Date.now()) {
  const cur: number[] = Array(days).fill(0);
  const prev: number[] = Array(days).fill(0);
  for (const x of d.deals) {
    if (x.stage !== 'Won') continue;
    const age = Math.floor((now - new Date(x.closeDate).getTime()) / DAY);
    if (age < 0) continue;
    if (age < days) cur[days - 1 - age]! += dealBase(d, x);
    else if (age < days * 2) prev[days * 2 - 1 - age]! += dealBase(d, x);
  }
  return { cur, prev };
}

/** Collapses a long daily series into at most `max` buckets so lines stay readable. */
export function bucket(series: number[], max = 30) {
  if (series.length <= max) return series;
  const size = Math.ceil(series.length / max);
  const out: number[] = [];
  for (let i = 0; i < series.length; i += size) out.push(series.slice(i, i + size).reduce((s, v) => s + v, 0));
  return out;
}

export function docStatus(doc: SalesDoc, now = Date.now()) {
  if (doc.kind === 'invoice' && doc.status === 'Sent' && new Date(doc.dueDate).getTime() < now) return 'Overdue';
  return doc.status;
}

export function receivables(d: DB) {
  let outstanding = 0;
  let overdue = 0;
  let paid30 = 0;
  const now = Date.now();
  for (const doc of d.docs) {
    if (doc.kind !== 'invoice' || doc.status === 'Void' || doc.status === 'Draft') continue;
    const t = docTotals(doc);
    outstanding += toBase(d, t.balance, doc.currency);
    if (docStatus(doc) === 'Overdue') overdue += toBase(d, t.balance, doc.currency);
    for (const p of doc.payments) if (now - new Date(p.at).getTime() < 30 * DAY) paid30 += toBase(d, p.amount, doc.currency);
  }
  return { outstanding, overdue, paid30 };
}
