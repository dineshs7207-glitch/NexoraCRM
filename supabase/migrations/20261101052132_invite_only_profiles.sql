-- Nexora is invite-only. Anyone can still create a Supabase Auth user (for example by clicking
-- "Continue with Google"), but only invited people get a profile, and without a profile row level
-- security shows them nothing. The invite-user edge function sets the invitee's role, team and scope.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.invited_at is null then
    return new;
  end if;
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
