import { resolveCaptureInsertFromBody } from "@/lib/capture-insert-resolve";
import {
  markCaptureEnrichmentFailure,
  runCaptureEnrichment,
} from "@/lib/run-capture-enrichment";
import { supabase } from "@/lib/supabase";
import { after } from "next/server";

/** Lets a bookmarklet POST from arbitrary pages (dev: localhost only). */
const BOOKMARKLET_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function jsonWithCors(
  body: unknown,
  init?: { status?: number; headers?: HeadersInit }
): Response {
  return Response.json(body, {
    status: init?.status ?? 200,
    headers: { ...BOOKMARKLET_CORS_HEADERS, ...init?.headers },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: BOOKMARKLET_CORS_HEADERS });
}

function stripUrlTail(u: string): string {
  return u.replace(/[)\].,;:]+$/g, "").trim();
}

/** First http(s) URL in a string (JSON or plain). */
function firstHttpUrlInString(s: string): string {
  if (!s) return "";
  const strict = s.match(/https?:\/\/[^\s"]+/i);
  if (strict?.[0]) return stripUrlTail(strict[0]);
  const loose = s.match(/https?:\/\/[^"'\s\\]+/i);
  if (loose?.[0]) return stripUrlTail(loose[0]);
  const idx = s.search(/https?:\/\//i);
  if (idx < 0) return "";
  const tail = s.slice(idx);
  const end = tail.search(/[\s"'<>\])},;]/);
  const chunk =
    end > 0 ? tail.slice(0, end) : stripUrlTail(tail.slice(0, 4000));
  return stripUrlTail(chunk);
}

function pickExistingText(body: Record<string, unknown>): string {
  for (const k of [
    "raw_text",
    "text",
    "title",
    "content",
    "name",
    "shortcutInput",
    "plainText",
  ] as const) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export async function POST(request: Request) {
  const rawText = await request.text();
  let rawBody: Record<string, unknown> = {};
  let parseOk = false;
  try {
    rawBody = JSON.parse(rawText) as Record<string, unknown>;
    parseOk = true;
  } catch {
    rawBody = {};
  }

  const detectedUrlFromRawBody = firstHttpUrlInString(rawText);
  const detectedUrlFromParsedString = parseOk
    ? firstHttpUrlInString(JSON.stringify(rawBody))
    : "";

  if (!parseOk && detectedUrlFromRawBody) {
    rawBody = {
      raw_text: rawText.trim().slice(0, 80_000),
      url: detectedUrlFromRawBody,
      source: "ios_share",
    };
    parseOk = true;
  }

  try {
    const R = resolveCaptureInsertFromBody(rawBody);
    const { rawJson, norm, trimmedImage } = R;
    const user_note = norm.user_note;

    let normalizedUrl =
      R.trimmedUrl ||
      detectedUrlFromRawBody ||
      detectedUrlFromParsedString ||
      "";
    normalizedUrl = normalizedUrl.trim();

    if (!normalizedUrl && /https?:\/\//i.test(rawText)) {
      normalizedUrl = firstHttpUrlInString(rawText).trim();
    }
    if (!normalizedUrl && parseOk && /https?:\/\//i.test(rawJson)) {
      normalizedUrl = firstHttpUrlInString(rawJson).trim();
    }

    let normalizedRawText = R.trimmedRaw.trim();
    if (!normalizedRawText) {
      normalizedRawText =
        pickExistingText(rawBody) || normalizedUrl || "";
    }

    const isManual =
      String(rawBody.source ?? "")
        .trim()
        .toLowerCase() === "manual";

    let finalSource = R.finalSource.trim();
    let finalCaptureType = R.resolvedType;
    if (normalizedUrl) {
      finalCaptureType = "url";
      if (isManual) {
        finalSource = "manual";
      } else {
        finalSource = "ios_url_share";
      }
    }

    let hasUrl = normalizedUrl.length > 0;
    let hasRawForInsert = normalizedRawText.length > 0;
    const hasImage = Boolean(trimmedImage);

    if (
      /https?:\/\//i.test(rawText) ||
      (parseOk && /https?:\/\//i.test(rawJson))
    ) {
      if (!normalizedUrl.trim()) {
        normalizedUrl =
          firstHttpUrlInString(rawText) || firstHttpUrlInString(rawJson);
      }
      if (normalizedUrl && !normalizedRawText.trim()) {
        normalizedRawText = normalizedUrl;
      }
      if (normalizedUrl) {
        finalCaptureType = "url";
        if (isManual) finalSource = "manual";
        else finalSource = "ios_url_share";
      }
      normalizedUrl = normalizedUrl.trim();
      normalizedRawText = normalizedRawText.trim();
      hasUrl = normalizedUrl.length > 0;
      hasRawForInsert = normalizedRawText.length > 0;
    }

    normalizedUrl = normalizedUrl.trim();
    normalizedRawText = normalizedRawText.trim();

    const maxRawLog = 65536;
    console.log(
      "API_CAPTURE_CREATE_RAW_BODY",
      rawJson.length > maxRawLog
        ? `${rawJson.slice(0, maxRawLog)}...(truncated, totalLen=${rawJson.length})`
        : rawJson
    );

    console.log("API_CAPTURE_INCOMING", {
      rawBodyFirst1000: rawJson.slice(0, 1000),
      parsedKeys: Object.keys(rawBody),
      detectedUrl: normalizedUrl || R.detectedUrl,
      normalizedUrl,
      finalSourceType: finalSource,
      finalCaptureType,
      hasImageUrl: hasImage,
    });

    const debugRequested = rawBody.debug === true;

    const rawTextPreview =
      norm.raw_text.length > 2000
        ? `${norm.raw_text.slice(0, 2000)}...(truncated)`
        : norm.raw_text;
    console.log("API_CAPTURE_CREATE_NORMALIZED", {
      raw_text: rawTextPreview,
      url: norm.url,
      urlEffective: normalizedUrl,
      source: finalSource,
      source_type: finalSource,
      title: norm.title,
      hasImageUrl: norm.hasImageUrl,
    });

    console.log("API_CAPTURE_CREATE_INPUT", {
      trimmedUrlLen: normalizedUrl.length,
      trimmedUrlPrefix: normalizedUrl.slice(0, 120),
      trimmedRawLen: normalizedRawText.length,
      hasImageUrl: hasImage,
      source: finalSource,
      capture_type_body: rawBody.capture_type,
    });

    const normalizedBody = {
      ...norm,
      url: normalizedUrl,
      source: finalSource,
      source_type: finalSource,
      capture_type: finalCaptureType,
    };

    if (!hasUrl && !hasRawForInsert && !hasImage) {
      console.error("API_CAPTURE_400_REJECTED", {
        rawBodyFirst1000: rawText.slice(0, 1000),
        parsedKeys: Object.keys(rawBody),
        detectedUrlFromRawBody,
        detectedUrlFromParsedString,
        normalizedUrl,
        normalizedRawText: normalizedRawText.slice(0, 500),
        hasImageUrl: hasImage,
      });
      return jsonWithCors(
        {
          error:
            "No usable content: need an http(s) URL, non-empty text, or an image.",
          code: "no_content",
          ...(debugRequested
            ? {
                _shortcut_debug: {
                  normalized: norm,
                  normalizedBody,
                },
              }
            : {}),
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("captures")
      .insert({
        raw_text: hasRawForInsert ? normalizedRawText : null,
        url: hasUrl ? normalizedUrl.trim() : null,
        source: finalSource,
        user_note,
        capture_type: finalCaptureType,
        image_url: trimmedImage,
        status: "analyzing",
      })
      .select(
        "id, raw_text, url, source, user_note, capture_type, image_url, status, created_at"
      )
      .single();

    if (error) {
      console.error("API_CAPTURE_CREATE_ERROR", {
        stage: "supabase_insert",
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      return jsonWithCors(
        {
          error: "Capture could not be saved.",
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          ...(debugRequested
            ? { _shortcut_debug: { normalized: norm, normalizedBody } }
            : {}),
        },
        { status: 500 }
      );
    }

    const finalKind = hasUrl ? "url_article" : hasImage ? "screenshot" : "text";

    console.log("API_CAPTURE_INSERT_RESULT", {
      id: data.id,
      url: data.url ?? null,
      source_type: data.source ?? null,
      capture_type: data.capture_type ?? null,
      image_url: data.image_url ?? null,
      finalKind,
    });

    try {
      after(() => {
        console.log("ENRICH_AFTER_STARTED", {
          captureId: data.id,
          note: "background_only_does_not_block_201",
        });
        void (async () => {
          const captureId = data.id;
          try {
            console.info("[auto-enrich] start", { captureId });
            const result = await runCaptureEnrichment(captureId, {
              skipMarkProcessing: true,
            });
            if (!result.ok) {
              console.error("[auto-enrich] finished with failure", {
                captureId,
                error: result.error,
                httpStatus: result.httpStatus,
              });
            } else {
              console.info("[auto-enrich] success", { captureId });
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("ENRICH_AFTER_ERROR_NON_BLOCKING", {
              captureId,
              stage: "auto_enrich_inner",
              message,
            });
            try {
              await markCaptureEnrichmentFailure(captureId, message);
            } catch (markErr) {
              console.error("ENRICH_AFTER_ERROR_NON_BLOCKING", {
                captureId,
                stage: "mark_failure_after_enrich_throw",
                message:
                  markErr instanceof Error ? markErr.message : String(markErr),
              });
            }
          }
        })();
      });
    } catch (scheduleErr) {
      console.error("ENRICH_AFTER_ERROR_NON_BLOCKING", {
        stage: "after_schedule",
        message:
          scheduleErr instanceof Error
            ? scheduleErr.message
            : String(scheduleErr),
        note: "201_response_still_sent_enrichment_may_run_via_client_POST_enrich",
      });
    }

    const responseBody: Record<string, unknown> = {
      ...(data as Record<string, unknown>),
    };
    if (debugRequested) {
      responseBody._shortcut_debug = { normalized: norm, normalizedBody };
    }
    return jsonWithCors(responseBody, { status: 201 });
  } catch (e) {
    console.error("API_CAPTURE_CREATE_ERROR", {
      stage: "unexpected",
      message: e instanceof Error ? e.message : String(e),
    });
    return jsonWithCors(
      { error: e instanceof Error ? e.message : "Create failed" },
      { status: 500 }
    );
  }
}
