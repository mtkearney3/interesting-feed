-- Public bucket for capture screenshots (OpenAI vision reads the public URL).
-- Uploads use the service role from the Next.js API route.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'capture-images',
  'capture-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
