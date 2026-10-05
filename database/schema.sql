-- World News initial Supabase/Postgres schema.
-- Run this once in the Supabase SQL editor before enabling persistence.

create table if not exists public.newsroom_articles (
  id text primary key,
  original_url text unique,
  category text not null,
  status text not null,
  published_at timestamptz,
  updated_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists newsroom_articles_category_idx
  on public.newsroom_articles (category);
create index if not exists newsroom_articles_status_idx
  on public.newsroom_articles (status);
create index if not exists newsroom_articles_published_at_idx
  on public.newsroom_articles (published_at desc);

create table if not exists public.newsroom_categories (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.newsroom_sources (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.newsroom_comments (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.newsroom_logs (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.newsroom_settings (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Keep all database access server-side through the service-role key.
alter table public.newsroom_articles enable row level security;
alter table public.newsroom_categories enable row level security;
alter table public.newsroom_sources enable row level security;
alter table public.newsroom_comments enable row level security;
alter table public.newsroom_logs enable row level security;
alter table public.newsroom_settings enable row level security;

-- The service role bypasses RLS. No anonymous/browser policies are intentionally created.
