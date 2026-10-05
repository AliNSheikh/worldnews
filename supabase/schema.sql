-- World News initial persistence schema for Supabase/PostgreSQL.
-- Run once in the Supabase SQL Editor.

create table if not exists public.newsroom_articles (
  id text primary key,
  payload jsonb not null,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists newsroom_articles_published_idx
  on public.newsroom_articles (published_at desc);

create table if not exists public.newsroom_sources (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.newsroom_categories (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.newsroom_comments (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.newsroom_settings (
  id text primary key default 'singleton',
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.newsroom_logs (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.newsroom_articles enable row level security;
alter table public.newsroom_sources enable row level security;
alter table public.newsroom_categories enable row level security;
alter table public.newsroom_comments enable row level security;
alter table public.newsroom_settings enable row level security;
alter table public.newsroom_logs enable row level security;

-- No public policies are intentionally created.
-- The Express server uses SUPABASE_SERVICE_ROLE_KEY server-side only.
