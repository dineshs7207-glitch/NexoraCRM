-- Owners have every admin right; scope checks treat them like admins.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role()::text in ('owner', 'admin'), false) $$;

create or replace function public.can_access_profile(target uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles me join public.profiles them on them.id = target
    where me.id = auth.uid() and me.active
      and (me.role::text in ('owner', 'admin') or me.scope = 'all' or them.id = me.id
        or (me.scope = 'team' and me.team is not null and them.team = me.team))
  )
$$;

drop policy "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy "users read own permission overrides" on public.permission_overrides;
create policy "users read own permission overrides" on public.permission_overrides for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

drop policy "admins manage permission overrides" on public.permission_overrides;
create policy "admins manage permission overrides" on public.permission_overrides for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy "admins manage pipeline stages" on public.pipeline_stages;
create policy "admins manage pipeline stages" on public.pipeline_stages for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Every invited user gets a profile. Name and team come from invite metadata; the role is
-- never taken from metadata, so it always starts as sales_rep/own until an admin changes it.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, work_email, team)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'team', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- Accounts created before this migration (for example an early invite) get their profile too.
insert into public.profiles (id, full_name, work_email, team)
select u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)),
  u.email,
  nullif(u.raw_user_meta_data ->> 'team', '')
from auth.users u
where u.email is not null
on conflict (id) do nothing;
