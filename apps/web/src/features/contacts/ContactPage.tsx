import { Building2, ChevronLeft, Copy, Mail, Phone, Target } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCan, useScoped } from '../../data/access';
import { updateContact } from '../../data/actions';
import { money, relTime, shortDate } from '../../lib/format';
import { Avatar, Card, Empty, PageHeader, toast } from '../../ui';
import { ActivityComposer, activitiesFor, StagePill, TagToggles, Timeline } from '../common';

export function ContactPage() {
  const { id } = useParams();
  const d = useScoped();
  const can = useCan();
  const navigate = useNavigate();
  const c = d.contacts.find((x) => x.id === id);
  if (!c) return <Empty title="This contact doesn't exist" hint="It may have been deleted, or it's outside what you can see." action={<Link className="btn" to="/contacts">Show contacts</Link>} />;
  const account = d.accounts.find((a) => a.id === c.accountId);
  const deals = d.deals.filter((x) => x.contactId === c.id);
  const threads = d.threads.filter((t) => t.contactId === c.id);
  const editable = can('edit');

  return (
    <>
      <Link to="/contacts" className="back-link">
        <ChevronLeft size={16} /> All contacts
      </Link>
      <PageHeader
        title={c.name}
        actions={
          <>
            <button
              className="btn"
              onClick={() => {
                navigator.clipboard?.writeText(c.email);
                toast('Email copied');
              }}
            >
              <Copy size={15} /> Copy email
            </button>
            {threads[0] && (
              <button className="btn primary" onClick={() => navigate(`/inbox/${threads[0]!.id}`)}>
                <Mail size={15} /> Open conversation
              </button>
            )}
          </>
        }
      />
      <div className="grid g-1-2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 'var(--gutter)' }}>
          <Card>
            <div className="identity">
              <Avatar name={c.name} size="lg" />
              <div className="identity-main">
                <b style={{ fontSize: 17 }}>{c.name}</b>
                <div className="muted">{c.title}</div>
                <div className="contact-lines">
                  <span>
                    <Mail size={13} /> {c.email}
                  </span>
                  <span>
                    <Phone size={13} /> {c.phone}
                  </span>
                  {account && (
                    <Link to={`/customers/${account.id}`}>
                      <Building2 size={13} /> {account.name}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </Card>
          <Card title="Deals" sub={`${deals.length}`}>
            <div className="stack" style={{ gap: 2 }}>
              {deals.map((x) => (
                <button key={x.id} className="menu-item" onClick={() => navigate(`/pipeline/${x.id}`)}>
                  <Target size={15} className="muted" />
                  <span className="grow ellipsis">{x.title}</span>
                  <span className="item-end">
                    <b className="num">{money(x.amount, x.currency)}</b>
                    <StagePill stage={x.stage} />
                  </span>
                </button>
              ))}
              {!deals.length && <span className="muted">No deals linked to this contact.</span>}
            </div>
          </Card>
          <Card title="Activity">
            <div className="stack">
              {editable && <ActivityComposer related={[{ kind: 'contact', id: c.id }, { kind: 'account', id: c.accountId }]} />}
              <Timeline items={activitiesFor(d, 'contact', c.id)} />
            </div>
          </Card>
        </div>
        <div className="stack" style={{ gap: 'var(--gutter)' }}>
          <Card title="About">
            <div className="kv">
              <div>
                <span>City</span>
                <b>{c.city || '—'}</b>
              </div>
              <div>
                <span>Added</span>
                <b>{shortDate(c.createdAt)}</b>
              </div>
              <div>
                <span>Birthday</span>
                <b>{c.birthday ? new Date(`2000-${c.birthday}`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '—'}</b>
              </div>
            </div>
            <div className="stack" style={{ gap: 8, marginTop: 14 }}>
              <span className="section-label">Tags</span>
              <TagToggles all={['Decision maker', 'Champion', 'Finance', 'Technical', 'Do not contact']} value={c.tags} onChange={(tags) => updateContact(c.id, { tags })} disabled={!editable} />
            </div>
          </Card>
          <Card title="Conversations">
            <div className="stack" style={{ gap: 2 }}>
              {threads.map((t) => (
                <button key={t.id} className="menu-item" onClick={() => navigate(`/inbox/${t.id}`)}>
                  <span className="grow ellipsis">
                    <b style={{ fontWeight: 650 }}>{t.subject}</b>
                    <span className="muted ellipsis" style={{ display: 'block', fontSize: 12 }}>
                      {t.messages.at(-1)?.body}
                    </span>
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {relTime(t.messages.at(-1)!.at)}
                  </span>
                </button>
              ))}
              {!threads.length && <span className="muted">No conversations yet.</span>}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
