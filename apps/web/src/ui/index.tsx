import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Info, Search, X } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { hueOf, initials } from '../lib/format';

/** Textarea that grows with its content (like a chat composer) up to `maxRows`, then scrolls. */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number; maxRows?: number }>(function AutoTextarea({ className, minRows = 2, maxRows = 10, onChange, ...rest }, ref) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current!);
  const resize = useCallback(() => {
    const el = inner.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 20;
    const chrome = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    el.style.height = 'auto';
    const min = line * minRows + chrome;
    const max = line * maxRows + chrome;
    const next = Math.min(Math.max(el.scrollHeight + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth), min), max);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [minRows, maxRows]);
  useLayoutEffect(resize, [rest.value, resize]);
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [resize]);
  return (
    <textarea
      ref={inner}
      rows={minRows}
      className={cx('textarea auto', className)}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      {...rest}
    />
  );
});

export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="Loading" />;
}

/** Placeholder shown while a screen's code loads. */
export function PageSkeleton() {
  return (
    <div className="skeleton-page" aria-busy="true" aria-label="Loading">
      <div className="row" style={{ marginBottom: 26, gap: 14 }}>
        <span className="sk" style={{ width: 200, height: 38 }} />
        <span className="sk" style={{ width: 150, height: 34, borderRadius: 999 }} />
      </div>
      <div className="kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card sk-card">
            <span className="sk" style={{ width: '45%', height: 12 }} />
            <span className="sk" style={{ width: '60%', height: 30, marginTop: 14 }} />
            <span className="sk" style={{ width: '80%', height: 10, marginTop: 22 }} />
          </div>
        ))}
      </div>
      <div className="grid g-2-1">
        <div className="card sk-card" style={{ height: 300 }} />
        <div className="card sk-card" style={{ height: 300 }} />
      </div>
    </div>
  );
}

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/* ---------- Toasts ---------- */
type Toast = { id: number; text: string };
let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();
let toastSeq = 0;
export function toast(text: string) {
  const t = { id: ++toastSeq, text };
  toasts = [...toasts, t].slice(-4);
  toastListeners.forEach((l) => l());
  window.setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l());
  }, 3200);
}
export function Toasts() {
  const list = useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts,
  );
  return (
    <div className="toasts" aria-live="polite" role="status">
      {list.map((t) => (
        <div className="toast" key={t.id}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ---------- Atoms ---------- */
export function Avatar({ name, hue, size }: { name: string; hue?: number; size?: 'sm' | 'lg' }) {
  const h = hue ?? hueOf(name);
  return (
    <span className={cx('avatar', size)} style={{ background: `hsl(${h} 60% 85% / 0.9)`, color: `hsl(${h} 45% 25%)` }} title={name} aria-hidden>
      {initials(name)}
    </span>
  );
}

export type Tone = 'up' | 'down' | 'warn' | 'info' | 'neutral';
export function StatusPill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('status', tone !== 'neutral' && tone)}>{children}</span>;
}

export function Delta({ value, suffix = '%', invert = false, digits = 1 }: { value: number; suffix?: string; invert?: boolean; digits?: number }) {
  const good = invert ? value < 0 : value > 0;
  const tone = Math.abs(value) < 0.05 ? 'flat' : good ? 'up' : 'down';
  return (
    <span className={cx('delta', tone)}>
      {value > 0 ? <ArrowUp size={12} /> : value < 0 ? <ArrowDown size={12} /> : null}
      {Math.abs(value).toFixed(digits)}
      {suffix}
    </span>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="info-tip" title={text} aria-label={text} role="img">
      <Info size={13} />
    </span>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} />;
}

export function Progress({ value, tone }: { value: number; tone?: 'up' | 'warn' | 'down' }) {
  return (
    <div className={cx('progress', tone)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {hint}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

/* ---------- Segmented control with sliding thumb ---------- */
export function Segmented<T extends string>({ options, value, onChange, size, label }: { options: readonly (T | { value: T; label: ReactNode })[]; value: T; onChange: (v: T) => void; size?: 'lg'; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, opts.length]);
  return (
    <div className={cx('seg', size)} ref={ref} role="group" aria-label={label}>
      {thumb && <span className="seg-thumb" style={thumb} />}
      {opts.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FilterPills<T extends string>({ options, value, onChange }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="pills" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" className="pill-btn" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count != null && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="search">
      <Search size={15} />
      <input className="input sm" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

export function Field({ label, hint, children, full }: { label: string; hint?: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={cx('field', full && 'full')}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

/* ---------- Layout ---------- */
export function PageHeader({ title, tabs, sub, actions }: { title: string; tabs?: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Nexora`;
  }, [title]);
  return (
    <header className="page-head">
      <h1 className="page-title">{title}</h1>
      {tabs}
      {sub && <span className="page-sub">{sub}</span>}
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, info, sub, tools, children, className, style }: { title?: ReactNode; info?: string; sub?: ReactNode; tools?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={cx('card', className)} style={style}>
      {(title || tools) && (
        <div className="card-head">
          {title && (
            <h2 className="card-title">
              {title}
              {info && <InfoTip text={info} />}
            </h2>
          )}
          {sub && <span className="card-sub">{sub}</span>}
          {tools && <div className="card-tools">{tools}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function KpiTile({ label, info, value, delta, deltaNote = 'vs last period', viz, link, hero, invertDelta }: { label: string; info?: string; value: ReactNode; delta?: number; deltaNote?: string; viz?: ReactNode; link?: { label: string; onClick: () => void }; hero?: boolean; invertDelta?: boolean }) {
  return (
    <section className={cx('card kpi', hero && 'hero')}>
      <div className="kpi-label">
        {label}
        {info && <InfoTip text={info} />}
      </div>
      <div className="kpi-body">
        <div className="kpi-value num">{value}</div>
        {viz}
      </div>
      {(delta != null || link) && (
        <div className="kpi-foot">
          <span className="row" style={{ gap: 6 }}>
            {delta != null && (
              <>
                <Delta value={delta} invert={invertDelta} /> <span className="muted">{deltaNote}</span>
              </>
            )}
          </span>
          {link && (
            <button className="kpi-link" onClick={link.onClick}>
              {link.label}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function Stepper({ steps, current, lost }: { steps: { label: string; sub?: string }[]; current: number; lost?: boolean }) {
  return (
    <ol className="stepper" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? (lost ? 'lost' : current === steps.length - 1 ? 'done' : 'current') : '';
        return (
          <li key={s.label} className={cx('step', state)}>
            <span className="step-dot">{state === 'done' ? '✓' : state === 'lost' ? '✕' : i + 1}</span>
            <b>{s.label}</b>
            {s.sub && <small className="muted">{s.sub}</small>}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Overlays ---------- */
function useEscape(onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, active]);
}

function useFocusIn(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    // On touch devices don't jump into a field: that would pop the keyboard over the panel.
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const first = touch ? null : el?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button:not(.icon-btn)');
    (first ?? el)?.focus({ preventScroll: true });
    return () => prev?.focus?.();
  }, [ref]);
}

/** Plays the exit animation before unmounting; locks page scroll while open. */
function useAnimatedClose(onClose: () => void) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  const close = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    window.setTimeout(onClose, 200);
  }, [onClose]);
  return [leaving, close] as const;
}

export function Sheet({ title, sub, onClose, children, footer, wide, headExtra }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; headExtra?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [leaving, close] = useAnimatedClose(onClose);
  useEscape(close);
  useFocusIn(ref);
  return createPortal(
    <>
      <div className={cx('scrim', leaving && 'leaving')} onClick={close} />
      <aside className={cx('sheet', wide && 'wide', leaving && 'leaving')} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} ref={ref} tabIndex={-1}>
        <span className="grabber" aria-hidden />
        <div className="sheet-head">
          <div className="grow">
            <h2 className="sheet-title">{title}</h2>
            {sub && <div className="muted" style={{ marginTop: 4 }}>{sub}</div>}
          </div>
          {headExtra}
          <button className="icon-btn sm" onClick={close} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </aside>
    </>,
    document.body,
  );
}

export function Modal({ title, onClose, children, footer, wide, sub }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; sub?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [leaving, close] = useAnimatedClose(onClose);
  useEscape(close);
  useFocusIn(ref);
  return createPortal(
    <>
      <div className={cx('scrim', leaving && 'leaving')} onClick={close} />
      <div className={cx('modal', wide && 'wide', leaving && 'leaving')} role="dialog" aria-modal="true" ref={ref} tabIndex={-1}>
        <span className="grabber" aria-hidden />
        <div className="modal-head">
          <div className="grow">
            <h2 className="modal-title">{title}</h2>
            {sub && <div className="muted" style={{ marginTop: 4 }}>{sub}</div>}
          </div>
          <button className="icon-btn sm" onClick={close} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

export function ConfirmModal({ title, body, confirm, onConfirm, onClose }: { title: string; body: ReactNode; confirm: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirm}
          </button>
        </>
      }
    >
      <p className="ink-2">{body}</p>
    </Modal>
  );
}

/** Small anchored menu; closes on outside click and Escape. */
export function Popover({ trigger, children, align = 'right', width, placement = 'below' }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; width?: number; placement?: 'below' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useEscape(close, open);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div className="popover" style={placement === 'right' ? { left: 'calc(100% + 14px)', top: 0, width } : { top: 'calc(100% + 8px)', [align]: 0, width }}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

/* ---------- Data table ---------- */
export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Plain-text label for the phone layout when `header` isn't a string. */
  label?: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => number | string;
  align?: 'right';
  width?: number | string;
}

export function DataTable<T>({ rows, columns, rowKey, onRowClick, selected, onSelect, initialSort, empty }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; selected?: Set<string>; onSelect?: (next: Set<string>) => void; initialSort?: { key: string; dir: 'asc' | 'desc' }; empty?: ReactNode }) {
  const [sort, setSort] = useState(initialSort);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort || !sort) return rows;
    const f = col.sort;
    return [...rows].sort((a, b) => {
      const x = f(a);
      const y = f(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, columns, sort]);
  const allOn = !!selected && rows.length > 0 && rows.every((r) => selected.has(rowKey(r)));
  if (!rows.length) return <>{empty ?? <Empty title="Nothing here yet" hint="Try changing the filters." />}</>;
  return (
    <div className="table-wrap">
      <table className="table responsive">
        <thead>
          <tr>
            {onSelect && (
              <th style={{ width: 36 }}>
                <input type="checkbox" className="check" checked={allOn} aria-label="Select all" onChange={() => onSelect(allOn ? new Set() : new Set(rows.map(rowKey)))} />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'r' : undefined} style={{ width: c.width }} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                {c.sort ? (
                  <button onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}>
                    {c.header}
                    {sort?.key === c.key ? sort.dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} /> : null}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const k = rowKey(r);
            const isSel = selected?.has(k);
            return (
              <tr key={k} className={cx(onRowClick && 'click', isSel && 'selected')} onClick={() => onRowClick?.(r)}>
                {onSelect && (
                  <td className="sel" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="check"
                      checked={!!isSel}
                      aria-label="Select row"
                      onChange={() => {
                        const next = new Set(selected);
                        if (isSel) next.delete(k);
                        else next.add(k);
                        onSelect(next);
                      }}
                    />
                  </td>
                )}
                {columns.map((c, i) => (
                  // data-label lets the phone layout show each cell as "Label: value".
                  <td key={c.key} className={cx(c.align === 'right' && 'r num', i === 0 && 'primary')} data-label={c.label ?? (typeof c.header === 'string' ? c.header : undefined)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (!count) return null;
  return createPortal(
    <div className="bulkbar" role="toolbar" aria-label="Bulk actions">
      <b style={{ marginRight: 6 }}>{count} selected</b>
      {children}
      <button className="btn sm" onClick={onClear}>
        Clear
      </button>
    </div>,
    document.body,
  );
}

/** Odometer-style count-up for headline numbers. */
export function useCountUp(target: number, ms = 700) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(a + (target - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
