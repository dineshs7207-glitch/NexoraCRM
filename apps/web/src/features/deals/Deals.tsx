import { CalendarClock, ChevronDown, Download, FileText, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCan, useScoped } from '../../data/access';
import { createDeal, deleteDeal, logAudit, moveDeal, updateDeal } from '../../data/actions';
import { dealBase, docStatus, isOpen } from '../../data/metrics';
import { docTotals } from '../../data/seed';
import { useDB, useMe, userName } from '../../data/store';
import { LEAD_SOURCES, OPEN_STAGES, STAGE_PROBABILITY, STAGES, type Deal, type LeadSource, type Stage } from '../../data/types';
import { downloadText, toCsv } from '../../lib/download';
import { CURRENCIES, dateTime, isoDay, money, relTime, shortDate } from '../../lib/format';
import { Avatar, Card, ConfirmModal, DataTable, Empty, Field, KpiTile, Modal, PageHeader, Popover, SearchInput, Segmented, Sheet, Stepper, Switch, cx, toast, type Column } from '../../ui';
import { useIsMobile } from '../../lib/hooks';
import { ActivityComposer, activitiesFor, DocPill, OwnerSelect, PipelineTabs, StagePill, Timeline, useBaseMoney } from '../common';

const DAY = 86_400_000;
const LOST_REASONS = ['Price', 'Chose a competitor', 'No budget', 'Timing', 'No decision', 'Other'];

export function Deals() {
  const d = useScoped();
  const can = useCan();
  const fmt = useBaseMoney();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<'board' | 'table'>('board');
  const [q, setQ] = useState('');
  const [owner, setOwner] = useState('all');
  const [losing, setLosing] = useState<Deal | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const stageFilter = params.get('stage') as Stage | null;

  const accName = (aid: string) => d.accounts.find((a) => a.id === aid)?.name ?? '';
  const now = Date.now();
  const deals = useMemo(() => {
    const s = q.trim().toLowerCase();
    return d.deals.filter((x) => (owner === 'all' || x.ownerId === owner) && (!s || `${x.title} ${accName(x.accountId)}`.toLowerCase().includes(s)));
  }, [d, q, owner]);

  const open = deals.filter((x) => isOpen(x.stage));
  const openValue = open.reduce((s, x) => s + dealBase(d, x), 0);
  const weighted = open.reduce((s, x) => s + (dealBase(d, x) * STAGE_PROBABILITY[x.stage]) / 100, 0);
  const avgAge = open.length ? open.reduce((s, x) => s + (now - new Date(x.createdAt).getTime()) / DAY, 0) / open.length : 0;
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getTime();
  const closingMonth = open.filter((x) => new Date(x.closeDate).getTime() < monthEnd);

  const drop = (dealId: string, stage: Stage) => {
    const deal = d.deals.find((x) => x.id === dealId);
    if (!deal || deal.stage === stage || !can('edit')) return;
    if (stage === 'Lost') return setLosing(deal);
    moveDeal(dealId, stage);
    toast(stage === 'Won' ? `🎉 ${deal.title} won` : `Moved to ${stage}`);
  };

  const exportCsv = () => {
    const name = `nexora-deals-${owner === 'all' ? 'all' : userName(d, owner).split(' ')[0]!.toLowerCase()}.csv`;
    downloadText(name, toCsv(deals.map((x) => ({ Deal: x.title, Account: accName(x.accountId), Stage: x.stage, Amount: x.amount, Currency: x.currency, 'Amount (base)': Math.round(dealBase(d, x)), Probability: STAGE_PROBABILITY[x.stage], Owner: userName(d, x.ownerId), 'Close date': isoDay(new Date(x.closeDate)), Source: x.source, Created: isoDay(new Date(x.createdAt)) }))));
    logAudit('Exported deals CSV', `${deals.length} rows`);
    toast(`Exported ${name}`);
  };

  const columns: Column<Deal>[] = [
    { key: 'title', header: 'Deal', sort: (x) => x.title, render: (x) => <b style={{ fontWeight: 650 }}>{x.title}</b> },
    { key: 'account', header: 'Account', sort: (x) => accName(x.accountId), render: (x) => accName(x.accountId) },
    { key: 'stage', header: 'Stage', sort: (x) => STAGES.indexOf(x.stage), render: (x) => <StagePill stage={x.stage} /> },
    { key: 'amount', header: 'Amount', align: 'right', sort: (x) => dealBase(d, x), render: (x) => money(x.amount, x.currency) },
    { key: 'prob', header: 'Prob.', align: 'right', sort: (x) => STAGE_PROBABILITY[x.stage], render: (x) => `${STAGE_PROBABILITY[x.stage]}%` },
    { key: 'owner', header: 'Owner', sort: (x) => userName(d, x.ownerId), render: (x) => userName(d, x.ownerId) },
    { key: 'close', header: 'Close date', sort: (x) => x.closeDate, render: (x) => shortDate(x.closeDate) },
  ];

  return (
    <>
      <PageHeader
        title="Deal Pipeline"
        tabs={<PipelineTabs value="deals" />}
        actions={
          <>
            <Segmented options={[{ value: 'board', label: 'Board' }, { value: 'table', label: 'List' }] as const} value={view} onChange={setView} label="View" />
            {can('export') && (
              <button className="btn" onClick={exportCsv}>
                <Download size={15} /> Export CSV
              </button>
            )}
            {can('edit') && (
              <button className="btn primary" onClick={() => setParams({ new: '1' })}>
                <Plus size={16} /> New deal
              </button>
            )}
          </>
        }
      />
      <div className="kpis">
        <KpiTile hero label="Open pipeline" value={fmt(openValue)} link={{ label: `${open.length} open deals`, onClick: () => setView('table') }} />
        <KpiTile label="Weighted forecast" info="Each open deal's value × its stage probability." value={fmt(weighted)} />
        <KpiTile label="Closing this month" value={fmt(closingMonth.reduce((s, x) => s + dealBase(d, x), 0))} link={{ label: `${closingMonth.length} deals`, onClick: () => setView('table') }} />
        <KpiTile label="Average deal age" info="Days since open deals were created." value={`${avgAge.toFixed(0)} days`} />
      </div>
      <div className="row wrap" style={{ marginBottom: 14, gap: 10 }}>
        <select className="select sm" style={{ width: 180 }} value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
          <option value="all">Everyone</option>
          {d.users
            .filter((u) => u.role !== 'Viewer')
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
        <SearchInput value={q} onChange={setQ} placeholder="Deal or account" />
        {view === "board" && (
          <label className="row" style={{ gap: 8, fontSize: 13, fontWeight: 600 }}>
            <Switch checked={showClosed} onChange={setShowClosed} label="Include won and lost" /> Include won &amp; lost
          </label>
        )}
        {stageFilter && (
          <button className="tag on" onClick={() => setParams({})}>
            Stage: {stageFilter} ✕
          </button>
        )}
      </div>

      {view === 'board' ? (
        <Board deals={stageFilter ? deals.filter((x) => x.stage === stageFilter) : deals} onDrop={drop} stages={showClosed || stageFilter === "Won" || stageFilter === "Lost" ? STAGES : OPEN_STAGES} />
      ) : (
        <Card className="pad-0">
          <DataTable rows={stageFilter ? deals.filter((x) => x.stage === stageFilter) : deals} columns={columns} rowKey={(x) => x.id} onRowClick={(x) => navigate(`/pipeline/${x.id}`)} initialSort={{ key: 'close', dir: 'asc' }} />
        </Card>
      )}

      {id && <DealSheet id={id} onClose={() => navigate('/pipeline')} onLose={setLosing} />}
      {losing && (
        <LostModal
          deal={losing}
          onClose={() => setLosing(null)}
          onConfirm={(reason) => {
            moveDeal(losing.id, 'Lost', reason);
            toast(`${losing.title} marked lost`);
            setLosing(null);
          }}
        />
      )}
      {params.get('new') && <NewDealModal accountId={params.get('account') ?? undefined} onClose={() => setParams({})} onCreated={(nid) => navigate(`/pipeline/${nid}`)} />}
    </>
  );
}

function Board({ deals, onDrop, stages }: { deals: Deal[]; onDrop: (id: string, stage: Stage) => void; stages: readonly Stage[] }) {
  const d = useDB();
  const fmt = useBaseMoney();
  const navigate = useNavigate();
  const [over, setOver] = useState<Stage | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const mobile = useIsMobile();
  const [tab, setTab] = useState<Stage>('New');
  const now = Date.now();

  // Phones: one stage at a time, picked from chips; cards move with a menu instead of drag.
  if (mobile) {
    const visible = (stage: Stage) => deals.filter((x) => x.stage === stage && (isOpen(stage) || now - new Date(x.closeDate).getTime() < 30 * DAY));
    const items = visible(tab);
    return (
      <div>
        <div className="stage-chips" role="tablist" aria-label="Stages">
          {stages.map((s) => (
            <button key={s} role="tab" className="pill-btn" aria-pressed={s === tab} aria-selected={s === tab} onClick={() => setTab(s)}>
              {s} <span className="count">{visible(s).length}</span>
            </button>
          ))}
        </div>
        <div className="row between" style={{ margin: '0 4px 10px' }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {isOpen(tab) ? `${items.length} open` : `${items.length} in the last 30 days`}
          </span>
          <b className="num">{fmt(items.reduce((s, x) => s + dealBase(d, x), 0))}</b>
        </div>
        <div className="mobile-list" key={tab}>
          {items.map((x) => (
            <article key={x.id} className="kcard" onClick={() => navigate(`/pipeline/${x.id}`)}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <b>{x.title.split(': ')[1] ?? x.title}</b>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {d.accounts.find((a) => a.id === x.accountId)?.name}
                  </div>
                </div>
                <b className="num" style={{ fontSize: 15, whiteSpace: 'nowrap' }}>
                  {money(x.amount, x.currency, { compact: true })}
                </b>
              </div>
              <div className="row between" onClick={(e) => e.stopPropagation()}>
                <span className="row" style={{ gap: 5, fontSize: 12, fontWeight: 600, color: isOpen(x.stage) && new Date(x.closeDate).getTime() < now ? 'var(--down)' : 'var(--ink-3)' }}>
                  <CalendarClock size={13} />
                  {isOpen(x.stage) ? `Closes ${relTime(x.closeDate)}` : `Closed ${relTime(x.closeDate)}`}
                </span>
                <Popover
                  width={200}
                  trigger={({ toggle }) => (
                    <button className="btn sm" onClick={toggle}>
                      Move <ChevronDown size={14} />
                    </button>
                  )}
                >
                  {(close) => (
                    <div>
                      <h4>Move to stage</h4>
                      {STAGES.filter((s) => s !== x.stage).map((s) => (
                        <button
                          key={s}
                          className="menu-item"
                          onClick={() => {
                            close();
                            onDrop(x.id, s);
                          }}
                        >
                          <StagePill stage={s} />
                        </button>
                      ))}
                    </div>
                  )}
                </Popover>
              </div>
            </article>
          ))}
          {!items.length && <Empty title={`Nothing in ${tab}`} hint="Deals you move here show up in this list." />}
        </div>
      </div>
    );
  }

  return (
    <div className="board" style={{ gridAutoColumns: 'minmax(250px, 1fr)' }}>
      {stages.map((stage) => {
        // Closed columns only show the last 30 days so the board stays a working view.
        const items = deals.filter((x) => x.stage === stage && (isOpen(stage) || now - new Date(x.closeDate).getTime() < 30 * DAY));
        const total = items.reduce((s, x) => s + dealBase(d, x), 0);
        return (
          <section
            key={stage}
            className={cx('column', over === stage && 'drop')}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(stage);
            }}
            onDragLeave={() => setOver((s) => (s === stage ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData('text/plain');
              if (id) onDrop(id, stage);
            }}
            aria-label={`${stage} column`}
          >
            <div className="column-head">
              <StagePill stage={stage} />
              <small>{items.length}</small>
              <span className="muted num" style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 650 }}>
                {fmt(total)}
              </span>
            </div>
            {!isOpen(stage) && <small className="muted" style={{ padding: '0 6px' }}>Last 30 days</small>}
            {items.map((x) => {
              const days = (new Date(x.closeDate).getTime() - now) / DAY;
              const closeTone = isOpen(x.stage) ? (days < 0 ? 'var(--down)' : days < 7 ? 'var(--warn)' : 'var(--ink-3)') : 'var(--ink-3)';
              const owner = d.users.find((u) => u.id === x.ownerId);
              return (
                <article
                  key={x.id}
                  className={cx('kcard', dragging === x.id && 'dragging')}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', x.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDragging(x.id);
                  }}
                  onDragEnd={() => setDragging(null)}
                  onClick={() => navigate(`/pipeline/${x.id}`)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/pipeline/${x.id}`)}
                >
                  <b>{x.title.split(': ')[1] ?? x.title}</b>
                  <span className="muted" style={{ fontSize: 12.5, marginTop: -6 }}>
                    {d.accounts.find((a) => a.id === x.accountId)?.name}
                  </span>
                  <div className="row between">
                    <b className="num" style={{ fontSize: 15 }}>
                      {money(x.amount, x.currency, { compact: true })}
                    </b>
                    {owner && <Avatar name={owner.name} hue={owner.hue} size="sm" />}
                  </div>
                  <div className="row" style={{ gap: 5, fontSize: 12, color: closeTone, fontWeight: 600 }}>
                    <CalendarClock size={13} />
                    {isOpen(x.stage) ? (days < 0 ? `Overdue ${relTime(x.closeDate)}` : `Closes ${relTime(x.closeDate)}`) : `Closed ${relTime(x.closeDate)}`}
                  </div>
                </article>
              );
            })}
            {!items.length && <div className="muted" style={{ fontSize: 12.5, padding: '10px 6px' }}>Drop a deal here</div>}
          </section>
        );
      })}
    </div>
  );
}

function DealSheet({ id, onClose, onLose }: { id: string; onClose: () => void; onLose: (d: Deal) => void }) {
  const d = useDB();
  const can = useCan();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deal = d.deals.find((x) => x.id === id);
  if (!deal) return null;
  const editable = can('edit');
  const account = d.accounts.find((a) => a.id === deal.accountId);
  const contact = d.contacts.find((c) => c.id === deal.contactId);
  const path = [...OPEN_STAGES, 'Won'] as Stage[];
  const lost = deal.stage === 'Lost';
  const lastOpen = lost ? [...deal.history].reverse().find((h) => h.stage !== 'Lost')?.stage ?? 'New' : deal.stage;
  const current = path.indexOf(lastOpen as Stage);
  const next = isOpen(deal.stage) ? path[current + 1] : undefined;
  const when = (s: Stage) => {
    const h = [...deal.history].reverse().find((x) => x.stage === s);
    return h ? dateTime(h.at) : undefined;
  };
  const docs = d.docs.filter((x) => x.dealId === deal.id);

  return (
    <Sheet
      wide
      title={deal.title}
      sub={
        <span className="row wrap" style={{ gap: 8 }}>
          <StagePill stage={deal.stage} /> {userName(d, deal.ownerId)} · created {shortDate(deal.createdAt)}
        </span>
      }
      onClose={onClose}
      footer={
        editable && (
          <>
            {can('delete') && (
              <button className="btn ghost" style={{ marginRight: 'auto', color: 'var(--down)' }} onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )}
            {isOpen(deal.stage) && (
              <button className="btn" onClick={() => onLose(deal)}>
                Mark lost
              </button>
            )}
            {!isOpen(deal.stage) && (
              <button
                className="btn"
                onClick={() => {
                  moveDeal(deal.id, lastOpen === 'Won' ? 'Negotiation' : (lastOpen as Stage));
                  toast('Deal reopened');
                }}
              >
                Reopen
              </button>
            )}
            {next && (
              <button
                className="btn primary"
                onClick={() => {
                  moveDeal(deal.id, next);
                  toast(next === 'Won' ? `🎉 ${deal.title} won` : `Moved to ${next}`);
                }}
              >
                {next === 'Won' ? 'Mark as won' : `Move to ${next}`}
              </button>
            )}
          </>
        )
      }
    >
      <Stepper steps={path.map((s) => ({ label: s, sub: when(s) }))} current={deal.stage === 'Won' ? path.length - 1 : current} lost={lost} />
      {lost && (
        <div className="box" style={{ background: 'var(--down-soft)', color: 'var(--down)', borderColor: 'transparent' }}>
          Lost at {lastOpen}. Reason: <b>{deal.lostReason ?? 'not recorded'}</b>
        </div>
      )}
      <div className="form-grid">
        <Field label="Amount">
          <div className="row" style={{ gap: 6 }}>
            <input className="input" type="number" min={0} defaultValue={deal.amount} key={deal.id + deal.amount} disabled={!editable} onBlur={(e) => Number(e.target.value) !== deal.amount && updateDeal(deal.id, { amount: Math.max(0, Number(e.target.value)) })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
            <select className="select" style={{ width: 90 }} value={deal.currency} disabled={!editable} onChange={(e) => updateDeal(deal.id, { currency: e.target.value as never })}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </Field>
        <Field label="Expected close">
          <input className="input" type="date" value={isoDay(new Date(deal.closeDate))} disabled={!editable} onChange={(e) => e.target.value && updateDeal(deal.id, { closeDate: new Date(e.target.value).toISOString() })} />
        </Field>
        <Field label="Owner">
          <OwnerSelect value={deal.ownerId} onChange={(v) => updateDeal(deal.id, { ownerId: v })} disabled={!editable} />
        </Field>
        <Field label="Probability" hint="Set by the stage">
          <input className="input" value={`${STAGE_PROBABILITY[deal.stage]}%`} disabled />
        </Field>
        <Field label="Next step" full>
          <input className="input" defaultValue={deal.nextStep ?? ''} key={deal.id} placeholder="What has to happen next?" disabled={!editable} onBlur={(e) => e.target.value !== (deal.nextStep ?? '') && updateDeal(deal.id, { nextStep: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        </Field>
      </div>
      <div className="kv box">
        <div>
          <span>Account</span>
          <b>{account ? <Link to={`/customers/${account.id}`}>{account.name}</Link> : '—'}</b>
        </div>
        <div>
          <span>Contact</span>
          <b>{contact ? <Link to={`/contacts/${contact.id}`}>{contact.name}</Link> : '—'}</b>
        </div>
        <div>
          <span>Source</span>
          <b>{deal.source}</b>
        </div>
        <div>
          <span>Days in pipeline</span>
          <b>{Math.max(0, Math.round(((isOpen(deal.stage) ? Date.now() : new Date(deal.closeDate).getTime()) - new Date(deal.createdAt).getTime()) / DAY))}</b>
        </div>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <div className="row between">
          <span className="section-label">Quotes & invoices</span>
          {editable && can('invoices') && (
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm" onClick={() => navigate(`/finance?new=quote&deal=${deal.id}`)}>
                New quote
              </button>
              {deal.stage === 'Won' && (
                <button className="btn sm" onClick={() => navigate(`/finance?new=invoice&deal=${deal.id}`)}>
                  New invoice
                </button>
              )}
            </div>
          )}
        </div>
        {docs.map((x) => (
          <button key={x.id} className="menu-item box" onClick={() => navigate(`/finance/${x.id}`)}>
            <FileText size={15} className="muted" />
            <span className="grow">{x.number}</span>
            <DocPill status={docStatus(x)} />
            <b className="num">{money(docTotals(x).total, x.currency)}</b>
          </button>
        ))}
        {!docs.length && <span className="muted">None yet.</span>}
      </div>
      {editable && <ActivityComposer related={[{ kind: 'deal', id: deal.id }, { kind: 'account', id: deal.accountId }, ...(deal.contactId ? [{ kind: 'contact' as const, id: deal.contactId }] : [])]} />}
      <div className="stack" style={{ gap: 10 }}>
        <span className="section-label">Activity</span>
        <Timeline items={activitiesFor(d, 'deal', deal.id)} />
      </div>
      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${deal.title}"?`}
          body="The deal and its stage history are removed for everyone. Linked invoices stay. This can't be undone."
          confirm="Delete deal"
          onConfirm={() => {
            deleteDeal(deal.id);
            toast('Deal deleted');
            onClose();
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </Sheet>
  );
}

function LostModal({ deal, onClose, onConfirm }: { deal: Deal; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState(LOST_REASONS[0]!);
  return (
    <Modal
      title={`Mark "${deal.title}" as lost?`}
      sub="The reason feeds the win/loss report."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn danger" onClick={() => onConfirm(reason)}>
            Mark lost
          </button>
        </>
      }
    >
      <div className="pills">
        {LOST_REASONS.map((r) => (
          <button key={r} className="pill-btn" aria-pressed={r === reason} onClick={() => setReason(r)}>
            {r}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function NewDealModal({ accountId, onClose, onCreated }: { accountId?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const d = useScoped();
  const me = useMe();
  const first = d.accounts.find((a) => a.id === accountId) ?? d.accounts[0];
  const [f, setF] = useState({ title: '', accountId: first?.id ?? '', contactId: '', amount: '', currency: first?.currency ?? 'INR', stage: 'New' as Stage, ownerId: me.id, closeDate: isoDay(new Date(Date.now() + 30 * DAY)), source: 'Referral' as LeadSource });
  const contacts = d.contacts.filter((c) => c.accountId === f.accountId);
  return (
    <Modal
      title="New deal"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!f.title.trim() || !f.accountId || !(Number(f.amount) > 0)}
            onClick={() => {
              const id = createDeal({ ...f, title: f.title.trim(), amount: Number(f.amount), contactId: f.contactId || contacts[0]?.id, closeDate: new Date(f.closeDate).toISOString() });
              toast('Deal created');
              onCreated(id);
            }}
          >
            Create deal
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Deal name" full>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Acme Logistics: Annual subscription" autoFocus />
        </Field>
        <Field label="Account">
          <select
            className="select"
            value={f.accountId}
            onChange={(e) => {
              const acc = d.accounts.find((a) => a.id === e.target.value);
              setF({ ...f, accountId: e.target.value, contactId: '', currency: acc?.currency ?? f.currency });
            }}
          >
            {d.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contact">
          <select className="select" value={f.contactId} onChange={(e) => setF({ ...f, contactId: e.target.value })}>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount">
          <input className="input" type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        <Field label="Currency">
          <select className="select" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as never })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Stage">
          <select className="select" value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value as Stage })}>
            {OPEN_STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Expected close">
          <input className="input" type="date" value={f.closeDate} onChange={(e) => setF({ ...f, closeDate: e.target.value })} />
        </Field>
        <Field label="Owner">
          <OwnerSelect value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} />
        </Field>
        <Field label="Source">
          <select className="select" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as LeadSource })}>
            {LEAD_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
