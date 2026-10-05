-- World News v1 persistent storage
-- Run this once in Supabase SQL Editor.

create table if not exists public.articles (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.sources (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_logs (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists articles_payload_category_idx on public.articles ((payload->>'category'));
create index if not exists articles_payload_status_idx on public.articles ((payload->>'status'));
create index if not exists articles_payload_published_idx on public.articles ((payload->>'publishedAt'));
create index if not exists sources_payload_active_idx on public.sources ((payload->>'isActive'));

alter table public.articles enable row level security;
alter table public.categories enable row level security;
alter table public.sources enable row level security;
alter table public.automation_logs enable row level security;
alter table public.site_settings enable row level security;

-- The application uses the server-only Service Role key, which bypasses RLS.
-- Do not expose SUPABASE_SERVICE_ROLE_KEY to the browser/Vite client.
