import { ChevronLeft, ChevronRight, FileText, Globe, Phone, Plus, Target } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCan, useScoped } from '../../data/access';
import { updateAccount } from '../../data/actions';
import { dealBase, docStatus, isOpen, toBase } from '../../data/metrics';
import { docTotals } from '../../data/seed';
import { userName } from '../../data/store';
import { CURRENCIES, monthLabel, money, relTime, shortDate } from '../../lib/format';
import { AutoTextarea, Avatar, Card, Empty, Field, KpiTile, PageHeader, toast } from '../../ui';
import { MonthlyBars, TipRows } from '../../ui/charts';
import { ActivityComposer, activitiesFor, DocPill, OwnerSelect, StagePill, TagToggles, Timeline, useBaseMoney } from '../common';
import { ContactModal } from './Contacts';

export function AccountPage() {
  const { id } = useParams();
  const d = useScoped();
  const can = useCan();
  const navigate = useNavigate();
  const fmt = useBaseMoney();
  const account = d.accounts.find((a) => a.id === id);
  const [notes, setNotes] = useState(account?.notes ?? '');
  const [adding, setAdding] = useState(false);
  // Reset the draft when navigating between accounts.
  useEffect(() => {
    setNotes(account?.notes ?? '');
  }, [id]);

  const data = useMemo(() => {
    if (!account) return null;
    const deals = d.deals.filter((x) => x.accountId === account.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const won = deals.filter((x) => x.stage === 'Won');
    const docs = d.docs.filter((x) => x.accountId === account.id).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
    const outstanding = docs.filter((x) => x.kind === 'invoice' && x.status !== 'Void' && x.status !== 'Draft').reduce((s, x) => s + toBase(d, docTotals(x).balance, x.currency), 0);
    const contacts = d.contacts.filter((c) => c.accountId === account.id);
    const contactIds = new Set(contacts.map((c) => c.id));
    const threads = d.threads.filter((t) => contactIds.has(t.contactId));
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const from = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - 10 + i, 1);
      const inMonth = won.filter((x) => new Date(x.closeDate) >= from && new Date(x.closeDate) < to);
      return { from, value: inMonth.reduce((s, x) => s + dealBase(d, x), 0), count: inMonth.length };
    });
    return {
      deals,
      won,
      lifetime: won.reduce((s, x) => s + dealBase(d, x), 0),
      open: deals.filter((x) => isOpen(x.stage)).reduce((s, x) => s + dealBase(d, x), 0),
      openCount: deals.filter((x) => isOpen(x.stage)).length,
      docs,
      outstanding,
      contacts,
      threads,
      months,
      activity: activitiesFor(d, 'account', account.id),
    };
  }, [d, account]);

  if (!account || !data) return <Empty title="This account doesn't exist" hint="It may have been deleted, or it's outside what you can see." action={<Link className="btn" to="/accounts">Show accounts</Link>} />;
  const editable = can('edit');
  const lastWon = data.won[0];

  return (
    <>
      <Link to="/accounts" className="back-link">
        <ChevronLeft size={16} /> All customers
      </Link>
      <PageHeader
        title={account.name}
        actions={
          editable && (
            <>
              <button className="btn" onClick={() => navigate(`/finance?new=invoice&account=${account.id}`)}>
                <FileText size={15} /> New invoice
              </button>
              <button className="btn primary" onClick={() => navigate(`/pipeline?new=1&account=${account.id}`)}>
                <Plus size={16} /> New deal
              </button>
            </>
          )
        }
      />

      <div className="grid g-1-2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 'var(--gutter)' }}>
          <Card>
            <div className="identity">
              <Avatar name={account.name} size="lg" />
              <div className="identity-main">
                <b style={{ fontSize: 17 }}>{account.name}</b>
                <div className="muted">
                  {account.industry || 'Industry not set'} · {account.city}, {account.country}
                </div>
                <div className="contact-lines">
                  {account.website && (
                    <span>
                      <Globe size={13} /> {account.website}
                    </span>
                  )}
                  {account.phone && (
                    <span>
                      <Phone size={13} /> {account.phone}
                    </span>
                  )}
                </div>
              </div>
              <div className="identity-value">
                <div className="muted" style={{ fontSize: 12 }}>
                  Lifetime value
                </div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(data.lifetime, false)}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  across {data.won.length} won deal{data.won.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          </Card>
          <div className="kpis" style={{ marginBottom: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <KpiTile label="Open pipeline" value={fmt(data.open)} link={{ label: `${data.openCount} open deals`, onClick: () => document.getElementById('acc-deals')?.scrollIntoView({ behavior: 'smooth' }) }} />
            <KpiTile label="Outstanding" info="Unpaid balance on sent invoices, in base currency." value={fmt(data.outstanding)} />
            <KpiTile label="Last win" value={lastWon ? relTime(lastWon.closeDate) : '—'} link={lastWon ? { label: money(lastWon.amount, lastWon.currency, { compact: true }), onClick: () => navigate(`/pipeline/${lastWon.id}`) } : undefined} />
          </div>
          <Card title="Monthly revenue" sub="Won deals, last 12 months">
            <MonthlyBars
              height={200}
              fmt={(v) => fmt(v)}
              points={data.months.map((m, i) => ({ key: String(i), label: monthLabel(m.from), value: m.value, kind: i === 11 ? 'current' : 'past', tip: <TipRows title={`${monthLabel(m.from)} ${m.from.getFullYear()}`} rows={[['Revenue', fmt(m.value, false)], ['Deals won', String(m.count)]]} /> }))}
            />
          </Card>
          <Card title="Deals" sub={`${data.deals.length} total`}>
            <div id="acc-deals" className="stack" style={{ gap: 2 }}>
              {data.deals.slice(0, 8).map((x) => (
                <button key={x.id} className="menu-item" onClick={() => navigate(`/pipeline/${x.id}`)}>
                  <Target size={15} className="muted" />
                  <span className="grow ellipsis">
                    {x.title}
                    <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                      {userName(d, x.ownerId)} · {x.stage === 'Won' || x.stage === 'Lost' ? `closed ${shortDate(x.closeDate)}` : `closes ${shortDate(x.closeDate)}`}
                    </span>
                  </span>
                  <span className="item-end">
                    <b className="num">{money(x.amount, x.currency)}</b>
                    <StagePill stage={x.stage} />
                  </span>
                  <ChevronRight size={15} className="muted hide-sm" />
                </button>
              ))}
              {data.deals.length > 8 && <span className="muted" style={{ padding: '6px 10px' }}>Plus {data.deals.length - 8} earlier deals</span>}
              {!data.deals.length && <span className="muted">No deals yet.</span>}
            </div>
          </Card>
          <Card title="Invoices & quotes" sub={`${data.docs.length} documents`}>
            <div className="stack" style={{ gap: 2 }}>
              {data.docs.map((x) => (
                <button key={x.id} className="menu-item" onClick={() => navigate(`/finance/${x.id}`)}>
                  <FileText size={15} className="muted" />
                  <span className="grow">
                    {x.number}
                    <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                      {x.kind === 'invoice' ? 'Invoice' : 'Quote'} · {shortDate(x.issueDate)}
                    </span>
                  </span>
                  <span className="item-end">
                    <b className="num">{money(docTotals(x).total, x.currency)}</b>
                    <DocPill status={docStatus(x)} />
                  </span>
                </button>
              ))}
              {!data.docs.length && <span className="muted">No invoices or quotes yet.</span>}
            </div>
          </Card>
          <Card title="Activity">
            <div className="stack">
              {editable && <ActivityComposer related={[{ kind: 'account', id: account.id }]} />}
              <Timeline items={data.activity} />
            </div>
          </Card>
        </div>

        <div className="stack" style={{ gap: 'var(--gutter)' }}>
          <Card title="About">
            <div className="stack">
              <div className="kv">
                <div>
                  <span>Customer since</span>
                  <b>{shortDate(account.createdAt)}</b>
                </div>
                <div>
                  <span>Billing currency</span>
                  <select className="select sm" value={account.currency} disabled={!editable} onChange={(e) => updateAccount(account.id, { currency: e.target.value as never })}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Field label="Account owner">
                <OwnerSelect value={account.ownerId} onChange={(v) => updateAccount(account.id, { ownerId: v })} disabled={!editable} />
              </Field>
              <div className="stack" style={{ gap: 8 }}>
                <span className="section-label">Tags</span>
                <TagToggles all={['Customer', 'Enterprise', 'Mid-market', 'Strategic', 'Partner', 'Renewal due']} value={account.tags} onChange={(tags) => updateAccount(account.id, { tags })} disabled={!editable} />
              </div>
            </div>
          </Card>
          <Card title="Contacts" sub={`${data.contacts.length}`} tools={editable && <button className="btn sm" onClick={() => setAdding(true)}><Plus size={14} /> Add</button>}>
            <div className="stack" style={{ gap: 2 }}>
              {data.contacts.map((c) => (
                <button key={c.id} className="menu-item" onClick={() => navigate(`/contacts/${c.id}`)}>
                  <Avatar name={c.name} size="sm" />
                  <span className="grow ellipsis">
                    {c.name}
                    <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                      {c.title} · {c.email}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
          <Card title="Notes" sub="Only your team sees these">
            <AutoTextarea minRows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable} placeholder="Buying process, key people, renewal terms…" />
            <div className="row between" style={{ marginTop: 10 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {notes === account.notes ? 'Saved' : 'Unsaved changes'}
              </span>
              <button
                className="btn sm primary"
                disabled={notes === account.notes || !editable}
                onClick={() => {
                  updateAccount(account.id, { notes });
                  toast('Note saved');
                }}
              >
                Save note
              </button>
            </div>
          </Card>
          <Card title="Conversations">
            <div className="stack" style={{ gap: 2 }}>
              {data.threads.map((t) => (
                <button key={t.id} className="menu-item" onClick={() => navigate(`/inbox/${t.id}`)}>
                  <span className="grow ellipsis">
                    <b style={{ fontWeight: 650 }}>{t.subject}</b>
                    <span className="muted ellipsis" style={{ display: 'block', fontSize: 12 }}>
                      {t.messages.at(-1)?.body}
                    </span>
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {relTime(t.messages.at(-1)!.at)}
                  </span>
                </button>
              ))}
              {!data.threads.length && <span className="muted">No conversations yet.</span>}
            </div>
          </Card>
        </div>
      </div>
      {adding && <ContactModal accountId={account.id} onClose={() => setAdding(false)} onCreated={(cid) => navigate(`/contacts/${cid}`)} />}
    </>
  );
}
