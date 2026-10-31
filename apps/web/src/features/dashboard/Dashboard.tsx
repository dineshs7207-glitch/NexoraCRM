import { CalendarClock, Check, Download, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCan, useScoped } from '../../data/access';
import { logAudit, saveTask } from '../../data/actions';
import { dealBase, isOpen, monthlyRevenue, pipeline, sumBase, wonBetween, winRate } from '../../data/metrics';
import { useMe, userName } from '../../data/store';
import { OPEN_STAGES, STAGE_PROBABILITY, type DB, type Task } from '../../data/types';
import { downloadText, toCsv } from '../../lib/download';
import { deltaPct, monthLabel, money, relTime } from '../../lib/format';
import { Avatar, Card, KpiTile, PageHeader, Progress, Segmented, cx, toast } from '../../ui';
import { MiniBars, MonthlyBars, Ring, Sparkline, TipRows } from '../../ui/charts';
import { useBaseMoney } from '../common';

const DAY = 86_400_000;
const STAGE_COLORS = ['var(--c-muted)', 'var(--c1)', 'var(--c3)', 'var(--c4)', 'var(--c2)'];

export function Dashboard() {
  const all = useScoped();
  const me = useMe();
  const can = useCan();
  const navigate = useNavigate();
  const fmt = useBaseMoney();
  const [scope, setScope] = useState<'team' | 'me'>('team');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const d: DB = useMemo(() => (scope === 'me' ? { ...all, deals: all.deals.filter((x) => x.ownerId === me.id), leads: all.leads.filter((l) => l.ownerId === me.id), activities: all.activities.filter((a) => a.userId === me.id) } : all), [all, scope, me.id]);
  const monthlyQuota = scope === 'me' ? me.quota : d.users.reduce((s, u) => s + u.quota, 0);

  const m = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const won = wonBetween(d, start, now.getTime());
    const wonPrev = wonBetween(d, prevStart, prevStart + (now.getTime() - start));
    const pipe = pipeline(d);
    const age = (x: { createdAt: string }) => now.getTime() - new Date(x.createdAt).getTime();
    const created30 = pipe.open.filter((x) => age(x) < 30 * DAY);
    const created60 = pipe.open.filter((x) => age(x) >= 30 * DAY && age(x) < 60 * DAY);
    const wr = winRate(d, now.getTime() - 90 * DAY, now.getTime());
    const wrPrev = winRate(d, now.getTime() - 180 * DAY, now.getTime() - 90 * DAY);
    const won90 = wonBetween(d, now.getTime() - 90 * DAY, now.getTime());
    const won180 = wonBetween(d, now.getTime() - 180 * DAY, now.getTime() - 90 * DAY);
    const avg = won90.length ? sumBase(d, won90) / won90.length : 0;
    const avgPrev = won180.length ? sumBase(d, won180) / won180.length : 0;
    const sixMonths = Array.from({ length: 6 }, (_, i) => sumBase(d, wonBetween(d, new Date(now.getFullYear(), now.getMonth() - 5 + i, 1).getTime(), new Date(now.getFullYear(), now.getMonth() - 4 + i, 1).getTime())));
    // Quarter quota: what's needed per day to land it.
    const q = Math.floor(now.getMonth() / 3);
    const qStart = new Date(now.getFullYear(), q * 3, 1);
    const qEnd = new Date(now.getFullYear(), q * 3 + 3, 1);
    const wonQ = sumBase(d, wonBetween(d, qStart.getTime(), now.getTime()));
    const quotaQ = monthlyQuota * 3;
    const daysLeft = Math.max(1, Math.ceil((qEnd.getTime() - now.getTime()) / DAY));
    return {
      wonValue: sumBase(d, won),
      wonDelta: deltaPct(sumBase(d, won), sumBase(d, wonPrev)),
      pipe,
      pipeDelta: deltaPct(sumBase(d, created30), sumBase(d, created60)),
      stageBars: OPEN_STAGES.map((s) => sumBase(d, pipe.open.filter((x) => x.stage === s))),
      wr,
      wrDelta: wr - wrPrev,
      avg,
      avgDelta: deltaPct(avg, avgPrev),
      sixMonths,
      quarter: { label: `Q${q + 1}`, won: wonQ, quota: quotaQ, daysLeft, perDay: Math.max(0, quotaQ - wonQ) / daysLeft, pct: quotaQ ? (wonQ / quotaQ) * 100 : 0 },
    };
  }, [d, monthlyQuota]);

  const months = useMemo(() => monthlyRevenue(d, year, now), [d, year]);
  const closed = months.filter((p) => p.kind !== 'forecast');
  const atTarget = closed.filter((p) => p.revenue >= monthlyQuota).length;
  const yearTotal = closed.reduce((s, p) => s + p.revenue, 0);
  const hot = [...m.pipe.open].sort((a, b) => dealBase(d, b) * STAGE_PROBABILITY[b.stage] - dealBase(d, a) * STAGE_PROBABILITY[a.stage]).slice(0, 6);

  const exportCsv = () => {
    const name = `nexora-overview-${year}-${scope}.csv`;
    downloadText(name, toCsv(months.map((p) => ({ Month: `${monthLabel(p.date)} ${year}`, Revenue: Math.round(p.revenue), Target: Math.round(monthlyQuota), 'Deals won': p.deals, Type: p.kind }))));
    logAudit('Exported overview CSV', name);
    toast(`Exported ${name}`);
  };

  return (
    <>
      <PageHeader
        title="Sales Overview"
        tabs={<Segmented options={[{ value: 'team', label: 'Team' }, { value: 'me', label: 'My numbers' }] as const} value={scope} onChange={setScope} label="Scope" />}
        sub={`${now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}, month to date`}
        actions={
          can('export') && (
            <button className="btn" onClick={exportCsv}>
              <Download size={15} /> Export
            </button>
          )
        }
      />

      <div className="kpis">
        <KpiTile hero label="Won this month" info="Closed-won value this month, compared with the same days last month." value={fmt(m.wonValue)} delta={m.wonDelta} deltaNote="vs last month" viz={<span style={{ color: 'var(--hero-ink)' }}><Sparkline data={m.sixMonths} /></span>} link={{ label: 'See growth', onClick: () => navigate('/growth') }} />
        <KpiTile label="Open pipeline" info="Total value of all open deals, converted to your base currency." value={fmt(m.pipe.value)} delta={m.pipeDelta} deltaNote="new vs prior 30d" viz={<span style={{ color: 'var(--c-main)' }}><MiniBars data={m.stageBars} /></span>} link={{ label: 'See pipeline', onClick: () => navigate('/pipeline') }} />
        <KpiTile label="Win rate" info="Won ÷ (won + lost) for deals closed in the last 90 days." value={`${m.wr.toFixed(0)}%`} delta={m.wrDelta} deltaNote="pt vs prior 90d" viz={<span style={{ color: 'var(--c-main)' }}><Ring value={m.wr} /></span>} />
        <KpiTile label="Average deal size" info="Average closed-won value, last 90 days." value={fmt(m.avg)} delta={m.avgDelta} deltaNote="vs prior 90d" />
      </div>

      <div className="grid g-1-2">
        <Card title="Revenue" sub={`${fmt(yearTotal)} won in ${year} · ${atTarget} of ${closed.length} months at target`} tools={<Segmented options={[String(now.getFullYear() - 1), String(now.getFullYear())]} value={String(year)} onChange={(v) => setYear(Number(v))} label="Year" />}>
          <MonthlyBars
            avg={monthlyQuota}
            avgLabel="target"
            fmt={(v) => fmt(v)}
            points={months.map((p) => ({
              key: p.key,
              label: monthLabel(p.date),
              value: p.revenue,
              kind: p.kind,
              tip: <TipRows title={`${monthLabel(p.date)} ${year}${p.kind === 'forecast' ? ' (forecast)' : ''}`} rows={[['Revenue', fmt(p.revenue, false)], ['Target', fmt(monthlyQuota, false)], ...(p.kind !== 'forecast' ? ([['Deals won', String(p.deals)]] as [string, string][]) : [])]} />,
            }))}
          />
          <div className="legend" style={{ marginTop: 10 }}>
            <span>
              <i style={{ background: 'repeating-linear-gradient(45deg, var(--c-muted) 0 3px, transparent 3px 6px)' }} />
              Won revenue
            </span>
            <span>
              <i style={{ background: 'var(--c-main)' }} />
              This month
            </span>
            <span>
              <i style={{ border: '1.5px dashed var(--ink-3)' }} />
              Forecast
            </span>
          </div>
        </Card>
        <Card title="Hot deals" sub="by weighted value" tools={<button className="btn sm" onClick={() => navigate('/pipeline')}>Pipeline</button>}>
          <div className="stack" style={{ gap: 4 }}>
            {hot.map((x) => {
              const owner = d.users.find((u) => u.id === x.ownerId);
              return (
                <button key={x.id} className="menu-item" onClick={() => navigate(`/pipeline/${x.id}`)}>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
                      Closes {new Date(x.closeDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <b className="ellipsis" style={{ display: 'block', fontWeight: 650 }}>
                      {x.title.split(': ')[1] ?? x.title}
                    </b>
                    <span className="muted ellipsis" style={{ display: 'block', fontSize: 12.5 }}>
                      {d.accounts.find((a) => a.id === x.accountId)?.name}
                    </span>
                  </span>
                  <span className="item-end">
                    <b className="num">{money(x.amount, x.currency, { compact: true })}</b>
                    <span className="muted" style={{ fontSize: 11.5 }}>
                      {x.stage} · {STAGE_PROBABILITY[x.stage]}%
                    </span>
                  </span>
                  {owner && <Avatar name={owner.name} hue={owner.hue} size="sm" />}
                </button>
              );
            })}
            {!hot.length && <span className="muted">No open deals.</span>}
          </div>
        </Card>
      </div>

      <div className="grid g-3 mt">
        <Card title="Team quota" sub={`${m.quarter.label} so far`}>
          <div className="row" style={{ gap: 16 }}>
            <span style={{ color: 'var(--c-main)' }}>
              <Ring value={m.quarter.pct} size={86} />
            </span>
            <div className="stack" style={{ gap: 2 }}>
              <b style={{ fontSize: 15 }}>
                {m.quarter.pct.toFixed(0)}% of {m.quarter.label} quota
              </b>
              <span className="muted" style={{ fontSize: 13 }}>
                {m.quarter.pct >= 100 ? 'Quota landed. Everything now is upside.' : `Needs ${fmt(m.quarter.perDay)} a day to land it`}
              </span>
            </div>
          </div>
          <div className="kv" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--line-2)' }}>
            <div>
              <span>Won</span>
              <b>{fmt(m.quarter.won)}</b>
            </div>
            <div>
              <span>Quota</span>
              <b>{fmt(m.quarter.quota)}</b>
            </div>
            <div>
              <span>Days left</span>
              <b>{m.quarter.daysLeft}</b>
            </div>
          </div>
        </Card>
        <StageMix d={d} />
        <Card title="Team leaderboard" sub="Won this month">
          <Leaderboard d={all} />
        </Card>
      </div>

      <div className="grid g-2 mt">
        <Today d={all} />
        <RecentActivity d={d} />
      </div>
    </>
  );
}

function StageMix({ d }: { d: DB }) {
  const fmt = useBaseMoney();
  const navigate = useNavigate();
  const open = d.deals.filter((x) => isOpen(x.stage));
  const total = sumBase(d, open) || 1;
  const rows = OPEN_STAGES.map((s, i) => {
    const deals = open.filter((x) => x.stage === s);
    const value = sumBase(d, deals);
    return { stage: s, count: deals.length, value, pct: (value / total) * 100, color: STAGE_COLORS[i]! };
  });
  return (
    <Card title="Stage mix" sub={`${fmt(total)} open across ${open.length} deals`}>
      <div style={{ display: 'flex', gap: 3, height: 12, borderRadius: 999, overflow: 'hidden', marginBottom: 14 }} aria-hidden>
        {rows.map((r) => (
          <div key={r.stage} style={{ width: `${r.pct}%`, background: r.color, transition: 'width .5s var(--ease)' }} />
        ))}
      </div>
      <div className="stack" style={{ gap: 2 }}>
        {rows.map((r) => (
          <button key={r.stage} className="menu-item" style={{ minHeight: 36, padding: '6px 8px' }} onClick={() => navigate(`/pipeline?stage=${r.stage}`)}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: r.color, flex: 'none' }} />
            <span className="grow">{r.stage}</span>
            <span className="muted num" style={{ width: 24, textAlign: 'right' }}>
              {r.count}
            </span>
            <b className="num" style={{ width: 70, textAlign: 'right' }}>
              {fmt(r.value)}
            </b>
            <span className="muted num" style={{ width: 36, textAlign: 'right' }}>
              {r.pct.toFixed(0)}%
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function Leaderboard({ d }: { d: DB }) {
  const fmt = useBaseMoney();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const rows = d.users
    .filter((u) => u.quota > 0)
    .map((u) => {
      const won = d.deals.filter((x) => x.ownerId === u.id && x.stage === 'Won' && new Date(x.closeDate).getTime() >= start);
      const value = won.reduce((s, x) => s + dealBase(d, x), 0);
      return { u, value, count: won.length, pct: (value / u.quota) * 100 };
    })
    .sort((a, b) => b.value - a.value);
  return (
    <div className="stack" style={{ gap: 14 }}>
      {rows.map((r, i) => (
        <div key={r.u.id} className="row" style={{ gap: 12 }}>
          <span className="muted num" style={{ width: 14 }}>
            {i + 1}
          </span>
          <Avatar name={r.u.name} hue={r.u.hue} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row between" style={{ gap: 8 }}>
              <b className="ellipsis" style={{ fontWeight: 650 }}>
                {r.u.name}
              </b>
              <b className="num">{fmt(r.value)}</b>
            </div>
            <div className="muted" style={{ fontSize: 12, margin: '2px 0 6px' }}>
              {r.pct.toFixed(0)}% of monthly quota · {r.count} deal{r.count === 1 ? '' : 's'}
            </div>
            <Progress value={Math.min(100, r.pct)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Today({ d }: { d: DB }) {
  const me = useMe();
  const navigate = useNavigate();
  const today = new Date().toDateString();
  const endOfToday = new Date(new Date().setHours(23, 59, 59, 999)).getTime();
  const mine = d.tasks.filter((t) => t.assigneeId === me.id).sort((a, b) => a.due.localeCompare(b.due));
  const todays = mine.filter((t) => new Date(t.due).toDateString() === today);
  const done = todays.filter((t) => t.column === 'Done').length;
  const upcoming = mine.filter((t) => t.column !== 'Done' && new Date(t.due).getTime() > endOfToday).slice(0, 3);
  const accountOf = (t: Task) => {
    if (t.related?.kind !== 'deal') return undefined;
    const deal = d.deals.find((x) => x.id === t.related!.id);
    return d.accounts.find((a) => a.id === deal?.accountId)?.name;
  };
  const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
  return (
    <Card
      title="Today"
      sub={`${done} of ${todays.length} done`}
      tools={
        <button className="btn sm" onClick={() => navigate('/tasks?new=1')}>
          <Plus size={14} /> Add
        </button>
      }
    >
      <div className="stack" style={{ gap: 4 }}>
        {todays.map((t) => {
          const isDone = t.column === 'Done';
          return (
            <div key={t.id} className="menu-item" style={{ cursor: 'default' }}>
              <button
                className={cx('check-circle', isDone && 'on')}
                aria-label={isDone ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                onClick={() => {
                  saveTask({ ...t, column: isDone ? 'To do' : 'Done' });
                  if (!isDone) toast('Nice, one down');
                }}
              >
                {isDone && <Check size={13} />}
              </button>
              <span className="grow" style={{ minWidth: 0, textDecoration: isDone ? 'line-through' : undefined, opacity: isDone ? 0.6 : 1 }}>
                <b style={{ display: 'block', fontWeight: 650 }}>{t.title}</b>
                <span className="muted ellipsis" style={{ display: 'block', fontSize: 12.5 }}>
                  {time(t.due)} · {t.kind ?? 'Task'}
                  {accountOf(t) ? ` · ${accountOf(t)}` : ''}
                </span>
              </span>
            </div>
          );
        })}
        {!todays.length && <span className="muted">Nothing due today.</span>}
      </div>
      <div className="row between" style={{ margin: '16px 0 6px' }}>
        <span className="section-label">Coming up</span>
        <button className="kpi-link" onClick={() => navigate('/schedule')}>
          Open schedule
        </button>
      </div>
      <div className="stack" style={{ gap: 2 }}>
        {upcoming.map((t) => (
          <div key={t.id} className="row" style={{ gap: 10, padding: '6px 4px', fontSize: 13 }}>
            <CalendarClock size={14} className="muted" />
            <span className="muted" style={{ width: 96, flex: 'none' }}>
              {new Date(t.due).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })} {time(t.due)}
            </span>
            <span className="grow ellipsis">{t.title}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecentActivity({ d }: { d: DB }) {
  const navigate = useNavigate();
  const items = [...d.activities].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7);
  const target = (a: (typeof items)[number]) => {
    const deal = a.related.find((r) => r.kind === 'deal');
    if (deal) return { to: `/pipeline/${deal.id}`, name: d.deals.find((x) => x.id === deal.id)?.title };
    const lead = a.related.find((r) => r.kind === 'lead');
    if (lead) return { to: `/leads/${lead.id}`, name: d.leads.find((x) => x.id === lead.id)?.company };
    const acc = a.related.find((r) => r.kind === 'account');
    return acc ? { to: `/customers/${acc.id}`, name: d.accounts.find((x) => x.id === acc.id)?.name } : null;
  };
  return (
    <Card title="Recent activity">
      <div className="stack" style={{ gap: 2 }}>
        {items.map((a) => {
          const t = target(a);
          const who = userName(d, a.userId);
          return (
            <button key={a.id} className="menu-item" disabled={!t} onClick={() => t && navigate(t.to)} style={{ alignItems: 'flex-start' }}>
              <Avatar name={who} hue={d.users.find((u) => u.id === a.userId)?.hue} size="sm" />
              <span className="grow" style={{ minWidth: 0 }}>
                <span style={{ display: 'block' }}>
                  <b style={{ fontWeight: 650 }}>{who.split(' ')[0]}</b> <span className="muted">·</span> {a.title}
                </span>
                {t?.name && (
                  <span className="muted ellipsis" style={{ display: 'block', fontSize: 12.5 }}>
                    {t.name}
                  </span>
                )}
              </span>
              <span className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
                {relTime(a.at)}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
