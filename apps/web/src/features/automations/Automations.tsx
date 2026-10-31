import { Plus, Zap } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCan } from '../../data/access';
import { newAutomation, saveAutomation } from '../../data/actions';
import { TRIGGERS } from '../../data/automation';
import { useDB } from '../../data/store';
import { relTime } from '../../lib/format';
import { Card, Empty, Field, KpiTile, Modal, PageHeader, Segmented, StatusPill, Switch, cx, toast } from '../../ui';
import { FlowStrip, TEMPLATES } from './shared';

const DAY = 86_400_000;

export function Automations() {
  const d = useDB();
  const can = useCan();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [creating, setCreating] = useState(false);
  const now = Date.now();
  const list = d.automations.filter((a) => filter === 'all' || (filter === 'active' ? a.enabled : !a.enabled));
  const real = (a: (typeof d.automations)[number]) => a.runs.filter((r) => !r.test);
  const runs30 = d.automations.flatMap((a) => real(a).filter((r) => now - new Date(r.at).getTime() < 30 * DAY));
  const runsPrev = d.automations.flatMap((a) => real(a).filter((r) => now - new Date(r.at).getTime() >= 30 * DAY && now - new Date(r.at).getTime() < 60 * DAY));
  const tasksCreated = runs30.reduce((s, r) => s + r.log.filter((l) => l.startsWith('☑')).length, 0);
  const emails = runs30.reduce((s, r) => s + r.log.filter((l) => l.startsWith('✉')).length, 0);
  const waiting = d.automations.reduce((s, a) => s + a.runs.filter((r) => r.status === 'Waiting').length, 0);
  const editable = can('automations');

  return (
    <>
      <PageHeader
        title="Automations"
        tabs={<Segmented options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }] as const} value={filter} onChange={setFilter} label="Filter" />}
        actions={
          editable && (
            <button className="btn primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> New automation
            </button>
          )
        }
      />
      <div className="kpis">
        <KpiTile hero label="Active automations" value={`${d.automations.filter((a) => a.enabled).length} of ${d.automations.length}`} />
        <KpiTile label="Runs in 30 days" value={runs30.length} delta={runsPrev.length ? ((runs30.length - runsPrev.length) / runsPrev.length) * 100 : undefined} deltaNote="vs prior 30d" />
        <KpiTile label="Work done for the team" info="Tasks created and emails sent by automations in the last 30 days." value={`${tasksCreated + emails}`} link={{ label: `${tasksCreated} tasks · ${emails} emails`, onClick: () => navigate('/tasks') }} />
        <KpiTile label="Waiting runs" info="Runs paused on a Wait step. They continue automatically when the wait ends." value={waiting} />
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {list.map((a) => {
          const r30 = real(a).filter((r) => now - new Date(r.at).getTime() < 30 * DAY);
          const completed = r30.filter((r) => r.status === 'Completed').length;
          return (
            <Card key={a.id} className="stack" style={{ gap: 14 }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <b style={{ fontSize: 16 }}>{a.name}</b>
                  <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {a.description}
                  </p>
                </div>
                <Switch
                  checked={a.enabled}
                  label={`${a.enabled ? 'Pause' : 'Turn on'} ${a.name}`}
                  disabled={!editable}
                  onChange={(v) => {
                    saveAutomation({ ...a, enabled: v }, v ? 'Enabled automation' : 'Paused automation');
                    toast(v ? `${a.name} is running` : `${a.name} paused`);
                  }}
                />
              </div>
              <div className="row" style={{ gap: 8, fontSize: 12.5 }}>
                <Zap size={13} className="muted" />
                <span className="ink-2">
                  {TRIGGERS[a.trigger.type].label}
                  {a.trigger.stage ? `: ${a.trigger.stage}` : ''}
                </span>
              </div>
              <FlowStrip a={a} />
              <div className="kv" style={{ gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px dashed var(--line-2)', paddingTop: 12 }}>
                <div>
                  <span>Runs, 30 days</span>
                  <b>{r30.length}</b>
                </div>
                <div>
                  <span>Completed</span>
                  <b>{r30.length ? `${Math.round((completed / r30.length) * 100)}%` : '—'}</b>
                </div>
                <div>
                  <span>Edited</span>
                  <b>{relTime(a.updatedAt)}</b>
                </div>
              </div>
              <div className="row between">
                <StatusPill tone={a.enabled ? 'up' : 'neutral'}>{a.enabled ? 'Active' : 'Paused'}</StatusPill>
                <button className="btn sm" onClick={() => navigate(`/automations/${a.id}`)}>
                  Open builder
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      {!list.length && <Empty title={filter === 'paused' ? 'Nothing is paused' : 'No automations yet'} hint="Automations run steps for you when something happens in Nexora." />}
      {creating && <TemplatePicker onClose={() => setCreating(false)} onCreated={(id) => navigate(`/automations/${id}`)} />}
    </>
  );
}

function TemplatePicker({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [pick, setPick] = useState(0);
  const [name, setName] = useState(TEMPLATES[0]!.name);
  const t = TEMPLATES[pick]!;
  return (
    <Modal
      wide
      title="New automation"
      sub="Start from a template. You can change every step in the builder. New automations start paused."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!name.trim()}
            onClick={() => {
              const id = newAutomation({ ...t, name: name.trim() });
              toast(`${name} created`);
              onCreated(id);
            }}
          >
            Create automation
          </button>
        </>
      }
    >
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {TEMPLATES.map((tp, i) => (
          <button
            key={tp.name}
            className={cx('box stack')}
            style={{ textAlign: 'left', gap: 8, background: i === pick ? 'var(--accent-soft)' : 'transparent', borderColor: i === pick ? 'var(--ink)' : undefined }}
            aria-pressed={i === pick}
            onClick={() => {
              setPick(i);
              setName(tp.name);
            }}
          >
            <b>{tp.name}</b>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {tp.description}
            </span>
            <FlowStrip a={{ ...tp, id: '', enabled: false, runs: [], reentry: 'every', updatedAt: '', updatedBy: '', steps: tp.steps.map((s, k) => ({ ...s, id: String(k) })) }} />
          </button>
        ))}
      </div>
      <Field label="Name">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
    </Modal>
  );
}
