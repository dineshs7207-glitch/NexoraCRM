import { ChevronLeft, FastForward, Play, Plus, Trash2, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCan } from '../../data/access';
import { deleteAutomation, saveAutomation } from '../../data/actions';
import { FIELDS, linkFor, OPS, resumeDue, STEPS, testRun, TRIGGERS } from '../../data/automation';
import { newId, useDB, userName } from '../../data/store';
import { OPEN_STAGES, STAGES, type Automation, type Condition, type Step, type StepType, type TriggerType } from '../../data/types';
import { relTime } from '../../lib/format';
import { AutoTextarea, Card, ConfirmModal, Empty, Field, Popover, StatusPill, Switch, cx, toast } from '../../ui';
import { STEP_ICON } from './shared';

const DEFAULTS: Record<StepType, Step['config']> = {
  wait: { days: 1, hours: 0 },
  condition: { condition: { field: 'stage', op: 'eq', value: '' } },
  email: { subject: '', body: 'Hi {{contact}},\n\n\n\n{{owner}}' },
  task: { title: 'Follow up on {{deal}}', dueDays: 1, assignee: 'owner' },
  tag: { tag: '' },
  notify: { message: '' },
  update: { field: '', value: '' },
};

export function Builder() {
  const { id } = useParams();
  const d = useDB();
  const can = useCan();
  const navigate = useNavigate();
  const stored = d.automations.find((a) => a.id === id);
  const [draft, setDraft] = useState<Automation | undefined>(stored);
  const [selected, setSelected] = useState<string>('trigger');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const dirty = useRef(false);
  const editable = can('automations');

  // Re-sync when switching automations.
  useEffect(() => {
    setDraft(d.automations.find((a) => a.id === id));
    setSelected('trigger');
  }, [id]);

  // Autosave, debounced.
  useEffect(() => {
    if (!draft || !dirty.current) return;
    const t = window.setTimeout(() => {
      saveAutomation(draft, 'Edited automation');
      dirty.current = false;
    }, 500);
    return () => window.clearTimeout(t);
  }, [draft]);

  if (!stored || !draft) {
    return <Empty title="This automation doesn't exist" hint="It may have been deleted. Pick another from the list." action={<Link className="btn" to="/automations">Show automations</Link>} />;
  }

  const update = (patch: Partial<Automation>) => {
    if (!editable) return;
    dirty.current = true;
    setDraft((a) => ({ ...a!, ...patch }));
  };
  const updateStep = (sid: string, patch: Partial<Step>) => update({ steps: draft.steps.map((s) => (s.id === sid ? { ...s, ...patch, config: { ...s.config, ...patch.config } } : s)) });
  const insertStep = (at: number, type: StepType) => {
    const step: Step = { id: newId('s'), type, name: STEPS[type].label, config: structuredClone(DEFAULTS[type]) };
    const steps = [...draft.steps];
    steps.splice(at, 0, step);
    update({ steps });
    setSelected(step.id);
  };
  const removeStep = (sid: string) => {
    update({ steps: draft.steps.filter((s) => s.id !== sid) });
    setSelected('trigger');
  };
  const kind = TRIGGERS[draft.trigger.type].kind;
  const step = draft.steps.find((s) => s.id === selected);
  const runs = stored.runs;
  const r30 = runs.filter((r) => !r.test && Date.now() - new Date(r.at).getTime() < 30 * 86_400_000);
  const waiting = runs.filter((r) => r.status === 'Waiting').length;

  const addButton = (at: number) =>
    editable ? (
      <Popover
        align="left"
        trigger={({ toggle }) => (
          <button className="add-step" onClick={toggle} aria-label="Add a step here">
            <Plus size={14} />
          </button>
        )}
      >
        {(close) => (
          <div>
            <h4>Add a step</h4>
            {(Object.keys(STEPS) as StepType[]).map((t) => {
              const Icon = STEP_ICON[t];
              return (
                <button
                  key={t}
                  className="menu-item"
                  onClick={() => {
                    insertStep(at, t);
                    close();
                  }}
                >
                  <Icon size={15} />
                  <span>
                    <b style={{ display: 'block', fontWeight: 650 }}>{STEPS[t].label}</b>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {STEPS[t].hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Popover>
    ) : (
      <span className="connector" />
    );

  return (
    <>
      <div className="row between wrap" style={{ marginBottom: 12 }}>
        <Link to="/automations" className="back-link" style={{ marginBottom: 0 }}>
          <ChevronLeft size={16} /> All automations
        </Link>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {editable ? 'Changes save automatically' : 'Read only for your role'} · last edited {relTime(stored.updatedAt)} by {userName(d, stored.updatedBy)}
        </span>
      </div>
      <div className="page-head">
        <input className="page-title" aria-label="Automation name" value={draft.name} disabled={!editable} onChange={(e) => update({ name: e.target.value })} style={{ border: 0, background: 'transparent', padding: 0, width: '100%', maxWidth: 700, outline: 'none' }} />
      </div>

      <div className="grid g-1-2" style={{ alignItems: 'start', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(300px, 1fr)' }}>
        <div className="canvas" role="list" aria-label="Automation steps">
          <button className={cx('node trigger', selected === 'trigger' && 'selected')} onClick={() => setSelected('trigger')} role="listitem">
            <span className="node-icon">
              <Zap size={17} />
            </span>
            <span className="grow">
              <small>Trigger</small>
              <b>
                {TRIGGERS[draft.trigger.type].label}
                {draft.trigger.stage ? `: ${draft.trigger.stage}` : ''}
              </b>
            </span>
          </button>
          <span className="connector" />
          {addButton(0)}
          {draft.steps.map((s, i) => {
            const Icon = STEP_ICON[s.type];
            return (
              <div key={s.id} className="stack" style={{ alignItems: 'center', gap: 0, width: '100%' }}>
                <span className="connector" />
                <div className={cx('node', selected === s.id && 'selected')} role="listitem">
                  <button className="row grow" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', gap: 12 }} onClick={() => setSelected(s.id)}>
                    <span className="node-icon">
                      <Icon size={17} />
                    </span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <small>{STEPS[s.type].label}</small>
                      <b className="ellipsis" style={{ display: 'block' }}>
                        {s.name}
                      </b>
                    </span>
                  </button>
                  {editable && (
                    <button className="icon-btn sm" aria-label={`Remove ${s.name}`} onClick={() => removeStep(s.id)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <span className="connector" />
                {addButton(i + 1)}
              </div>
            );
          })}
          <span className="connector" />
          <span className="end-node">End</span>
        </div>

        <div className="stack" style={{ gap: 'var(--gutter)' }}>
          <Card title={selected === 'trigger' ? 'Trigger' : step ? STEPS[step.type].label : 'Step'} sub={selected === 'trigger' ? TRIGGERS[draft.trigger.type].hint : step && STEPS[step.type].hint}>
            {selected === 'trigger' ? (
              <div className="stack">
                <Field label="When">
                  <select className="select" value={draft.trigger.type} disabled={!editable} onChange={(e) => update({ trigger: { type: e.target.value as TriggerType, stage: e.target.value === 'deal.stage_changed' ? 'Proposal' : undefined } })}>
                    {(Object.keys(TRIGGERS) as TriggerType[]).map((t) => (
                      <option key={t} value={t}>
                        {TRIGGERS[t].label}
                      </option>
                    ))}
                  </select>
                </Field>
                {draft.trigger.type === 'deal.stage_changed' && (
                  <Field label="Stage">
                    <select className="select" value={draft.trigger.stage} disabled={!editable} onChange={(e) => update({ trigger: { ...draft.trigger, stage: e.target.value as never } })}>
                      {OPEN_STAGES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Re-entry" hint="Whether the same record can go through this flow more than once">
                  <select className="select" value={draft.reentry} disabled={!editable} onChange={(e) => update({ reentry: e.target.value as Automation['reentry'] })}>
                    <option value="once">Once per record</option>
                    <option value="every">Every time the trigger happens</option>
                  </select>
                </Field>
                <Field label="Description">
                  <AutoTextarea minRows={2} value={draft.description} disabled={!editable} onChange={(e) => update({ description: e.target.value })} />
                </Field>
              </div>
            ) : step ? (
              <StepInspector step={step} kind={kind} disabled={!editable} onChange={(patch) => updateStep(step.id, patch)} />
            ) : null}
          </Card>

          <Card title={draft.enabled ? 'Running' : 'Paused'} tools={<Switch checked={draft.enabled} disabled={!editable} label="Running" onChange={(v) => { update({ enabled: v }); toast(v ? 'Automation is running' : 'Automation paused'); }} />}>
            <p className="muted" style={{ fontSize: 13 }}>
              {draft.enabled ? 'Matching records enter this flow as soon as the trigger happens.' : 'Paused: nobody enters. Runs already waiting stay paused until you turn it back on.'}
            </p>
            <div className="kv" style={{ marginTop: 14 }}>
              <div>
                <span>Runs, 30 days</span>
                <b>{r30.length}</b>
              </div>
              <div>
                <span>Waiting</span>
                <b>{waiting}</b>
              </div>
            </div>
            <div className="row wrap" style={{ marginTop: 16, gap: 8 }}>
              <button
                className="btn"
                onClick={() => {
                  const run = testRun(draft.id);
                  toast(run ? 'Test run passed. Nothing was sent.' : 'No sample record to test with');
                  if (run) setOpenRun(run.id);
                }}
              >
                <Play size={14} /> Test run
              </button>
              {waiting > 0 && editable && (
                <button
                  className="btn"
                  title="Demo helper: finish all waits now"
                  onClick={() => {
                    const n = resumeDue(true);
                    toast(`${n} waiting run(s) continued`);
                  }}
                >
                  <FastForward size={14} /> Skip waits
                </button>
              )}
              {can('delete') && editable && (
                <button className="btn ghost" style={{ color: 'var(--down)', marginLeft: 'auto' }} onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </Card>

          <Card title="Recent runs" sub={`${runs.length} total`}>
            <div className="stack" style={{ gap: 2 }}>
              {runs.slice(0, 12).map((r) => (
                <div key={r.id}>
                  <button className="menu-item" onClick={() => setOpenRun(openRun === r.id ? null : r.id)} aria-expanded={openRun === r.id}>
                    <span className="grow ellipsis">
                      {r.label}
                      <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                        {relTime(r.at)}
                        {r.status === 'Waiting' && r.resumeAt ? ` · continues ${relTime(r.resumeAt)}` : ''}
                      </span>
                    </span>
                    <StatusPill tone={r.status === 'Completed' || r.status === 'Passed (test)' ? 'up' : r.status === 'Waiting' ? 'info' : r.status === 'Failed' ? 'down' : 'warn'}>{r.status}</StatusPill>
                  </button>
                  {openRun === r.id && (
                    <div className="box" style={{ margin: '4px 10px 8px', fontSize: 12.5, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                      {r.log.map((l, i) => (
                        <div key={i}>{l}</div>
                      ))}
                      {r.ref && (
                        <button className="btn sm" style={{ marginTop: 8 }} onClick={() => navigate(linkFor(r.ref!))}>
                          Open record
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {!runs.length && <span className="muted">No runs yet. Runs show here as records enter the flow.</span>}
            </div>
          </Card>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${draft.name}"?`}
          body="It stops straight away. Records already in the flow won't get any more steps."
          confirm="Delete automation"
          onConfirm={() => {
            deleteAutomation(draft.id);
            toast('Automation deleted');
            navigate('/automations');
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

function StepInspector({ step, kind, disabled, onChange }: { step: Step; kind: keyof typeof FIELDS; disabled: boolean; onChange: (patch: Partial<Step>) => void }) {
  const d = useDB();
  const c = step.config;
  const set = (config: Step['config']) => onChange({ config });
  const fields = FIELDS[kind];
  const cond: Condition = c.condition ?? { field: fields[0]!.key, op: 'eq', value: '' };
  const mergeHint = kind === 'doc' ? '{{contact}} {{account}} {{number}} {{amount}} {{due}} {{owner}}' : kind === 'lead' ? '{{name}} {{company}} {{amount}} {{owner}}' : '{{contact}} {{account}} {{deal}} {{amount}} {{owner}}';
  return (
    <div className="stack">
      <Field label="Step name">
        <input className="input" value={step.name} disabled={disabled} onChange={(e) => onChange({ name: e.target.value })} autoFocus />
      </Field>
      {step.type === 'wait' && (
        <div className="form-grid">
          <Field label="Days">
            <input className="input" type="number" min={0} value={c.days ?? 0} disabled={disabled} onChange={(e) => set({ days: Math.max(0, Number(e.target.value)) })} />
          </Field>
          <Field label="Hours">
            <input className="input" type="number" min={0} max={23} value={c.hours ?? 0} disabled={disabled} onChange={(e) => set({ hours: Math.max(0, Number(e.target.value)) })} />
          </Field>
        </div>
      )}
      {step.type === 'condition' && (
        <>
          <div className="form-grid">
            <Field label="Field">
              <select className="select" value={cond.field} disabled={disabled} onChange={(e) => set({ condition: { ...cond, field: e.target.value } })}>
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Operator">
              <select className="select" value={cond.op} disabled={disabled} onChange={(e) => set({ condition: { ...cond, op: e.target.value as Condition['op'] } })}>
                {(Object.keys(OPS) as Condition['op'][]).map((o) => (
                  <option key={o} value={o}>
                    {OPS[o]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Value">
            {cond.field === 'stage' ? (
              <select className="select" value={cond.value} disabled={disabled} onChange={(e) => set({ condition: { ...cond, value: e.target.value } })}>
                <option value="">Choose…</option>
                {STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            ) : (
              <input className="input" value={cond.value} disabled={disabled} onChange={(e) => set({ condition: { ...cond, value: e.target.value } })} />
            )}
          </Field>
          <span className="muted" style={{ fontSize: 12.5 }}>
            If this is false, the run ends here.
          </span>
        </>
      )}
      {step.type === 'email' && (
        <>
          <Field label="Subject">
            <input className="input" value={c.subject ?? ''} disabled={disabled} onChange={(e) => set({ subject: e.target.value })} />
          </Field>
          <Field label="Message" hint={`Merge fields: ${mergeHint}`}>
            <AutoTextarea minRows={5} maxRows={16} value={c.body ?? ''} disabled={disabled} onChange={(e) => set({ body: e.target.value })} />
          </Field>
          <span className="muted" style={{ fontSize: 12.5 }}>
            In this preview the email is added to the Inbox thread. Real sending starts when email is connected (Phase 6).
          </span>
        </>
      )}
      {step.type === 'task' && (
        <>
          <Field label="Task title" hint={`Merge fields: ${mergeHint}`}>
            <input className="input" value={c.title ?? ''} disabled={disabled} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <div className="form-grid">
            <Field label="Assign to">
              <select className="select" value={c.assignee ?? 'owner'} disabled={disabled} onChange={(e) => set({ assignee: e.target.value })}>
                <option value="owner">Record owner</option>
                {d.users
                  .filter((u) => u.role !== 'Viewer')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Due in (days)">
              <input className="input" type="number" min={0} value={c.dueDays ?? 1} disabled={disabled} onChange={(e) => set({ dueDays: Math.max(0, Number(e.target.value)) })} />
            </Field>
          </div>
        </>
      )}
      {step.type === 'tag' && (
        <Field label="Tag" hint={kind === 'lead' ? 'Added to the lead' : 'Added to the account'}>
          <input className="input" value={c.tag ?? ''} disabled={disabled} onChange={(e) => set({ tag: e.target.value })} />
        </Field>
      )}
      {step.type === 'notify' && (
        <Field label="Message" hint={`Merge fields: ${mergeHint}`}>
          <AutoTextarea minRows={2} value={c.message ?? ''} disabled={disabled} onChange={(e) => set({ message: e.target.value })} />
        </Field>
      )}
      {step.type === 'update' && (
        <div className="form-grid">
          <Field label="Field">
            <select className="select" value={c.field ?? ''} disabled={disabled} onChange={(e) => set({ field: e.target.value })}>
              <option value="">Choose…</option>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="New value">
            <input className="input" value={c.value ?? ''} disabled={disabled} onChange={(e) => set({ value: e.target.value })} />
          </Field>
        </div>
      )}
    </div>
  );
}
