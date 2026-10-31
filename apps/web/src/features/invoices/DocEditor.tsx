import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useScoped } from '../../data/access';
import { blankLine, saveDoc } from '../../data/actions';
import { docTotals, lineTotals } from '../../data/seed';
import type { Currency, DocLine, SalesDoc } from '../../data/types';
import { CURRENCIES, isoDay, money } from '../../lib/format';
import { AutoTextarea, Field, Modal, toast } from '../../ui';

const DAY = 86_400_000;

export function DocEditor({ kind, existing, accountId, dealId, onClose, onSaved }: { kind: SalesDoc['kind']; existing?: SalesDoc; accountId?: string; dealId?: string; onClose: () => void; onSaved: (id: string) => void }) {
  const d = useScoped();
  const deal = d.deals.find((x) => x.id === (existing?.dealId ?? dealId));
  const initialAccount = existing?.accountId ?? deal?.accountId ?? accountId ?? d.accounts[0]?.id ?? '';
  const acc = d.accounts.find((a) => a.id === initialAccount);
  const [f, setF] = useState({
    accountId: initialAccount,
    contactId: existing?.contactId ?? deal?.contactId ?? '',
    dealId: existing?.dealId ?? deal?.id ?? '',
    currency: (existing?.currency ?? deal?.currency ?? acc?.currency ?? d.company.baseCurrency) as Currency,
    issueDate: isoDay(new Date(existing?.issueDate ?? Date.now())),
    dueDate: isoDay(new Date(existing?.dueDate ?? Date.now() + (kind === 'invoice' ? 30 : 15) * DAY)),
    notes: existing?.notes ?? (kind === 'invoice' ? 'Thank you for your business.' : 'Prices valid for 30 days.'),
    terms: existing?.terms ?? d.company.paymentTerms,
  });
  const defaultTax = f.currency === 'INR' ? 18 : 0;
  const [lines, setLines] = useState<DocLine[]>(existing?.lines.map((l) => ({ ...l })) ?? [{ ...blankLine(), taxPct: defaultTax }]);
  const totals = docTotals({ lines, payments: [] });
  const contacts = d.contacts.filter((c) => c.accountId === f.accountId);
  const deals = d.deals.filter((x) => x.accountId === f.accountId);
  const activeProducts = d.products.filter((p) => p.status === 'Active');
  const valid = f.accountId && lines.length && lines.every((l) => l.description.trim() && l.qty > 0 && l.unitPrice >= 0) && f.dueDate >= f.issueDate;
  const rate = (c: Currency) => d.company.rates[c] ?? 1;

  const setLine = (id: string, patch: Partial<DocLine>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const pickProduct = (id: string, productId: string) => {
    const p = d.products.find((x) => x.id === productId);
    if (!p) return setLine(id, { productId: undefined });
    // Catalogue prices are stored in their own currency; convert to the document currency.
    const price = Math.round((p.price * rate(p.currency)) / rate(f.currency));
    setLine(id, { productId, description: p.name, unitPrice: price, taxPct: f.currency === 'INR' ? p.taxPct : 0 });
  };

  const save = () => {
    const { id } = saveDoc({
      id: existing?.id,
      kind,
      accountId: f.accountId,
      contactId: f.contactId || contacts[0]?.id,
      dealId: f.dealId || undefined,
      currency: f.currency,
      issueDate: new Date(f.issueDate).toISOString(),
      dueDate: new Date(f.dueDate).toISOString(),
      status: existing?.status ?? 'Draft',
      lines: lines.map((l) => ({ ...l, description: l.description.trim() })),
      notes: f.notes,
      terms: f.terms,
    });
    toast(existing ? 'Changes saved' : `${kind === 'invoice' ? 'Invoice' : 'Quote'} draft created`);
    onSaved(id);
  };

  return (
    <Modal
      wide
      title={existing ? `Edit ${existing.number}` : kind === 'invoice' ? 'New invoice' : 'New quote'}
      sub={existing ? undefined : 'Saved as a draft. The number is assigned when you save.'}
      onClose={onClose}
      footer={
        <>
          <span className="muted" style={{ marginRight: 'auto' }}>
            Total <b style={{ color: 'var(--ink)', fontSize: 16 }}>{money(totals.total, f.currency, { cents: true })}</b>
          </span>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!valid} onClick={save}>
            {existing ? 'Save changes' : 'Save draft'}
          </button>
        </>
      }
    >
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Field label="Bill to (account)">
          <select
            className="select"
            value={f.accountId}
            onChange={(e) => {
              const a = d.accounts.find((x) => x.id === e.target.value);
              setF({ ...f, accountId: e.target.value, contactId: '', dealId: '', currency: a?.currency ?? f.currency });
            }}
          >
            {d.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Attention">
          <select className="select" value={f.contactId} onChange={(e) => setF({ ...f, contactId: e.target.value })}>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Deal">
          <select className="select" value={f.dealId} onChange={(e) => setF({ ...f, dealId: e.target.value })}>
            <option value="">None</option>
            {deals.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Currency">
          <select className="select" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as Currency })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Issue date">
          <input className="input" type="date" value={f.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value })} />
        </Field>
        <Field label={kind === 'invoice' ? 'Due date' : 'Valid until'}>
          <input className="input" type="date" value={f.dueDate} min={f.issueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </Field>
      </div>

      <div className="table-wrap box" style={{ padding: 0 }}>
        <table className="table lines">
          <thead>
            <tr>
              <th style={{ minWidth: 240 }}>Item</th>
              <th className="r" style={{ width: 80 }}>
                Qty
              </th>
              <th className="r" style={{ width: 130 }}>
                Unit price
              </th>
              <th className="r" style={{ width: 80 }}>
                Disc. %
              </th>
              <th className="r" style={{ width: 80 }}>
                Tax %
              </th>
              <th className="r" style={{ width: 130 }}>
                Amount
              </th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="line-item">
                  <div className="stack" style={{ gap: 6 }}>
                    <select className="select sm" value={l.productId ?? ''} onChange={(e) => pickProduct(l.id, e.target.value)} aria-label="Product">
                      <option value="">Custom item</option>
                      {activeProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                    <input className="input sm" value={l.description} placeholder="Description" onChange={(e) => setLine(l.id, { description: e.target.value })} aria-label="Description" />
                  </div>
                </td>
                <td data-label="Qty">
                  <input className="input sm num" type="number" min={0} step="any" value={l.qty} onChange={(e) => setLine(l.id, { qty: Number(e.target.value) })} aria-label="Quantity" style={{ textAlign: 'right' }} />
                </td>
                <td data-label="Unit price">
                  <input className="input sm num" type="number" min={0} step="any" value={l.unitPrice} onChange={(e) => setLine(l.id, { unitPrice: Number(e.target.value) })} aria-label="Unit price" style={{ textAlign: 'right' }} />
                </td>
                <td data-label="Disc. %">
                  <input className="input sm num" type="number" min={0} max={100} value={l.discountPct} onChange={(e) => setLine(l.id, { discountPct: Math.min(100, Math.max(0, Number(e.target.value))) })} aria-label="Discount percent" style={{ textAlign: 'right' }} />
                </td>
                <td data-label="Tax %">
                  <input className="input sm num" type="number" min={0} max={100} value={l.taxPct} onChange={(e) => setLine(l.id, { taxPct: Math.min(100, Math.max(0, Number(e.target.value))) })} aria-label="Tax percent" style={{ textAlign: 'right' }} />
                </td>
                <td className="r num line-amount" data-label="Amount">
                  <b>{money(lineTotals(l).net, f.currency, { cents: true })}</b>
                </td>
                <td className="line-remove">
                  <button className="icon-btn sm" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: 12 }}>
          <button className="btn sm" onClick={() => setLines((ls) => [...ls, { ...blankLine(), taxPct: defaultTax }])}>
            <Plus size={14} /> Add line
          </button>
        </div>
      </div>

      <div className="grid g-2" style={{ gap: 18 }}>
        <div className="stack">
          <Field label="Notes to client">
            <AutoTextarea minRows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
          <Field label="Terms">
            <AutoTextarea minRows={2} value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} />
          </Field>
        </div>
        <div className="box stack" style={{ gap: 8, alignSelf: 'start' }}>
          <Row label="Subtotal" value={money(totals.subtotal, f.currency, { cents: true })} />
          {totals.discount > 0 && <Row label="Discount" value={`− ${money(totals.discount, f.currency, { cents: true })}`} />}
          <Row label={f.currency === 'INR' ? 'GST' : 'Tax'} value={money(totals.tax, f.currency, { cents: true })} />
          <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 8 }}>
            <Row label={<b>Total</b>} value={<b style={{ fontSize: 17 }}>{money(totals.total, f.currency, { cents: true })}</b>} />
          </div>
          {f.currency !== d.company.baseCurrency && (
            <span className="muted" style={{ fontSize: 12 }}>
              ≈ {money(totals.total * rate(f.currency), d.company.baseCurrency)} at 1 {f.currency} = {rate(f.currency)} {d.company.baseCurrency}
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="row between">
      <span className="ink-2">{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
