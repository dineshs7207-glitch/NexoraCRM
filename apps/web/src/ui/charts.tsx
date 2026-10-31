import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** Tracks an element's width so charts draw at real pixel size (crisp text, no scaling). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e!.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type Tip = { x: number; y: number; content: ReactNode } | null;
function TipBox({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  );
}
export function TipRows({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <>
      <b>{title}</b>
      {rows.map(([k, v]) => (
        <div className="tip-row" key={k}>
          <span>{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/* ---------- Micro visuals for KPI tiles ---------- */
export function Sparkline({ data, w = 96, h = 36 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * (w - 6) + 3, h - 4 - ((v - min) / (max - min || 1)) * (h - 8)] as const);
  const last = pts.at(-1)!;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="chart" style={{ maxWidth: "100%", height: "auto" }} aria-hidden>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
      <circle cx={last[0]} cy={last[1]} r={3} fill="currentColor" />
    </svg>
  );
}

export function MiniBars({ data, w = 70, h = 38 }: { data: number[]; w?: number; h?: number }) {
  const max = Math.max(...data, 1);
  const bw = (w - (data.length - 1) * 4) / data.length;
  return (
    <svg width={w} height={h} className="chart" aria-hidden>
      {data.map((v, i) => {
        const bh = Math.max(3, (v / max) * h);
        return <rect key={i} x={i * (bw + 4)} y={h - bh} width={bw} height={bh} rx={4} fill="currentColor" opacity={i === data.length - 1 ? 1 : 0.35} />;
      })}
    </svg>
  );
}

export function Ring({ value, size = 52 }: { value: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} className="chart" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" style={{ fill: 'currentColor', fontWeight: 700, fontSize: Math.round(size * 0.22) }}>
        {Math.round(v)}%
      </text>
    </svg>
  );
}

/* ---------- Semicircle gauge ---------- */
export function Gauge({ value, max = 100, label }: { value: number; max?: number; label: ReactNode }) {
  const w = 280;
  const h = 160;
  const cx = w / 2;
  const cy = 146;
  const r = 112;
  const p = Math.max(0, Math.min(1, value / max));
  const polar = (t: number, rr = r) => [cx - rr * Math.cos(Math.PI * t), cy - rr * Math.sin(Math.PI * t)] as const;
  const [ex, ey] = polar(p);
  const gid = useId();
  return (
    <div style={{ position: 'relative', maxWidth: w, margin: '0 auto' }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="chart" style={{ width: "100%", height: "auto" }} role="img" aria-label={`${Math.round(value)} out of ${max}`}>
        <defs>
          <linearGradient id={gid} x1="0" x2="1">
            <stop offset="0" stopColor="var(--c-main)" stopOpacity={0.35} />
            <stop offset="1" stopColor="var(--c-main)" />
          </linearGradient>
        </defs>
        {Array.from({ length: 41 }, (_, i) => {
          const t = i / 40;
          const [x1, y1] = polar(t, r + 12);
          const [x2, y2] = polar(t, r + (i % 5 === 0 ? 20 : 16));
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-2)" strokeWidth={1.5} strokeLinecap="round" />;
        })}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--well)" strokeWidth={16} strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex} ${ey}`} fill="none" stroke={`url(#${gid})`} strokeWidth={16} strokeLinecap="round" />
        <circle cx={ex} cy={ey} r={11} fill="var(--float)" stroke="var(--c-main)" strokeWidth={3} />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 4, textAlign: 'center' }}>{label}</div>
    </div>
  );
}

/* ---------- Monthly bars: hatched past, solid current, dashed forecast ---------- */
export interface BarPoint {
  key: string;
  label: string;
  value: number;
  kind: 'past' | 'current' | 'forecast';
  tip: ReactNode;
}
export function MonthlyBars({ points, avg, avgLabel = "avg", fmt, height = 250 }: { points: BarPoint[]; avg?: number; avgLabel?: string; fmt: (v: number) => string; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const pid = useId().replace(/:/g, '');
  const padL = 46;
  const padB = 26;
  const top = 18;
  const max = niceMax(Math.max(...points.map((p) => p.value), avg ?? 0) * 1.08);
  const innerW = Math.max(0, w - padL);
  const slot = innerW / points.length;
  const bw = Math.max(8, Math.min(44, slot * 0.62));
  const y = (v: number) => top + (1 - v / max) * (height - top - padB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  return (
    <div ref={ref} style={{ position: 'relative' }} onMouseLeave={() => setTip(null)}>
      {w > 0 && (
        <svg width={w} height={height} className="chart" role="img" aria-label="Monthly revenue bar chart">
          <defs>
            <pattern id={`h${pid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--c-muted)" opacity={0.5} />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--c-main)" strokeOpacity={0.35} strokeWidth={2} />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={w} y1={y(t)} y2={y(t)} stroke="var(--c-grid)" />
              <text x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="central">
                {fmt(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = padL + i * slot + (slot - bw) / 2;
            const yy = y(p.value);
            const hh = Math.max(p.value > 0 ? 4 : 0, height - padB - yy);
            const common = { x, y: height - padB - hh, width: bw, height: hh, rx: 8 };
            return (
              <g key={p.key} onMouseEnter={() => setTip({ x: x + bw / 2, y: Math.min(yy, height - padB - 4), content: p.tip })} onClick={() => setTip({ x: x + bw / 2, y: Math.min(yy, height - padB - 4), content: p.tip })}>
                <rect x={padL + i * slot} y={top} width={slot} height={height - top - padB} fill="transparent" />
                {p.kind === 'past' && <rect {...common} fill={`url(#h${pid})`} />}
                {p.kind === 'current' && <rect {...common} fill="var(--c-main)" />}
                {p.kind === 'forecast' && <rect {...common} fill="none" stroke="var(--ink-3)" strokeDasharray="4 4" strokeWidth={1.5} />}
                {/* On narrow charts use initials so month labels never run together. */}
                <text x={x + bw / 2} y={height - 8} textAnchor="middle" style={p.kind === 'current' ? { fill: 'var(--ink)', fontWeight: 700 } : undefined}>
                  {slot < 34 ? p.label.slice(0, 1) : p.label}
                </text>
              </g>
            );
          })}
          {avg != null && avg > 0 && (
            <g pointerEvents="none">
              <line x1={padL} x2={w} y1={y(avg)} y2={y(avg)} stroke="var(--ink-2)" strokeDasharray="2 5" strokeWidth={1.5} strokeLinecap="round" />
              <rect x={w - 92} y={y(avg) - 32} width={90} height={22} rx={11} fill="var(--float)" stroke="var(--line-2)" />
              <text x={w - 47} y={y(avg) - 21} textAnchor="middle" dominantBaseline="central" style={{ fill: 'var(--ink)', fontWeight: 600 }}>
                {avgLabel} {fmt(avg)}
              </text>
            </g>
          )}
        </svg>
      )}
      <TipBox tip={tip} />
    </div>
  );
}

/* ---------- Donut ---------- */
export function Donut({ items, center, size = 180 }: { items: { label: string; value: number; color: string }[]; center: ReactNode; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const gap = items.length > 1 ? 4 : 0;
  let acc = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} className="chart" role="img" aria-label="Donut chart">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--well)" strokeWidth={22} />
        {items.map((it, i) => {
          const len = (it.value / total) * c;
          const el = (
            <circle
              key={it.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={it.color}
              strokeWidth={hover === i ? 26 : 22}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-width .2s' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${it.label}: ${it.value} (${Math.round((it.value / total) * 100)}%)`}</title>
            </circle>
          );
          acc += len;
          return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
        {hover != null ? (
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{Math.round((items[hover]!.value / total) * 100)}%</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {items[hover]!.label}
            </div>
          </div>
        ) : (
          center
        )}
      </div>
    </div>
  );
}

export function LegendList({ items, fmt }: { items: { label: string; value: number; color: string }[]; fmt?: (v: number) => string }) {
  const total = items.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="stack" style={{ gap: 9, flex: 1, minWidth: 140 }}>
      {items.map((it) => (
        <div key={it.label} className="row between" style={{ fontSize: 13 }}>
          <span className="row" style={{ gap: 8 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: it.color, display: 'inline-block' }} />
            {it.label}
          </span>
          <span className="num">
            <b>{fmt ? fmt(it.value) : it.value}</b> <span className="muted">{Math.round((it.value / total) * 100)}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Heatmap ---------- */
export function Heatmap({ grid, rows, cols, unit, onCell }: { grid: number[][]; rows: string[]; cols: readonly string[]; unit: string; onCell?: (row: number, col: number) => void }) {
  const [tip, setTip] = useState<Tip>(null);
  const max = Math.max(...grid.flat(), 1);
  const step = (v: number) => (v === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setTip(null)}>
      <div className="heatmap" style={{ gridTemplateColumns: `minmax(56px, 80px) repeat(${rows.length}, minmax(0,1fr))` }}>
        {cols.map((col, ci) => (
          <Fragment key={col}>
            <span className="muted heat-label">{col}</span>
            {rows.map((r, ri) => {
              const v = grid[ri]![ci]!;
              return (
                <button
                  key={r}
                  type="button"
                  className="heat-cell"
                  style={{ background: `var(--heat-${step(v)})` }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    const box = el.parentElement!.parentElement!.getBoundingClientRect();
                    const rr = el.getBoundingClientRect();
                    setTip({ x: rr.left - box.left + rr.width / 2, y: rr.top - box.top, content: <TipRows title={`${r} · ${col}`} rows={[[unit, String(v)], ...(onCell && v ? ([['', 'Click to see them']] as [string, string][]) : [])]} /> });
                  }}
                  onClick={() => onCell?.(ri, ci)}
                  disabled={!onCell || !v}
                  aria-label={`${r} ${col}: ${v} ${unit}`}
                />
              );
            })}
          </Fragment>
        ))}
        <span />
        {rows.map((r) => (
          <span key={r} className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
            {r}
          </span>
        ))}
      </div>
      <div className="row" style={{ gap: 6, marginTop: 14, justifyContent: 'flex-end', fontSize: 12 }}>
        <span className="muted">Less</span>
        {[0, 1, 2, 3, 4].map((s) => (
          <i key={s} style={{ width: 16, height: 12, borderRadius: 4, background: `var(--heat-${s})`, display: 'inline-block' }} />
        ))}
        <span className="muted">More</span>
      </div>
      <TipBox tip={tip} />
    </div>
  );
}

/* ---------- Funnel ---------- */
export function Funnel({ steps }: { steps: { label: string; count: number }[] }) {
  const top = steps[0]?.count || 1;
  let worst = -1;
  let worstDrop = 0;
  steps.forEach((s, i) => {
    if (!i) return;
    const prev = steps[i - 1]!.count || 1;
    const drop = 1 - s.count / prev;
    if (drop > worstDrop) {
      worstDrop = drop;
      worst = i;
    }
  });
  return (
    <div className="stack" style={{ gap: 6 }}>
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1]!.count || 1 : 0;
        const drop = i ? Math.round((1 - s.count / prev) * 100) : 0;
        return (
          <div key={s.label}>
            {i > 0 && (
              <div style={{ fontSize: 11.5, padding: '2px 0 4px 2px', color: i === worst ? 'var(--down)' : 'var(--ink-3)', fontWeight: i === worst ? 650 : 500 }}>
                ↓ {drop}% drop-off{i === worst ? ', biggest leak' : ''}
              </div>
            )}
            <div className="row" style={{ gap: 12 }}>
              <span style={{ width: 92, fontSize: 13, fontWeight: 600 }}>{s.label}</span>
              <div className="grow" style={{ height: 26, background: 'var(--well)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ width: `${(s.count / top) * 100}%`, height: '100%', background: 'var(--c-main)', opacity: 1 - i * 0.11, borderRadius: 8, transition: 'width .5s var(--ease)' }} />
              </div>
              <span className="num" style={{ width: 70, textAlign: 'right', fontSize: 13 }}>
                <b>{s.count}</b> <span className="muted">{Math.round((s.count / top) * 100)}%</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Area + previous-period comparison ---------- */
export function AreaCompare({ cur, prev, labels, fmt, height = 260 }: { cur: number[]; prev: number[]; labels: string[]; fmt: (v: number) => string; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');
  const padL = 50;
  const padB = 26;
  const top = 14;
  const max = niceMax(Math.max(...cur, ...prev, 1) * 1.1);
  const n = cur.length;
  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (w - padL - 8);
  const y = (v: number) => top + (1 - v / max) * (height - top - padB);
  const path = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const labelEvery = Math.ceil(n / 7);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {w > 0 && (
        <svg
          width={w}
          height={height}
          className="chart"
          role="img"
          aria-label="Revenue over time compared with the previous period"
          onMouseMove={(e) => {
            const bx = e.currentTarget.getBoundingClientRect().left;
            const i = Math.round(((e.clientX - bx - padL) / (w - padL - 8)) * (n - 1));
            setHi(Math.max(0, Math.min(n - 1, i)));
          }}
          onMouseLeave={() => setHi(null)}
        >
          <defs>
            <linearGradient id={`a${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--c-main)" stopOpacity={0.22} />
              <stop offset="1" stopColor="var(--c-main)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={padL} x2={w} y1={y(t * max)} y2={y(t * max)} stroke="var(--c-grid)" />
              <text x={padL - 8} y={y(t * max)} textAnchor="end" dominantBaseline="central">
                {fmt(t * max)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor="middle">
                {l}
              </text>
            ) : null,
          )}
          <path d={`${path(cur)} L${x(n - 1)},${height - padB} L${x(0)},${height - padB} Z`} fill={`url(#a${gid})`} />
          <path d={path(prev)} fill="none" stroke="var(--ink-3)" strokeWidth={1.75} strokeDasharray="5 5" />
          <path d={path(cur)} fill="none" stroke="var(--c-main)" strokeWidth={2.25} strokeLinejoin="round" />
          {hi != null && (
            <g pointerEvents="none">
              <line x1={x(hi)} x2={x(hi)} y1={top} y2={height - padB} stroke="var(--line-2)" />
              <circle cx={x(hi)} cy={y(prev[hi]!)} r={4} fill="var(--float)" stroke="var(--ink-3)" strokeWidth={2} />
              <circle cx={x(hi)} cy={y(cur[hi]!)} r={5} fill="var(--float)" stroke="var(--c-main)" strokeWidth={2.5} />
            </g>
          )}
        </svg>
      )}
      {hi != null && w > 0 && (
        <div className="chart-tip" style={{ left: x(hi), top: y(Math.max(cur[hi]!, prev[hi]!)) }}>
          <TipRows title={labels[hi]!} rows={[['This period', fmt(cur[hi]!)], ['Previous', fmt(prev[hi]!)]]} />
        </div>
      )}
    </div>
  );
}

/* ---------- Bars with the max highlighted ---------- */
export function HighlightBars({ data, fmt, height = 180 }: { data: { label: string; value: number }[]; fmt: (v: number) => string; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const maxIdx = data.findIndex((d) => d.value === max);
  const slot = w / data.length;
  const bw = Math.max(6, Math.min(36, slot * 0.6));
  const padB = 22;
  return (
    <div ref={ref} style={{ position: 'relative' }} onMouseLeave={() => setTip(null)}>
      {w > 0 && (
        <svg width={w} height={height} className="chart" role="img" aria-label="Bar chart">
          {data.map((d, i) => {
            const h = Math.max(d.value ? 4 : 0, (d.value / max) * (height - padB - 10));
            const x = i * slot + (slot - bw) / 2;
            return (
              <g key={d.label} onMouseEnter={() => setTip({ x: x + bw / 2, y: height - padB - h, content: <TipRows title={d.label} rows={[['Value', fmt(d.value)]]} /> })}>
                <rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
                <rect x={x} y={height - padB - h} width={bw} height={h} rx={6} fill={i === maxIdx ? 'var(--c-main)' : 'var(--c-muted)'} />
                <text x={x + bw / 2} y={height - 6} textAnchor="middle">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <TipBox tip={tip} />
    </div>
  );
}

/* ---------- Two-part split bar ---------- */
export function SplitBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div style={{ display: 'flex', gap: 3, height: 14, borderRadius: 999, overflow: 'hidden' }}>
      {parts.map((p) => (
        <div key={p.label} title={`${p.label}: ${Math.round((p.value / total) * 100)}%`} style={{ width: `${(p.value / total) * 100}%`, background: p.color, transition: 'width .5s var(--ease)' }} />
      ))}
    </div>
  );
}
