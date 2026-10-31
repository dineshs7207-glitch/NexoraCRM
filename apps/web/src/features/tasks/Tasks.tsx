import { CalendarClock, ChevronDown, MessageSquare, Plus, SquareCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCan, useScoped } from '../../data/access';
import { deleteTask, moveTask, saveTask } from '../../data/actions';
import { newId, useDB, useMe, userName } from '../../data/store';
import { TASK_COLUMNS, TASK_KINDS, type Task, type TaskColumn, type TaskKind } from '../../data/types';
import { isoDay, relTime } from '../../lib/format';
import { AutoTextarea, Avatar, ConfirmModal, Empty, Field, PageHeader, Popover, Progress, Segmented, Sheet, cx, toast } from '../../ui';
import { useIsMobile } from '../../lib/hooks';
import { Ring } from '../../ui/charts';
import { OwnerSelect } from '../common';

const DAY = 86_400_000;
const TAGS = ['Follow-up', 'Proposal', 'Demo', 'Contract', 'Onboarding', 'Account', 'Internal', 'Automation'];

function dueTone(t: Task) {
  if (t.column === 'Done') return 'var(--ink-3)';
  const days = (new Date(t.due).getTime() - Date.now()) / DAY;
  return days < 0 ? 'var(--down)' : days < 1.5 ? 'var(--warn)' : 'var(--ink-3)';
}

export function Tasks() {
  const d = useScoped();
  const me = useMe();
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const [scope, setScope] = useState<'mine' | 'team'>('mine');
  const [who, setWho] = useState<string | null>(null);
  const [over, setOver] = useState<TaskColumn | null>(null);
  const mobile = useIsMobile();
  const [col, setCol] = useState<TaskColumn>('To do');
  const tasks = d.tasks.filter((t) => (scope === 'mine' ? t.assigneeId === me.id : who ? t.assigneeId === who : true));
  const done = tasks.filter((t) => t.column === 'Done').length;
  const overdue = tasks.filter((t) => t.column !== 'Done' && new Date(t.due).getTime() < Date.now()).length;
  const people = d.users.filter((u) => d.tasks.some((t) => t.assigneeId === u.id));
  const openId = params.get('open');

  return (
    <>
      <PageHeader
        title="Tasks"
        tabs={<Segmented options={[{ value: 'mine', label: `My tasks ${d.tasks.filter((t) => t.assigneeId === me.id && t.column !== 'Done').length}` }, { value: 'team', label: 'Team' }] as const} value={scope} onChange={setScope} label="Scope" />}
        actions={
          can('edit') && (
            <button className="btn primary" onClick={() => setParams({ new: '1' })}>
              <Plus size={16} /> Add task
            </button>
          )
        }
      />
      <div className="card row wrap" style={{ marginBottom: 'var(--gutter)', gap: 22 }}>
        <div className="grow">
          <b style={{ fontSize: 15 }}>{scope === 'mine' ? 'Your follow-ups' : 'Team follow-ups'}</b>
          <div className="muted" style={{ fontSize: 13 }}>
            {tasks.length} tasks · {overdue ? <span style={{ color: 'var(--down)', fontWeight: 600 }}>{overdue} overdue</span> : 'nothing overdue'}
          </div>
        </div>
        {scope === 'team' && (
          <div className="row" style={{ gap: 8 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>
              Show cards for
            </span>
            <div className="row" style={{ gap: 4 }}>
              {people.map((u) => (
                <button key={u.id} onClick={() => setWho(who === u.id ? null : u.id)} aria-pressed={who === u.id} style={{ border: 0, padding: 0, background: 'none', borderRadius: '50%', boxShadow: who === u.id ? '0 0 0 2px var(--ink)' : undefined, opacity: who && who !== u.id ? 0.45 : 1 }} title={u.name}>
                  <Avatar name={u.name} hue={u.hue} />
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="row" style={{ gap: 10, color: 'var(--c-main)' }}>
          <Ring value={tasks.length ? (done / tasks.length) * 100 : 0} />
          <span className="muted" style={{ fontSize: 12.5 }}>
            {done} of {tasks.length} done
          </span>
        </div>
      </div>
      {mobile ? (
        <div>
          <div className="stage-chips" role="tablist" aria-label="Columns">
            {TASK_COLUMNS.map((c) => (
              <button key={c} role="tab" className="pill-btn" aria-pressed={c === col} aria-selected={c === col} onClick={() => setCol(c)}>
                {c} <span className="count">{tasks.filter((t) => t.column === c).length}</span>
              </button>
            ))}
          </div>
          <div className="mobile-list" key={col}>
            {tasks
              .filter((t) => t.column === col)
              .sort((a, b) => a.due.localeCompare(b.due))
              .map((t) => (
                <TaskCard
                  key={t.id}
                  t={t}
                  onOpen={() => setParams({ open: t.id })}
                  footer={
                    can('edit') && (
                      <Popover
                        width={190}
                        trigger={({ toggle }) => (
                          <button className="btn sm" onClick={toggle}>
                            Move <ChevronDown size={14} />
                          </button>
                        )}
                      >
                        {(close) => (
                          <div>
                            <h4>Move to</h4>
                            {TASK_COLUMNS.filter((c) => c !== t.column).map((c) => (
                              <button
                                key={c}
                                className="menu-item"
                                onClick={() => {
                                  close();
                                  moveTask(t.id, c);
                                  toast(`Task moved to ${c}`);
                                }}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        )}
                      </Popover>
                    )
                  }
                />
              ))}
            {!tasks.some((t) => t.column === col) && <Empty title={`Nothing in ${col}`} hint="Tasks you move here show up in this list." />}
          </div>
        </div>
      ) : (
      <div className="board">
        {TASK_COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.column === col).sort((a, b) => a.due.localeCompare(b.due));
          return (
            <section
              key={col}
              className={cx('column', over === col && 'drop')}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col);
              }}
              onDragLeave={() => setOver((c) => (c === col ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData('text/plain');
                const t = d.tasks.find((x) => x.id === id);
                if (t && t.column !== col && can('edit')) {
                  moveTask(id, col);
                  toast(`Task moved to ${col}`);
                }
              }}
              aria-label={`${col} column`}
            >
              <div className="column-head">
                {col} <small>{items.length}</small>
                {can('edit') && (
                  <button className="icon-btn sm" style={{ marginLeft: 'auto', width: 26, height: 26 }} aria-label={`Add task to ${col}`} onClick={() => setParams({ new: '1', column: col })}>
                    <Plus size={14} />
                  </button>
                )}
              </div>
              {items.map((t) => (
                <TaskCard key={t.id} t={t} onOpen={() => setParams({ open: t.id })} draggable />
              ))}
            </section>
          );
        })}
      </div>
      )}
      {openId && <TaskSheet id={openId} onClose={() => setParams({})} />}
      {params.get('new') && (
        <NewTask
          column={(params.get("column") as TaskColumn) ?? "To do"}
          date={params.get("date") ?? undefined}
          onClose={() => setParams({})}
          onCreated={(id) => setParams({ open: id })}
        />
      )}
    </>
  );
}

function TaskCard({ t, onOpen, draggable, footer }: { t: Task; onOpen: () => void; draggable?: boolean; footer?: React.ReactNode }) {
  const d = useDB();
  const checked = t.checklist.filter((c) => c.done).length;
  const assignee = d.users.find((u) => u.id === t.assigneeId);
  return (
    <article className="kcard" draggable={draggable} onDragStart={draggable ? (e) => e.dataTransfer.setData('text/plain', t.id) : undefined} onClick={onOpen} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="row between">
        <span className="tag">{t.tag}</span>
        {t.priority === 'High' && <span className="status down">High</span>}
      </div>
      <b>{t.title}</b>
      {t.checklist.length > 0 && (
        <div className="row" style={{ gap: 8, fontSize: 12 }}>
          <SquareCheck size={13} className="muted" />
          <span className="muted">
            {checked}/{t.checklist.length}
          </span>
          <div className="grow">
            <Progress value={(checked / t.checklist.length) * 100} tone="up" />
          </div>
        </div>
      )}
      <div className="row between" style={{ fontSize: 12, gap: 8 }}>
        <span className="row" style={{ gap: 5, color: dueTone(t), fontWeight: 600 }}>
          <CalendarClock size={13} />
          {t.column === 'Done' ? 'Done' : `Due ${relTime(t.due)}`}
        </span>
        <span className="row" style={{ gap: 8 }} onClick={(e) => footer && e.stopPropagation()}>
          {t.comments.length > 0 && (
            <span className="row muted" style={{ gap: 3 }}>
              <MessageSquare size={12} /> {t.comments.length}
            </span>
          )}
          {assignee && <Avatar name={assignee.name} hue={assignee.hue} size="sm" />}
          {footer}
        </span>
      </div>
    </article>
  );
}

function relatedLink(d: ReturnType<typeof useDB>, t: Task) {
  if (!t.related) return null;
  const { kind, id } = t.related;
  if (kind === 'deal') {
    const x = d.deals.find((y) => y.id === id);
    return x && <Link to={`/pipeline/${x.id}`}>{x.title}</Link>;
  }
  if (kind === 'lead') {
    const x = d.leads.find((y) => y.id === id);
    return x && <Link to={`/leads/${x.id}`}>{x.name}</Link>;
  }
  if (kind === 'account') {
    const x = d.accounts.find((y) => y.id === id);
    return x && <Link to={`/customers/${x.id}`}>{x.name}</Link>;
  }
  const x = d.contacts.find((y) => y.id === id);
  return x && <Link to={`/contacts/${x.id}`}>{x.name}</Link>;
}

function TaskSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useDB();
  const me = useMe();
  const can = useCan();
  const [item, setItem] = useState('');
  const [comment, setComment] = useState('');
  const [confirm, setConfirm] = useState(false);
  const t = d.tasks.find((x) => x.id === id);
  if (!t) return null;
  const editable = can('edit');
  const patch = (p: Partial<Task>) => saveTask({ ...t, ...p });
  return (
    <Sheet
      title="Task details"
      onClose={onClose}
      footer={
        <>
          {can('delete') && (
            <button className="btn ghost" style={{ color: 'var(--down)', marginRight: 'auto' }} onClick={() => setConfirm(true)}>
              <Trash2 size={14} /> Delete task
            </button>
          )}
          {editable && t.column !== 'Done' && (
            <button
              className="btn"
              onClick={() => {
                moveTask(t.id, 'Done');
                toast('Task completed');
              }}
            >
              Mark done
            </button>
          )}
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <Field label="Title">
        <input className="input" defaultValue={t.title} key={t.id} disabled={!editable} onBlur={(e) => e.target.value.trim() && e.target.value !== t.title && patch({ title: e.target.value.trim() })} />
      </Field>
      <div className="form-grid">
        <Field label="Column">
          <select className="select" value={t.column} disabled={!editable} onChange={(e) => moveTask(t.id, e.target.value as TaskColumn)}>
            {TASK_COLUMNS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Tag">
          <select className="select" value={t.tag} disabled={!editable} onChange={(e) => patch({ tag: e.target.value })}>
            {[...new Set([...TAGS, t.tag])].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Assignee">
          <OwnerSelect value={t.assigneeId} onChange={(v) => patch({ assigneeId: v })} disabled={!editable} />
        </Field>
        <Field label="Due date">
          <input className="input" type="date" value={isoDay(new Date(t.due))} disabled={!editable} onChange={(e) => e.target.value && patch({ due: new Date(`${e.target.value}T17:00:00`).toISOString() })} />
        </Field>
        <Field label="Priority">
          <select className="select" value={t.priority} disabled={!editable} onChange={(e) => patch({ priority: e.target.value as Task['priority'] })}>
            {['High', 'Medium', 'Low'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Related to">
          <div style={{ paddingTop: 10, fontWeight: 600 }}>{relatedLink(d, t) ?? <span className="muted">Nothing linked</span>}</div>
        </Field>
      </div>
      <Field label="Details">
        <AutoTextarea defaultValue={t.detail} key={`${t.id}d`} disabled={!editable} onBlur={(e) => e.target.value !== t.detail && patch({ detail: e.target.value })} />
      </Field>
      <div className="stack" style={{ gap: 8 }}>
        <span className="section-label">
          Checklist {t.checklist.filter((c) => c.done).length}/{t.checklist.length}
        </span>
        {t.checklist.map((c) => (
          <label key={c.id} className="row" style={{ gap: 10 }}>
            <input type="checkbox" className="check" checked={c.done} disabled={!editable} onChange={() => patch({ checklist: t.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} />
            <span style={{ textDecoration: c.done ? 'line-through' : undefined, color: c.done ? 'var(--ink-3)' : undefined }}>{c.text}</span>
          </label>
        ))}
        {editable && (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!item.trim()) return;
              patch({ checklist: [...t.checklist, { id: newId('ck'), text: item.trim(), done: false }] });
              setItem('');
            }}
          >
            <input className="input sm" placeholder="Add an item" value={item} onChange={(e) => setItem(e.target.value)} />
            <button className="btn sm" type="submit">
              Add
            </button>
          </form>
        )}
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <span className="section-label">Comments</span>
        {t.comments.map((c) => (
          <div key={c.id} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
            <Avatar name={userName(d, c.userId)} size="sm" />
            <div>
              <b style={{ fontSize: 13 }}>{userName(d, c.userId)}</b> <span className="muted" style={{ fontSize: 12 }}>{relTime(c.at)}</span>
              <p style={{ fontSize: 13.5 }}>{c.text}</p>
            </div>
          </div>
        ))}
        {editable && (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!comment.trim()) return;
              patch({ comments: [...t.comments, { id: newId('cm'), userId: me.id, text: comment.trim(), at: new Date().toISOString() }] });
              setComment('');
            }}
          >
            <input className="input sm" placeholder="Write a comment" value={comment} onChange={(e) => setComment(e.target.value)} />
            <button className="btn sm" type="submit">
              Post
            </button>
          </form>
        )}
      </div>
      {confirm && (
        <ConfirmModal
          title="Delete this task?"
          body="It's removed for everyone. This can't be undone."
          confirm="Delete task"
          onConfirm={() => {
            deleteTask(t.id);
            toast('Task deleted');
            onClose();
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </Sheet>
  );
}

function NewTask({ column, date, onClose, onCreated }: { column: TaskColumn; date?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const me = useMe();
  const [f, setF] = useState({ title: "", kind: "Task" as TaskKind, tag: "Follow-up", assigneeId: me.id, due: isoDay(date ? new Date(date) : new Date(Date.now() + DAY)), time: "10:00", priority: "Medium" as Task["priority"] });
  return (
    <Sheet
      title="New task"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!f.title.trim()}
            onClick={() => {
              const { time, ...rest } = f;
              const id = saveTask({ ...rest, title: f.title.trim(), column, due: new Date(`${f.due}T${time}:00`).toISOString() });
              toast('Task added');
              onCreated(id);
            }}
          >
            Add task
          </button>
        </>
      }
    >
      <Field label="Title">
        <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus placeholder="e.g. Call back about pricing" />
      </Field>
      <div className="form-grid">
        <Field label="Type">
          <select className="select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as TaskKind })}>
            {TASK_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Field>
        <Field label="Time">
          <input className="input" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        </Field>
        <Field label="Tag">
          <select className="select" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })}>
            {TAGS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select className="select" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Task['priority'] })}>
            {['High', 'Medium', 'Low'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Assignee">
          <OwnerSelect value={f.assigneeId} onChange={(v) => setF({ ...f, assigneeId: v })} />
        </Field>
        <Field label="Due date">
          <input className="input" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
        </Field>
      </div>
      <span className="muted">Goes into the "{column}" column.</span>
    </Sheet>
  );
}
