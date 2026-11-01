-- Access helpers, settings and reference data shared by every CRM table.

alter table public.profiles
  add column quota numeric(14, 2) not null default 0 check (quota >= 0),
  add column avatar_hue smallint not null default 212 check (avatar_hue between 0 and 359);
create index profiles_team_idx on public.profiles (team);
create index profiles_manager_id_idx on public.profiles (manager_id);

-- Any active Nexora user.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and active) $$;

-- Active users who may change records (everyone but viewers).
create or replace function public.can_write() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and active and role::text <> 'viewer') $$;

create or replace function public.is_manager_or_above() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role()::text in ('owner', 'admin', 'manager'), false) $$;

-- Records owned by `owner` are visible within the caller's data scope.
create or replace function public.can_see_owner(owner uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select owner is not null and public.can_access_profile(owner) $$;

-- Owner/Admin change anything, Managers their team's records, Sales reps their own. Viewers nothing.
create or replace function public.can_write_owner(owner uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.active and me.role::text <> 'viewer'
      and (me.role::text in ('owner', 'admin') or me.id = owner
        or (me.role::text = 'manager' and me.team is not null
          and exists (select 1 from public.profiles them where them.id = owner and them.team = me.team)))
  )
$$;

-- Deleting needs manager rights or above, within write scope.
create or replace function public.can_delete_owner(owner uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select public.is_manager_or_above() and public.can_write_owner(owner) $$;

-- Helpers are for policies and signed-in users only.
revoke execute on function public.current_role(), public.is_admin(), public.is_staff(), public.can_write(), public.is_manager_or_above(),
  public.can_access_profile(uuid), public.can_see_owner(uuid), public.can_write_owner(uuid), public.can_delete_owner(uuid) from public, anon;
grant execute on function public.current_role(), public.is_admin(), public.is_staff(), public.can_write(), public.is_manager_or_above(),
  public.can_access_profile(uuid), public.can_see_owner(uuid), public.can_write_owner(uuid), public.can_delete_owner(uuid) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Single-row company settings.
create table public.company_settings (
  id boolean primary key default true check (id),
  name text not null default 'Nexora',
  legal_name text not null default '',
  address text not null default '',
  tax_id text not null default '',
  email text not null default '',
  phone text not null default '',
  base_currency text not null default 'INR' check (base_currency in ('INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD')),
  timezone text not null default 'Asia/Kolkata',
  invoice_prefix text not null default 'INV-',
  quote_prefix text not null default 'QT-',
  next_invoice_no integer not null default 1 check (next_invoice_no > 0),
  next_quote_no integer not null default 1 check (next_quote_no > 0),
  payment_terms text not null default 'Due within 15 days',
  bank_details text not null default '',
  notify jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.company_settings (id) values (true);

create table public.currency_rates (
  currency text primary key check (currency in ('INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD')),
  rate_to_base numeric(14, 6) not null check (rate_to_base > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.currency_rates (currency, rate_to_base) values
  ('INR', 1), ('USD', 83.2), ('EUR', 90.1), ('GBP', 105.4), ('AED', 22.65), ('SGD', 61.8);

-- Pipeline stages: add win probability and the Negotiation stage the app uses.
alter table public.pipeline_stages
  add column probability smallint not null default 0 check (probability between 0 and 100),
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();
update public.pipeline_stages set position = position + 100 where name in ('Won', 'Lost');
insert into public.pipeline_stages (name, position, color) values ('Negotiation', 5, '#EA580C') on conflict (name) do nothing;
update public.pipeline_stages set position = 6 where name = 'Won';
update public.pipeline_stages set position = 7 where name = 'Lost';
update public.pipeline_stages s set probability = v.p
from (values ('New', 10), ('Contacted', 20), ('Qualified', 40), ('Proposal', 60), ('Negotiation', 80), ('Won', 100), ('Lost', 0)) as v(name, p)
where s.name = v.name;

alter table public.company_settings enable row level security;
alter table public.currency_rates enable row level security;

create policy "staff read company settings" on public.company_settings for select to authenticated using (public.is_staff());
create policy "admins update company settings" on public.company_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "staff read currency rates" on public.currency_rates for select to authenticated using (public.is_staff());
create policy "admins manage currency rates" on public.currency_rates for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Only Nexora staff read stages (replaces the open read policy).
drop policy "authenticated users read pipeline stages" on public.pipeline_stages;
create policy "staff read pipeline stages" on public.pipeline_stages for select to authenticated using (public.is_staff());

create trigger company_settings_touch_updated_at before update on public.company_settings for each row execute function public.touch_updated_at();
create trigger currency_rates_touch_updated_at before update on public.currency_rates for each row execute function public.touch_updated_at();
create trigger pipeline_stages_touch_updated_at before update on public.pipeline_stages for each row execute function public.touch_updated_at();
