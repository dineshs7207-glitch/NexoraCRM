import { Copy, Download, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCan, useScoped } from '../../data/access';
import { convertLead, createLead, deleteLeads, logAudit, updateLead } from '../../data/actions';
import { useDB, useMe, userName } from '../../data/store';
import { LEAD_SOURCES, LEAD_STATUSES, type Lead, type LeadSource, type LeadStatus } from '../../data/types';
import { downloadText, toCsv } from '../../lib/download';
import { CURRENCIES, money, relTime, shortDate } from '../../lib/format';
import { Avatar, BulkBar, Card, ConfirmModal, DataTable, Field, FilterPills, KpiTile, Modal, PageHeader, Popover, Progress, SearchInput, Sheet, StatusPill, toast, type Column } from '../../ui';
import { ActivityComposer, activitiesFor, LEAD_TONE, OwnerSelect, PipelineTabs, TagToggles, Timeline } from '../common';

const DAY = 86_400_000;
const NEXT: Partial<Record<LeadStatus, LeadStatus>> = { New: 'Contacted', Contacted: 'Qualified' };

export function Leads() {
  const d = useScoped();
  const can = useCan();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<'All' | LeadStatus>('All');
  const [q, setQ] = useState('');
  const [source, setSource] = useState<'All' | LeadSource>('All');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const now = Date.now();
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return d.leads.filter((l) => (status === 'All' || l.status === status) && (source === 'All' || l.source === source) && (!s || `${l.name} ${l.company} ${l.email}`.toLowerCase().includes(s)));
  }, [d.leads, status, source, q]);

  const newWeek = d.leads.filter((l) => now - new Date(l.createdAt).getTime() < 7 * DAY).length;
  const newPrevWeek = d.leads.filter((l) => {
    const age = now - new Date(l.createdAt).getTime();
    return age >= 7 * DAY && age < 14 * DAY;
  }).length;
  const untouched = d.leads.filter((l) => l.status === 'New' && now - new Date(l.createdAt).getTime() > DAY).length;
  const decided = d.leads.filter((l) => ['Qualified', 'Unqualified', 'Converted'].includes(l.status));
  const qualRate = decided.length ? (decided.filter((l) => l.status !== 'Unqualified').length / decided.length) * 100 : 0;
  const avgScore = d.leads.length ? d.leads.reduce((s, l) => s + l.score, 0) / d.leads.length : 0;

  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Lead',
      sort: (l) => l.name,
      render: (l) => (
        <div className="cell-main">
          <Avatar name={l.name} />
          <div style={{ minWidth: 0 }}>
            <b className="ellipsis">{l.name}</b>
            <small>
              {l.title}, {l.company}
            </small>
          </div>
        </div>
      ),
    },
    { key: 'source', header: 'Source', sort: (l) => l.source, render: (l) => l.source },
    { key: 'status', header: 'Status', sort: (l) => l.status, render: (l) => <StatusPill tone={LEAD_TONE[l.status]}>{l.status}</StatusPill> },
    {
      key: 'score',
      header: 'Score',
      sort: (l) => l.score,
      render: (l) => (
        <div className="row" style={{ gap: 8, minWidth: 90 }}>
          <span className="num" style={{ width: 22 }}>
            {l.score}
          </span>
          <div className="grow">
            <Progress value={l.score} tone={l.score >= 70 ? 'up' : l.score >= 40 ? undefined : 'warn'} />
          </div>
        </div>
      ),
    },
    { key: 'owner', header: 'Owner', sort: (l) => userName(d, l.ownerId), render: (l) => userName(d, l.ownerId) },
    { key: 'value', header: 'Est. value', align: 'right', sort: (l) => l.estValue, render: (l) => money(l.estValue, l.currency, { compact: true }) },
    { key: 'last', header: 'Last activity', sort: (l) => l.lastActivityAt, render: (l) => <span className="muted">{relTime(l.lastActivityAt)}</span> },
  ];

  const exportCsv = () => {
    const name = `nexora-leads-${status.toLowerCase()}.csv`;
    downloadText(name, toCsv(filtered.map((l) => ({ Name: l.name, Company: l.company, Title: l.title, Email: l.email, Phone: l.phone, City: l.city, Source: l.source, Status: l.status, Score: l.score, Owner: userName(d, l.ownerId), 'Estimated value': l.estValue, Currency: l.currency, Created: shortDate(l.createdAt) }))));
    logAudit('Exported leads CSV', `${filtered.length} rows`);
    toast(`Exported ${name}`);
  };

  const bulk = (patch: Partial<Lead>, label: string) => {
    selected.forEach((lid) => updateLead(lid, patch, label));
    toast(`${label}: ${selected.size} lead(s)`);
    setSelected(new Set());
  };

  return (
    <>
      <PageHeader
        title="Leads"
        tabs={<PipelineTabs value="leads" />}
        sub={`${d.leads.length} leads`}
        actions={
          <>
            {can('export') && (
              <button className="btn" onClick={exportCsv}>
                <Download size={15} /> Export CSV
              </button>
            )}
            {can('edit') && (
              <button className="btn primary" onClick={() => setParams({ new: '1' })}>
                <Plus size={16} /> New lead
              </button>
            )}
          </>
        }
      />
      <div className="kpis">
        <KpiTile hero label="New this week" value={newWeek} delta={newPrevWeek ? ((newWeek - newPrevWeek) / newPrevWeek) * 100 : 0} deltaNote="vs last week" />
        <KpiTile label="Waiting over 24 hours" info="New leads nobody has contacted yet, more than a day after they arrived." value={untouched} link={untouched ? { label: 'Show them', onClick: () => setStatus('New') } : undefined} />
        <KpiTile label="Qualification rate" info="Qualified or converted, out of all leads with a decision." value={`${qualRate.toFixed(0)}%`} />
        <KpiTile label="Average lead score" value={avgScore.toFixed(0)} viz={<div style={{ width: 90 }}><Progress value={avgScore} /></div>} />
      </div>

      <Card className="pad-0">
        <div className="row wrap" style={{ padding: '16px 18px', gap: 12 }}>
          <FilterPills value={status} onChange={setStatus} options={[{ value: 'All' as const, label: 'All', count: d.leads.length }, ...LEAD_STATUSES.map((s) => ({ value: s, label: s, count: d.leads.filter((l) => l.status === s).length }))]} />
          <div className="row" style={{ marginLeft: 'auto', gap: 10 }}>
            <select className="select sm" style={{ width: 150 }} value={source} onChange={(e) => setSource(e.target.value as never)} aria-label="Source">
              <option value="All">All sources</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <SearchInput value={q} onChange={setQ} placeholder="Name, company or email" />
          </div>
        </div>
        <DataTable rows={filtered} columns={columns} rowKey={(l) => l.id} onRowClick={(l) => navigate(`/leads/${l.id}`)} selected={can('edit') ? selected : undefined} onSelect={can('edit') ? setSelected : undefined} initialSort={{ key: 'last', dir: 'desc' }} />
      </Card>

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <button className="btn sm" onClick={() => bulk({ status: 'Contacted' }, 'Marked contacted')}>
          Mark contacted
        </button>
        <button className="btn sm" onClick={() => bulk({ status: 'Unqualified' }, 'Marked unqualified')}>
          Unqualify
        </button>
        <Popover
          align="left"
          trigger={({ toggle }) => (
            <button className="btn sm" onClick={toggle}>
              Assign to…
            </button>
          )}
        >
          {(close) => (
            <div style={{ color: 'var(--ink)' }}>
              {d.users
                .filter((u) => u.role !== 'Viewer')
                .map((u) => (
                  <button
                    key={u.id}
                    className="menu-item"
                    onClick={() => {
                      bulk({ ownerId: u.id }, `Assigned to ${u.name}`);
                      close();
                    }}
                  >
                    <Avatar name={u.name} hue={u.hue} size="sm" /> {u.name}
                  </button>
                ))}
            </div>
          )}
        </Popover>
        {can('delete') && (
          <button className="btn sm" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        )}
      </BulkBar>

      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${selected.size} lead(s)?`}
          body="They are removed for everyone on the team. This can't be undone."
          confirm="Delete leads"
          onConfirm={() => {
            deleteLeads([...selected]);
            toast(`Deleted ${selected.size} lead(s)`);
            setSelected(new Set());
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
      {id && <LeadSheet id={id} onClose={() => navigate('/leads')} />}
      {params.get('new') && (
        <NewLeadModal
          onClose={() => setParams({})}
          onCreated={(nid) => {
            setParams({});
            navigate(`/leads/${nid}`);
          }}
        />
      )}
    </>
  );
}

function LeadSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useDB();
  const can = useCan();
  const navigate = useNavigate();
  const lead = d.leads.find((l) => l.id === id);
  const [converting, setConverting] = useState(false);
  if (!lead) return null;
  const next = NEXT[lead.status];
  const editable = can('edit');
  return (
    <Sheet
      title={lead.name}
      sub={
        <span className="row" style={{ gap: 8 }}>
          <StatusPill tone={LEAD_TONE[lead.status]}>{lead.status}</StatusPill>
          {lead.title}, {lead.company}
        </span>
      }
      onClose={onClose}
      footer={
        lead.status === 'Converted' ? (
          <button className="btn primary" onClick={() => navigate(`/pipeline/${lead.convertedDealId}`)}>
            Open deal
          </button>
        ) : (
          editable && (
            <>
              {lead.status !== 'Unqualified' && (
                <button className="btn" onClick={() => updateLead(lead.id, { status: 'Unqualified' }, 'Unqualified lead')}>
                  Unqualify
                </button>
              )}
              <button className="btn" onClick={() => setConverting(true)}>
                Convert to deal
              </button>
              {next && (
                <button
                  className="btn primary"
                  onClick={() => {
                    updateLead(lead.id, { status: next }, `Marked lead ${next}`);
                    toast(`${lead.name} marked ${next.toLowerCase()}`);
                  }}
                >
                  Mark as {next.toLowerCase()}
                </button>
              )}
            </>
          )
        )
      }
    >
      <div className="kv">
        <div>
          <span>Email</span>
          <b className="row" style={{ gap: 6 }}>
            {lead.email}
            <button
              className="icon-btn sm"
              style={{ width: 24, height: 24 }}
              aria-label="Copy email"
              onClick={() => {
                navigator.clipboard?.writeText(lead.email);
                toast('Email copied');
              }}
            >
              <Copy size={12} />
            </button>
          </b>
        </div>
        <div>
          <span>Phone</span>
          <b>{lead.phone}</b>
        </div>
        <div>
          <span>City</span>
          <b>{lead.city}</b>
        </div>
        <div>
          <span>Source</span>
          <b>{lead.source}</b>
        </div>
        <div>
          <span>Estimated value</span>
          <b>{money(lead.estValue, lead.currency)}</b>
        </div>
        <div>
          <span>Created</span>
          <b>{shortDate(lead.createdAt)}</b>
        </div>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <div className="row between">
          <span className="section-label">Lead score</span>
          <b>{lead.score}/100</b>
        </div>
        <Progress value={lead.score} tone={lead.score >= 70 ? 'up' : lead.score >= 40 ? undefined : 'warn'} />
      </div>
      <Field label="Owner">
        <OwnerSelect value={lead.ownerId} onChange={(v) => updateLead(lead.id, { ownerId: v }, 'Reassigned lead')} disabled={!editable} />
      </Field>
      <div className="stack" style={{ gap: 8 }}>
        <span className="section-label">Tags</span>
        <TagToggles all={['Hot', 'Inbound', 'Webinar', 'Trade show', 'Budget confirmed']} value={lead.tags} onChange={(tags) => updateLead(lead.id, { tags }, 'Updated lead tags')} disabled={!editable} />
      </div>
      {editable && <ActivityComposer related={[{ kind: 'lead', id: lead.id }]} />}
      <div className="stack" style={{ gap: 10 }}>
        <span className="section-label">Activity</span>
        <Timeline items={activitiesFor(d, 'lead', lead.id)} />
      </div>
      {converting && (
        <ConvertModal
          lead={lead}
          onClose={() => setConverting(false)}
          onDone={(dealId) => {
            toast(`Converted ${lead.name} into a deal`);
            navigate(`/pipeline/${dealId}`);
          }}
        />
      )}
    </Sheet>
  );
}

function ConvertModal({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: (dealId: string) => void }) {
  const [title, setTitle] = useState(`${lead.company}: New business`);
  const [amount, setAmount] = useState(String(lead.estValue));
  return (
    <Modal
      title="Convert to deal"
      sub="Creates (or links) the account, a contact and a deal at the Qualified stage. The lead's history moves with it."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!title.trim() || !(Number(amount) > 0)}
            onClick={() => {
              const id = convertLead(lead.id, { title: title.trim(), amount: Number(amount) });
              if (id) onDone(id);
            }}
          >
            Convert
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Deal name" full>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={`Amount (${lead.currency})`}>
          <input className="input" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Account">
          <input className="input" value={lead.company} disabled />
        </Field>
      </div>
    </Modal>
  );
}

function NewLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const me = useMe();
  const [f, setF] = useState({ name: '', company: '', title: '', email: '', phone: '', city: '', source: 'Website' as LeadSource, ownerId: me.id, estValue: '', currency: 'INR' as Lead['currency'] });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const emailOk = !f.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email);
  const valid = f.name.trim() && f.company.trim() && emailOk;
  return (
    <Modal
      title="New lead"
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
              const id = createLead({ ...f, name: f.name.trim(), company: f.company.trim(), estValue: Number(f.estValue) || 0 });
              toast(`Lead ${f.name} created`);
              onCreated(id);
            }}
          >
            Create lead
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Full name">
          <input className="input" value={f.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Company">
          <input className="input" value={f.company} onChange={set('company')} />
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
        <Field label="City">
          <input className="input" value={f.city} onChange={set('city')} />
        </Field>
        <Field label="Source">
          <select className="select" value={f.source} onChange={set('source')}>
            {LEAD_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Owner">
          <OwnerSelect value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} />
        </Field>
        <Field label="Estimated value">
          <input className="input" type="number" min={0} value={f.estValue} onChange={set('estValue')} />
        </Field>
        <Field label="Currency">
          <select className="select" value={f.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
