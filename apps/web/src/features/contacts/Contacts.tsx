import { Download, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCan, useScoped } from '../../data/access';
import { createAccount, createContact, logAudit } from '../../data/actions';
import { dealBase, isOpen } from '../../data/metrics';
import { useMe, userName } from '../../data/store';
import type { Account, Contact, Currency, DB } from '../../data/types';
import { downloadText, toCsv } from '../../lib/download';
import { CURRENCIES, relTime } from '../../lib/format';
import { Avatar, Card, DataTable, Field, FilterPills, KpiTile, Modal, PageHeader, SearchInput, Segmented, toast, type Column } from '../../ui';
import { OwnerSelect, useBaseMoney } from '../common';

const DAY = 86_400_000;

interface AccountRow {
  a: Account;
  open: number;
  won: number;
  deals: number;
  last?: string;
}

export function accountRows(d: DB): AccountRow[] {
  return d.accounts.map((a) => {
    const deals = d.deals.filter((x) => x.accountId === a.id);
    const last = d.activities.find((x) => x.related.some((r) => r.kind === 'account' && r.id === a.id))?.at;
    return {
      a,
      deals: deals.length,
      open: deals.filter((x) => isOpen(x.stage)).reduce((s, x) => s + dealBase(d, x), 0),
      won: deals.filter((x) => x.stage === 'Won').reduce((s, x) => s + dealBase(d, x), 0),
      last,
    };
  });
}

export function Contacts() {
  const d = useScoped();
  const can = useCan();
  const fmt = useBaseMoney();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tab = pathname.startsWith('/customers') ? 'accounts' : 'contacts';
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState('All');
  const [adding, setAdding] = useState<null | 'account' | 'contact'>(null);

  const rows = useMemo(() => accountRows(d), [d]);
  const customers = rows.filter((r) => r.won > 0);
  const now = Date.now();
  const newThisMonth = d.accounts.filter((a) => now - new Date(a.createdAt).getTime() < 30 * DAY).length;
  const repeat = customers.filter((r) => d.deals.filter((x) => x.accountId === r.a.id && x.stage === 'Won').length > 1).length;
  const avgLtv = customers.length ? customers.reduce((s, r) => s + r.won, 0) / customers.length : 0;

  const segments = ['All', 'Customers', 'Prospects', ...new Set(d.accounts.flatMap((a) => a.tags))];
  const inSegment = (r: AccountRow) => segment === 'All' || (segment === 'Customers' ? r.won > 0 : segment === 'Prospects' ? r.won === 0 : r.a.tags.includes(segment));
  const s = q.trim().toLowerCase();
  const accRows = rows.filter((r) => inSegment(r) && (!s || `${r.a.name} ${r.a.city} ${r.a.industry}`.toLowerCase().includes(s)));
  const accName = (id: string) => d.accounts.find((a) => a.id === id)?.name ?? '';
  const conRows = d.contacts.filter((c) => !s || `${c.name} ${c.email} ${accName(c.accountId)}`.toLowerCase().includes(s));

  const accColumns: Column<AccountRow>[] = [
    {
      key: 'name',
      header: 'Account',
      sort: (r) => r.a.name,
      render: (r) => (
        <div className="cell-main">
          <Avatar name={r.a.name} />
          <div>
            <b>{r.a.name}</b>
            <small>{r.a.industry || '—'}</small>
          </div>
        </div>
      ),
    },
    { key: 'city', header: 'City', sort: (r) => r.a.city, render: (r) => `${r.a.city}${r.a.country !== 'India' ? `, ${r.a.country}` : ''}` },
    { key: 'owner', header: 'Owner', sort: (r) => userName(d, r.a.ownerId), render: (r) => userName(d, r.a.ownerId) },
    { key: 'deals', header: 'Deals', align: 'right', sort: (r) => r.deals, render: (r) => r.deals },
    { key: 'open', header: 'Open pipeline', align: 'right', sort: (r) => r.open, render: (r) => (r.open ? fmt(r.open) : <span className="muted">—</span>) },
    { key: 'won', header: 'Lifetime revenue', align: 'right', sort: (r) => r.won, render: (r) => <b>{r.won ? fmt(r.won) : <span className="muted">—</span>}</b> },
    { key: 'last', header: 'Last activity', sort: (r) => r.last ?? '', render: (r) => <span className="muted">{r.last ? relTime(r.last) : '—'}</span> },
    { key: 'tags', header: 'Tags', render: (r) => <div className="pills">{r.a.tags.map((t) => <span className="tag" key={t}>{t}</span>)}</div> },
  ];
  const conColumns: Column<Contact>[] = [
    {
      key: 'name',
      header: 'Contact',
      sort: (c) => c.name,
      render: (c) => (
        <div className="cell-main">
          <Avatar name={c.name} />
          <div>
            <b>{c.name}</b>
            <small>{c.title}</small>
          </div>
        </div>
      ),
    },
    { key: 'account', header: 'Account', sort: (c) => accName(c.accountId), render: (c) => accName(c.accountId) },
    { key: 'email', header: 'Email', render: (c) => c.email },
    { key: 'phone', header: 'Phone', render: (c) => <span className="num">{c.phone}</span> },
    { key: 'owner', header: 'Owner', sort: (c) => userName(d, c.ownerId), render: (c) => userName(d, c.ownerId) },
    { key: 'tags', header: 'Tags', render: (c) => <div className="pills">{c.tags.map((t) => <span className="tag" key={t}>{t}</span>)}</div> },
  ];

  const exportCsv = () => {
    const name = `nexora-${tab}.csv`;
    const csv =
      tab === 'accounts'
        ? toCsv(accRows.map((r) => ({ Account: r.a.name, Industry: r.a.industry, City: r.a.city, Country: r.a.country, Currency: r.a.currency, Owner: userName(d, r.a.ownerId), Deals: r.deals, 'Open pipeline (base)': Math.round(r.open), 'Lifetime revenue (base)': Math.round(r.won), Tags: r.a.tags.join('; ') })))
        : toCsv(conRows.map((c) => ({ Name: c.name, Title: c.title, Account: accName(c.accountId), Email: c.email, Phone: c.phone, City: c.city, Owner: userName(d, c.ownerId) })));
    downloadText(name, csv);
    logAudit(`Exported ${tab} CSV`, name);
    toast(`Exported ${name}`);
  };

  return (
    <>
      <PageHeader
        title="Customers"
        tabs={<Segmented options={[{ value: 'accounts', label: 'Accounts' }, { value: 'contacts', label: 'Contacts' }] as const} value={tab} onChange={(v) => navigate(v === 'accounts' ? '/customers' : '/contacts')} label="Accounts or contacts" />}
        actions={
          <>
            {can('export') && (
              <button className="btn" onClick={exportCsv}>
                <Download size={15} /> Export
              </button>
            )}
            {can('edit') && (
              <button className="btn primary" onClick={() => setAdding(tab === 'accounts' ? 'account' : 'contact')}>
                <Plus size={16} /> {tab === 'accounts' ? 'Add account' : 'Add contact'}
              </button>
            )}
          </>
        }
      />
      <div className="kpis">
        <KpiTile hero label="Accounts" value={d.accounts.length} link={{ label: `${d.contacts.length} contacts`, onClick: () => navigate('/contacts') }} />
        <KpiTile label="New in 30 days" value={newThisMonth} />
        <KpiTile label="Repeat customers" info="Customers with more than one won deal." value={`${customers.length ? Math.round((repeat / customers.length) * 100) : 0}%`} />
        <KpiTile label="Average lifetime value" info="Average won revenue per customer account." value={fmt(avgLtv)} />
      </div>
      <Card className="pad-0">
        <div className="row wrap" style={{ padding: '16px 18px', gap: 12 }}>
          {tab === 'accounts' ? <FilterPills value={segment} onChange={setSegment} options={segments.map((sg) => ({ value: sg, label: sg, count: rows.filter((r) => (sg === 'All' ? true : sg === 'Customers' ? r.won > 0 : sg === 'Prospects' ? r.won === 0 : r.a.tags.includes(sg))).length }))} /> : <b>All contacts</b>}
          <div style={{ marginLeft: 'auto' }}>
            <SearchInput value={q} onChange={setQ} placeholder={tab === 'accounts' ? 'Account, city or industry' : 'Name, email or account'} />
          </div>
        </div>
        {tab === 'accounts' ? <DataTable rows={accRows} columns={accColumns} rowKey={(r) => r.a.id} onRowClick={(r) => navigate(`/customers/${r.a.id}`)} initialSort={{ key: 'won', dir: 'desc' }} /> : <DataTable rows={conRows} columns={conColumns} rowKey={(c) => c.id} onRowClick={(c) => navigate(`/contacts/${c.id}`)} initialSort={{ key: 'name', dir: 'asc' }} />}
      </Card>
      {adding === 'account' && <AccountModal onClose={() => setAdding(null)} onCreated={(id) => navigate(`/customers/${id}`)} />}
      {adding === 'contact' && <ContactModal onClose={() => setAdding(null)} onCreated={(id) => navigate(`/contacts/${id}`)} />}
    </>
  );
}

export function AccountModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const me = useMe();
  const [f, setF] = useState({ name: '', industry: '', city: '', country: 'India', website: '', phone: '', currency: 'INR' as Currency, ownerId: me.id });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal
      title="Add account"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!f.name.trim()}
            onClick={() => {
              const id = createAccount({ ...f, name: f.name.trim() });
              toast(`${f.name} added`);
              onCreated(id);
            }}
          >
            Add account
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Company name" full>
          <input className="input" value={f.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Industry">
          <input className="input" value={f.industry} onChange={set('industry')} />
        </Field>
        <Field label="Website">
          <input className="input" value={f.website} onChange={set('website')} />
        </Field>
        <Field label="City">
          <input className="input" value={f.city} onChange={set('city')} />
        </Field>
        <Field label="Country">
          <input className="input" value={f.country} onChange={set('country')} />
        </Field>
        <Field label="Phone">
          <input className="input" value={f.phone} onChange={set('phone')} />
        </Field>
        <Field label="Billing currency" hint="Deals and invoices for this account default to it">
          <select className="select" value={f.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Owner" full>
          <OwnerSelect value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} />
        </Field>
      </div>
    </Modal>
  );
}

export function ContactModal({ onClose, onCreated, accountId }: { onClose: () => void; onCreated: (id: string) => void; accountId?: string }) {
  const d = useScoped();
  const me = useMe();
  const [f, setF] = useState({ name: '', title: '', email: '', phone: '', city: '', accountId: accountId ?? d.accounts[0]?.id ?? '', ownerId: me.id });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const emailOk = !f.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email);
  return (
    <Modal
      title="Add contact"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!f.name.trim() || !f.accountId || !emailOk}
            onClick={() => {
              const id = createContact({ ...f, name: f.name.trim() });
              toast(`${f.name} added`);
              onCreated(id);
            }}
          >
            Add contact
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Full name">
          <input className="input" value={f.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Job title">
          <input className="input" value={f.title} onChange={set('title')} />
        </Field>
        <Field label="Email" hint={emailOk ? undefined : 'Enter a valid email address'}>
          <input className="input" type="email" value={f.email} onChange={set('email')} />
        </Field>
        <Field label="Phone">
          <input className="input" value={f.phone} onChange={set('phone')} />
        </Field>
        <Field label="Account">
          <select className="select" value={f.accountId} onChange={set('accountId')} disabled={!!accountId}>
            {d.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="City">
          <input className="input" value={f.city} onChange={set('city')} />
        </Field>
      </div>
    </Modal>
  );
}
