import {
  CAPTURES_FOLLOWUP_SELECT_CORE,
  CAPTURES_FOLLOWUP_SELECT_EXTENDED,
  isMissingOptionalCaptureColumnError,
} from "@/lib/captures-db-columns";
import { answerFollowupQuestion } from "@/lib/openai-followup-answer";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const q =
    typeof body === "object" &&
    body !== null &&
    "question" in body &&
    typeof (body as { question: unknown }).question === "string"
      ? (body as { question: string }).question.trim()
      : "";

  if (!q) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rowQuery = await supabase
    .from("captures")
    .select(CAPTURES_FOLLOWUP_SELECT_EXTENDED)
    .eq("id", id)
    .single();

  if (
    rowQuery.error &&
    isMissingOptionalCaptureColumnError(rowQuery.error)
  ) {
    rowQuery = await supabase
      .from("captures")
      .select(CAPTURES_FOLLOWUP_SELECT_CORE)
      .eq("id", id)
      .single();
  }

  const row = rowQuery.data;
  const fetchError = rowQuery.error;

  if (fetchError || !row) {
    return NextResponse.json(
      { error: fetchError?.message ?? "Capture not found" },
      { status: 404 }
    );
  }

  try {
    const payload = await answerFollowupQuestion(
      {
        clipId: row.id,
        raw_text: row.raw_text,
        url: row.url,
        image_url: row.image_url,
        url_article_text: row.url_article_text,
        ai_title: row.ai_title,
        ai_summary: row.ai_summary,
        ai_why_interesting: row.ai_why_interesting,
        ai_category: row.ai_category,
        ai_related_notes: row.ai_related_notes,
      },
      q
    );

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Follow-up failed";
    console.error("[followup]", { captureId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
