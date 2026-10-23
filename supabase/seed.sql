-- Development reference data only. User profiles are created from Supabase Auth invitations.
insert into public.pipeline_stages(name, position, color, is_won, is_lost) values
  ('New', 1, '#3B82F6', false, false),
  ('Contacted', 2, '#0891B2', false, false),
  ('Qualified', 3, '#7C3AED', false, false),
  ('Proposal', 4, '#F59E0B', false, false),
  ('Won', 5, '#16A34A', true, false),
  ('Lost', 6, '#DC2626', false, true)
on conflict (name) do nothing;
