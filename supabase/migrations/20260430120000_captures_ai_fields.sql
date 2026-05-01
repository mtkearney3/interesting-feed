-- Richer captures + AI enrichment columns (run in Supabase SQL editor or via CLI).

alter table captures
  add column if not exists capture_type text not null default 'link',
  add column if not exists image_url text,
  add column if not exists ai_title text,
  add column if not exists ai_summary text,
  add column if not exists ai_why_interesting text,
  add column if not exists ai_category text,
  add column if not exists ai_insight_score double precision,
  add column if not exists ai_followup_questions jsonb default '[]'::jsonb,
  add column if not exists ai_related_notes text;

-- Normalize legacy status values into the MVP lifecycle.
update captures
set status = 'raw'
where status is null
   or trim(status) = ''
   or lower(status) not in ('raw', 'processing', 'processed', 'error');
