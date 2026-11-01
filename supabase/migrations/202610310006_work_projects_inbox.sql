-- Activities, tasks, onboarding projects and the inbox.

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('call', 'email', 'meeting', 'note', 'stage', 'task', 'invoice', 'automation')),
  title text not null,
  body text,
  occurred_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references public.profiles(id),
  lead_id uuid references public.leads(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activities_user_id_idx on public.activities (user_id);
create index activities_occurred_at_idx on public.activities (occurred_at desc);
create index activities_lead_id_idx on public.activities (lead_id);
create index activities_deal_id_idx on public.activities (deal_id);
create index activities_account_id_idx on public.activities (account_id);
create index activities_contact_id_idx on public.activities (contact_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  kind text check (kind in ('Call', 'Meeting', 'Task', 'Email')),
  detail text not null default '',
  status text not null default 'To do' check (status in ('To do', 'In progress', 'Review', 'Done')),
  priority text not null default 'Medium' check (priority in ('High', 'Medium', 'Low')),
  due_at timestamptz,
  assignee_id uuid not null default auth.uid() references public.profiles(id),
  tag text not null default '',
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_assignee_status_idx on public.tasks (assignee_id, status);
create index tasks_due_at_idx on public.tasks (due_at);
create index tasks_lead_id_idx on public.tasks (lead_id);
create index tasks_deal_id_idx on public.tasks (deal_id);
create index tasks_account_id_idx on public.tasks (account_id);
create index tasks_contact_id_idx on public.tasks (contact_id);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  position smallint not null default 0,
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_checklist_items_task_idx on public.task_checklist_items (task_id, position);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);
create index task_comments_user_id_idx on public.task_comments (user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  owner_id uuid not null default auth.uid() references public.profiles(id),
  status text not null default 'Planning' check (status in ('Planning', 'In progress', 'In review', 'Done')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_id_idx on public.projects (owner_id);
create index projects_account_id_idx on public.projects (account_id);
create index projects_contact_id_idx on public.projects (contact_id);
create index projects_deal_id_idx on public.projects (deal_id);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);
create index project_members_profile_id_idx on public.project_members (profile_id);

create table public.project_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  position smallint not null default 0,
  name text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_steps_project_idx on public.project_steps (project_id, position);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  channel text not null default 'email' check (channel in ('email', 'whatsapp', 'web')),
  subject text not null default '',
  assignee_id uuid not null default auth.uid() references public.profiles(id),
  unread boolean not null default true,
  starred boolean not null default false,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index threads_assignee_id_idx on public.threads (assignee_id, done);
create index threads_contact_id_idx on public.threads (contact_id);
create index threads_deal_id_idx on public.threads (deal_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  sender_id uuid references public.profiles(id), -- null: written by the customer
  body text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages (thread_id, sent_at);
create index messages_sender_id_idx on public.messages (sender_id);

-- Project checks bypass RLS internally so projects and project_members can reference each other without recursion.
create or replace function public.can_see_project(pid uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = pid and (public.can_see_owner(p.owner_id)
      or exists (select 1 from public.project_members m where m.project_id = p.id and public.can_see_owner(m.profile_id)))
  )
$$;

create or replace function public.can_write_project(pid uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = pid and (public.can_write_owner(p.owner_id)
      or (public.can_write() and exists (select 1 from public.project_members m where m.project_id = p.id and m.profile_id = auth.uid())))
  )
$$;
revoke execute on function public.can_see_project(uuid), public.can_write_project(uuid) from public, anon;
grant execute on function public.can_see_project(uuid), public.can_write_project(uuid) to authenticated;

alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_steps enable row level security;
alter table public.threads enable row level security;
alter table public.messages enable row level security;

-- Activities: the author's scope, or any record the activity is attached to.
create policy "activities visible in scope" on public.activities for select to authenticated
using (
  public.can_see_owner(user_id)
  or exists (select 1 from public.leads l where l.id = activities.lead_id)
  or exists (select 1 from public.deals d where d.id = activities.deal_id)
  or exists (select 1 from public.accounts a where a.id = activities.account_id)
  or exists (select 1 from public.contacts c where c.id = activities.contact_id)
);
create policy "activities logged by writers" on public.activities for insert to authenticated
with check (public.can_write() and user_id = auth.uid());
create policy "activities edited by author or admin" on public.activities for update to authenticated
using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "activities deleted by author or admin" on public.activities for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "tasks visible in scope" on public.tasks for select to authenticated using (public.can_see_owner(assignee_id));
create policy "tasks created in write scope" on public.tasks for insert to authenticated with check (public.can_write_owner(assignee_id) or (public.can_write() and assignee_id = auth.uid()));
create policy "tasks updated in write scope" on public.tasks for update to authenticated using (public.can_write_owner(assignee_id)) with check (public.can_write_owner(assignee_id));
create policy "tasks deleted in write scope" on public.tasks for delete to authenticated using (public.can_write_owner(assignee_id));

create policy "checklist visible with task" on public.task_checklist_items for select to authenticated
using (exists (select 1 from public.tasks t where t.id = task_checklist_items.task_id));
create policy "checklist managed with task" on public.task_checklist_items for all to authenticated
using (exists (select 1 from public.tasks t where t.id = task_checklist_items.task_id and public.can_write_owner(t.assignee_id)))
with check (exists (select 1 from public.tasks t where t.id = task_checklist_items.task_id and public.can_write_owner(t.assignee_id)));

create policy "comments visible with task" on public.task_comments for select to authenticated
using (exists (select 1 from public.tasks t where t.id = task_comments.task_id));
create policy "comments added by writers" on public.task_comments for insert to authenticated
with check (public.can_write() and user_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_comments.task_id));
create policy "comments edited by author" on public.task_comments for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "comments deleted by author or admin" on public.task_comments for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "projects visible to scope and members" on public.projects for select to authenticated using (public.can_see_owner(owner_id) or public.can_see_project(id));
create policy "projects created in write scope" on public.projects for insert to authenticated with check (public.can_write_owner(owner_id));
create policy "projects updated by owner scope or members" on public.projects for update to authenticated
using (public.can_write_project(id)) with check (public.can_write() and public.can_see_owner(owner_id));
create policy "projects deleted by managers" on public.projects for delete to authenticated using (public.can_delete_owner(owner_id));

create policy "members visible with project" on public.project_members for select to authenticated using (public.can_see_project(project_id));
create policy "members managed by project owner scope" on public.project_members for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_members.project_id and public.can_write_owner(p.owner_id)))
with check (exists (select 1 from public.projects p where p.id = project_members.project_id and public.can_write_owner(p.owner_id)));

create policy "steps visible with project" on public.project_steps for select to authenticated using (public.can_see_project(project_id));
create policy "steps managed by project writers" on public.project_steps for all to authenticated
using (public.can_write_project(project_id)) with check (public.can_write_project(project_id));

create policy "threads visible in scope" on public.threads for select to authenticated using (public.can_see_owner(assignee_id));
create policy "threads created in write scope" on public.threads for insert to authenticated with check (public.can_write_owner(assignee_id));
create policy "threads updated in write scope" on public.threads for update to authenticated using (public.can_write_owner(assignee_id)) with check (public.can_write_owner(assignee_id));
create policy "threads deleted by managers" on public.threads for delete to authenticated using (public.can_delete_owner(assignee_id));

-- Customer messages arrive through the server (secret key); staff can only post as themselves.
create policy "messages visible with thread" on public.messages for select to authenticated
using (exists (select 1 from public.threads t where t.id = messages.thread_id));
create policy "messages sent by thread writers" on public.messages for insert to authenticated
with check (sender_id = auth.uid() and exists (select 1 from public.threads t where t.id = messages.thread_id and public.can_write_owner(t.assignee_id)));

create trigger activities_touch_updated_at before update on public.activities for each row execute function public.touch_updated_at();
create trigger tasks_touch_updated_at before update on public.tasks for each row execute function public.touch_updated_at();
create trigger task_checklist_items_touch_updated_at before update on public.task_checklist_items for each row execute function public.touch_updated_at();
create trigger task_comments_touch_updated_at before update on public.task_comments for each row execute function public.touch_updated_at();
create trigger projects_touch_updated_at before update on public.projects for each row execute function public.touch_updated_at();
create trigger project_members_touch_updated_at before update on public.project_members for each row execute function public.touch_updated_at();
create trigger project_steps_touch_updated_at before update on public.project_steps for each row execute function public.touch_updated_at();
create trigger threads_touch_updated_at before update on public.threads for each row execute function public.touch_updated_at();
create trigger messages_touch_updated_at before update on public.messages for each row execute function public.touch_updated_at();
