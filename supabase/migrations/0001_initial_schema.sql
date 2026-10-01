create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  logo_url text,
  currency text not null default 'XAF',
  invoice_prefix text not null default 'FAC',
  quote_prefix text not null default 'DEV',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  company_name text,
  phone text,
  whatsapp text,
  email text,
  address text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  title text not null,
  description text,
  location text,
  start_date date,
  expected_end_date date,
  actual_end_date date,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  estimated_amount numeric(14,2) not null default 0 check (estimated_amount >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete set null,
  number text not null,
  issue_date date not null default current_date,
  valid_until date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  tax numeric(14,2) not null default 0 check (tax >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, number)
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  quantity numeric(14,2) not null default 1 check (quantity >= 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  amount numeric(14,2) not null default 0 check (amount >= 0)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  number text not null,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  tax numeric(14,2) not null default 0 check (tax >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, number)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(14,2) not null default 1 check (quantity >= 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  amount numeric(14,2) not null default 0 check (amount >= 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  amount numeric(14,2) not null check (amount >= 0),
  payment_date date not null default current_date,
  method text,
  reference text,
  note text,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  category text,
  amount numeric(14,2) not null check (amount >= 0),
  expense_date date not null default current_date,
  supplier text,
  payment_method text,
  description text,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  title text not null,
  type text,
  start_at timestamptz not null,
  end_at timestamptz,
  status text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  notes text,
  reminder_minutes integer check (reminder_minutes >= 0),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  type text,
  name text not null,
  storage_path text not null,
  mime_type text,
  size bigint check (size >= 0),
  created_at timestamptz not null default now()
);

create index clients_business_id_idx on public.clients (business_id);
create index jobs_business_id_idx on public.jobs (business_id);
create index jobs_client_id_idx on public.jobs (client_id);
create index jobs_start_date_idx on public.jobs (start_date);
create index quotes_business_id_idx on public.quotes (business_id);
create index quotes_client_id_idx on public.quotes (client_id);
create index quotes_job_id_idx on public.quotes (job_id);
create index quotes_issue_date_idx on public.quotes (issue_date);
create index quote_items_quote_id_idx on public.quote_items (quote_id);
create index invoices_business_id_idx on public.invoices (business_id);
create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_job_id_idx on public.invoices (job_id);
create index invoices_quote_id_idx on public.invoices (quote_id);
create index invoices_issue_date_idx on public.invoices (issue_date);
create index invoices_due_date_idx on public.invoices (due_date);
create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index payments_business_id_idx on public.payments (business_id);
create index payments_client_id_idx on public.payments (client_id);
create index payments_invoice_id_idx on public.payments (invoice_id);
create index payments_job_id_idx on public.payments (job_id);
create index payments_payment_date_idx on public.payments (payment_date);
create index expenses_business_id_idx on public.expenses (business_id);
create index expenses_job_id_idx on public.expenses (job_id);
create index expenses_expense_date_idx on public.expenses (expense_date);
create index appointments_business_id_idx on public.appointments (business_id);
create index appointments_client_id_idx on public.appointments (client_id);
create index appointments_job_id_idx on public.appointments (job_id);
create index appointments_start_at_idx on public.appointments (start_at);
create index documents_business_id_idx on public.documents (business_id);
create index documents_client_id_idx on public.documents (client_id);
create index documents_job_id_idx on public.documents (job_id);
create index documents_quote_id_idx on public.documents (quote_id);
create index documents_invoice_id_idx on public.documents (invoice_id);

alter table public.businesses enable row level security;
alter table public.clients enable row level security;
alter table public.jobs enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.appointments enable row level security;
alter table public.documents enable row level security;

create policy businesses_select_own on public.businesses for select using (owner_id = auth.uid());
create policy businesses_insert_own on public.businesses for insert with check (owner_id = auth.uid());
create policy businesses_update_own on public.businesses for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy businesses_delete_own on public.businesses for delete using (owner_id = auth.uid());

create policy clients_select_own_business on public.clients for select using (exists (select 1 from public.businesses b where b.id = clients.business_id and b.owner_id = auth.uid()));
create policy clients_insert_own_business on public.clients for insert with check (exists (select 1 from public.businesses b where b.id = clients.business_id and b.owner_id = auth.uid()));
create policy clients_update_own_business on public.clients for update using (exists (select 1 from public.businesses b where b.id = clients.business_id and b.owner_id = auth.uid())) with check (exists (select 1 from public.businesses b where b.id = clients.business_id and b.owner_id = auth.uid()));
create policy clients_delete_own_business on public.clients for delete using (exists (select 1 from public.businesses b where b.id = clients.business_id and b.owner_id = auth.uid()));

create policy jobs_select_own_business on public.jobs for select using (exists (select 1 from public.businesses b where b.id = jobs.business_id and b.owner_id = auth.uid()));
create policy jobs_insert_own_business on public.jobs for insert with check (exists (select 1 from public.businesses b where b.id = jobs.business_id and b.owner_id = auth.uid()));
create policy jobs_update_own_business on public.jobs for update using (exists (select 1 from public.businesses b where b.id = jobs.business_id and b.owner_id = auth.uid())) with check (exists (select 1 from public.businesses b where b.id = jobs.business_id and b.owner_id = auth.uid()));
create policy jobs_delete_own_business on public.jobs for delete using (exists (select 1 from public.businesses b where b.id = jobs.business_id and b.owner_id = auth.uid()));

create policy quotes_select_own_business on public.quotes for select using (exists (select 1 from public.businesses b where b.id = quotes.business_id and b.owner_id = auth.uid()));
create policy quotes_insert_own_business on public.quotes for insert with check (exists (select 1 from public.businesses b where b.id = quotes.business_id and b.owner_id = auth.uid()));
create policy quotes_update_own_business on public.quotes for update using (exists (select 1 from public.businesses b where b.id = quotes.business_id and b.owner_id = auth.uid())) with check (exists (select 1 from public.businesses b where b.id = quotes.business_id and b.owner_id = auth.uid()));
create policy quotes_delete_own_business on public.quotes for delete using (exists (select 1 from public.businesses b where b.id = quotes.business_id and b.owner_id = auth.uid()));

create policy quote_items_select_own_business on public.quote_items for select using (exists (select 1 from public.quotes q join public.businesses b on b.id = q.business_id where q.id = quote_items.quote_id and b.owner_id = auth.uid()));
create policy quote_items_insert_own_business on public.quote_items for insert with check (exists (select 1 from public.quotes q join public.businesses b on b.id = q.business_id where q.id = quote_items.quote_id and b.owner_id = auth.uid()));
create policy quote_items_update_own_business on public.quote_items for update using (exists (select 1 from public.quotes q join public.businesses b on b.id = q.business_id where q.id = quote_items.quote_id and b.owner_id = auth.uid())) with check (exists (select 1 from public.quotes q join public.businesses b on b.id = q.business_id where q.id = quote_items.quote_id and b.owner_id = auth.uid()));
create policy quote_items_delete_own_business on public.quote_items for delete using (exists (select 1 from public.quotes q join public.businesses b on b.id = q.business_id where q.id = quote_items.quote_id and b.owner_id = auth.uid()));

create policy invoices_select_own_business on public.invoices for select using (exists (select 1 from public.businesses b where b.id = invoices.business_id and b.owner_id = auth.uid()));
create policy invoices_insert_own_business on public.invoices for insert with check (exists (select 1 from public.businesses b where b.id = invoices.business_id and b.owner_id = auth.uid()));
create policy invoices_update_own_business on public.invoices for update using (exists (select 1 from public.businesses b where b.id = invoices.business_id and b.owner_id = auth.uid())) with check (exists (select 1 from public.businesses b where b.id = invoices.business_id and b.owner_id = auth.uid()));
create policy invoices_delete_own_business on public.invoices for delete using (exists (select 1 from public.businesses b where b.id = invoices.business_id and b.owner_id = auth.uid()));

create policy invoice_items_select_own_business on public.invoice_items for select using (exists (select 1 from public.invoices i join public.businesses b on b.id = i.business_id where i.id = invoice_items.invoice_id and b.owner_id = auth.uid()));
create policy invoice_items_insert_own_business on public.invoice_items for insert with check (exists (select 1 from public.invoices i join public.businesses b on b.id = i.business_id where i.id = invoice_items.invoice_id and b.owner_id = auth.uid()));
create policy invoice_items_update_own_business on public.invoice_items for update using (exists (select 1 from public.invoices i join public.businesses b on b.id = i.business_id where i.id = invoice_items.invoice_id and b.owner_id = auth.uid())) with check (exists (select 1 from public.invoices i join public.businesses b on b.id = i.business_id where i.id = invoice_items.invoice_id and b.owner_id = auth.uid()));
create policy invoice_items_delete_own_business on public.invoice_items for delete using (exists (select 1 from public.invoices i join public.businesses b on b.id = i.business_id where i.id = invoice_items.invoice_id and b.owner_id = auth.uid()));

create policy payments_select_own_business on public.payments for select using (exists (select 1 from public.businesses b where b.id = payments.business_id and b.owner_id = auth.uid()));
create policy payments_insert_own_business on public.payments for insert with check (exists (select 1 from public.businesses b where b.id = payments.business_id and b.owner_id = auth.uid()));
create policy payments_update_own_business on public.payments for update using (exists (select 1 from public.businesses b where b.id = payments.business_id and b.owner_id = auth.uid())) with check (exists (select 1 from public.businesses b where b.id = payments.business_id and b.owner_id = auth.uid()));
create policy payments_delete_own_business on public.payments for delete using (exists (select 1 from public.businesses b where b.id = payments.business_id and b.owner_id = auth.uid()));

create policy expenses_select_own_business on public.expenses for select using (exists (select 1 from public.businesses b where b.id = expenses.business_id and b.owner_id = auth.uid()));
create policy expenses_insert_own_business on public.expenses for insert with check (exists (select 1 from public.businesses b where b.id = expenses.business_id and b.owner_id = auth.uid()));
create policy expenses_update_own_business on public.expenses for update using (exists (select 1 from public.businesses b where b.id = expenses.business_id and b.owner_id = auth.uid())) with check (exists (select 1 from public.businesses b where b.id = expenses.business_id and b.owner_id = auth.uid()));
create policy expenses_delete_own_business on public.expenses for delete using (exists (select 1 from public.businesses b where b.id = expenses.business_id and b.owner_id = auth.uid()));

create policy appointments_select_own_business on public.appointments for select using (exists (select 1 from public.businesses b where b.id = appointments.business_id and b.owner_id = auth.uid()));
create policy appointments_insert_own_business on public.appointments for insert with check (exists (select 1 from public.businesses b where b.id = appointments.business_id and b.owner_id = auth.uid()));
create policy appointments_update_own_business on public.appointments for update using (exists (select 1 from public.businesses b where b.id = appointments.business_id and b.owner_id = auth.uid())) with check (exists (select 1 from public.businesses b where b.id = appointments.business_id and b.owner_id = auth.uid()));
create policy appointments_delete_own_business on public.appointments for delete using (exists (select 1 from public.businesses b where b.id = appointments.business_id and b.owner_id = auth.uid()));

create policy documents_select_own_business on public.documents for select using (exists (select 1 from public.businesses b where b.id = documents.business_id and b.owner_id = auth.uid()));
create policy documents_insert_own_business on public.documents for insert with check (exists (select 1 from public.businesses b where b.id = documents.business_id and b.owner_id = auth.uid()));
create policy documents_update_own_business on public.documents for update using (exists (select 1 from public.businesses b where b.id = documents.business_id and b.owner_id = auth.uid())) with check (exists (select 1 from public.businesses b where b.id = documents.business_id and b.owner_id = auth.uid()));
create policy documents_delete_own_business on public.documents for delete using (exists (select 1 from public.businesses b where b.id = documents.business_id and b.owner_id = auth.uid()));

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = excluded.public;

create policy documents_storage_select_own_business on storage.objects
for select to authenticated
using (
  bucket_id = 'documents'
  and exists (select 1 from public.businesses b where b.id = split_part(name, '/', 1)::uuid and b.owner_id = auth.uid())
);

create policy documents_storage_insert_own_business on storage.objects
for insert to authenticated
with check (
  bucket_id = 'documents'
  and exists (select 1 from public.businesses b where b.id = split_part(name, '/', 1)::uuid and b.owner_id = auth.uid())
);

create policy documents_storage_update_own_business on storage.objects
for update to authenticated
using (
  bucket_id = 'documents'
  and exists (select 1 from public.businesses b where b.id = split_part(name, '/', 1)::uuid and b.owner_id = auth.uid())
)
with check (
  bucket_id = 'documents'
  and exists (select 1 from public.businesses b where b.id = split_part(name, '/', 1)::uuid and b.owner_id = auth.uid())
);

create policy documents_storage_delete_own_business on storage.objects
for delete to authenticated
using (
  bucket_id = 'documents'
  and exists (select 1 from public.businesses b where b.id = split_part(name, '/', 1)::uuid and b.owner_id = auth.uid())
);
