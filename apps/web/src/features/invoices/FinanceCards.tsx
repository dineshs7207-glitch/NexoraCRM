import { useState } from 'react';
import { docStatus, toBase } from '../../data/metrics';
import { docTotals } from '../../data/seed';
import type { DB } from '../../data/types';
import { monthLabel } from '../../lib/format';
import { Card, Segmented } from '../../ui';
import { useBaseMoney } from '../common';

const DAY = 86_400_000;

/** Invoiced vs collected per month, in base currency. */
export function CashFlow({ d }: { d: DB }) {
  const fmt = useBaseMoney();
  const [range, setRange] = useState<'6M' | '12M'>('6M');
  const n = range === '6M' ? 6 : 12;
  const now = new Date();
  const months = Array.from({ length: n }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (n - 1) + i, 1));
  const rows = months.map((m, i) => {
    const end = i < n - 1 ? months[i + 1]!.getTime() : Date.now() + 1;
    let invoiced = 0;
    let collected = 0;
    for (const doc of d.docs) {
      if (doc.kind !== 'invoice' || doc.status === 'Void' || doc.status === 'Draft') continue;
      const issued = new Date(doc.issueDate).getTime();
      if (issued >= m.getTime() && issued < end) invoiced += toBase(d, docTotals(doc).total, doc.currency);
      for (const p of doc.payments) {
        const t = new Date(p.at).getTime();
        if (t >= m.getTime() && t < end) collected += toBase(d, p.amount, doc.currency);
      }
    }
    return { m, invoiced, collected };
  });
  const max = Math.max(...rows.flatMap((r) => [r.invoiced, r.collected]), 1);
  const totalC = rows.reduce((s, r) => s + r.collected, 0);
  const totalI = rows.reduce((s, r) => s + r.invoiced, 0);
  return (
    <Card title="Cash flow" sub={`${fmt(totalC)} collected · ${totalI ? Math.round((totalC / totalI) * 100) : 0}% of ${fmt(totalI)} invoiced`} tools={<Segmented options={['6M', '12M'] as const} value={range} onChange={setRange} label="Range" />}>
      <div className="cashflow" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {rows.map((r) => (
          <div key={r.m.toISOString()} className="cf-col" title={`${monthLabel(r.m)}: invoiced ${fmt(r.invoiced, false)}, collected ${fmt(r.collected, false)}`}>
            <div className="cf-bars">
              <i style={{ height: `${(r.invoiced / max) * 100}%` }} className="cf-inv" />
              <i style={{ height: `${(r.collected / max) * 100}%` }} className="cf-col-bar" />
            </div>
            <span className="muted">{n > 6 ? monthLabel(r.m).slice(0, 1) : monthLabel(r.m)}</span>
          </div>
        ))}
      </div>
      <div className="legend" style={{ marginTop: 12 }}>
        <span>
          <i style={{ background: 'var(--c-main)' }} />
          Collected
        </span>
        <span>
          <i style={{ background: 'var(--c-muted)' }} />
          Invoiced
        </span>
      </div>
    </Card>
  );
}

const BUCKETS = [
  { label: '0–30 days', max: 30 },
  { label: '31–60 days', max: 60 },
  { label: '61–90 days', max: 90 },
  { label: '90+ days', max: Infinity },
];

/** Unpaid invoices grouped by age since issue. */
export function Aging({ d, onPick }: { d: DB; onPick: () => void }) {
  const fmt = useBaseMoney();
  const now = Date.now();
  const unpaid = d.docs.filter((x) => x.kind === 'invoice' && (x.status === 'Sent' || docStatus(x) === 'Overdue'));
  const rows = BUCKETS.map((b, i) => {
    const min = i ? BUCKETS[i - 1]!.max : -1;
    const docs = unpaid.filter((x) => {
      const age = (now - new Date(x.issueDate).getTime()) / DAY;
      return age > min && age <= b.max;
    });
    return { ...b, count: docs.length, value: docs.reduce((s, x) => s + toBase(d, docTotals(x).balance, x.currency), 0) };
  });
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const tones = ['var(--up)', 'var(--warn)', 'var(--c2)', 'var(--down)'];
  return (
    <Card title="Aging" sub="Unpaid invoices by age since issue">
      <div style={{ display: 'flex', gap: 3, height: 12, borderRadius: 999, overflow: 'hidden', marginBottom: 14 }} aria-hidden>
        {rows.map((r, i) => (
          <div key={r.label} style={{ width: `${(r.value / total) * 100}%`, background: tones[i] }} />
        ))}
      </div>
      <div className="stack" style={{ gap: 2 }}>
        {rows.map((r, i) => (
          <button key={r.label} className="menu-item" style={{ minHeight: 38 }} onClick={onPick}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: tones[i], flex: 'none' }} />
            <span className="grow">{r.label}</span>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {r.count} invoice{r.count === 1 ? '' : 's'}
            </span>
            <b className="num" style={{ minWidth: 70, textAlign: 'right' }}>
              {fmt(r.value)}
            </b>
          </button>
        ))}
      </div>
    </Card>
  );
}
