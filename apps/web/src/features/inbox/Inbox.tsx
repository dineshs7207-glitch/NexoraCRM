import { Check, ChevronLeft, Globe, Mail, MessageCircle, Send, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCan, useScoped } from '../../data/access';
import { patchThread, sendMessage, simulateReply } from '../../data/actions';
import { fill } from '../../data/automation';
import { dealBase } from '../../data/metrics';
import { useMe, userName } from '../../data/store';
import type { Thread } from '../../data/types';
import { money, relTime } from '../../lib/format';
import { AutoTextarea, Avatar, Card, Empty, PageHeader, SearchInput, Segmented, cx, toast } from '../../ui';
import { useIsMobile } from '../../lib/hooks';
import { StagePill, useBaseMoney } from '../common';

const CHANNEL = { email: { icon: Mail, label: 'Email' }, whatsapp: { icon: MessageCircle, label: 'WhatsApp' }, web: { icon: Globe, label: 'Website chat' } } as const;
const QUICK = [
  { label: 'Sending the quote', text: 'Hi {{first}}, I am sending the updated quote for {{deal}} today. Let me know if you have any questions.' },
  { label: 'Book a call', text: 'Hi {{first}}, could we set up a 30-minute call this week to go through the details? Share a slot that suits you.' },
  { label: 'Checking now', text: 'Thanks {{first}}, let me check with the team and get back to you shortly.' },
  { label: 'Thanks', text: 'Thank you, {{first}}! Much appreciated.' },
];

export function Inbox() {
  const d = useScoped();
  const navigate = useNavigate();
  const { id } = useParams();
  const [filter, setFilter] = useState<'all' | 'unread' | 'done'>('all');
  const [q, setQ] = useState('');
  const contact = (t: Thread) => d.contacts.find((c) => c.id === t.contactId);

  const threads = useMemo(() => {
    const s = q.trim().toLowerCase();
    return d.threads
      .filter((t) => (filter === 'done' ? t.done : !t.done) && (filter !== 'unread' || t.unread))
      .filter((t) => !s || `${t.subject} ${contact(t)?.name ?? ''} ${t.messages.map((m) => m.body).join(' ')}`.toLowerCase().includes(s))
      .sort((a, b) => b.messages.at(-1)!.at.localeCompare(a.messages.at(-1)!.at));
  }, [d, filter, q]); // contact() reads d

  const mobile = useIsMobile();
  // Desktop opens the newest conversation; phones show the list first, like a chat app.
  useEffect(() => {
    if (!mobile && !id && threads[0]) navigate(`/inbox/${threads[0].id}`, { replace: true });
  }, [id, threads, navigate, mobile]);

  const unread = d.threads.filter((t) => t.unread && !t.done).length;
  const active = d.threads.find((t) => t.id === id);

  return (
    <>
      {!(mobile && active) && <PageHeader title="Inbox" sub={`${unread} unread`} />}
      <div className="inbox">
        {!(mobile && active) && (
        <Card>
          <div className="stack" style={{ gap: 10, marginBottom: 10 }}>
            <Segmented options={[{ value: 'all', label: 'Open' }, { value: 'unread', label: 'Unread' }, { value: 'done', label: 'Done' }] as const} value={filter} onChange={setFilter} label="Filter" />
            <SearchInput value={q} onChange={setQ} placeholder="Search conversations" />
          </div>
          <div className="thread-list">
            {threads.map((t) => {
              const c = contact(t);
              const last = t.messages.at(-1)!;
              const Icon = CHANNEL[t.channel].icon;
              return (
                <Link key={t.id} to={`/inbox/${t.id}`} className={cx('thread', t.id === id && 'active')}>
                  <span style={{ position: 'relative' }}>
                    <Avatar name={c?.name ?? '?'} />
                    <span style={{ position: 'absolute', right: -4, bottom: -4, width: 18, height: 18, borderRadius: 9, background: 'var(--float)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 1px var(--line)' }} title={CHANNEL[t.channel].label}>
                      <Icon size={11} />
                    </span>
                  </span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="row between">
                      <b className="ellipsis" style={{ fontWeight: t.unread ? 750 : 600 }}>
                        {c?.name}
                      </b>
                      <span className="muted" style={{ fontSize: 11.5, flex: 'none' }}>
                        {relTime(last.at)}
                      </span>
                    </span>
                    <span className="ellipsis" style={{ display: 'block', fontSize: 13, fontWeight: t.unread ? 650 : 500 }}>
                      {t.starred && <Star size={11} style={{ verticalAlign: -1, marginRight: 4 }} fill="currentColor" />}
                      {t.subject}
                    </span>
                    <span className="muted ellipsis" style={{ display: 'block', fontSize: 12.5, paddingRight: 14 }}>
                      {last.from === 'contact' ? '' : 'You: '}
                      {last.body}
                    </span>
                  </span>
                  {t.unread && <span className="unread-dot" />}
                </Link>
              );
            })}
            {!threads.length && <Empty title="Nothing here" hint={filter === "done" ? "Conversations you mark done land here." : "You are all caught up."} />}
          </div>
        </Card>
        )}
        {active ? <Conversation key={active.id} thread={active} onBack={mobile ? () => navigate("/inbox") : undefined} /> : !mobile && <Card><Empty title="Pick a conversation" /></Card>}
        {active && !mobile && <Context thread={active} />}
      </div>
    </>
  );
}

function Conversation({ thread, onBack }: { thread: Thread; onBack?: () => void }) {
  const d = useScoped();
  const me = useMe();
  const can = useCan();
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const c = d.contacts.find((x) => x.id === thread.contactId);
  const deal = d.deals.find((x) => x.id === thread.dealId);
  const vars = { first: c?.name.split(' ')[0] ?? 'there', deal: deal?.title ?? 'your project', owner: me.name };

  useEffect(() => {
    if (thread.unread) patchThread(thread.id, { unread: false });
  }, [thread.id, thread.unread]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [thread.messages.length, typing]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    sendMessage(thread.id, body);
    setText('');
    // Demo only: simulate the customer replying. Real email/WhatsApp sync arrives in Phase 6.
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      simulateReply(thread.id);
    }, 2200);
  };

  let lastDay = '';
  return (
    <Card className="conv">
      <div className="conv-head">
        {onBack && (
          <button className="icon-btn sm" onClick={onBack} aria-label="Back to conversations">
            <ChevronLeft size={18} />
          </button>
        )}
        <Avatar name={c?.name ?? "?"} />
        <div className="grow" style={{ minWidth: 0 }}>
          <b>{c?.name}</b>
          <div className="muted ellipsis" style={{ fontSize: 12.5 }}>
            {CHANNEL[thread.channel].label} · {thread.subject}
          </div>
        </div>
        {deal && (
          <Link to={`/pipeline/${deal.id}`} className="tag hide-sm" style={{ textDecoration: "none" }}>
            {deal.title.split(': ')[1] ?? deal.title}
          </Link>
        )}
        <button className="icon-btn sm" aria-label={thread.starred ? 'Unstar' : 'Star'} aria-pressed={thread.starred} onClick={() => patchThread(thread.id, { starred: !thread.starred })}>
          <Star size={15} fill={thread.starred ? 'currentColor' : 'none'} />
        </button>
        <button
          className="btn sm"
          onClick={() => {
            patchThread(thread.id, { done: !thread.done });
            toast(thread.done ? 'Moved back to open' : 'Marked done');
          }}
        >
          <Check size={14} /> <span className="hide-sm">{thread.done ? "Reopen" : "Mark done"}</span>
        </button>
      </div>
      <div className="messages" aria-live="polite">
        {thread.messages.map((m) => {
          const day = new Date(m.at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
          const sep = day !== lastDay ? (lastDay = day) : null;
          const mine = m.from !== 'contact';
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {sep && (
                <div className="muted" style={{ textAlign: 'center', fontSize: 12, margin: '8px 0' }}>
                  {sep}
                </div>
              )}
              <div className={cx('bubble', mine && 'me')}>{m.body}</div>
              <div className={cx('bubble-meta', mine && 'me')}>
                {mine ? userName(d, m.from) : c?.name} · {new Date(m.at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="bubble typing" aria-label={`${c?.name} is typing`}>
            <span />
            <span />
            <span />
          </div>
        )}
        <div ref={end} />
      </div>
      {can('edit') && (
        <div className="composer-wrap">
          <div className="pills">
            {QUICK.map((qr) => (
              <button key={qr.label} className="tag" onClick={() => setText(fill(qr.text, vars))}>
                {qr.label}
              </button>
            ))}
          </div>
          <div className="composer">
            <AutoTextarea
              minRows={1}
              maxRows={6}
              placeholder="Write a reply…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // On phones the Enter key adds a line, like WhatsApp; the send button sends.
                if (e.key === 'Enter' && !e.shiftKey && !onBack) {
                  e.preventDefault();
                  send();
                }
              }}
              aria-label="Reply"
            />
            <button className="send-btn" onClick={send} disabled={!text.trim()} aria-label="Send">
              <Send size={17} />
            </button>
          </div>
          <span className="muted hide-sm" style={{ fontSize: 12 }}>
            Enter to send, Shift+Enter for a new line. Replies are logged on the deal and account timeline.
          </span>
        </div>
      )}
    </Card>
  );
}

function Context({ thread }: { thread: Thread }) {
  const d = useScoped();
  const fmt = useBaseMoney();
  const c = d.contacts.find((x) => x.id === thread.contactId);
  const account = d.accounts.find((a) => a.id === c?.accountId);
  if (!c) return null;
  const deals = d.deals.filter((x) => x.accountId === c.accountId);
  const won = deals.filter((x) => x.stage === 'Won').sort((a, b) => b.closeDate.localeCompare(a.closeDate));
  return (
    <Card className="ctx" style={{ overflowY: 'auto' }}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 6 }}>
        <Avatar name={c.name} size="lg" />
        <b style={{ fontSize: 16 }}>{c.name}</b>
        <span className="muted">
          {c.title}
          {account ? `, ${account.name}` : ''}
        </span>
      </div>
      <div className="kv" style={{ marginTop: 18 }}>
        <div>
          <span>Lifetime revenue</span>
          <b>{fmt(won.reduce((s, x) => s + dealBase(d, x), 0))}</b>
        </div>
        <div>
          <span>Deals</span>
          <b>{deals.length}</b>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <span>Email</span>
          <b>{c.email}</b>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <span>Phone</span>
          <b>{c.phone}</b>
        </div>
      </div>
      <div className="stack" style={{ gap: 6, marginTop: 18 }}>
        <span className="section-label">Open deals</span>
        {deals
          .filter((x) => x.stage !== 'Won' && x.stage !== 'Lost')
          .slice(0, 4)
          .map((x) => (
            <Link key={x.id} to={`/pipeline/${x.id}`} className="menu-item" style={{ textDecoration: 'none' }}>
              <span className="grow ellipsis">{x.title.split(': ')[1] ?? x.title}</span>
              <StagePill stage={x.stage} />
            </Link>
          ))}
        <span className="muted" style={{ fontSize: 12.5 }}>
          Owner: {userName(d, thread.assigneeId)}
        </span>
      </div>
      {account && (
        <Link to={`/customers/${account.id}`} className="btn" style={{ marginTop: 18, width: '100%' }}>
          View account
        </Link>
      )}
      <div className="muted" style={{ fontSize: 12, marginTop: 12, textAlign: 'center' }}>
        Last won: {won[0] ? money(won[0].amount, won[0].currency, { compact: true }) : '—'}
      </div>
    </Card>
  );
}
