-- Per-user tokens for iPhone Shortcut ingestion (no browser session).
-- Run in Supabase SQL Editor or via CLI.

-- 1) Captures owner column (safe if already applied)
ALTER TABLE public.captures
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS captures_user_id_idx ON public.captures (user_id);

-- 2) Shortcut tokens
CREATE TABLE IF NOT EXISTS public.user_shortcut_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_shortcut_tokens_user_id_idx
  ON public.user_shortcut_tokens (user_id);

CREATE INDEX IF NOT EXISTS user_shortcut_tokens_token_idx
  ON public.user_shortcut_tokens (token);

-- 3) RLS
ALTER TABLE public.captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_shortcut_tokens ENABLE ROW LEVEL SECURITY;

-- Captures policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own captures" ON public.captures;
CREATE POLICY "Users can view their own captures"
  ON public.captures FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own captures" ON public.captures;
CREATE POLICY "Users can insert their own captures"
  ON public.captures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own captures" ON public.captures;
CREATE POLICY "Users can update their own captures"
  ON public.captures FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own captures" ON public.captures;
CREATE POLICY "Users can delete their own captures"
  ON public.captures FOR DELETE
  USING (auth.uid() = user_id);

-- user_shortcut_tokens: own rows only
DROP POLICY IF EXISTS "Users select own shortcut tokens" ON public.user_shortcut_tokens;
CREATE POLICY "Users select own shortcut tokens"
  ON public.user_shortcut_tokens FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own shortcut tokens" ON public.user_shortcut_tokens;
CREATE POLICY "Users insert own shortcut tokens"
  ON public.user_shortcut_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own shortcut tokens" ON public.user_shortcut_tokens;
CREATE POLICY "Users update own shortcut tokens"
  ON public.user_shortcut_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
