-- Automations and their runs, per-user notifications and the append-only audit log.

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  enabled boolean not null default false,
  trigger_type text not null check (trigger_type in ('lead.created', 'deal.created', 'deal.stage_changed', 'deal.won', 'deal.lost', 'invoice.overdue', 'invoice.paid', 'task.overdue')),
  trigger_stage_id uuid references public.pipeline_stages(id) on delete set null,
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  reentry text not null default 'once' check (reentry in ('once', 'every')),
  updated_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index automations_trigger_idx on public.automations (trigger_type) where enabled;
create index automations_trigger_stage_id_idx on public.automations (trigger_stage_id);
create index automations_updated_by_idx on public.automations (updated_by);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  label text not null default '',
  status text not null check (status in ('Completed', 'Stopped', 'Waiting', 'Failed', 'Passed (test)')),
  log text[] not null default '{}',
  is_test boolean not null default false,
  ref_kind text check (ref_kind in ('lead', 'deal', 'doc', 'task')),
  ref_id uuid,
  next_step smallint,
  resume_at timestamptz,
  started_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index automation_runs_automation_idx on public.automation_runs (automation_id, created_at desc);
create index automation_runs_resume_at_idx on public.automation_runs (resume_at) where status = 'Waiting';
create index automation_runs_started_by_idx on public.automation_runs (started_by);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('lead', 'deal', 'invoice', 'message', 'task', 'automation')),
  title text not null,
  body text not null default '',
  link text not null default '/',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, read_at, created_at desc);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null default auth.uid() references public.profiles(id),
  action text not null,
  target text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_actor_id_idx on public.audit_log (actor_id);

alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

create policy "staff read automations" on public.automations for select to authenticated using (public.is_staff());
create policy "managers manage automations" on public.automations for all to authenticated
using (public.is_manager_or_above()) with check (public.is_manager_or_above() and updated_by = auth.uid());

-- Any writer's actions can trigger an automation, so writers record and advance runs.
create policy "staff read automation runs" on public.automation_runs for select to authenticated using (public.is_staff());
create policy "writers record automation runs" on public.automation_runs for insert to authenticated with check (public.can_write());
create policy "writers advance automation runs" on public.automation_runs for update to authenticated using (public.can_write()) with check (public.can_write());
create policy "managers delete automation runs" on public.automation_runs for delete to authenticated using (public.is_manager_or_above());

-- Notifications are private to their recipient; any writer may notify a colleague.
create policy "recipients read notifications" on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy "writers send notifications" on public.notifications for insert to authenticated with check (public.can_write());
create policy "recipients mark notifications" on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "recipients delete notifications" on public.notifications for delete to authenticated using (recipient_id = auth.uid());

-- Audit log: everyone writes their own entries, only admins read, nobody edits.
create policy "staff append audit entries" on public.audit_log for insert to authenticated with check (public.is_staff() and actor_id = auth.uid());
create policy "admins read audit log" on public.audit_log for select to authenticated using (public.is_admin());

create trigger automations_touch_updated_at before update on public.automations for each row execute function public.touch_updated_at();
create trigger automation_runs_touch_updated_at before update on public.automation_runs for each row execute function public.touch_updated_at();
create trigger notifications_touch_updated_at before update on public.notifications for each row execute function public.touch_updated_at();
