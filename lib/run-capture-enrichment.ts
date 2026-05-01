import { enrichCaptureWithOpenAI } from "@/lib/openai-enrich";
import { supabase } from "@/lib/supabase";

const ENRICH_NOTE_PREFIX = "[enrichment] ";
const ENRICH_NOTE_MAX = 4000;

export type RunEnrichmentResult =
  | { ok: true; capture: Record<string, unknown> }
  | {
      ok: false;
      error: string;
      httpStatus: number;
    };

type RunOptions = {
  /** POST /api/captures already set status to `processing` before scheduling work. */
  skipMarkProcessing?: boolean;
};

function enrichmentTimeoutMs(): number {
  const n = Number(process.env.CAPTURE_ENRICH_TIMEOUT_MS);
  return Number.isFinite(n) && n > 5_000 ? n : 55_000;
}

function formatFailureNote(reason: string): string {
  return `${ENRICH_NOTE_PREFIX}${reason}`.slice(0, ENRICH_NOTE_MAX);
}

export async function markCaptureEnrichmentFailure(
  captureId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from("captures")
    .update({
      status: "error",
      ai_related_notes: formatFailureNote(reason),
    })
    .eq("id", captureId);

  if (error) {
    console.error("[enrich] markCaptureEnrichmentFailure failed", {
      captureId,
      message: error.message,
    });
  }
}

function isAbortLike(e: unknown): boolean {
  if (e instanceof Error && e.name === "AbortError") return true;
  if (
    typeof DOMException !== "undefined" &&
    e instanceof DOMException &&
    e.name === "AbortError"
  ) {
    return true;
  }
  return false;
}

export async function runCaptureEnrichment(
  captureId: string,
  options?: RunOptions
): Promise<RunEnrichmentResult> {
  try {
    const { data: row, error: fetchError } = await supabase
      .from("captures")
      .select(
        "id, raw_text, url, source, user_note, capture_type, image_url, status"
      )
      .eq("id", captureId)
      .single();

    if (fetchError || !row) {
      return {
        ok: false,
        error: "Capture not found",
        httpStatus: 404,
      };
    }

    if (!options?.skipMarkProcessing) {
      const { error: processingError } = await supabase
        .from("captures")
        .update({ status: "processing" })
        .eq("id", captureId);

      if (processingError) {
        const msg = `Could not set processing: ${processingError.message}`;
        await markCaptureEnrichmentFailure(captureId, msg);
        return {
          ok: false,
          error: msg,
          httpStatus: 500,
        };
      }
    }

    const hasImage = Boolean(row.image_url?.trim());
    const timeoutMs = hasImage
      ? Math.max(enrichmentTimeoutMs(), 90_000)
      : enrichmentTimeoutMs();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);

    try {
      const enriched = await enrichCaptureWithOpenAI(
        {
          raw_text: row.raw_text,
          url: row.url,
          source: row.source,
          user_note: row.user_note,
          capture_type: String(row.capture_type ?? "link"),
          image_url: row.image_url ?? null,
        },
        { signal: ac.signal }
      );

      const { data: updated, error: updateError } = await supabase
        .from("captures")
        .update({
          ai_title: enriched.ai_title,
          ai_summary: enriched.ai_summary,
          ai_why_interesting: enriched.ai_why_interesting,
          ai_category: enriched.ai_category,
          ai_insight_score: enriched.ai_insight_score,
          ai_followup_questions: enriched.ai_followup_questions,
          ai_related_notes: enriched.ai_related_notes,
          status: "processed",
        })
        .eq("id", captureId)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      return { ok: true, capture: updated as Record<string, unknown> };
    } catch (e) {
      let message = e instanceof Error ? e.message : "Enrichment failed";
      if (isAbortLike(e)) {
        message = `Enrichment timed out after ${timeoutMs}ms`;
      }
      console.error("[enrich] run failed", { captureId, message });
      await markCaptureEnrichmentFailure(captureId, message);
      return {
        ok: false,
        error: message,
        httpStatus: 502,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[enrich] unexpected", { captureId, message });
    await markCaptureEnrichmentFailure(captureId, message);
    return {
      ok: false,
      error: message,
      httpStatus: 502,
    };
  }
}
