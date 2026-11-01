-- Accounts, contacts, deals, stage history, leads and the product catalogue.

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  industry text not null default '',
  city text not null default '',
  country text not null default '',
  website text not null default '',
  phone text not null default '',
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD')),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  tags text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounts_owner_id_idx on public.accounts (owner_id);
create index accounts_name_idx on public.accounts (lower(name));

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  title text not null default '',
  email text not null default '',
  phone text not null default '',
  city text not null default '',
  birthday date,
  owner_id uuid not null default auth.uid() references public.profiles(id),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_account_id_idx on public.contacts (account_id);
create index contacts_owner_id_idx on public.contacts (owner_id);
create index contacts_email_idx on public.contacts (lower(email));

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  account_id uuid not null references public.accounts(id) on delete restrict,
  contact_id uuid references public.contacts(id) on delete set null,
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD')),
  stage_id uuid not null references public.pipeline_stages(id),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  close_date date,
  source text not null default 'Website' check (source in ('Website', 'Referral', 'LinkedIn', 'Cold call', 'Event', 'Partner')),
  lost_reason text,
  next_step text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deals_owner_stage_idx on public.deals (owner_id, stage_id);
create index deals_account_id_idx on public.deals (account_id);
create index deals_contact_id_idx on public.deals (contact_id);
create index deals_stage_id_idx on public.deals (stage_id);
create index deals_close_date_idx on public.deals (close_date);

create table public.deal_stage_history (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages(id),
  changed_by uuid not null default auth.uid() references public.profiles(id),
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deal_stage_history_deal_idx on public.deal_stage_history (deal_id, changed_at);
create index deal_stage_history_stage_id_idx on public.deal_stage_history (stage_id);
create index deal_stage_history_changed_by_idx on public.deal_stage_history (changed_by);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  company text not null default '',
  title text not null default '',
  email text not null default '',
  phone text not null default '',
  city text not null default '',
  source text not null default 'Website' check (source in ('Website', 'Referral', 'LinkedIn', 'Cold call', 'Event', 'Partner')),
  status text not null default 'New' check (status in ('New', 'Contacted', 'Qualified', 'Unqualified', 'Converted')),
  score smallint not null default 40 check (score between 0 and 100),
  est_value numeric(14, 2) not null default 0 check (est_value >= 0),
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD')),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  tags text[] not null default '{}',
  last_activity_at timestamptz not null default now(),
  converted_deal_id uuid references public.deals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_owner_status_idx on public.leads (owner_id, status);
create index leads_created_at_idx on public.leads (created_at desc);
create index leads_converted_deal_id_idx on public.leads (converted_deal_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  sku text not null unique,
  category text not null default '',
  price numeric(14, 2) not null default 0 check (price >= 0),
  cost numeric(14, 2) not null default 0 check (cost >= 0),
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD')),
  unit text not null default 'unit',
  tax_pct numeric(5, 2) not null default 18 check (tax_pct between 0 and 100),
  status text not null default 'Active' check (status in ('Active', 'Draft', 'Archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category);

alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.deals enable row level security;
alter table public.deal_stage_history enable row level security;
alter table public.leads enable row level security;
alter table public.products enable row level security;

-- Accounts: visible within the owner's scope, or when the caller can see a deal on the account.
create policy "accounts visible in scope" on public.accounts for select to authenticated
using (public.can_see_owner(owner_id) or exists (select 1 from public.deals d where d.account_id = accounts.id and public.can_see_owner(d.owner_id)));
create policy "accounts created in write scope" on public.accounts for insert to authenticated with check (public.can_write_owner(owner_id));
create policy "accounts updated in write scope" on public.accounts for update to authenticated using (public.can_write_owner(owner_id)) with check (public.can_write_owner(owner_id));
create policy "accounts deleted by managers" on public.accounts for delete to authenticated using (public.can_delete_owner(owner_id));

-- Contacts follow their account.
create policy "contacts visible with account" on public.contacts for select to authenticated
using (public.can_see_owner(owner_id) or exists (select 1 from public.accounts a where a.id = contacts.account_id));
create policy "contacts created in write scope" on public.contacts for insert to authenticated
with check (public.can_write_owner(owner_id) and exists (select 1 from public.accounts a where a.id = contacts.account_id));
create policy "contacts updated in write scope" on public.contacts for update to authenticated using (public.can_write_owner(owner_id)) with check (public.can_write_owner(owner_id));
create policy "contacts deleted by managers" on public.contacts for delete to authenticated using (public.can_delete_owner(owner_id));

create policy "deals visible in scope" on public.deals for select to authenticated using (public.can_see_owner(owner_id));
create policy "deals created in write scope" on public.deals for insert to authenticated with check (public.can_write_owner(owner_id));
create policy "deals updated in write scope" on public.deals for update to authenticated using (public.can_write_owner(owner_id)) with check (public.can_write_owner(owner_id));
create policy "deals deleted by managers" on public.deals for delete to authenticated using (public.can_delete_owner(owner_id));

-- Stage history is append-only and follows its deal.
create policy "stage history visible with deal" on public.deal_stage_history for select to authenticated
using (exists (select 1 from public.deals d where d.id = deal_stage_history.deal_id));
create policy "stage history added by deal writers" on public.deal_stage_history for insert to authenticated
with check (changed_by = auth.uid() and exists (select 1 from public.deals d where d.id = deal_stage_history.deal_id and public.can_write_owner(d.owner_id)));

create policy "leads visible in scope" on public.leads for select to authenticated using (public.can_see_owner(owner_id));
create policy "leads created in write scope" on public.leads for insert to authenticated with check (public.can_write_owner(owner_id));
create policy "leads updated in write scope" on public.leads for update to authenticated using (public.can_write_owner(owner_id)) with check (public.can_write_owner(owner_id));
create policy "leads deleted by managers" on public.leads for delete to authenticated using (public.can_delete_owner(owner_id));

create policy "staff read products" on public.products for select to authenticated using (public.is_staff());
create policy "managers manage products" on public.products for all to authenticated using (public.is_manager_or_above()) with check (public.is_manager_or_above());

create trigger accounts_touch_updated_at before update on public.accounts for each row execute function public.touch_updated_at();
create trigger contacts_touch_updated_at before update on public.contacts for each row execute function public.touch_updated_at();
create trigger deals_touch_updated_at before update on public.deals for each row execute function public.touch_updated_at();
create trigger deal_stage_history_touch_updated_at before update on public.deal_stage_history for each row execute function public.touch_updated_at();
create trigger leads_touch_updated_at before update on public.leads for each row execute function public.touch_updated_at();
create trigger products_touch_updated_at before update on public.products for each row execute function public.touch_updated_at();
