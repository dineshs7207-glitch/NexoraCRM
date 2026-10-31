import { Check, ChevronLeft, ChevronRight, Mail, Phone, Plus, SquareCheck, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCan, useScoped } from '../../data/access';
import { saveTask } from '../../data/actions';
import { useMe } from '../../data/store';
import { TASK_KINDS, type Task, type TaskKind } from '../../data/types';
import { useIsMobile } from '../../lib/hooks';
import { Avatar, Card, PageHeader, Segmented, cx, toast } from '../../ui';

const DAY = 86_400_000;
const KIND_ICON: Record<TaskKind, typeof Phone> = { Call: Phone, Meeting: Users, Task: SquareCheck, Email: Mail };
const KIND_LABEL: Record<TaskKind, string> = { Call: 'Calls', Meeting: 'Meetings', Task: 'Tasks', Email: 'Emails' };
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
/** Monday-based start of the week containing `d`. */
const startOfWeek = (d: Date) => {
  const s = startOfDay(d);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
};
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });

export function Schedule() {
  const d = useScoped();
  const me = useMe();
  const can = useCan();
  const mobile = useIsMobile();
  const navigate = useNavigate();
  const [view, setView] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [who, setWho] = useState<string>('all');
  const [kinds, setKinds] = useState<Set<TaskKind>>(new Set(TASK_KINDS));

  const items = useMemo(() => d.tasks.filter((t) => (who === 'all' || t.assigneeId === who) && kinds.has(t.kind ?? 'Task')).sort((a, b) => a.due.localeCompare(b.due)), [d.tasks, who, kinds]);
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of items) {
      const k = new Date(t.due).toDateString();
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return m;
  }, [items]);

  const today = startOfDay(new Date());
  const mine = d.tasks.filter((t) => t.assigneeId === me.id);
  const todayCount = mine.filter((t) => sameDay(new Date(t.due), today)).length;
  const weekCount = mine.filter((t) => {
    const x = new Date(t.due).getTime();
    return x >= startOfWeek(today).getTime() && x < startOfWeek(today).getTime() + 7 * DAY;
  }).length;
  const overdue = mine.filter((t) => t.column !== 'Done' && new Date(t.due).getTime() < today.getTime()).length;

  // Visible days: a 6-week month grid or a single week.
  const days = useMemo(() => {
    const first = view === 'month' ? startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1)) : startOfWeek(cursor);
    return Array.from({ length: view === 'month' ? 42 : 7 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  }, [view, cursor]);
  const shift = (dir: number) => {
    const c = new Date(cursor);
    if (view === 'month') c.setMonth(c.getMonth() + dir, 1);
    else c.setDate(c.getDate() + dir * 7);
    setCursor(c);
  };
  const title = view === 'month' ? cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : `Week of ${startOfWeek(cursor).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  const agenda = byDay.get(selected.toDateString()) ?? [];
  const people = d.users.filter((u) => u.role !== 'Viewer' && d.tasks.some((t) => t.assigneeId === u.id));
  const open = (t: Task) => navigate(`/tasks?open=${t.id}`);
  const toggleDone = (t: Task) => {
    const done = t.column === 'Done';
    saveTask({ ...t, column: done ? 'To do' : 'Done' });
    if (!done) toast('Marked done');
  };

  return (
    <>
      <PageHeader
        title="Team Schedule"
        sub={`${todayCount} today · ${weekCount} this week${overdue ? ` · ${overdue} overdue` : ''}`}
        actions={
          can('edit') && (
            <button className="btn primary" onClick={() => navigate(`/tasks?new=1&date=${selected.toISOString()}`)}>
              <Plus size={16} /> New task
            </button>
          )
        }
      />
      <div className="row wrap" style={{ gap: 10, marginBottom: 16 }}>
        <div className="pills">
          <button className="pill-btn" aria-pressed={who === 'all'} onClick={() => setWho('all')}>
            Everyone
          </button>
          {people.map((u) => (
            <button key={u.id} className="pill-btn" aria-pressed={who === u.id} onClick={() => setWho(u.id)}>
              <Avatar name={u.name} hue={u.hue} size="sm" /> {u.name.split(' ')[0]}
            </button>
          ))}
        </div>
        <div className="pills" style={{ marginLeft: 'auto' }}>
          {TASK_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            const on = kinds.has(k);
            return (
              <button
                key={k}
                className="pill-btn"
                aria-pressed={on}
                onClick={() => {
                  const next = new Set(kinds);
                  if (on) next.delete(k);
                  else next.add(k);
                  setKinds(next.size ? next : new Set(TASK_KINDS));
                }}
              >
                <Icon size={14} /> {KIND_LABEL[k]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid g-1-2" style={{ gridTemplateColumns: mobile ? undefined : 'minmax(0, 2fr) minmax(300px, 1fr)', alignItems: 'start' }}>
        <Card
          title={title}
          tools={
            <>
              <button className="icon-btn sm" onClick={() => shift(-1)} aria-label="Previous">
                <ChevronLeft size={16} />
              </button>
              <button
                className="btn sm"
                onClick={() => {
                  setCursor(today);
                  setSelected(today);
                }}
              >
                Today
              </button>
              <button className="icon-btn sm" onClick={() => shift(1)} aria-label="Next">
                <ChevronRight size={16} />
              </button>
              <Segmented options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }] as const} value={view} onChange={setView} label="Calendar view" />
            </>
          }
        >
          <div className={cx('cal', view)} role="grid" aria-label={title}>
            {WEEKDAYS.map((w) => (
              <div key={w} className="cal-head" role="columnheader">
                {mobile ? w[0] : w}
              </div>
            ))}
            {days.map((day) => {
              const list = byDay.get(day.toDateString()) ?? [];
              const outside = view === 'month' && day.getMonth() !== cursor.getMonth();
              const max = view === 'week' ? 8 : 3;
              return (
                <div
                  key={day.toISOString()}
                  role="gridcell"
                  tabIndex={0}
                  className={cx('cal-cell', outside && 'outside', sameDay(day, today) && 'today', sameDay(day, selected) && 'selected')}
                  onClick={() => setSelected(day)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelected(day)}
                  aria-label={`${day.toDateString()}, ${list.length} items`}
                >
                  <span className="cal-date">{day.getDate()}</span>
                  {mobile ? (
                    <span className="cal-dots">
                      {list.slice(0, 3).map((t) => (
                        <i key={t.id} className={cx('dot', t.kind ?? 'Task')} />
                      ))}
                    </span>
                  ) : (
                    <>
                      {list.slice(0, max).map((t) => (
                        <button
                          key={t.id}
                          className={cx('cal-event', t.kind ?? 'Task', t.column === 'Done' && 'done')}
                          onClick={(e) => {
                            e.stopPropagation();
                            open(t);
                          }}
                          title={`${time(t.due)} ${t.title}`}
                        >
                          <b>{time(t.due)}</b> {t.title}
                        </button>
                      ))}
                      {list.length > max && <span className="cal-more">+{list.length - max} more</span>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="legend" style={{ marginTop: 12 }}>
            {TASK_KINDS.map((k) => (
              <span key={k}>
                <i className={cx('dot', k)} style={{ borderRadius: 9 }} />
                {KIND_LABEL[k]}
              </span>
            ))}
          </div>
        </Card>

        <Card title={sameDay(selected, today) ? 'Today' : selected.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} sub={`${agenda.filter((t) => t.column === 'Done').length}/${agenda.length} done`}>
          <div className="stack" style={{ gap: 4 }}>
            {agenda.map((t) => {
              const Icon = KIND_ICON[t.kind ?? 'Task'];
              const done = t.column === 'Done';
              const owner = d.users.find((u) => u.id === t.assigneeId);
              return (
                <div key={t.id} className="menu-item" style={{ cursor: 'default' }}>
                  <button className={cx('check-circle', done && 'on')} aria-label={done ? 'Mark not done' : 'Mark done'} onClick={() => toggleDone(t)} disabled={!can('edit')}>
                    {done && <Check size={13} />}
                  </button>
                  <button className="grow" style={{ minWidth: 0, border: 0, background: 'none', padding: 0, textAlign: 'left', opacity: done ? 0.6 : 1 }} onClick={() => open(t)}>
                    <b style={{ display: 'block', fontWeight: 650, textDecoration: done ? 'line-through' : undefined }}>{t.title}</b>
                    <span className="muted row" style={{ gap: 5, fontSize: 12.5 }}>
                      <Icon size={12} /> {time(t.due)} · {t.kind ?? 'Task'}
                    </span>
                  </button>
                  {owner && <Avatar name={owner.name} hue={owner.hue} size="sm" />}
                </div>
              );
            })}
            {!agenda.length && <span className="muted">Nothing scheduled. Pick another day, or add a task.</span>}
          </div>
        </Card>
      </div>
    </>
  );
}
