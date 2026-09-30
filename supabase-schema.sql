-- Run this file once in Supabase SQL Editor before deploying.

create table if not exists public.customers (
  id text primary key,
  name text not null,
  phone text default '',
  notes text default '',
  created_at text not null
);

create table if not exists public.transactions (
  id text primary key,
  customer_id text not null references public.customers(id) on delete cascade,
  type text not null check (type in ('debt', 'payment')),
  amount numeric not null check (amount > 0),
  date text not null,
  note text default '',
  created_at text not null
);

create unique index if not exists idx_customers_phone_filled
  on public.customers(phone)
  where phone <> '';

create index if not exists idx_transactions_customer_date
  on public.transactions(customer_id, date, created_at);

-- The Node server uses the private Service Role key, which bypasses RLS.
-- No client-side key can read these financial records directly.
-- Never put SUPABASE_SERVICE_ROLE_KEY in frontend JavaScript.
alter table public.customers enable row level security;
alter table public.transactions enable row level security;
