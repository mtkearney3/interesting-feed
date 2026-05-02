import { describeCaptureEnrichBranch } from "@/lib/captures-enrich-pipeline";
import {
  CAPTURES_ENRICH_FETCH_SELECT,
  isMissingOptionalCaptureColumnError,
} from "@/lib/captures-db-columns";
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
  /** POST /api/captures already set status to `analyzing` before scheduling work. */
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

async function updateCaptureAfterEnrichment(
  captureId: string,
  updatePayload: Record<string, unknown>
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  let result = await supabase
    .from("captures")
    .update(updatePayload)
    .eq("id", captureId)
    .select()
    .single();

  if (
    result.error &&
    isMissingOptionalCaptureColumnError(result.error) &&
    ("url_article_text" in updatePayload ||
      "last_enrichment_pipeline" in updatePayload)
  ) {
    const {
      url_article_text: _u,
      last_enrichment_pipeline: _l,
      ...rest
    } = updatePayload;
    console.warn("[enrich] retrying update without url_article_text / last_enrichment_pipeline", {
      captureId,
      message: result.error.message,
    });
    result = await supabase
      .from("captures")
      .update(rest)
      .eq("id", captureId)
      .select()
      .single();
  }

  return result;
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
      .select(CAPTURES_ENRICH_FETCH_SELECT)
      .eq("id", captureId)
      .single();

    if (fetchError || !row) {
      const err = fetchError as { code?: string; message?: string } | null;
      const notFound =
        !row ||
        err?.code === "PGRST116" ||
        /0 rows/i.test(String(err?.message ?? ""));
      return {
        ok: false,
        error: err?.message ?? "Capture not found",
        httpStatus: notFound ? 404 : 500,
      };
    }

    const st = String(row.status ?? "").toLowerCase();
    const alreadyEnriched =
      Boolean(String(row.ai_title ?? "").trim()) &&
      (st === "ready" || st === "processed");
    if (alreadyEnriched) {
      return { ok: true, capture: row as Record<string, unknown> };
    }

    const branch = describeCaptureEnrichBranch({
      id: row.id,
      url: row.url,
      raw_text: row.raw_text,
      image_url: row.image_url,
    });
    console.log("ENRICH_PIPELINE_BRANCH", branch);

    const urlTrimmedForLog = String(row.url ?? "").trim();
    const hasImageUrlForLog = Boolean(row.image_url?.trim());
    console.log("ENRICHMENT_ROUTING_FINAL", {
      id: captureId,
      url: row.url ?? null,
      source_type: row.source ?? null,
      capture_type: row.capture_type ?? null,
      image_url: row.image_url ?? null,
      selectedPipeline: branch.selectedPipeline,
    });

    if (!options?.skipMarkProcessing) {
      const { error: processingError } = await supabase
        .from("captures")
        .update({ status: "analyzing" })
        .eq("id", captureId);

      if (processingError) {
        const msg = `Could not set analyzing: ${processingError.message}`;
        await markCaptureEnrichmentFailure(captureId, msg);
        return {
          ok: false,
          error: msg,
          httpStatus: 500,
        };
      }
    }

    const urlTrimmed = urlTrimmedForLog;
    const hasUrl = Boolean(urlTrimmed);
    const hasImage = hasImageUrlForLog;
    const timeoutMs =
      hasImage || hasUrl
        ? Math.max(enrichmentTimeoutMs(), 90_000)
        : enrichmentTimeoutMs();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);

    try {
      const enriched = await enrichCaptureWithOpenAI(
        {
          id: row.id,
          raw_text: row.raw_text,
          url: row.url,
          source: row.source,
          user_note: row.user_note,
          capture_type: String(
            row.capture_type ?? (hasUrl ? "url" : "link")
          ),
          /** URL clips: preview/screenshot URLs must not influence OpenAI (UI only). */
          image_url: hasUrl ? null : (row.image_url ?? null),
        },
        { signal: ac.signal }
      );

      const updatePayload: Record<string, unknown> = {
        ai_title: enriched.ai_title,
        ai_summary: enriched.ai_summary,
        ai_why_interesting: enriched.ai_why_interesting,
        ai_category: enriched.ai_category,
        ai_insight_score: enriched.ai_insight_score,
        ai_followup_questions: enriched.ai_followup_questions,
        ai_related_notes: enriched.ai_related_notes,
        status: "ready",
        last_enrichment_pipeline: enriched.last_enrichment_pipeline,
      };
      if (hasUrl) {
        updatePayload.url_article_text = enriched.url_article_text ?? null;
      }

      const { data: updated, error: updateError } =
        await updateCaptureAfterEnrichment(captureId, updatePayload);

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (hasUrl) {
        const savedLen =
          typeof enriched.url_article_text === "string"
            ? enriched.url_article_text.length
            : 0;
        console.log("URL_ENRICH_SAVE_ATTEMPT", {
          clipId: captureId,
          url_article_text_chars_in_result: savedLen,
          pipeline: enriched.last_enrichment_pipeline,
        });

        let verify = await supabase
          .from("captures")
          .select("id, url_article_text, ai_summary, ai_related_notes")
          .eq("id", captureId)
          .single();

        if (
          verify.error &&
          isMissingOptionalCaptureColumnError(verify.error)
        ) {
          verify = await supabase
            .from("captures")
            .select("id, ai_summary, ai_related_notes")
            .eq("id", captureId)
            .single();
        }

        if (verify.error) {
          console.error("URL_ENRICH_PERSIST_VERIFY_FAILED", {
            clipId: captureId,
            message: verify.error.message,
          });
        } else {
          const persistedText =
            typeof verify.data?.url_article_text === "string"
              ? verify.data.url_article_text
              : "";
          console.log("URL_ENRICH_PERSIST_VERIFY", {
            clipId: captureId,
            persistedUrlArticleTextLength: persistedText.length,
            persistedAiDescriptionFirst300: String(
              verify.data?.ai_summary ?? ""
            ).slice(0, 300),
            persistedAiRelatedNotesFirst300: String(
              verify.data?.ai_related_notes ?? ""
            ).slice(0, 300),
          });
        }
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
