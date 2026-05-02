/**
 * Supports DBs that have not yet applied migrations adding url_article_text /
 * last_enrichment_pipeline. PostgREST returns PGRST204-style errors when those
 * columns are requested but absent from the schema cache.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const CAPTURES_LIST_SELECT_CORE =
  "id, raw_text, url, source, user_note, capture_type, image_url, ai_title, ai_summary, ai_why_interesting, ai_category, ai_insight_score, ai_followup_questions, ai_related_notes, status, created_at";

export const CAPTURES_LIST_SELECT_EXTENDED = `${CAPTURES_LIST_SELECT_CORE}, url_article_text, last_enrichment_pipeline`;

export const CAPTURES_ENRICH_FETCH_SELECT =
  "id, raw_text, url, source, user_note, capture_type, image_url, status, ai_title";

/** Follow-up API row (with optional stored article body). */
export const CAPTURES_FOLLOWUP_SELECT_CORE =
  "id, raw_text, url, image_url, ai_title, ai_summary, ai_why_interesting, ai_category, ai_related_notes";

export const CAPTURES_FOLLOWUP_SELECT_EXTENDED = `${CAPTURES_FOLLOWUP_SELECT_CORE}, url_article_text`;

export const CAPTURES_DEBUG_SELECT_CORE =
  "id, url, image_url, ai_summary, ai_related_notes";

export const CAPTURES_DEBUG_SELECT_EXTENDED = `${CAPTURES_DEBUG_SELECT_CORE}, url_article_text, last_enrichment_pipeline`;

export function isMissingOptionalCaptureColumnError(
  error: { message?: string; code?: string } | null | undefined
): boolean {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("url_article_text") ||
    msg.includes("last_enrichment_pipeline") ||
    (msg.includes("schema cache") && msg.includes("captures"))
  );
}

export async function capturesListQueryWithColumnFallback(
  supabase: SupabaseClient
) {
  const extended = await supabase
    .from("captures")
    .select(CAPTURES_LIST_SELECT_EXTENDED)
    .order("created_at", { ascending: false });

  if (!extended.error) {
    console.log("CAPTURE_FEED_QUERY", {
      select: "extended",
      rowCount: extended.data?.length ?? 0,
      error: null,
    });
    return extended;
  }

  if (isMissingOptionalCaptureColumnError(extended.error)) {
    console.warn("CAPTURE_FEED_QUERY", {
      select: "extended_failed_using_core_fallback",
      rowCount: 0,
      error: extended.error.message,
      code: extended.error.code,
    });
    const core = await supabase
      .from("captures")
      .select(CAPTURES_LIST_SELECT_CORE)
      .order("created_at", { ascending: false });
    console.log("CAPTURE_FEED_QUERY", {
      select: "core_fallback",
      rowCount: core.data?.length ?? 0,
      error: core.error?.message ?? null,
      code: core.error?.code ?? null,
    });
    return core;
  }

  console.error("CAPTURE_FEED_QUERY", {
    select: "extended",
    rowCount: 0,
    error: extended.error.message,
    code: extended.error.code,
  });
  return extended;
}
