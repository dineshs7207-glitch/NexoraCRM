import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCan, useScoped } from '../../data/access';
import { logAudit } from '../../data/actions';
import { bucket, countBy, dailySeries, dealBase, isOpen, periodBounds, repBoard, stageFunnel, sumBase, wonBetween, winRate } from '../../data/metrics';
import { OPEN_STAGES, type DB } from '../../data/types';
import { downloadText, toCsv } from '../../lib/download';
import { deltaPct, isoDay } from '../../lib/format';
import { Avatar, Card, KpiTile, PageHeader, Segmented, Switch, toast } from '../../ui';
import { AreaCompare, Donut, Funnel, HighlightBars, LegendList, Sparkline, SplitBar } from '../../ui/charts';
import { useBaseMoney } from '../common';
import { ActivityByTime, LeadSources, NewCustomers, TopCustomers, WinRateTrend } from './GrowthExtras';

const RANGES = { '7D': 7, '30D': 30, '90D': 90, '12M': 365 } as const;
type Range = keyof typeof RANGES;
const DAY = 86_400_000;

export function Reports() {
  const all = useScoped();
  const can = useCan();
  const fmt = useBaseMoney();
  const [range, setRange] = useState<Range>('90D');
  const [owner, setOwner] = useState('all');
  const [compare, setCompare] = useState(true);
  const [when, setWhen] = useState<'weekday' | 'month'>('weekday');
  const days = RANGES[range];

  const d: DB = useMemo(() => (owner === 'all' ? all : { ...all, deals: all.deals.filter((x) => x.ownerId === owner), leads: all.leads.filter((l) => l.ownerId === owner) }), [all, owner]);

  const r = useMemo(() => {
    const { from, to, prevFrom, prevTo } = periodBounds(days);
    const won = wonBetween(d, from, to);
    const wonPrev = wonBetween(d, prevFrom, prevTo);
    const lost = d.deals.filter((x) => x.stage === 'Lost' && new Date(x.closeDate).getTime() >= from);
    const leads = d.leads.filter((l) => new Date(l.createdAt).getTime() >= from).length;
    const leadsPrev = d.leads.filter((l) => {
      const t = new Date(l.createdAt).getTime();
      return t >= prevFrom && t < prevTo;
    }).length;
    const series = dailySeries(d, days);
    const size = Math.ceil(days / 30);
    const cur = bucket(series.cur);
    const prev = bucket(series.prev);
    const labels = cur.map((_, i) => new Date(from + i * size * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
    const value = sumBase(d, won);
    const valuePrev = sumBase(d, wonPrev);
    const avg = won.length ? value / won.length : 0;
    const avgPrev = wonPrev.length ? valuePrev / wonPrev.length : 0;
    const wr = winRate(d, from, to);
    const wrPrev = winRate(d, prevFrom, prevTo);
    const newBiz = won.filter((x) => !/renewal|expansion/i.test(x.title));
    const expansion = won.filter((x) => /renewal|expansion/i.test(x.title));
    const sources = countBy(won, (x) => x.source).map(([label]) => ({ label, value: sumBase(d, won.filter((x) => x.source === label)) })).sort((a, b) => b.value - a.value);
    const lostReasons = countBy(lost, (x) => x.lostReason ?? 'Not recorded');
    const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({ label, value: won.filter((x) => (new Date(x.closeDate).getDay() + 6) % 7 === i).length }));
    const monthPart = ['1–7', '8–14', '15–21', '22–31'].map((label, i) => ({ label, value: won.filter((x) => Math.min(3, Math.floor((new Date(x.closeDate).getDate() - 1) / 7)) === i).length }));
    return {
      won,
      value,
      valueDelta: deltaPct(value, valuePrev),
      countDelta: deltaPct(won.length, wonPrev.length),
      avg,
      avgDelta: deltaPct(avg, avgPrev),
      wr,
      wrDelta: wr - wrPrev,
      leads,
      leadsDelta: deltaPct(leads, leadsPrev),
      cur,
      prev,
      labels,
      newBiz: sumBase(d, newBiz),
      newBizPrev: sumBase(d, wonPrev.filter((x) => !/renewal|expansion/i.test(x.title))),
      expansion: sumBase(d, expansion),
      expansionPrev: sumBase(d, wonPrev.filter((x) => /renewal|expansion/i.test(x.title))),
      funnel: stageFunnel(d, from, to),
      sources,
      reps: repBoard(all, from, to),
      lostReasons,
      weekday,
      monthPart,
      from,
    };
  }, [d, all, days]);

  const colors = ['var(--c1)', 'var(--c2)', 'var(--c3)'];
  const sourceItems = [...r.sources.slice(0, 3).map((s, i) => ({ ...s, color: colors[i]! })), ...(r.sources.length > 3 ? [{ label: 'Other', value: r.sources.slice(3).reduce((s, x) => s + x.value, 0), color: 'var(--c-other)' }] : [])];
  const pipelineByStage = OPEN_STAGES.map((s) => ({ label: s, value: sumBase(d, d.deals.filter((x) => x.stage === s)) }));
  const nbDelta = deltaPct(r.newBiz, r.newBizPrev);
  const exDelta = deltaPct(r.expansion, r.expansionPrev);
  const insight = r.newBiz + r.expansion === 0 ? 'No revenue closed in this period yet.' : nbDelta >= exDelta ? `New business grew faster this period: ${nbDelta >= 0 ? '+' : ''}${nbDelta.toFixed(1)}% against ${exDelta >= 0 ? '+' : ''}${exDelta.toFixed(1)}% for renewals and expansion.` : `Renewals and expansion grew faster: ${exDelta >= 0 ? '+' : ''}${exDelta.toFixed(1)}% against ${nbDelta >= 0 ? '+' : ''}${nbDelta.toFixed(1)}% for new business.`;
  const maxRep = Math.max(...r.reps.map((x) => x.won), 1);
  const ownerName = owner === 'all' ? 'all' : all.users.find((u) => u.id === owner)?.name.split(' ')[0]!.toLowerCase();

  const exportCsv = () => {
    const name = `nexora-report-${range.toLowerCase()}-${ownerName}.csv`;
    const rows = r.cur.map((v, i) => ({ Period: r.labels[i], Revenue: Math.round(v), 'Previous period revenue': Math.round(r.prev[i] ?? 0), Change: r.prev[i] ? `${deltaPct(v, r.prev[i]!).toFixed(1)}%` : '' }));
    downloadText(name, toCsv(rows));
    logAudit('Exported report CSV', name);
    toast(`Exported ${name}`);
  };

  return (
    <>
      <PageHeader
        title="Growth Reports"
        sub={`Since ${isoDay(new Date(r.from))}`}
        actions={
          <>
            <Segmented options={Object.keys(RANGES) as Range[]} value={range} onChange={setRange} label="Range" />
            <select className="select sm" style={{ width: 170 }} value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
              <option value="all">Whole team</option>
              {all.users
                .filter((u) => u.quota > 0)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
            <label className="row" style={{ gap: 8, fontSize: 13, fontWeight: 600 }}>
              <Switch checked={compare} onChange={setCompare} label="Compare with previous period" /> vs previous
            </label>
            {can('export') && (
              <button className="btn" onClick={exportCsv}>
                <Download size={15} /> Export CSV
              </button>
            )}
          </>
        }
      />
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <KpiTile hero label="Revenue won" value={fmt(r.value)} delta={compare ? r.valueDelta : undefined} deltaNote="vs previous" viz={<span style={{ color: 'var(--hero-ink)' }}><Sparkline data={r.cur} w={70} /></span>} />
        <KpiTile label="Deals won" value={r.won.length} delta={compare ? r.countDelta : undefined} deltaNote="vs previous" />
        <KpiTile label="Average deal size" value={fmt(r.avg)} delta={compare ? r.avgDelta : undefined} deltaNote="vs previous" />
        <KpiTile label="Win rate" value={`${r.wr.toFixed(1)}%`} delta={compare ? r.wrDelta : undefined} deltaNote="pt vs previous" />
        <KpiTile label="New leads" value={r.leads} delta={compare ? r.leadsDelta : undefined} deltaNote="vs previous" />
      </div>

      <div className="grid g-1-2">
        <Card title="Revenue over time" sub={compare ? 'Solid: this period · dashed: previous period' : 'Closed-won revenue'}>
          <AreaCompare cur={r.cur} prev={compare ? r.prev : r.cur.map(() => 0)} labels={r.labels} fmt={(v) => fmt(v)} />
        </Card>
        <Card title="New business vs renewals" info="Deals whose name mentions renewal or expansion count as existing-customer revenue.">
          <div className="stack" style={{ gap: 16 }}>
            <SplitBar parts={[{ label: 'New business', value: r.newBiz, color: 'var(--c-main)' }, { label: 'Renewals & expansion', value: r.expansion, color: 'var(--c-muted)' }]} />
            {[
              ['New business', r.newBiz, nbDelta, 'var(--c-main)'],
              ['Renewals & expansion', r.expansion, exDelta, 'var(--c-muted)'],
            ].map(([label, value, delta, color]) => (
              <div key={label as string} className="row between">
                <span className="row" style={{ gap: 8 }}>
                  <i style={{ width: 10, height: 10, borderRadius: 3, background: color as string, display: 'inline-block' }} />
                  {label}
                </span>
                <span className="num">
                  <b>{fmt(value as number)}</b> {compare && <span className={`delta ${(delta as number) >= 0 ? 'up' : 'down'}`}>{(delta as number) >= 0 ? '+' : ''}{(delta as number).toFixed(1)}%</span>}
                </span>
              </div>
            ))}
            <div className="box ink-2" style={{ fontSize: 13 }}>
              {insight}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid g-2 mt">
        <Card title="Sales funnel" info="Deals created in the period and how far they got. The biggest drop between steps is highlighted.">
          <Funnel steps={r.funnel.map((f) => ({ label: f.stage, count: f.count }))} />
        </Card>
        <Card title="Revenue by source" sub="Won deals in the period">
          {sourceItems.length ? (
            <div className="row wrap" style={{ gap: 26 }}>
              <Donut items={sourceItems} center={<div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(r.value)}</div><div className="muted" style={{ fontSize: 12 }}>won</div></div>} />
              <LegendList items={sourceItems} fmt={(v) => fmt(v)} />
            </div>
          ) : (
            <div className="muted">No wins in this period.</div>
          )}
        </Card>
      </div>

      <div className="grid g-1-2 mt">
        <Card title="Rep leaderboard" sub="Won in period · open pipeline">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Rep</th>
                  <th className="r">Deals</th>
                  <th style={{ width: '38%' }}>Won</th>
                  <th className="r">Open pipeline</th>
                </tr>
              </thead>
              <tbody>
                {r.reps.map((x, i) => (
                  <tr key={x.user.id}>
                    <td className="muted">{i + 1}</td>
                    <td>
                      <div className="cell-main">
                        <Avatar name={x.user.name} hue={x.user.hue} size="sm" />
                        <b>{x.user.name}</b>
                      </div>
                    </td>
                    <td className="r num">{x.count}</td>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <div className="grow" style={{ height: 8, background: 'var(--well)', borderRadius: 8 }}>
                          <div style={{ width: `${(x.won / maxRep) * 100}%`, height: '100%', borderRadius: 8, background: 'var(--c-main)' }} />
                        </div>
                        <b className="num" style={{ width: 70, textAlign: 'right' }}>
                          {fmt(x.won)}
                        </b>
                      </div>
                    </td>
                    <td className="r num">{fmt(x.open)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="When deals close" tools={<Segmented options={[{ value: 'weekday', label: 'Weekday' }, { value: 'month', label: 'Day of month' }] as const} value={when} onChange={setWhen} label="Grouping" />}>
          <HighlightBars data={when === 'weekday' ? r.weekday : r.monthPart} fmt={(v) => `${v} deals`} />
          <div className="row between muted" style={{ fontSize: 12.5, marginTop: 10 }}>
            {when === 'weekday' ? (
              <>
                <span>Weekdays {pct(r.weekday.slice(0, 5), r.weekday)}</span>
                <span>Weekend {pct(r.weekday.slice(5), r.weekday)}</span>
              </>
            ) : (
              <>
                <span>Last week of month {pct(r.monthPart.slice(3), r.monthPart)}</span>
                <span>{r.won.length} deals</span>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="grid g-2 mt">
        <Card title="Open pipeline by stage">
          <HighlightBars data={pipelineByStage} fmt={(v) => fmt(v)} />
        </Card>
        <Card title="Why deals are lost" sub={`${r.lostReasons.reduce((s, [, v]) => s + v, 0)} lost in period`}>
          <div className="stack" style={{ gap: 10 }}>
            {r.lostReasons.map(([reason, n]) => (
              <div key={reason} className="row" style={{ gap: 12 }}>
                <span style={{ width: 140 }}>{reason}</span>
                <div className="grow" style={{ height: 10, background: 'var(--well)', borderRadius: 8 }}>
                  <div style={{ width: `${(n / Math.max(...r.lostReasons.map(([, v]) => v))) * 100}%`, height: '100%', borderRadius: 8, background: 'var(--down)', opacity: 0.75 }} />
                </div>
                <b className="num" style={{ width: 24, textAlign: 'right' }}>
                  {n}
                </b>
              </div>
            ))}
            {!r.lostReasons.length && <span className="muted">No lost deals in this period.</span>}
          </div>
        </Card>
      </div>
      <div className="grid g-2 mt">
        <NewCustomers d={d} />
        <WinRateTrend d={d} />
      </div>
      <div className="grid g-2 mt">
        <TopCustomers d={d} />
        <LeadSources d={d} />
      </div>
      <div className="grid mt">
        <ActivityByTime d={d} />
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 18 }}>
        All amounts converted to {d.company.baseCurrency} using the rates in Settings → Company. Open deals: {d.deals.filter((x) => isOpen(x.stage)).length}, valued at {fmt(d.deals.filter((x) => isOpen(x.stage)).reduce((s, x) => s + dealBase(d, x), 0))}.
      </p>
    </>
  );
}

function pct(part: { value: number }[], whole: { value: number }[]) {
  const t = whole.reduce((s, x) => s + x.value, 0);
  return t ? `${Math.round((part.reduce((s, x) => s + x.value, 0) / t) * 100)}%` : '—';
}
