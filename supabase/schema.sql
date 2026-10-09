-- Run in Supabase SQL Editor. Backend uses the service-role key, never the browser.
create table if not exists public.menuflow_records (
  table_name text not null,
  record_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (table_name, record_id)
);
create index if not exists menuflow_records_table_idx on public.menuflow_records (table_name);
alter table public.menuflow_records enable row level security;
-- No anon/authenticated policies: browser cannot access records directly.
-- This schema is a compatibility bridge. Normalize orders, inventory, points
-- and customers into dedicated relational tables before production.
