-- Quotes, invoices, their lines and payments. Documents follow the visibility of their account.

create table public.sales_docs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('invoice', 'quote')),
  number text not null unique,
  account_id uuid not null references public.accounts(id) on delete restrict,
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD')),
  issue_date date not null default current_date,
  due_date date not null default current_date + 15,
  status text not null default 'Draft',
  notes text not null default '',
  terms text not null default '',
  created_by uuid not null default auth.uid() references public.profiles(id),
  converted_from uuid references public.sales_docs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_docs_status_check check (
    (kind = 'invoice' and status in ('Draft', 'Sent', 'Paid', 'Overdue', 'Void'))
    or (kind = 'quote' and status in ('Draft', 'Sent', 'Accepted', 'Declined'))
  ),
  constraint sales_docs_dates_check check (due_date >= issue_date)
);
create index sales_docs_account_id_idx on public.sales_docs (account_id);
create index sales_docs_kind_status_idx on public.sales_docs (kind, status);
create index sales_docs_due_date_idx on public.sales_docs (due_date);
create index sales_docs_contact_id_idx on public.sales_docs (contact_id);
create index sales_docs_deal_id_idx on public.sales_docs (deal_id);
create index sales_docs_created_by_idx on public.sales_docs (created_by);
create index sales_docs_converted_from_idx on public.sales_docs (converted_from);

create table public.sales_doc_lines (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.sales_docs(id) on delete cascade,
  position smallint not null default 0,
  product_id uuid references public.products(id) on delete set null,
  description text not null default '',
  qty numeric(12, 3) not null default 1 check (qty > 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  discount_pct numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  tax_pct numeric(5, 2) not null default 18 check (tax_pct between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sales_doc_lines_doc_idx on public.sales_doc_lines (doc_id, position);
create index sales_doc_lines_product_id_idx on public.sales_doc_lines (product_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.sales_docs(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  method text not null default 'Bank transfer',
  recorded_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_doc_id_idx on public.payments (doc_id);
create index payments_recorded_by_idx on public.payments (recorded_by);

alter table public.sales_docs enable row level security;
alter table public.sales_doc_lines enable row level security;
alter table public.payments enable row level security;

create policy "docs visible with account" on public.sales_docs for select to authenticated
using (exists (select 1 from public.accounts a where a.id = sales_docs.account_id));
create policy "docs created by writers" on public.sales_docs for insert to authenticated
with check (public.can_write() and created_by = auth.uid() and exists (select 1 from public.accounts a where a.id = sales_docs.account_id));
create policy "docs updated by writers" on public.sales_docs for update to authenticated
using (public.can_write() and exists (select 1 from public.accounts a where a.id = sales_docs.account_id))
with check (public.can_write() and exists (select 1 from public.accounts a where a.id = sales_docs.account_id));
create policy "docs deleted by managers" on public.sales_docs for delete to authenticated
using (public.is_manager_or_above() and exists (select 1 from public.accounts a where a.id = sales_docs.account_id));

create policy "lines visible with doc" on public.sales_doc_lines for select to authenticated
using (exists (select 1 from public.sales_docs d where d.id = sales_doc_lines.doc_id));
create policy "lines managed by writers" on public.sales_doc_lines for all to authenticated
using (public.can_write() and exists (select 1 from public.sales_docs d where d.id = sales_doc_lines.doc_id))
with check (public.can_write() and exists (select 1 from public.sales_docs d where d.id = sales_doc_lines.doc_id));

create policy "payments visible with doc" on public.payments for select to authenticated
using (exists (select 1 from public.sales_docs d where d.id = payments.doc_id));
create policy "payments recorded by writers" on public.payments for insert to authenticated
with check (public.can_write() and recorded_by = auth.uid() and exists (select 1 from public.sales_docs d where d.id = payments.doc_id));
create policy "payments changed by managers" on public.payments for update to authenticated
using (public.is_manager_or_above() and exists (select 1 from public.sales_docs d where d.id = payments.doc_id))
with check (public.is_manager_or_above());
create policy "payments deleted by managers" on public.payments for delete to authenticated
using (public.is_manager_or_above() and exists (select 1 from public.sales_docs d where d.id = payments.doc_id));

create trigger sales_docs_touch_updated_at before update on public.sales_docs for each row execute function public.touch_updated_at();
create trigger sales_doc_lines_touch_updated_at before update on public.sales_doc_lines for each row execute function public.touch_updated_at();
create trigger payments_touch_updated_at before update on public.payments for each row execute function public.touch_updated_at();
