import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCan } from '../../data/access';
import { saveProduct } from '../../data/actions';
import { toBase } from '../../data/metrics';
import { lineTotals } from '../../data/seed';
import { useDB } from '../../data/store';
import type { Currency, Product } from '../../data/types';
import { CURRENCIES, money } from '../../lib/format';
import { Card, DataTable, Field, FilterPills, KpiTile, Modal, PageHeader, Progress, SearchInput, Segmented, Sheet, StatusPill, toast, type Column } from '../../ui';
import { Sparkline } from '../../ui/charts';
import { useBaseMoney } from '../common';

const STATUS_TONE = { Active: 'up', Draft: 'neutral', Archived: 'warn' } as const;
const margin = (p: Pick<Product, 'price' | 'cost'>) => (p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0);
type Sort = 'revenue' | 'price-desc' | 'price-asc' | 'margin' | 'name';

export function Products() {
  const d = useDB();
  const can = useCan();
  const fmt = useBaseMoney();
  const navigate = useNavigate();
  const { id } = useParams();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [status, setStatus] = useState('All');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [sort, setSort] = useState<Sort>('revenue');
  const [adding, setAdding] = useState(false);

  // Units and revenue from invoices in the last 90 days.
  const usage = useMemo(() => {
    const out = new Map<string, { units: number; revenue: number; monthly: number[] }>();
    const now = new Date();
    for (const doc of d.docs) {
      if (doc.kind !== 'invoice' || doc.status === 'Void' || doc.status === 'Draft') continue;
      const issued = new Date(doc.issueDate);
      const monthsAgo = (now.getFullYear() - issued.getFullYear()) * 12 + now.getMonth() - issued.getMonth();
      for (const l of doc.lines) {
        if (!l.productId) continue;
        const u = out.get(l.productId) ?? { units: 0, revenue: 0, monthly: Array(6).fill(0) };
        const rev = toBase(d, lineTotals(l).net, doc.currency);
        if (monthsAgo < 3) {
          u.units += l.qty;
          u.revenue += rev;
        }
        if (monthsAgo < 6) u.monthly[5 - monthsAgo]! += rev;
        out.set(l.productId, u);
      }
    }
    return out;
  }, [d]);

  const cats = ['All', ...new Set(d.products.map((p) => p.category))];
  const s = q.trim().toLowerCase();
  const rows = d.products
    .filter((p) => (cat === 'All' || p.category === cat) && (status === 'All' || p.status === status) && (!s || `${p.name} ${p.sku}`.toLowerCase().includes(s)))
    .sort((a, b) => {
      switch (sort) {
        case 'revenue':
          return (usage.get(b.id)?.revenue ?? 0) - (usage.get(a.id)?.revenue ?? 0);
        case 'price-desc':
          return toBase(d, b.price, b.currency) - toBase(d, a.price, a.currency);
        case 'price-asc':
          return toBase(d, a.price, a.currency) - toBase(d, b.price, b.currency);
        case 'margin':
          return margin(b) - margin(a);
        default:
          return a.name.localeCompare(b.name);
      }
    });
  const active = d.products.filter((p) => p.status === 'Active');
  const avgMargin = active.length ? active.reduce((s2, p) => s2 + margin(p), 0) / active.length : 0;
  const top = [...usage.entries()].sort((a, b) => b[1].revenue - a[1].revenue)[0];
  const topProduct = d.products.find((p) => p.id === top?.[0]);

  const columns: Column<Product>[] = [
    { key: 'name', header: 'Product', sort: (p) => p.name, render: (p) => <div className="cell-main"><Tile p={p} /><div><b>{p.name}</b><small>{p.sku}</small></div></div> },
    { key: 'cat', header: 'Category', sort: (p) => p.category, render: (p) => p.category },
    { key: 'price', header: 'Price', align: 'right', sort: (p) => toBase(d, p.price, p.currency), render: (p) => `${money(p.price, p.currency)} / ${p.unit}` },
    { key: 'margin', header: 'Margin', align: 'right', sort: margin, render: (p) => `${margin(p).toFixed(0)}%` },
    { key: 'rev', header: 'Revenue, 90 days', align: 'right', sort: (p) => usage.get(p.id)?.revenue ?? 0, render: (p) => fmt(usage.get(p.id)?.revenue ?? 0) },
    { key: 'status', header: 'Status', sort: (p) => p.status, render: (p) => <StatusPill tone={STATUS_TONE[p.status]}>{p.status}</StatusPill> },
  ];

  return (
    <>
      <PageHeader
        title="Products & services"
        actions={
          can('edit') && (
            <button className="btn primary" onClick={() => setAdding(true)}>
              <Plus size={16} /> Add product
            </button>
          )
        }
      />
      <div className="kpis">
        <KpiTile hero label="Active products" value={active.length} link={{ label: `${d.products.length} in catalogue`, onClick: () => setStatus('All') }} />
        <KpiTile label="Average margin" value={`${avgMargin.toFixed(1)}%`} viz={<div style={{ width: 90 }}><Progress value={avgMargin} tone="up" /></div>} />
        <KpiTile label="Top seller, 90 days" value={topProduct ? fmt(top![1].revenue) : '—'} link={topProduct ? { label: topProduct.name, onClick: () => navigate(`/products/${topProduct.id}`) } : undefined} />
        <KpiTile label="Drafts & archived" value={d.products.length - active.length} />
      </div>
      <div className="row wrap" style={{ gap: 10, marginBottom: 12 }}>
        <SearchInput value={q} onChange={setQ} placeholder="Name or SKU" />
        <span className="muted">{rows.length} products</span>
        <div className="row" style={{ marginLeft: 'auto', gap: 10 }}>
          <select className="select sm" style={{ width: 190 }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="revenue">Best-selling</option>
            <option value="price-desc">Price, high to low</option>
            <option value="price-asc">Price, low to high</option>
            <option value="margin">Highest margin</option>
            <option value="name">Name, A to Z</option>
          </select>
          <Segmented options={[{ value: 'grid', label: 'Grid' }, { value: 'table', label: 'Table' }] as const} value={view} onChange={setView} label="View" />
        </div>
      </div>
      <div className="row wrap" style={{ gap: 10, marginBottom: 18 }}>
        <FilterPills value={cat} onChange={setCat} options={cats.map((c) => ({ value: c, label: c }))} />
        <span style={{ width: 1, height: 22, background: 'var(--line-2)' }} />
        <FilterPills value={status} onChange={setStatus} options={['All', 'Active', 'Draft', 'Archived'].map((c) => ({ value: c, label: c }))} />
      </div>
      {view === 'grid' ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
          {rows.map((p) => {
            const u = usage.get(p.id);
            return (
              <button key={p.id} className="card stack" style={{ textAlign: 'left', border: 0, gap: 10 }} onClick={() => navigate(`/products/${p.id}`)}>
                <div className="row between">
                  <Tile p={p} />
                  {p.status !== 'Active' && <StatusPill tone={STATUS_TONE[p.status]}>{p.status}</StatusPill>}
                </div>
                <div>
                  <b style={{ fontSize: 15 }}>{p.name}</b>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {p.sku} · {p.category}
                  </div>
                </div>
                <div className="row between">
                  <b className="num" style={{ fontSize: 17 }}>
                    {money(p.price, p.currency)}
                    <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}> / {p.unit}</span>
                  </b>
                  <span className="delta up">{margin(p).toFixed(0)}% margin</span>
                </div>
                <div className="row between muted" style={{ fontSize: 12.5, borderTop: '1px dashed var(--line-2)', paddingTop: 10 }}>
                  <span>{u ? `${u.units} sold, 90 days` : 'No sales yet'}</span>
                  <span style={{ color: 'var(--c-main)' }}>{u && <Sparkline data={u.monthly} w={70} h={24} />}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Card className="pad-0">
          <DataTable rows={rows} columns={columns} rowKey={(p) => p.id} onRowClick={(p) => navigate(`/products/${p.id}`)} />
        </Card>
      )}
      {id && <ProductSheet id={id} usage={usage.get(id)} onClose={() => navigate('/products')} />}
      {adding && <ProductModal onClose={() => setAdding(false)} />}
    </>
  );
}

function Tile({ p }: { p: Product }) {
  return (
    <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--well)', display: 'grid', placeItems: 'center', fontWeight: 750, fontSize: 13, flex: 'none' }}>
      {p.sku.split('-')[1]?.slice(0, 3) ?? p.name.slice(0, 2)}
    </span>
  );
}

function ProductSheet({ id, usage, onClose }: { id: string; usage?: { units: number; revenue: number; monthly: number[] }; onClose: () => void }) {
  const d = useDB();
  const can = useCan();
  const fmt = useBaseMoney();
  const p = d.products.find((x) => x.id === id);
  if (!p) return null;
  const editable = can('edit');
  const inline = (key: 'price' | 'cost' | 'taxPct') => (
    <input
      className="input"
      type="number"
      min={0}
      defaultValue={p[key]}
      key={p.id + key + p[key]}
      disabled={!editable}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      onBlur={(e) => {
        const v = Math.max(0, Number(e.target.value));
        if (v !== p[key]) {
          saveProduct({ ...p, [key]: v });
          toast('Saved');
        }
      }}
    />
  );
  return (
    <Sheet title={p.name} sub={`${p.sku} · ${p.category}`} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      <div className="form-grid">
        <Field label={`Price (${p.currency}) / ${p.unit}`} hint="Press Enter to save">
          {inline('price')}
        </Field>
        <Field label={`Unit cost (${p.currency})`}>{inline('cost')}</Field>
        <Field label="Tax rate %" hint="Applied on quotes and invoices in INR">
          {inline('taxPct')}
        </Field>
        <Field label="Status">
          <select className="select" value={p.status} disabled={!editable} onChange={(e) => saveProduct({ ...p, status: e.target.value as Product['status'] })}>
            <option value="Active">Active, can be quoted</option>
            <option value="Draft">Draft, hidden from quotes</option>
            <option value="Archived">Archived</option>
          </select>
        </Field>
      </div>
      <div className="box stack" style={{ gap: 8 }}>
        <div className="row between">
          <span className="section-label">Margin</span>
          <b>
            {margin(p).toFixed(1)}% · {money(p.price - p.cost, p.currency)} per {p.unit}
          </b>
        </div>
        <Progress value={margin(p)} tone="up" />
      </div>
      <div className="box stack" style={{ gap: 8 }}>
        <div className="row between">
          <span className="section-label">Invoiced, last 6 months</span>
          <b>{fmt((usage?.monthly ?? []).reduce((s, v) => s + v, 0))}</b>
        </div>
        {usage ? (
          <div style={{ color: 'var(--c-main)' }}>
            <Sparkline data={usage.monthly} w={400} h={60} />
          </div>
        ) : (
          <span className="muted">Not on any invoice yet.</span>
        )}
        {usage && <span className="muted" style={{ fontSize: 12.5 }}>{usage.units} units in the last 90 days</span>}
      </div>
    </Sheet>
  );
}

function ProductModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: '', sku: '', category: 'Subscription', price: '', cost: '', currency: 'INR' as Currency, unit: 'unit', taxPct: '18', status: 'Active' as Product['status'] });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const price = Number(f.price);
  const cost = Number(f.cost);
  return (
    <Modal
      title="Add product"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!f.name.trim() || !(price >= 0) || !f.price}
            onClick={() => {
              saveProduct({ ...f, name: f.name.trim(), sku: f.sku.trim() || f.name.slice(0, 3).toUpperCase(), price, cost: cost || 0, taxPct: Number(f.taxPct) || 0 });
              toast(`${f.name} added`);
              onClose();
            }}
          >
            Add product
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" full>
          <input className="input" value={f.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="SKU">
          <input className="input" value={f.sku} onChange={set('sku')} />
        </Field>
        <Field label="Category">
          <select className="select" value={f.category} onChange={set('category')}>
            {['Subscription', 'Services', 'Training', 'Support', 'Add-on', 'Licence'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Price">
          <input className="input" type="number" min={0} value={f.price} onChange={set('price')} />
        </Field>
        <Field label="Unit cost">
          <input className="input" type="number" min={0} value={f.cost} onChange={set('cost')} />
        </Field>
        <Field label="Currency">
          <select className="select" value={f.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Billed per">
          <input className="input" value={f.unit} onChange={set('unit')} placeholder="user / month, project, day…" />
        </Field>
        <Field label="Tax rate %">
          <input className="input" type="number" min={0} max={100} value={f.taxPct} onChange={set('taxPct')} />
        </Field>
        <Field label="Status">
          <select className="select" value={f.status} onChange={set('status')}>
            <option value="Active">Active, can be quoted</option>
            <option value="Draft">Draft, hidden from quotes</option>
          </select>
        </Field>
        <div className="box full">
          {price > 0 ? (
            <span>
              Margin <b>{(((price - cost) / price) * 100).toFixed(1)}%</b> · {money(price - cost, f.currency)} per {f.unit}
            </span>
          ) : (
            <span className="muted">Enter a price and a cost to see the margin.</span>
          )}
        </div>
      </div>
    </Modal>
  );
}
