import {
  CAPTURES_DEBUG_SELECT_CORE,
  CAPTURES_DEBUG_SELECT_EXTENDED,
  isMissingOptionalCaptureColumnError,
} from "@/lib/captures-db-columns";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { NextResponse } from "next/server";

function debugAllowed(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_CAPTURE_URL_DEBUG === "true"
  );
}

/**
 * Temporary diagnostics for URL clip enrichment (dev or ALLOW_CAPTURE_URL_DEBUG=true).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!debugAllowed()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let q = await supabase
    .from("captures")
    .select(CAPTURES_DEBUG_SELECT_EXTENDED)
    .eq("id", id)
    .single();

  if (q.error && isMissingOptionalCaptureColumnError(q.error)) {
    q = await supabase
      .from("captures")
      .select(CAPTURES_DEBUG_SELECT_CORE)
      .eq("id", id)
      .single();
  }

  const row = q.data;
  const error = q.error;

  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? "Capture not found" },
      { status: 404 }
    );
  }

  const url = typeof row.url === "string" ? row.url : null;
  const rec = row as Record<string, unknown>;
  const urlArticleText =
    typeof rec.url_article_text === "string" ? rec.url_article_text : "";
  const aiSummary = typeof row.ai_summary === "string" ? row.ai_summary : null;
  const aiRelated =
    typeof row.ai_related_notes === "string" ? row.ai_related_notes : null;

  return NextResponse.json({
    id: row.id,
    url,
    hasImageUrl: Boolean(
      row.image_url && String(row.image_url).trim().length > 0
    ),
    urlArticleTextLength: urlArticleText.length,
    urlArticleTextFirst2000: urlArticleText.slice(0, 2000),
    aiDescription: aiSummary,
    aiRelatedNotes: aiRelated,
    selectedPipelineLastRun:
      typeof rec.last_enrichment_pipeline === "string"
        ? rec.last_enrichment_pipeline
        : null,
    schemaNote:
      "If url_article_text or last_enrichment_pipeline is always null, apply Supabase migrations.",
  });
}
