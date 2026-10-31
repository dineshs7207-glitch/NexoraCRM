import { Download, FileDown, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCan, useScoped } from '../../data/access';
import { convertQuote, logAudit, recordPayment, setDocStatus } from '../../data/actions';
import { docStatus, receivables, toBase } from '../../data/metrics';
import { docTotals } from '../../data/seed';
import { useDB, userName } from '../../data/store';
import type { SalesDoc } from '../../data/types';
import { downloadText, toCsv } from '../../lib/download';
import { dateTime, isoDay, money, relTime, shortDate } from '../../lib/format';
import { ConfirmModal, DataTable, Field, FilterPills, KpiTile, Modal, PageHeader, SearchInput, Segmented, Sheet, Stepper, toast, Card, type Column } from '../../ui';
import { DocPill, useBaseMoney } from '../common';
import { DocEditor } from './DocEditor';
import { Aging, CashFlow } from './FinanceCards';

const INVOICE_STATUSES = ['Draft', 'Sent', 'Overdue', 'Paid', 'Void'] as const;
const QUOTE_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined'] as const;

/** Opens the printable A4 view; the browser's "Save as PDF" produces the file until server PDFs land (Phase 4). */
export function openPrintView(id: string) {
  const url = `${window.location.pathname}${window.location.search}#/finance/${id}/print`;
  window.open(url, '_blank', 'noopener');
}

export function Invoices() {
  const d = useScoped();
  const can = useCan();
  const fmt = useBaseMoney();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [kind, setKind] = useState<SalesDoc['kind']>('invoice');
  const [status, setStatus] = useState('All');
  const [q, setQ] = useState('');

  const accName = (aid: string) => d.accounts.find((a) => a.id === aid)?.name ?? '';
  const docs = useMemo(() => {
    const s = q.trim().toLowerCase();
    return d.docs.filter((x) => x.kind === kind && (status === 'All' || docStatus(x) === status) && (!s || `${x.number} ${accName(x.accountId)}`.toLowerCase().includes(s)));
  }, [d, kind, status, q]); // accName reads d

  const r = receivables(d);
  const drafts = d.docs.filter((x) => x.kind === kind && x.status === 'Draft').length;
  const quotesOpen = d.docs.filter((x) => x.kind === 'quote' && x.status === 'Sent');
  const quotesValue = quotesOpen.reduce((s, x) => s + toBase(d, docTotals(x).total, x.currency), 0);
  const quotesDecided = d.docs.filter((x) => x.kind === 'quote' && (x.status === 'Accepted' || x.status === 'Declined'));
  const acceptRate = quotesDecided.length ? (quotesDecided.filter((x) => x.status === 'Accepted').length / quotesDecided.length) * 100 : 0;
  const statuses = kind === 'invoice' ? INVOICE_STATUSES : QUOTE_STATUSES;

  const columns: Column<SalesDoc>[] = [
    { key: 'number', header: 'Number', sort: (x) => x.number, render: (x) => <b style={{ fontWeight: 650 }}>{x.number}</b> },
    { key: 'account', header: 'Bill to', sort: (x) => accName(x.accountId), render: (x) => accName(x.accountId) },
    { key: 'issue', header: 'Issued', sort: (x) => x.issueDate, render: (x) => shortDate(x.issueDate) },
    {
      key: 'due',
      header: kind === 'invoice' ? 'Due' : 'Valid until',
      sort: (x) => x.dueDate,
      render: (x) => <span style={{ color: docStatus(x) === 'Overdue' ? 'var(--down)' : undefined }}>{shortDate(x.dueDate)}</span>,
    },
    { key: 'status', header: 'Status', sort: (x) => docStatus(x), render: (x) => <DocPill status={docStatus(x)} /> },
    { key: 'total', header: 'Total', align: 'right', sort: (x) => toBase(d, docTotals(x).total, x.currency), render: (x) => money(docTotals(x).total, x.currency, { cents: true }) },
    ...(kind === 'invoice' ? [{ key: 'balance', header: 'Balance due', align: 'right' as const, sort: (x: SalesDoc) => toBase(d, docTotals(x).balance, x.currency), render: (x: SalesDoc) => <b>{x.status === 'Void' ? '—' : money(docTotals(x).balance, x.currency, { cents: true })}</b> }] : []),
  ];

  const exportCsv = () => {
    const name = `nexora-${kind}s-${status.toLowerCase()}.csv`;
    downloadText(name, toCsv(docs.map((x) => { const t = docTotals(x); return { Number: x.number, 'Bill to': accName(x.accountId), Issued: isoDay(new Date(x.issueDate)), Due: isoDay(new Date(x.dueDate)), Status: docStatus(x), Currency: x.currency, Subtotal: t.subtotal.toFixed(2), Discount: t.discount.toFixed(2), Tax: t.tax.toFixed(2), Total: t.total.toFixed(2), Paid: t.paid.toFixed(2), Balance: t.balance.toFixed(2) }; })));
    logAudit(`Exported ${kind}s CSV`, `${docs.length} rows`);
    toast(`Exported ${name}`);
  };

  const newKind = params.get('new') as SalesDoc['kind'] | null;
  return (
    <>
      <PageHeader
        title="Revenue & Invoices"
        tabs={
          <Segmented
            options={[{ value: 'invoice', label: 'Invoices' }, { value: 'quote', label: 'Quotes' }] as const}
            value={kind}
            onChange={(v) => {
              setKind(v);
              setStatus('All');
            }}
            label="Document type"
          />
        }
        actions={
          <>
            {can('export') && (
              <button className="btn" onClick={exportCsv}>
                <Download size={15} /> Export CSV
              </button>
            )}
            {can('invoices') && (
              <button className="btn primary" onClick={() => setParams({ new: kind })}>
                <Plus size={16} /> New {kind}
              </button>
            )}
          </>
        }
      />
      <div className="kpis">
        {kind === 'invoice' ? (
          <>
            <KpiTile hero label="Outstanding" info="Unpaid balance on sent and overdue invoices, converted to base currency." value={fmt(r.outstanding)} />
            <KpiTile label="Overdue" value={fmt(r.overdue)} link={{ label: 'Show overdue', onClick: () => setStatus('Overdue') }} />
            <KpiTile label="Collected in 30 days" value={fmt(r.paid30)} />
            <KpiTile label="Drafts" value={drafts} link={drafts ? { label: 'Show drafts', onClick: () => setStatus('Draft') } : undefined} />
          </>
        ) : (
          <>
            <KpiTile hero label="Open quotes" value={fmt(quotesValue)} link={{ label: `${quotesOpen.length} awaiting reply`, onClick: () => setStatus('Sent') }} />
            <KpiTile label="Acceptance rate" value={`${acceptRate.toFixed(0)}%`} />
            <KpiTile label="Drafts" value={drafts} />
            <KpiTile label="Quotes this year" value={d.docs.filter((x) => x.kind === 'quote' && new Date(x.issueDate).getFullYear() === new Date().getFullYear()).length} />
          </>
        )}
      </div>
      {kind === 'invoice' && (
        <div className="grid g-1-2" style={{ marginBottom: 'var(--gutter)' }}>
          <CashFlow d={d} />
          <Aging d={d} onPick={() => setStatus('Overdue')} />
        </div>
      )}
      <Card className="pad-0">
        <div className="row wrap" style={{ padding: '16px 18px', gap: 12 }}>
          <FilterPills value={status} onChange={setStatus} options={['All', ...statuses].map((s) => ({ value: s, label: s, count: d.docs.filter((x) => x.kind === kind && (s === 'All' || docStatus(x) === s)).length }))} />
          <div style={{ marginLeft: 'auto' }}>
            <SearchInput value={q} onChange={setQ} placeholder="Number or account" />
          </div>
        </div>
        <DataTable rows={docs} columns={columns} rowKey={(x) => x.id} onRowClick={(x) => navigate(`/finance/${x.id}`)} initialSort={{ key: 'issue', dir: 'desc' }} />
      </Card>
      {id && <DocSheet id={id} onClose={() => navigate('/finance')} />}
      {newKind && (
        <DocEditor
          kind={newKind}
          accountId={params.get('account') ?? undefined}
          dealId={params.get('deal') ?? undefined}
          onClose={() => setParams({})}
          onSaved={(nid) => {
            setKind(newKind);
            navigate(`/finance/${nid}`);
          }}
        />
      )}
    </>
  );
}

function DocSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useDB();
  const can = useCan();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const doc = d.docs.find((x) => x.id === id);
  if (!doc) return null;
  const t = docTotals(doc);
  const status = docStatus(doc);
  const account = d.accounts.find((a) => a.id === doc.accountId);
  const contact = d.contacts.find((c) => c.id === doc.contactId);
  const deal = d.deals.find((x) => x.id === doc.dealId);
  const editable = can('invoices');
  const isInv = doc.kind === 'invoice';
  const flow = isInv ? ['Draft', 'Sent', 'Paid'] : ['Draft', 'Sent', status === 'Declined' ? 'Declined' : 'Accepted'];
  const stepIndex = status === 'Overdue' ? 1 : Math.max(0, flow.indexOf(status));
  const download = () => {
    openPrintView(doc.id);
    logAudit('Downloaded PDF', doc.number);
  };

  return (
    <Sheet
      wide
      title={doc.number}
      sub={
        <span className="row wrap" style={{ gap: 8 }}>
          <DocPill status={status} /> {account?.name} · issued {shortDate(doc.issueDate)}
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={download} style={{ marginRight: 'auto' }}>
            <FileDown size={15} /> Download PDF
          </button>
          {editable && doc.status === 'Draft' && (
            <button className="btn" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
          {editable && isInv && doc.status !== 'Void' && doc.status !== 'Paid' && (
            <button className="btn ghost" style={{ color: 'var(--down)' }} onClick={() => setVoiding(true)}>
              Void
            </button>
          )}
          {editable && doc.status === 'Draft' && (
            <button
              className="btn primary"
              onClick={() => {
                setDocStatus(doc.id, 'Sent');
                toast(`${doc.number} marked as sent`);
              }}
            >
              Mark as sent
            </button>
          )}
          {editable && isInv && (status === 'Sent' || status === 'Overdue') && (
            <button className="btn primary" onClick={() => setPaying(true)}>
              Record payment
            </button>
          )}
          {editable && !isInv && doc.status === 'Sent' && (
            <>
              <button className="btn" onClick={() => setDocStatus(doc.id, 'Declined')}>
                Declined
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  const inv = convertQuote(doc.id);
                  toast('Quote accepted, invoice draft created');
                  if (inv) navigate(`/finance/${inv}`);
                }}
              >
                Accept & invoice
              </button>
            </>
          )}
        </>
      }
    >
      {status !== 'Void' && <Stepper steps={flow.map((s) => ({ label: s === 'Sent' && status === 'Overdue' ? 'Overdue' : s }))} current={stepIndex} lost={status === 'Declined' || status === 'Overdue'} />}
      <div className="kv box">
        <div>
          <span>Bill to</span>
          <b>{account ? <Link to={`/customers/${account.id}`}>{account.name}</Link> : '—'}</b>
          {contact && <div className="muted" style={{ fontSize: 12.5 }}>Attn. {contact.name}</div>}
        </div>
        <div>
          <span>{isInv ? 'Due' : 'Valid until'}</span>
          <b style={{ color: status === 'Overdue' ? 'var(--down)' : undefined }}>{shortDate(doc.dueDate)}</b>
          <div className="muted" style={{ fontSize: 12.5 }}>{relTime(doc.dueDate)}</div>
        </div>
        <div>
          <span>Deal</span>
          <b>{deal ? <Link to={`/pipeline/${deal.id}`}>{deal.title}</Link> : '—'}</b>
        </div>
        <div>
          <span>Created by</span>
          <b>{userName(d, doc.createdBy)}</b>
        </div>
      </div>
      <div className="stack" style={{ gap: 0 }}>
        <span className="section-label" style={{ marginBottom: 8 }}>
          Items
        </span>
        {doc.lines.map((l) => (
          <div key={l.id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', gap: 12 }}>
            <span className="grow">
              {l.description}
              <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>
                {l.qty} × {money(l.unitPrice, doc.currency, { cents: true })}
                {l.discountPct ? ` · ${l.discountPct}% off` : ''}
                {l.taxPct ? ` · tax ${l.taxPct}%` : ''}
              </span>
            </span>
            <b className="num">{money(l.qty * l.unitPrice * (1 - l.discountPct / 100), doc.currency, { cents: true })}</b>
          </div>
        ))}
        <div className="stack" style={{ gap: 6, paddingTop: 12 }}>
          <SumRow label="Subtotal" value={money(t.subtotal, doc.currency, { cents: true })} />
          {t.discount > 0 && <SumRow label="Discount" value={`− ${money(t.discount, doc.currency, { cents: true })}`} />}
          <SumRow label={doc.currency === 'INR' ? 'GST' : 'Tax'} value={money(t.tax, doc.currency, { cents: true })} />
          <SumRow label={<b>Total</b>} value={<b style={{ fontSize: 16 }}>{money(t.total, doc.currency, { cents: true })}</b>} />
          {isInv && t.paid > 0 && <SumRow label="Paid" value={`− ${money(t.paid, doc.currency, { cents: true })}`} />}
          {isInv && doc.status !== 'Void' && <SumRow label={<b>Balance due</b>} value={<b>{money(t.balance, doc.currency, { cents: true })}</b>} />}
        </div>
      </div>
      {doc.payments.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="section-label">Payments</span>
          {doc.payments.map((p) => (
            <div key={p.id} className="row between box" style={{ padding: '10px 14px' }}>
              <span>
                {p.method} <span className="muted">· {dateTime(p.at)}</span>
              </span>
              <b className="num">{money(p.amount, doc.currency, { cents: true })}</b>
            </div>
          ))}
        </div>
      )}
      {doc.notes && (
        <div>
          <span className="section-label">Notes</span>
          <p className="ink-2" style={{ marginTop: 6 }}>{doc.notes}</p>
        </div>
      )}
      {editing && <DocEditor kind={doc.kind} existing={doc} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {paying && <PaymentModal doc={doc} balance={t.balance} onClose={() => setPaying(false)} />}
      {voiding && (
        <ConfirmModal
          title={`Void ${doc.number}?`}
          body="The invoice stays in your records for audit, but no longer counts as money owed. Its number is never reused."
          confirm="Void invoice"
          onConfirm={() => {
            setDocStatus(doc.id, 'Void');
            toast(`${doc.number} voided`);
          }}
          onClose={() => setVoiding(false)}
        />
      )}
    </Sheet>
  );
}

function SumRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="row between">
      <span className="ink-2">{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}

function PaymentModal({ doc, balance, onClose }: { doc: SalesDoc; balance: number; onClose: () => void }) {
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [method, setMethod] = useState('Bank transfer');
  const value = Number(amount);
  const valid = value > 0 && value <= balance + 0.01;
  return (
    <Modal
      title="Record payment"
      sub={`${doc.number} · balance ${money(balance, doc.currency, { cents: true })}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!valid}
            onClick={() => {
              recordPayment(doc.id, value, method);
              toast(value >= balance - 0.01 ? `${doc.number} paid in full` : 'Part payment recorded');
              onClose();
            }}
          >
            Record payment
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={`Amount (${doc.currency})`} hint={valid ? undefined : 'Must be more than 0 and not above the balance'}>
          <input className="input" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Method">
          <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
            {['Bank transfer', 'UPI', 'Card', 'Cheque', 'Cash', 'Wire (SWIFT)'].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
