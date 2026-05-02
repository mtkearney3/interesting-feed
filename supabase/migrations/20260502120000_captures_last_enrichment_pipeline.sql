-- Tracks which enrichment path last completed (URL text-only vs vision vs plain text).

alter table public.captures
  add column if not exists last_enrichment_pipeline text;
