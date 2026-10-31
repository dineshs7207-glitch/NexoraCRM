import { Bell, Clock, Filter, Mail, PenLine, SquareCheck, Tag, Zap } from 'lucide-react';
import type { Automation, Step, StepType } from '../../data/types';

export const STEP_ICON: Record<StepType, typeof Mail> = {
  wait: Clock,
  condition: Filter,
  email: Mail,
  task: SquareCheck,
  tag: Tag,
  notify: Bell,
  update: PenLine,
};

export function FlowStrip({ a }: { a: Automation }) {
  return (
    <div className="flow-strip" aria-label={`Trigger then ${a.steps.map((s) => s.type).join(', ')}`}>
      <i className="first">
        <Zap size={14} />
      </i>
      {a.steps.map((s) => {
        const Icon = STEP_ICON[s.type];
        return (
          <span key={s.id} className="row" style={{ gap: 4 }}>
            <span style={{ width: 8, height: 1, background: 'var(--line-2)' }} />
            <i>
              <Icon size={14} />
            </i>
          </span>
        );
      })}
    </div>
  );
}

type Template = Pick<Automation, 'name' | 'description' | 'trigger'> & { steps: Omit<Step, 'id'>[] };
export const TEMPLATES: Template[] = [
  {
    name: 'Stuck deal nudge',
    description: 'If a deal sits in Negotiation for a week, nudge the owner and their manager.',
    trigger: { type: 'deal.stage_changed', stage: 'Negotiation' },
    steps: [
      { type: 'wait', name: 'Wait 7 days', config: { days: 7 } },
      { type: 'condition', name: 'Still in Negotiation?', config: { condition: { field: 'stage', op: 'eq', value: 'Negotiation' } } },
      { type: 'notify', name: 'Nudge the owner', config: { message: '{{deal}} has been in Negotiation for 7 days.' } },
      { type: 'task', name: 'Decide next step', config: { title: 'Unblock {{deal}}', dueDays: 1, assignee: 'owner' } },
    ],
  },
  {
    name: 'New deal intro email',
    description: 'Send a short intro from the owner as soon as a deal is created.',
    trigger: { type: 'deal.created' },
    steps: [{ type: 'email', name: 'Intro email', config: { subject: 'Great to connect, {{contact}}', body: 'Hi {{contact}},\n\nThanks for your time. I will be your point of contact for {{deal}}.\n\n{{owner}}' } }],
  },
  {
    name: 'Payment thank-you',
    description: 'Thank the client when an invoice is paid in full.',
    trigger: { type: 'invoice.paid' },
    steps: [
      { type: 'email', name: 'Thank-you email', config: { subject: 'Payment received for {{number}}', body: 'Hi {{contact}},\n\nWe have received your payment for {{number}}. Thank you!\n\n{{owner}}' } },
      { type: 'tag', name: 'Tag account "Good payer"', config: { tag: 'Good payer' } },
    ],
  },
  {
    name: 'Hot lead fast lane',
    description: 'High-score leads get a same-day call task and a team alert.',
    trigger: { type: 'lead.created' },
    steps: [
      { type: 'condition', name: 'Score above 70?', config: { condition: { field: 'score', op: 'gt', value: '70' } } },
      { type: 'tag', name: 'Tag "Hot"', config: { tag: 'Hot' } },
      { type: 'task', name: 'Call today', config: { title: 'Call {{name}} today', dueDays: 0, assignee: 'owner' } },
      { type: 'notify', name: 'Alert the team', config: { message: 'Hot lead: {{name}} from {{company}}' } },
    ],
  },
  { name: 'Blank automation', description: 'Start from a trigger and add your own steps.', trigger: { type: 'deal.won' }, steps: [] },
];
