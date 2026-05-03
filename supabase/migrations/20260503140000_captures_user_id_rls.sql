-- Per-user captures + RLS. Assign legacy rows in SQL editor, e.g.:
-- update public.captures set user_id = 'YOUR_USER_UUID' where user_id is null;

alter table public.captures
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists captures_user_id_idx on public.captures (user_id);

alter table public.captures enable row level security;

drop policy if exists "Users can view their own captures" on public.captures;
create policy "Users can view their own captures"
  on public.captures
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own captures" on public.captures;
create policy "Users can insert their own captures"
  on public.captures
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own captures" on public.captures;
create policy "Users can update their own captures"
  on public.captures
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own captures" on public.captures;
create policy "Users can delete their own captures"
  on public.captures
  for delete
  using (auth.uid() = user_id);
