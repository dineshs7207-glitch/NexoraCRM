import { CalendarClock, Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCan, useScoped } from '../../data/access';
import { saveProject, toggleProjectStep } from '../../data/actions';
import { useDB, useMe } from '../../data/store';
import { PROJECT_STATUSES, type Project } from '../../data/types';
import { isoDay, relTime, shortDate } from '../../lib/format';
import { Avatar, Empty, Field, FilterPills, KpiTile, Modal, PageHeader, Progress, Sheet, StatusPill, cx, toast, type Tone } from '../../ui';
import { OwnerSelect } from '../common';

const DAY = 86_400_000;
const TONE: Record<Project['status'], Tone> = { Planning: 'neutral', 'In progress': 'info', 'In review': 'warn', Done: 'up' };

export function Projects() {
  const d = useScoped();
  const can = useCan();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<'All' | Project['status']>('All');
  const now = Date.now();
  const active = d.projects.filter((p) => p.status !== 'Done');
  const steps = d.projects.flatMap((p) => p.steps);
  const stepsPct = steps.length ? (steps.filter((s) => s.done).length / steps.length) * 100 : 0;
  const dueSoon = active.filter((p) => new Date(p.due).getTime() - now < 14 * DAY).length;
  const list = d.projects.filter((p) => status === 'All' || p.status === status).sort((a, b) => a.due.localeCompare(b.due));

  return (
    <>
      <PageHeader
        title="Customer Projects"
        sub="Onboarding after every won deal"
        actions={
          can('edit') && (
            <button className="btn primary" onClick={() => setParams({ new: '1' })}>
              <Plus size={16} /> New project
            </button>
          )
        }
      />
      <div className="kpis">
        <KpiTile hero label="Active projects" value={active.length} />
        <KpiTile label="Steps complete overall" value={`${stepsPct.toFixed(0)}%`} viz={<div style={{ width: 90 }}><Progress value={stepsPct} tone="up" /></div>} />
        <KpiTile label="Due in the next 14 days" value={dueSoon} />
        <KpiTile label="Delivered" info="Projects marked done." value={d.projects.length - active.length} />
      </div>
      <div className="row wrap" style={{ gap: 10, marginBottom: 16 }}>
        <FilterPills value={status} onChange={setStatus} options={[{ value: 'All' as const, label: 'All', count: d.projects.length }, ...PROJECT_STATUSES.map((s) => ({ value: s, label: s, count: d.projects.filter((p) => p.status === s).length }))]} />
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>
          {list.length} projects
        </span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {list.map((p) => (
          <ProjectCard key={p.id} p={p} onOpen={() => navigate(`/projects/${p.id}`)} />
        ))}
      </div>
      {!list.length && <Empty title="No projects here" hint="Projects start automatically when a deal is won." />}
      {id && <ProjectSheet id={id} onClose={() => navigate('/projects')} />}
      {params.get('new') && <NewProject onClose={() => setParams({})} onCreated={(pid) => navigate(`/projects/${pid}`)} />}
    </>
  );
}

function ProjectCard({ p, onOpen }: { p: Project; onOpen: () => void }) {
  const d = useDB();
  const acc = d.accounts.find((a) => a.id === p.accountId);
  const contact = d.contacts.find((c) => c.id === p.contactId);
  const done = p.steps.filter((s) => s.done).length;
  const next = p.steps.find((s) => !s.done);
  const days = (new Date(p.due).getTime() - Date.now()) / DAY;
  return (
    <button className="card stack" style={{ textAlign: 'left', border: 0, gap: 12 }} onClick={onOpen}>
      <div className="row" style={{ gap: 10 }}>
        <Avatar name={acc?.name ?? p.name} />
        <div className="grow" style={{ minWidth: 0 }}>
          <b className="ellipsis" style={{ display: 'block' }}>
            {acc?.name}
          </b>
          <span className="muted ellipsis" style={{ display: 'block', fontSize: 12.5 }}>
            {contact?.name ?? '—'}
          </span>
        </div>
        <StatusPill tone={TONE[p.status]}>{p.status}</StatusPill>
      </div>
      <b style={{ fontSize: 15 }}>{p.name.replace(`${acc?.name} `, '').replace(/^./, (c) => c.toUpperCase())}</b>
      <div className="stack" style={{ gap: 6 }}>
        <div className="row between" style={{ fontSize: 12.5 }}>
          <span className="muted">
            {done} of {p.steps.length} steps
          </span>
          <b className="num">{Math.round((done / p.steps.length) * 100)}%</b>
        </div>
        <Progress value={(done / p.steps.length) * 100} tone={p.status === 'Done' ? 'up' : undefined} />
      </div>
      <div className="row between" style={{ fontSize: 12.5, borderTop: '1px dashed var(--line-2)', paddingTop: 10, gap: 8 }}>
        <span className="stack" style={{ gap: 2, minWidth: 0 }}>
          <span className="ellipsis">{next ? `Next: ${next.name}` : 'All steps done'}</span>
          <span className="row" style={{ gap: 4, fontWeight: 600, color: p.status !== 'Done' && days < 0 ? 'var(--down)' : p.status !== 'Done' && days < 7 ? 'var(--warn)' : 'var(--ink-3)' }}>
            <CalendarClock size={12} /> {p.status === 'Done' ? `Delivered ${shortDate(p.due)}` : `Due ${relTime(p.due)}`}
          </span>
        </span>
        <span className="presence-stack">
          {p.team.slice(0, 3).map((uid) => {
            const u = d.users.find((x) => x.id === uid);
            return u ? <Avatar key={uid} name={u.name} hue={u.hue} size="sm" /> : null;
          })}
        </span>
      </div>
    </button>
  );
}

function ProjectSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useDB();
  const can = useCan();
  const p = d.projects.find((x) => x.id === id);
  if (!p) return null;
  const editable = can('edit');
  const acc = d.accounts.find((a) => a.id === p.accountId);
  const deal = d.deals.find((x) => x.id === p.dealId);
  const done = p.steps.filter((s) => s.done).length;
  return (
    <Sheet
      title={p.name}
      sub={
        <span className="row" style={{ gap: 8 }}>
          <StatusPill tone={TONE[p.status]}>{p.status}</StatusPill> {done} of {p.steps.length} steps
        </span>
      }
      onClose={onClose}
    >
      <Progress value={(done / p.steps.length) * 100} tone="up" />
      <div className="stack" style={{ gap: 4 }}>
        <span className="section-label">Steps</span>
        {p.steps.map((s, i) => (
          <div key={s.id} className="menu-item" style={{ cursor: 'default' }}>
            <button
              className={cx('check-circle', s.done && 'on')}
              disabled={!editable}
              aria-label={s.done ? `Mark "${s.name}" not done` : `Mark "${s.name}" done`}
              onClick={() => {
                toggleProjectStep(p.id, s.id);
                if (!s.done && done + 1 === p.steps.length) toast('🎉 Project delivered');
              }}
            >
              {s.done && <Check size={13} />}
            </button>
            <span className="grow" style={{ textDecoration: s.done ? 'line-through' : undefined, opacity: s.done ? 0.6 : 1 }}>
              <span className="muted num" style={{ marginRight: 8 }}>
                {i + 1}
              </span>
              {s.name}
            </span>
          </div>
        ))}
      </div>
      <div className="form-grid">
        <Field label="Owner">
          <OwnerSelect value={p.ownerId} onChange={(v) => saveProject({ ...p, ownerId: v, team: [...new Set([v, ...p.team])] })} disabled={!editable} />
        </Field>
        <Field label="Due date">
          <input className="input" type="date" value={isoDay(new Date(p.due))} disabled={!editable} onChange={(e) => e.target.value && saveProject({ ...p, due: new Date(e.target.value).toISOString() })} />
        </Field>
      </div>
      <div className="kv box">
        <div>
          <span>Customer</span>
          <b>{acc ? <Link to={`/customers/${acc.id}`}>{acc.name}</Link> : '—'}</b>
        </div>
        <div>
          <span>From deal</span>
          <b>{deal ? <Link to={`/pipeline/${deal.id}`}>{deal.title}</Link> : '—'}</b>
        </div>
        <div>
          <span>Started</span>
          <b>{shortDate(p.createdAt)}</b>
        </div>
        <div>
          <span>Team</span>
          <b>{p.team.map((u) => d.users.find((x) => x.id === u)?.name.split(' ')[0]).filter(Boolean).join(', ')}</b>
        </div>
      </div>
    </Sheet>
  );
}

function NewProject({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const d = useScoped();
  const me = useMe();
  const [f, setF] = useState({ accountId: d.accounts[0]?.id ?? '', name: '', ownerId: me.id, due: isoDay(new Date(Date.now() + 30 * DAY)) });
  const acc = d.accounts.find((a) => a.id === f.accountId);
  return (
    <Modal
      title="New project"
      sub="Uses the standard onboarding steps. You can tick them off as you go."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!f.accountId}
            onClick={() => {
              const id = saveProject({ accountId: f.accountId, ownerId: f.ownerId, name: f.name.trim() || `${acc?.name} onboarding`, due: new Date(f.due).toISOString(), contactId: d.contacts.find((c) => c.accountId === f.accountId)?.id });
              toast('Project created');
              onCreated(id);
            }}
          >
            Create project
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Customer" full>
          <select className="select" value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
            {d.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Project name" full>
          <input className="input" value={f.name} placeholder={`${acc?.name ?? ''} onboarding`} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Owner">
          <OwnerSelect value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} />
        </Field>
        <Field label="Due date">
          <input className="input" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
