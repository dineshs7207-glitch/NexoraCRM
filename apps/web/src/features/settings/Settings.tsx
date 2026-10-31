import { Bell, Building2, Database, Download, Eye, History, Palette, Shield, Users } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { can, ROLE_SCOPE, ROLES, useCan } from '../../data/access';
import { inviteUser, logAudit, switchUser, updateCompany, updateUser } from '../../data/actions';
import { resetDB, useDB, useMe, userName } from '../../data/store';
import type { Company, Currency, Role } from '../../data/types';
import { downloadText, toCsv } from '../../lib/download';
import { CURRENCIES, dateTime } from '../../lib/format';
import { setPrefsAnimated, usePrefs, type PaletteName } from '../../lib/prefs';
import { AutoTextarea, Avatar, Card, ConfirmModal, DataTable, Field, Modal, PageHeader, Progress, Segmented, Switch, toast } from '../../ui';

const TABS = [
  { id: 'profile', label: 'Profile & appearance', icon: Palette },
  { id: 'company', label: 'Company & currency', icon: Building2 },
  { id: 'team', label: 'Team & roles', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'audit', label: 'Audit log', icon: History },
  { id: 'data', label: 'Data', icon: Database },
] as const;

export function Settings() {
  const { tab } = useParams();
  if (!tab || !TABS.some((t) => t.id === tab)) return <Navigate to="/settings/profile" replace />;
  return (
    <>
      <PageHeader title="Settings" />
      <div className="settings">
        <nav className="settings-nav card" style={{ padding: 8 }} aria-label="Settings sections">
          {TABS.map((t) => (
            <NavLink key={t.id} to={`/settings/${t.id}`}>
              <t.icon size={16} /> {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="stack" style={{ gap: 'var(--gutter)' }}>
          {tab === 'profile' && <Profile />}
          {tab === 'company' && <CompanyTab />}
          {tab === 'team' && <Team />}
          {tab === 'notifications' && <Notifications />}
          {tab === 'security' && <Security />}
          {tab === 'audit' && <Audit />}
          {tab === 'data' && <DataTab />}
        </div>
      </div>
    </>
  );
}

const PALETTES: { id: PaletteName; label: string; swatch: string }[] = [
  { id: 'lime', label: 'Lime', swatch: 'linear-gradient(135deg, #13171a 50%, #c4ef4f 50%)' },
  { id: 'mono', label: 'Mono', swatch: 'linear-gradient(135deg, #15191d 50%, #e6ebee 50%)' },
  { id: 'ocean', label: 'Ocean', swatch: 'linear-gradient(135deg, #1d5a86 50%, #b5d8f0 50%)' },
  { id: 'sage', label: 'Sage', swatch: 'linear-gradient(135deg, #345e4a 50%, #d3e6cf 50%)' },
  { id: 'pastel', label: 'Pastel', swatch: 'linear-gradient(135deg, #5b4bb3 50%, #f6d9e6 50%)' },
];

function Profile() {
  const me = useMe();
  const prefs = usePrefs();
  const [name, setName] = useState(me.name);
  return (
    <>
      <Card title="Your profile">
        <div className="row" style={{ gap: 16, marginBottom: 18 }}>
          <Avatar name={me.name} hue={me.hue} size="lg" />
          <div>
            <b style={{ fontSize: 16 }}>{me.name}</b>
            <div className="muted">
              {me.role} · {me.team}
            </div>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Full name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== me.name && (updateUser(me.id, { name: name.trim() }), toast('Name saved'))} />
          </Field>
          <Field label="Email" hint="Changing your sign-in email needs verification (with login, Phase 3)">
            <input className="input" value={me.email} disabled />
          </Field>
          <Field label="Role" hint="Only an Owner or Admin can change roles">
            <input className="input" value={me.role} disabled />
          </Field>
          <Field label="Sees">
            <input className="input" value={ROLE_SCOPE[me.role]} disabled />
          </Field>
        </div>
      </Card>
      <Card title="Appearance" sub="Applies straight away, on this device">
        <div className="stack" style={{ gap: 18 }}>
          <div className="setting-row" style={{ paddingTop: 0 }}>
            <div className="grow">
              <b>Theme</b>
              <div className="muted" style={{ fontSize: 13 }}>
                System follows your computer's light or dark setting
              </div>
            </div>
            <Segmented options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }] as const} value={prefs.theme} onChange={(v) => setPrefsAnimated({ theme: v })} label="Theme" />
          </div>
          <div>
            <b>Colour</b>
            <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Re-tints buttons, highlights and charts. Status colours (green, amber, red) never change.
            </div>
            <div className="swatches">
              {PALETTES.map((p) => (
                <button key={p.id} className="swatch" aria-pressed={prefs.palette === p.id} onClick={(e) => setPrefsAnimated({ palette: p.id }, { x: e.clientX, y: e.clientY })}>
                  <i style={{ background: p.swatch }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

function CompanyTab() {
  const d = useDB();
  const allowed = useCan()('company');
  const [f, setF] = useState<Company>(d.company);
  const set = (k: keyof Company) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const dirty = JSON.stringify(f) !== JSON.stringify(d.company);
  return (
    <>
      <Card title="Company" sub={allowed ? 'Shown on invoices and quotes' : 'Only an Owner or Admin can edit this'}>
        <fieldset disabled={!allowed} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <Field label="Display name">
              <input className="input" value={f.name} onChange={set('name')} />
            </Field>
            <Field label="Legal name">
              <input className="input" value={f.legalName} onChange={set('legalName')} />
            </Field>
            <Field label="Address" full>
              <AutoTextarea minRows={3} value={f.address} onChange={set('address')} />
            </Field>
            <Field label="Tax ID" hint='Start with "GSTIN" to print CGST/SGST on INR invoices'>
              <input className="input" value={f.taxId} onChange={set('taxId')} />
            </Field>
            <Field label="Time zone">
              <select className="select" value={f.timezone} onChange={set('timezone')}>
                {['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Dublin', 'America/New_York', 'America/Los_Angeles'].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </Field>
            <Field label="Billing email">
              <input className="input" value={f.email} onChange={set('email')} />
            </Field>
            <Field label="Phone">
              <input className="input" value={f.phone} onChange={set('phone')} />
            </Field>
          </div>
        </fieldset>
      </Card>
      <Card title="Invoicing">
        <fieldset disabled={!allowed} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <Field label="Invoice prefix" hint={`Next: ${f.invoicePrefix}-${new Date().getFullYear()}-${String(f.nextInvoiceNo).padStart(4, '0')}`}>
              <input className="input" value={f.invoicePrefix} onChange={set('invoicePrefix')} />
            </Field>
            <Field label="Quote prefix" hint={`Next: ${f.quotePrefix}-${new Date().getFullYear()}-${String(f.nextQuoteNo).padStart(4, '0')}`}>
              <input className="input" value={f.quotePrefix} onChange={set('quotePrefix')} />
            </Field>
            <Field label="Default payment terms" full>
              <input className="input" value={f.paymentTerms} onChange={set('paymentTerms')} />
            </Field>
            <Field label="Bank / UPI details" full>
              <input className="input" value={f.bankDetails} onChange={set('bankDetails')} />
            </Field>
          </div>
        </fieldset>
      </Card>
      <Card title="Currencies" sub="Each deal and invoice keeps its own currency. Reports convert to the base currency with these rates.">
        <fieldset disabled={!allowed} style={{ border: 0, padding: 0, margin: 0 }}>
          <Field label="Base currency">
            <select className="select" style={{ maxWidth: 220 }} value={f.baseCurrency} onChange={(e) => setF({ ...f, baseCurrency: e.target.value as Currency })}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginTop: 14 }}>
            {CURRENCIES.filter((c) => c !== f.baseCurrency).map((c) => (
              <Field key={c} label={`1 ${c} =`} hint={f.baseCurrency}>
                <input
                  className="input num"
                  type="number"
                  min={0}
                  step="any"
                  value={f.rates[c] / (f.rates[f.baseCurrency] || 1)}
                  onChange={(e) => {
                    // Rates are stored relative to INR internally; edits are made relative to the base.
                    const v = Math.max(0, Number(e.target.value));
                    setF({ ...f, rates: { ...f.rates, [c]: v * (f.rates[f.baseCurrency] || 1) } });
                  }}
                />
              </Field>
            ))}
          </div>
        </fieldset>
      </Card>
      {allowed && (
        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" disabled={!dirty} onClick={() => setF(d.company)}>
            Discard
          </button>
          <button
            className="btn primary"
            disabled={!dirty}
            onClick={() => {
              const base = f.rates[f.baseCurrency] || 1;
              const rates = Object.fromEntries(Object.entries(f.rates).map(([k, v]) => [k, v / base])) as Company['rates'];
              updateCompany({ ...f, rates });
              setF({ ...f, rates });
              toast('Company settings saved');
            }}
          >
            Save changes
          </button>
        </div>
      )}
    </>
  );
}

function Team() {
  const d = useDB();
  const me = useMe();
  const allowed = useCan()('team');
  const [inviting, setInviting] = useState(false);
  const seats = 10;
  const used = d.users.filter((u) => u.status !== 'Deactivated').length;
  return (
    <>
      <Card title="Team" sub={`${used} of ${seats} seats used · ${d.users.filter((u) => u.status === 'Invited').length} pending`} tools={allowed && <button className="btn primary sm" onClick={() => setInviting(true)}>Invite teammate</button>}>
        <Progress value={(used / seats) * 100} />
        <div className="stack" style={{ gap: 0, marginTop: 10 }}>
          {d.users.map((u) => (
            <div key={u.id} className="setting-row" style={{ flexWrap: 'wrap' }}>
              <Avatar name={u.name} hue={u.hue} />
              <div className="grow" style={{ minWidth: 160 }}>
                <b>
                  {u.name} {u.id === me.id && <span className="muted">(you)</span>}
                </b>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {u.email} · {u.team} {u.status !== 'Active' && <span className="status warn" style={{ marginLeft: 6 }}>{u.status}</span>}
                </div>
              </div>
              <label className="field" style={{ width: 130 }}>
                <span>Monthly quota</span>
                <input className="input sm num" type="number" min={0} defaultValue={u.quota} disabled={!allowed} onBlur={(e) => Number(e.target.value) !== u.quota && updateUser(u.id, { quota: Math.max(0, Number(e.target.value)) })} />
              </label>
              <label className="field" style={{ width: 140 }}>
                <span>Role</span>
                <select className="select sm" value={u.role} disabled={!allowed || u.id === me.id} onChange={(e) => updateUser(u.id, { role: e.target.value as Role })}>
                  {ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <button
                className="btn sm"
                disabled={u.id === me.id || u.status !== 'Active'}
                title="See Nexora exactly as this person would"
                onClick={() => {
                  switchUser(u.id);
                  toast(`Now viewing as ${u.name}`);
                }}
              >
                <Eye size={14} /> View as
              </button>
            </div>
          ))}
        </div>
      </Card>
      <Card title="What each role can do" sub="Enforced on the server once login is live (Phase 3). Here it shapes the screens.">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Sees</th>
                {['Edit records', 'Delete', 'Export', 'Invoices', 'Automations', 'Team', 'Company'].map((h) => (
                  <th key={h} className="r">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r}>
                  <td>
                    <b>{r}</b>
                  </td>
                  <td className="muted">{ROLE_SCOPE[r]}</td>
                  {(['edit', 'delete', 'export', 'invoices', 'automations', 'team', 'company'] as const).map((p) => (
                    <td key={p} className="r">
                      {can(r, p) ? '✓' : <span className="muted">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {inviting && <InviteModal onClose={() => setInviting(false)} />}
    </>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Sales rep');
  const [team, setTeam] = useState('Mid-market');
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return (
    <Modal
      title="Invite teammate"
      sub="They'll get an email link to set a password once login is live."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!ok}
            onClick={() => {
              inviteUser(email.trim().toLowerCase(), role, team);
              toast(`Invite created for ${email}`);
              onClose();
            }}
          >
            Send invite
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Email" full>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Role" hint={ROLE_SCOPE[role]}>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.filter((r) => r !== 'Owner').map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Team">
          <select className="select" value={team} onChange={(e) => setTeam(e.target.value)}>
            {['Enterprise', 'Mid-market', 'Leadership', 'Finance'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function Notifications() {
  const d = useDB();
  const rows: [string, string, string][] = [
    ['newLead', 'New leads', 'When a lead is assigned to you'],
    ['dealWon', 'Deals won', 'When anyone on your team wins a deal'],
    ['invoiceOverdue', 'Overdue invoices', 'When an invoice you own passes its due date'],
    ['messages', 'Customer messages', 'New replies in your inbox'],
    ['weeklyReport', 'Weekly report', 'Every Monday at 8 AM'],
  ];
  return (
    <Card title="Notify me about">
      {rows.map(([key, label, hint]) => (
        <div key={key} className="setting-row">
          <div className="grow">
            <b>{label}</b>
            <div className="muted" style={{ fontSize: 13 }}>
              {hint}
            </div>
          </div>
          <Switch checked={!!d.company.notify[key]} label={label} onChange={(v) => updateCompany({ notify: { ...d.company.notify, [key]: v } })} />
        </div>
      ))}
    </Card>
  );
}

function Security() {
  const items: [string, string][] = [
    ['Sign-in', 'Email and password (hashed with Argon2id), secure httpOnly session cookies, CSRF protection, rate-limited login.'],
    ['Two-factor authentication', 'Authenticator-app codes (TOTP) for every account; required for Owners and Admins.'],
    ['Sessions', 'See and sign out devices; sessions expire after inactivity.'],
    ['Data access', 'Every request checks role and record scope on the server, so reps only ever receive their own records.'],
    ['Audit trail', 'Every change, export and download is logged with who and when (already active in this preview).'],
    ['Backups', 'Nightly encrypted database backups stored off the server, with a tested restore.'],
  ];
  return (
    <Card title="Security" sub="Arrives with login and the database on Hostinger (Phase 3)">
      <div className="box" style={{ background: 'var(--warn-soft)', color: 'var(--warn)', borderColor: 'transparent', marginBottom: 14 }}>
        This preview stores data only in this browser and has no login. Don't enter real customer data until Phase 3 is live.
      </div>
      {items.map(([title, body]) => (
        <div key={title} className="setting-row">
          <Shield size={18} className="muted" />
          <div className="grow">
            <b>{title}</b>
            <div className="muted" style={{ fontSize: 13 }}>
              {body}
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function Audit() {
  const d = useDB();
  const allowed = useCan()('export');
  return (
    <Card
      className="pad-0"
      title={<span style={{ padding: '18px 0 0 18px', display: 'inline-block' }}>Audit log</span>}
      tools={
        allowed && (
          <button
            className="btn sm"
            style={{ margin: '18px 18px 0 0' }}
            onClick={() => {
              const name = 'nexora-audit-log.csv';
              downloadText(name, toCsv(d.audit.map((a) => ({ When: a.at, Who: userName(d, a.userId), Action: a.action, Target: a.target }))));
              logAudit('Exported audit log', name);
              toast(`Exported ${name}`);
            }}
          >
            <Download size={14} /> Export
          </button>
        )
      }
    >
      <DataTable
        rows={d.audit}
        rowKey={(a) => a.id}
        columns={[
          { key: 'at', header: 'When', sort: (a) => a.at, render: (a) => <span className="num">{dateTime(a.at)}</span> },
          { key: 'who', header: 'Who', sort: (a) => userName(d, a.userId), render: (a) => userName(d, a.userId) },
          { key: 'action', header: 'Action', render: (a) => <b style={{ fontWeight: 600 }}>{a.action}</b> },
          { key: 'target', header: 'Target', render: (a) => <span className="muted">{a.target}</span> },
        ]}
        initialSort={{ key: 'at', dir: 'desc' }}
      />
    </Card>
  );
}

function DataTab() {
  const d = useDB();
  const allowed = useCan()('company');
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Card title="Export everything" sub="A full JSON backup of this workspace">
        <button
          className="btn"
          disabled={!allowed}
          onClick={() => {
            const name = `nexora-backup-${new Date().toISOString().slice(0, 10)}.json`;
            downloadText(name, JSON.stringify(d, null, 2), 'application/json');
            logAudit('Exported full backup', name);
            toast(`Exported ${name}`);
          }}
        >
          <Download size={15} /> Download backup
        </button>
      </Card>
      <Card title="Reset sample data" sub="Puts the preview back to its starting data. Your theme choice is kept.">
        <button className="btn danger" disabled={!allowed} onClick={() => setConfirm(true)}>
          Reset sample data
        </button>
      </Card>
      {confirm && (
        <ConfirmModal
          title="Reset all data?"
          body="Every lead, deal, invoice and change made in this browser is replaced with the sample data. This can't be undone."
          confirm="Reset data"
          onConfirm={() => {
            resetDB();
            toast('Sample data restored');
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </>
  );
}

