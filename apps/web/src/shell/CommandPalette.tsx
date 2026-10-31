import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useScoped } from '../data/access';
import { docTotals } from '../data/seed';
import { money } from '../lib/format';
import { cx } from '../ui';

interface Item {
  group: string;
  label: string;
  meta?: string;
  to: string;
}

const PAGES: Item[] = [
  ['Overview', '/overview'],
  ['Pipeline: deals', '/pipeline'],
  ['Pipeline: leads', '/leads'],
  ['Customers', '/customers'],
  ['Contacts', '/contacts'],
  ['Schedule', '/schedule'],
  ['Finance: invoices & quotes', '/finance'],
  ['Growth reports', '/growth'],
  ['Projects', '/projects'],
  ['Inbox', '/inbox'],
  ['Tasks board', '/tasks'],
  ['Automations', '/automations'],
  ['Products & services', '/products'],
  ['Settings', '/settings'],
].map(([label, to]) => ({ group: 'Go to page', label: label!, to: to! }));

const ACTIONS: Item[] = [
  { group: 'Quick actions', label: 'New lead', to: '/leads?new=1' },
  { group: 'Quick actions', label: 'New deal', to: '/pipeline?new=1' },
  { group: 'Quick actions', label: 'New invoice', to: '/finance?new=invoice' },
  { group: 'Quick actions', label: 'New quote', to: '/finance?new=quote' },
  { group: 'Quick actions', label: 'New task or call', to: '/tasks?new=1' },
  { group: 'Quick actions', label: 'New project', to: '/projects?new=1' },
];

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const d = useScoped();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [...ACTIONS, ...PAGES];
    const has = (...xs: (string | undefined)[]) => xs.some((x) => x?.toLowerCase().includes(s));
    const acc = (id: string) => d.accounts.find((a) => a.id === id)?.name ?? '';
    return [
      ...[...ACTIONS, ...PAGES].filter((p) => has(p.label)),
      ...d.leads.filter((l) => has(l.name, l.company, l.email)).slice(0, 6).map((l) => ({ group: 'Leads', label: `${l.name}, ${l.company}`, meta: l.status, to: `/leads/${l.id}` })),
      ...d.deals.filter((x) => has(x.title)).slice(0, 6).map((x) => ({ group: 'Deals', label: x.title, meta: `${x.stage}, ${money(x.amount, x.currency, { compact: true })}`, to: `/pipeline/${x.id}` })),
      ...d.accounts.filter((a) => has(a.name, a.city)).slice(0, 5).map((a) => ({ group: 'Accounts', label: a.name, meta: a.city, to: `/customers/${a.id}` })),
      ...d.contacts.filter((c) => has(c.name, c.email)).slice(0, 5).map((c) => ({ group: 'Contacts', label: c.name, meta: acc(c.accountId), to: `/contacts/${c.id}` })),
      ...d.docs.filter((x) => has(x.number, acc(x.accountId))).slice(0, 6).map((x) => ({ group: x.kind === 'invoice' ? 'Invoices' : 'Quotes', label: `${x.number}, ${acc(x.accountId)}`, meta: `${x.status}, ${money(docTotals(x).total, x.currency, { compact: true })}`, to: `/finance/${x.id}` })),
    ];
  }, [q, d]);

  const go = (it: Item | undefined) => {
    if (!it) return;
    onClose();
    navigate(it.to);
  };

  let lastGroup = '';
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 18, top: 20, color: 'var(--ink-3)' }} />
          <input
            className="palette-input"
            autoFocus
            placeholder="Search leads, deals, accounts, invoices, or jump to a page…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(items.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') go(items[active]);
              else if (e.key === 'Escape') onClose();
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
          />
        </div>
        <div className="palette-results" id="palette-list" role="listbox">
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? <div className="palette-group">{(lastGroup = it.group)}</div> : null;
            return (
              <div key={it.group + it.to + i}>
                {header}
                <button className={cx('menu-item', i === active && 'active')} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(it)}>
                  <span className="grow ellipsis">{it.label}</span>
                  {it.meta && <span className="muted" style={{ fontSize: 12.5 }}>{it.meta}</span>}
                </button>
              </div>
            );
          })}
          {!items.length && <div className="empty">No matches for "{q}"</div>}
        </div>
        <div className="palette-foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>Enter</kbd> to open
          </span>
          <span>
            <kbd>Esc</kbd> to close
          </span>
        </div>
      </div>
    </>,
    document.body,
  );
}
