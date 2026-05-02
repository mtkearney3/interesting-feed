-- Run once in Supabase SQL Editor (hosted) or: npm run db:apply-capture-columns
-- Requires DATABASE_URL in .env.local for the CLI script path.

alter table public.captures
  add column if not exists url_article_text text;

alter table public.captures
  add column if not exists last_enrichment_pipeline text;
