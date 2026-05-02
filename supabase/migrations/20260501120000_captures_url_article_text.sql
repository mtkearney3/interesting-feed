-- Persist server-extracted article body for URL clips (text-only AI follow-ups).

alter table public.captures
  add column if not exists url_article_text text;
