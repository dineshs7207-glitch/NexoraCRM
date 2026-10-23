create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'manager', 'employee', 'viewer');
create type public.data_scope as enum ('own', 'team', 'all');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  work_email text not null unique,
  role public.app_role not null default 'employee',
  team text,
  manager_id uuid references public.profiles(id),
  scope public.data_scope not null default 'own',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permission_overrides (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permission text not null,
  allowed boolean not null,
  primary key (profile_id, permission)
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position integer not null unique,
  color text not null,
  is_won boolean not null default false,
  is_lost boolean not null default false
);

create function public.current_role() returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and active = true $$;

create function public.can_access_profile(target uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles me join public.profiles them on them.id = target
    where me.id = auth.uid() and me.active
      and (me.role = 'admin' or me.scope = 'all' or them.id = me.id
        or (me.scope = 'team' and me.team is not null and them.team = me.team))
  )
$$;

alter table public.profiles enable row level security;
alter table public.permission_overrides enable row level security;
alter table public.pipeline_stages enable row level security;

create policy "profiles are visible within data scope" on public.profiles for select to authenticated
using (public.can_access_profile(id));
create policy "admins manage profiles" on public.profiles for all to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "users read own permission overrides" on public.permission_overrides for select to authenticated
using (profile_id = auth.uid() or public.current_role() = 'admin');
create policy "admins manage permission overrides" on public.permission_overrides for all to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "authenticated users read pipeline stages" on public.pipeline_stages for select to authenticated
using (true);
create policy "admins manage pipeline stages" on public.pipeline_stages for all to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

insert into public.pipeline_stages(name, position, color, is_won, is_lost) values
  ('New', 1, '#3B82F6', false, false),
  ('Contacted', 2, '#0891B2', false, false),
  ('Qualified', 3, '#7C3AED', false, false),
  ('Proposal', 4, '#F59E0B', false, false),
  ('Won', 5, '#16A34A', true, false),
  ('Lost', 6, '#DC2626', false, true)
on conflict (name) do nothing;
