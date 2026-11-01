import { BarChart3, Bell, Bolt, Building2, CalendarDays, CheckSquare, FileText, FolderKanban, Home, Inbox, LayoutGrid, LogOut, Mail, Moon, Package, Plus, Search, Settings, Sun, Target, UserPlus } from 'lucide-react';
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { markNotifications, switchUser } from '../data/actions';
import { startEngine } from '../data/automation';
import { ROLE_SCOPE, useScoped } from '../data/access';

import { useDB, useMe } from '../data/store';
import { relTime } from '../lib/format';
import { resolvedTheme, setPrefsAnimated, usePrefs } from '../lib/prefs';
import { signOut, useSession } from '../lib/session';
import { Avatar, PageSkeleton, Popover, Sheet, Toasts } from '../ui';
import { CommandPalette } from './CommandPalette';

const KIND_ICON = { lead: UserPlus, deal: Target, invoice: FileText, message: Mail, task: CheckSquare, automation: Bolt } as const;

export function Shell() {
  const d = useScoped();
  const me = useMe();
  const prefs = usePrefs();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const section = pathname.split('/')[1] ?? '';

  useEffect(() => startEngine(), []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  // New section: start at the top, like a fresh page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [section]);

  const newLeads = d.leads.filter((l) => l.status === 'New').length;
  const unread = d.threads.filter((t) => t.unread && !t.done).length;
  const overdue = d.docs.filter((x) => x.status === 'Overdue').length;
  const dueToday = d.tasks.filter((t) => t.column !== 'Done' && t.assigneeId === me.id && new Date(t.due).toDateString() === new Date().toDateString()).length;
  const myTasks = d.tasks.filter((t) => t.column !== 'Done' && t.assigneeId === me.id).length;

  const nav = [
    { to: '/overview', label: 'Overview' },
    { to: '/pipeline', label: 'Pipeline', badge: newLeads, also: ['leads'] },
    { to: '/customers', label: 'Customers', also: ['contacts'] },
    { to: '/schedule', label: 'Schedule', badge: dueToday, also: ['tasks'] },
    { to: '/finance', label: 'Finance', badge: overdue },
    { to: '/growth', label: 'Growth' },
    { to: '/projects', label: 'Projects' },
  ];
  const dark = resolvedTheme(prefs) === 'dark';
  // Who "Back to …" returns to: the signed-in account, or the Owner in the open preview.
  const session = useSession();
  const home = session.status === 'signedIn' ? d.users.find((u) => u.id === session.profile.id) : d.users.find((u) => u.role === 'Owner');
  const toggleTheme = (e: React.MouseEvent) => setPrefsAnimated({ theme: dark ? 'light' : 'dark' }, { x: e.clientX, y: e.clientY });

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/overview" className="brand" aria-label={`${d.company.name} home`}>
          <span className="brand-logo">N</span>
          <span className="brand-text">
            <div className="brand-name">{d.company.name}</div>
            <div className="brand-sub">Sales workspace · {me.role}</div>
          </span>
        </Link>
        <TopNav items={nav} section={section} />
        <div className="top-actions">
          <button className="icon-btn only-mobile" onClick={() => setPaletteOpen(true)} aria-label="Search">
            <Search size={17} />
          </button>
          <NavLink to="/inbox" className="icon-btn hide-mobile" aria-label={`Inbox, ${unread} unread`} title="Inbox">
            <Inbox size={17} />
            {unread > 0 && <span className="dot" />}
          </NavLink>
          <Notifications />
          <div className="presence" aria-label="Teammates online">
            {d.users
              .filter((u) => u.status === 'Active' && u.id !== me.id)
              .slice(0, 3)
              .map((u) => (
                <Avatar key={u.id} name={u.name} hue={u.hue} />
              ))}
          </div>
          {session.status === 'signedIn' ? (
            <AccountMenu />
          ) : (
            <button className="icon-btn avatar-btn" onClick={() => navigate('/settings/profile')} aria-label="Your profile">
              <Avatar name={me.name} hue={me.hue} />
            </button>
          )}
        </div>
      </header>

      {home && me.id !== home.id && (
        <div className="notice info no-print">
          <span>
            Previewing as <b>{me.name}</b> ({me.role}, sees {ROLE_SCOPE[me.role].toLowerCase()}). This switch only changes what you see in this browser.
          </span>
          <button className="btn sm" onClick={() => switchUser(home.id)}>
            Back to {home.name}
          </button>
        </div>
      )}

      <aside className="dock" aria-label="Quick actions">
        <button className="dock-btn" onClick={() => setPaletteOpen(true)} aria-label="Search (Ctrl+K)" title="Search  Ctrl+K">
          <Search size={19} />
        </button>
        <CreateMenu />
        <NavLink to="/tasks" className="dock-btn" aria-label="Tasks" title="Tasks">
          <CheckSquare size={19} />
          {!!myTasks && <span className="badge">{myTasks}</span>}
        </NavLink>
        <NavLink to="/automations" className="dock-btn" aria-label="Automations" title="Automations">
          <Bolt size={19} />
        </NavLink>
        <NavLink to="/products" className="dock-btn" aria-label="Products" title="Products & services">
          <Package size={19} />
        </NavLink>
        <NavLink to="/settings" className="dock-btn" aria-label="Settings" title="Settings">
          <Settings size={19} />
        </NavLink>
        <span className="dock-sep" />
        <button className="dock-btn" onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title="Toggle theme">
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </aside>

      {/* Keyed by section so each page change plays the enter animation; opening a record panel doesn't. */}
      <main key={section} className="page-enter">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>

      <nav className="tabbar" aria-label="Main">
        {[
          { to: '/overview', label: 'Overview', icon: Home },
          { to: '/pipeline', label: 'Pipeline', icon: Target, badge: newLeads },
          { to: '/schedule', label: 'Schedule', icon: CalendarDays, badge: dueToday },
          { to: '/inbox', label: 'Inbox', icon: Inbox, badge: unread },
        ].map((t) => (
          <NavLink key={t.to} to={t.to} className="tab">
            <span className="tab-icon">
              <t.icon size={20} />
              {!!t.badge && <span className="badge">{t.badge}</span>}
            </span>
            {t.label}
          </NavLink>
        ))}
        <button className={`tab${moreOpen ? ' active' : ''}`} onClick={() => setMoreOpen(true)}>
          <span className="tab-icon">
            <LayoutGrid size={20} />
          </span>
          More
        </button>
      </nav>

      {moreOpen && (
        <Sheet title="More" onClose={() => setMoreOpen(false)}>
          <div className="more-grid">
            {[
              { to: '/customers', label: 'Customers', icon: Building2 },
              { to: '/finance', label: 'Finance', icon: FileText, badge: overdue },
              { to: '/growth', label: 'Growth', icon: BarChart3 },
              { to: '/projects', label: 'Projects', icon: FolderKanban },
              { to: '/leads', label: 'Leads', icon: UserPlus, badge: newLeads },
              { to: '/tasks', label: 'Tasks', icon: CheckSquare, badge: myTasks },
              { to: '/automations', label: 'Automations', icon: Bolt },
              { to: '/products', label: 'Products', icon: Package },
              { to: '/settings', label: 'Settings', icon: Settings },
            ].map((t) => (
              <button
                key={t.to}
                className="more-item"
                onClick={() => {
                  setMoreOpen(false);
                  navigate(t.to);
                }}
              >
                <span className="more-icon">
                  <t.icon size={20} />
                  {!!t.badge && <span className="badge">{t.badge}</span>}
                </span>
                {t.label}
              </button>
            ))}
            <button className="more-item" onClick={toggleTheme}>
              <span className="more-icon">{dark ? <Sun size={20} /> : <Moon size={20} />}</span>
              {dark ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </Sheet>
      )}

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      <Toasts />
    </div>
  );
}

const CREATE_ITEMS = [
  { label: 'New lead', to: '/leads?new=1', icon: UserPlus },
  { label: 'New deal', to: '/pipeline?new=1', icon: Target },
  { label: 'New task or call', to: '/tasks?new=1', icon: CheckSquare },
  { label: 'New invoice', to: '/finance?new=invoice', icon: FileText },
  { label: 'New quote', to: '/finance?new=quote', icon: FileText },
  { label: 'New project', to: '/projects?new=1', icon: FolderKanban },
];

/** Dock "+" menu for creating any record from anywhere. */
function CreateMenu() {
  const navigate = useNavigate();
  return (
    <Popover
      align="left"
      width={220}
      trigger={({ toggle, open }) => (
        <button className={`dock-btn${open ? ' active' : ''}`} onClick={toggle} aria-label="Create" title="Create">
          <Plus size={20} />
        </button>
      )}
      placement="right"
    >
      {(close) => (
        <div>
          <h4>Create</h4>
          {CREATE_ITEMS.map((c) => (
            <button
              key={c.label}
              className="menu-item"
              onClick={() => {
                close();
                navigate(c.to);
              }}
            >
              <c.icon size={16} /> {c.label}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

/** Signed-in account: profile shortcut and sign out. */
function AccountMenu() {
  const session = useSession();
  const navigate = useNavigate();
  if (session.status !== 'signedIn') return null;
  const { profile } = session;
  return (
    <Popover
      width={240}
      trigger={({ toggle }) => (
        <button className="icon-btn avatar-btn" onClick={toggle} aria-label="Your account">
          <Avatar name={profile.full_name} hue={212} />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div style={{ padding: '8px 10px 6px' }}>
            <b style={{ display: 'block' }}>{profile.full_name}</b>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {profile.work_email}
            </span>
          </div>
          <button
            className="menu-item"
            onClick={() => {
              close();
              navigate('/settings/profile');
            }}
          >
            <Settings size={16} /> Profile & settings
          </button>
          <button
            className="menu-item"
            onClick={() => {
              close();
              void signOut();
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </Popover>
  );
}

/** Top pill navigation with a highlight that slides to the active item. */
function TopNav({ items, section }: { items: { to: string; label: string; badge?: number; also?: string[] }[]; section: string }) {
  const ref = useRef<HTMLElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const activeIndex = items.findIndex((n) => n.to.slice(1) === section || n.also?.includes(section));
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current?.querySelectorAll<HTMLAnchorElement>('a')[activeIndex];
      setThumb(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeIndex, items.map((i) => i.badge).join()]); // badges change item widths
  return (
    <nav className="nav" aria-label="Main" ref={ref}>
      {thumb && <span className="nav-thumb" style={thumb} />}
      {items.map((n, i) => (
        <NavLink key={n.to} to={n.to} className={i === activeIndex ? 'current' : undefined}>
          {n.label}
          {!!n.badge && <span className="badge">{n.badge}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

function Notifications() {
  const d = useDB();
  const navigate = useNavigate();
  const unread = d.notifications.filter((n) => !n.read).length;
  return (
    <Popover
      width={340}
      trigger={({ toggle }) => (
        <button className="icon-btn" onClick={toggle} aria-label={`Notifications, ${unread} unread`}>
          <Bell size={17} />
          {unread > 0 && <span className="dot" />}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="row between" style={{ padding: '8px 10px 6px' }}>
            <b>Notifications</b>
            <button className="btn ghost sm" onClick={() => markNotifications()} disabled={!unread}>
              Mark all read
            </button>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {d.notifications.slice(0, 12).map((n) => {
              const Icon = KIND_ICON[n.kind] ?? Inbox;
              return (
                <button
                  key={n.id}
                  className="menu-item"
                  style={{ alignItems: 'flex-start' }}
                  onClick={() => {
                    markNotifications([n.id]);
                    close();
                    navigate(n.link);
                  }}
                >
                  <span className="tl-icon" style={{ width: 30, height: 30 }}>
                    <Icon size={15} />
                  </span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <b style={{ display: 'block', fontWeight: n.read ? 550 : 700 }}>{n.title}</b>
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      {n.body}
                    </span>
                  </span>
                  <span className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
                    {relTime(n.at)}
                  </span>
                  {!n.read && <span style={{ width: 7, height: 7, borderRadius: 9, background: 'var(--info)', marginTop: 6, flex: 'none' }} />}
                </button>
              );
            })}
            {!d.notifications.length && <div className="empty">You're all caught up.</div>}
          </div>
        </div>
      )}
    </Popover>
  );
}
