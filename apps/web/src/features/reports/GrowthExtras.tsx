import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { activityHeatmap, activitySlot, BANDS, countBy, dealBase, heatmapActivities } from '../../data/metrics';
import type { DB } from '../../data/types';
import { monthLabel, relTime } from '../../lib/format';
import { Avatar, Card, Sheet } from '../../ui';
import { Donut, Heatmap, HighlightBars, LegendList, Sparkline } from '../../ui/charts';
import { useBaseMoney } from '../common';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];

/** First day of each of the last `n` months, oldest first. */
function lastMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (n - 1) + i, 1));
}

export function ActivityByTime({ d }: { d: DB }) {
  const [cell, setCell] = useState<[number, number] | null>(null);
  const grid = useMemo(() => activityHeatmap(d), [d]);
  return (
    <Card title="Sales activity by time" info="Calls, emails, meetings and notes logged in the last 60 days. Click a cell to see them." sub="Last 60 days">
      <Heatmap grid={grid} rows={DAYS} cols={BANDS} unit="Activities" onCell={(r, c) => setCell([r, c])} />
      {cell && <SlotSheet d={d} cell={cell} onClose={() => setCell(null)} />}
    </Card>
  );
}

function SlotSheet({ d, cell, onClose }: { d: DB; cell: [number, number]; onClose: () => void }) {
  const navigate = useNavigate();
  const items = heatmapActivities(d)
    .filter((a) => {
      const [r, c] = activitySlot(a.at);
      return r === cell[0] && c === cell[1];
    })
    .sort((a, b) => b.at.localeCompare(a.at));
  const target = (a: (typeof items)[number]) => {
    const deal = a.related.find((r) => r.kind === 'deal');
    if (deal) return { to: `/pipeline/${deal.id}`, name: d.deals.find((x) => x.id === deal.id)?.title };
    const lead = a.related.find((r) => r.kind === 'lead');
    if (lead) {
      const l = d.leads.find((x) => x.id === lead.id);
      return { to: `/leads/${lead.id}`, name: l && `${l.name}, ${l.company}` };
    }
    const acc = a.related.find((r) => r.kind === 'account');
    return acc ? { to: `/customers/${acc.id}`, name: d.accounts.find((x) => x.id === acc.id)?.name } : null;
  };
  return (
    <Sheet title={`${DAY_NAMES[cell[0]]}, ${BANDS[cell[1]]!.toLowerCase()}`} sub={`${items.length} activities in the last 60 days`} onClose={onClose}>
      <div className="stack" style={{ gap: 4 }}>
        {items.map((a) => {
          const t = target(a);
          return (
            <button key={a.id} className="menu-item" disabled={!t} onClick={() => t && navigate(t.to)}>
              <span className="grow" style={{ minWidth: 0 }}>
                <b style={{ fontWeight: 650, display: 'block' }}>{a.title}</b>
                <span className="muted ellipsis" style={{ display: 'block', fontSize: 12.5 }}>
                  {t?.name ?? '—'}
                </span>
              </span>
              <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                {relTime(a.at)}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export function LeadSources({ d }: { d: DB }) {
  const items = useMemo(() => {
    const rows = countBy([...d.leads.map((l) => l.source), ...d.deals.map((x) => x.source)], (s) => s);
    const colors = ['var(--c1)', 'var(--c2)', 'var(--c3)'];
    const top = rows.slice(0, 3).map(([label, value], i) => ({ label, value, color: colors[i]! }));
    const other = rows.slice(3).reduce((s, [, v]) => s + v, 0);
    return other ? [...top, { label: 'Other', value: other, color: 'var(--c-other)' }] : top;
  }, [d]);
  return (
    <Card title="Lead sources" info="Where leads and deals came from." sub={`${d.leads.length + d.deals.length} records`}>
      <div className="row wrap" style={{ gap: 26 }}>
        <Donut
          items={items}
          center={
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{items[0]?.label}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                top source
              </div>
            </div>
          }
        />
        <LegendList items={items} />
      </div>
    </Card>
  );
}

/** An account becomes a customer on its first won deal. */
export function NewCustomers({ d }: { d: DB }) {
  const months = lastMonths(6);
  const firstWin = new Map<string, number>();
  for (const x of d.deals) {
    if (x.stage !== 'Won') continue;
    const t = new Date(x.closeDate).getTime();
    if (!firstWin.has(x.accountId) || t < firstWin.get(x.accountId)!) firstWin.set(x.accountId, t);
  }
  const data = months.map((m, i) => {
    const end = i < months.length - 1 ? months[i + 1]!.getTime() : Date.now() + 1;
    return { label: monthLabel(m), value: [...firstWin.values()].filter((t) => t >= m.getTime() && t < end).length };
  });
  const total = data.reduce((s, x) => s + x.value, 0);
  return (
    <Card title="New customers per month" sub={`${total} joined in the last 6 months`}>
      <HighlightBars data={data} fmt={(v) => `${v} new`} />
    </Card>
  );
}

export function WinRateTrend({ d }: { d: DB }) {
  const months = lastMonths(6);
  const data = months.map((m, i) => {
    const end = i < months.length - 1 ? months[i + 1]!.getTime() : Date.now() + 1;
    const closed = d.deals.filter((x) => (x.stage === 'Won' || x.stage === 'Lost') && new Date(x.closeDate).getTime() >= m.getTime() && new Date(x.closeDate).getTime() < end);
    const won = closed.filter((x) => x.stage === 'Won').length;
    return { label: monthLabel(m), value: closed.length ? Math.round((won / closed.length) * 100) : 0, won, closed: closed.length };
  });
  const won = data.reduce((s, x) => s + x.won, 0);
  const closed = data.reduce((s, x) => s + x.closed, 0);
  return (
    <Card title="Win rate trend" sub={`${closed ? Math.round((won / closed) * 100) : 0}% · ${won} won of ${closed} closed, last 6 months`}>
      <HighlightBars data={data} fmt={(v) => `${v}%`} />
    </Card>
  );
}

export function TopCustomers({ d }: { d: DB }) {
  const fmt = useBaseMoney();
  const navigate = useNavigate();
  const months = lastMonths(6);
  const since = months[0]!.getTime();
  const rows = d.accounts
    .map((a) => {
      const won = d.deals.filter((x) => x.accountId === a.id && x.stage === 'Won' && new Date(x.closeDate).getTime() >= since);
      const trend = months.map((m, i) => {
        const end = i < months.length - 1 ? months[i + 1]!.getTime() : Date.now() + 1;
        return won.filter((x) => new Date(x.closeDate).getTime() >= m.getTime() && new Date(x.closeDate).getTime() < end).reduce((s, x) => s + dealBase(d, x), 0);
      });
      return { a, deals: won.length, revenue: won.reduce((s, x) => s + dealBase(d, x), 0), trend };
    })
    .filter((r) => r.revenue > 0)
    .sort((x, y) => y.revenue - x.revenue)
    .slice(0, 6);
  return (
    <Card title="Top customers by revenue won" sub="Last 6 months">
      <div className="stack" style={{ gap: 2 }}>
        {rows.map((r, i) => (
          <button key={r.a.id} className="menu-item" onClick={() => navigate(`/customers/${r.a.id}`)}>
            <span className="muted num" style={{ width: 14 }}>
              {i + 1}
            </span>
            <Avatar name={r.a.name} size="sm" />
            <span className="grow" style={{ minWidth: 0 }}>
              <b className="ellipsis" style={{ display: 'block', fontWeight: 650 }}>
                {r.a.name}
              </b>
              <span className="muted" style={{ fontSize: 12 }}>
                {r.a.industry} · {r.deals} deal{r.deals === 1 ? '' : 's'}
              </span>
            </span>
            <span className="hide-sm" style={{ color: 'var(--c-main)' }}>
              <Sparkline data={r.trend} w={64} h={24} />
            </span>
            <b className="num">{fmt(r.revenue)}</b>
          </button>
        ))}
        {!rows.length && <span className="muted">No wins in the last 6 months.</span>}
      </div>
    </Card>
  );
}
