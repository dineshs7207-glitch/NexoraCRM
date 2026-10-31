import { ArrowRightLeft, Bolt, CheckSquare, FileText, Mail, MessageSquare, Phone, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logActivity } from '../data/actions';
import { useDB } from '../data/store';
import type { Activity, ActivityType, Currency, DB, LeadStatus, SalesDoc, Stage } from '../data/types';
import { money, relTime } from '../lib/format';
import { AutoTextarea, Segmented, StatusPill, type Tone } from '../ui';

export const STAGE_TONE: Record<Stage, Tone> = {
  New: 'neutral',
  Contacted: 'info',
  Qualified: 'info',
  Proposal: 'warn',
  Negotiation: 'warn',
  Won: 'up',
  Lost: 'down',
};
export const LEAD_TONE: Record<LeadStatus, Tone> = { New: 'info', Contacted: 'neutral', Qualified: 'up', Unqualified: 'down', Converted: 'up' };
export const DOC_TONE: Record<string, Tone> = { Draft: 'neutral', Sent: 'info', Paid: 'up', Overdue: 'down', Void: 'neutral', Accepted: 'up', Declined: 'down' };

export function StagePill({ stage }: { stage: Stage }) {
  return <StatusPill tone={STAGE_TONE[stage]}>{stage}</StatusPill>;
}
export function DocPill({ status }: { status: SalesDoc['status'] }) {
  return <StatusPill tone={DOC_TONE[status]}>{status}</StatusPill>;
}

/** Formats an amount in the company base currency. */
export function useBaseMoney() {
  const d = useDB();
  return (v: number, compact = true) => money(v, d.company.baseCurrency, { compact });
}

export function baseCurrency(d: DB): Currency {
  return d.company.baseCurrency;
}

const ACT_ICON: Record<ActivityType, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: MessageSquare,
  stage: ArrowRightLeft,
  task: CheckSquare,
  invoice: FileText,
  automation: Bolt,
};

export function Timeline({ items, limit = 12 }: { items: Activity[]; limit?: number }) {
  const d = useDB();
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, limit);
  if (!items.length) return <div className="muted">No activity yet.</div>;
  return (
    <div className="timeline">
      {shown.map((a) => {
        const Icon = ACT_ICON[a.type] ?? MessageSquare;
        return (
          <div className="tl-item" key={a.id}>
            <span className="tl-icon">
              <Icon size={15} />
            </span>
            <div className="grow">
              <b>{a.title}</b>
              {a.body && <p style={{ whiteSpace: 'pre-wrap' }}>{a.body.length > 220 ? `${a.body.slice(0, 220)}…` : a.body}</p>}
              <small>
                {d.users.find((u) => u.id === a.userId)?.name ?? 'System'} · {relTime(a.at)}
              </small>
            </div>
          </div>
        );
      })}
      {items.length > limit && (
        <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAll((v) => !v)}>
          {all ? 'Show less' : `Show ${items.length - limit} more`}
        </button>
      )}
    </div>
  );
}

/** Quick logger for calls, emails, meetings and notes against one or more records. */
export function ActivityComposer({ related, disabled }: { related: Activity['related']; disabled?: boolean }) {
  const [type, setType] = useState<'note' | 'call' | 'email' | 'meeting'>('note');
  const [text, setText] = useState('');
  const labels = { note: 'Note', call: 'Call', email: 'Email', meeting: 'Meeting' } as const;
  return (
    <div className="box stack" style={{ gap: 10 }}>
      <Segmented options={(['note', 'call', 'email', 'meeting'] as const).map((v) => ({ value: v, label: labels[v] }))} value={type} onChange={setType} label="Activity type" />
      <AutoTextarea minRows={2} placeholder={type === 'note' ? 'Add a note only your team sees…' : `What happened on this ${labels[type].toLowerCase()}?`} value={text} onChange={(e) => setText(e.target.value)} disabled={disabled} />
      <div className="row between">
        <span className="muted" style={{ fontSize: 12 }}>
          Logged to the timeline of every linked record
        </span>
        <button
          className="btn primary sm"
          disabled={!text.trim() || disabled}
          onClick={() => {
            const title = type === 'note' ? 'Note added' : `${labels[type]} logged`;
            logActivity({ type, title, body: text.trim(), related });
            setText('');
          }}
        >
          Log {labels[type].toLowerCase()}
        </button>
      </div>
    </div>
  );
}

export function OwnerSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const d = useDB();
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {d.users
        .filter((u) => u.role !== 'Viewer' && u.status !== 'Deactivated')
        .map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
    </select>
  );
}

export function activitiesFor(d: DB, kind: Activity['related'][number]['kind'], id: string) {
  return d.activities.filter((a) => a.related.some((r) => r.kind === kind && r.id === id)).sort((a, b) => b.at.localeCompare(a.at));
}

export function TagToggles({ all, value, onChange, disabled }: { all: string[]; value: string[]; onChange: (tags: string[]) => void; disabled?: boolean }) {
  const options = [...new Set([...all, ...value])];
  return (
    <div className="pills">
      {options.map((t) => {
        const on = value.includes(t);
        return (
          <button key={t} type="button" className={`tag${on ? ' on' : ''}`} disabled={disabled} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== t) : [...value, t])}>
            {on ? '✓' : '+'} {t}
          </button>
        );
      })}
    </div>
  );
}

/** Pipeline holds both deals and leads; this switch sits next to the page title. */
export function PipelineTabs({ value }: { value: 'deals' | 'leads' }) {
  const navigate = useNavigate();
  return <Segmented options={[{ value: 'deals', label: 'Deals' }, { value: 'leads', label: 'Leads' }] as const} value={value} onChange={(v) => navigate(v === 'deals' ? '/pipeline' : '/leads')} label="Deals or leads" />;
}
