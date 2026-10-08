CREATE TABLE IF NOT EXISTS newsroom_articles (
  id TEXT PRIMARY KEY,
  original_url TEXT,
  category TEXT,
  status TEXT,
  published_at TEXT,
  updated_at TEXT,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_newsroom_articles_original_url
  ON newsroom_articles(original_url);
CREATE INDEX IF NOT EXISTS idx_newsroom_articles_category
  ON newsroom_articles(category);
CREATE INDEX IF NOT EXISTS idx_newsroom_articles_status
  ON newsroom_articles(status);
CREATE INDEX IF NOT EXISTS idx_newsroom_articles_published_at
  ON newsroom_articles(published_at DESC);

CREATE TABLE IF NOT EXISTS newsroom_categories (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS newsroom_sources (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS newsroom_comments (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS newsroom_logs (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS newsroom_settings (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
