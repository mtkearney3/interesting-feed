import { computeCaptureInsertFromParsed } from "@/lib/capture-insert-compute";
import { scheduleCaptureEnrichmentAfterResponse } from "@/lib/capture-enrich-after";
import { parseCapturePostRequest } from "@/lib/capture-request-parse";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

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

export async function POST(request: Request) {
  const supabase = await createRouteHandlerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonWithCors(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  const parsed = await parseCapturePostRequest(request);

  try {
    const computed = computeCaptureInsertFromParsed(parsed);
    if (!computed.ok) {
      return jsonWithCors(
        {
          error: computed.error,
          code: computed.code,
          ...(computed.debugRequested && computed.debug
            ? { _shortcut_debug: computed.debug }
            : {}),
        },
        { status: 400 }
      );
    }

    const { insert, norm, rawJson, normalizedBody, debugRequested } = computed;

    const maxRawLog = 65536;
    console.log(
      "API_CAPTURE_CREATE_RAW_BODY",
      rawJson.length > maxRawLog
        ? `${rawJson.slice(0, maxRawLog)}...(truncated, totalLen=${rawJson.length})`
        : rawJson
    );

    console.log("API_CAPTURE_INCOMING", {
      rawBodyFirst1000: rawJson.slice(0, 1000),
      parsedKeys: Object.keys(parsed.rawBody),
    });

    const rawTextPreview =
      norm.raw_text.length > 2000
        ? `${norm.raw_text.slice(0, 2000)}...(truncated)`
        : norm.raw_text;
    console.log("API_CAPTURE_CREATE_NORMALIZED", {
      raw_text: rawTextPreview,
      url: norm.url,
      source: insert.source,
      title: norm.title,
      hasImageUrl: Boolean(insert.image_url),
    });

    console.log("API_CAPTURE_CREATE_INPUT", {
      trimmedUrlLen: (insert.url ?? "").length,
      trimmedRawLen: (insert.raw_text ?? "").length,
      hasImageUrl: Boolean(insert.image_url),
      source: insert.source,
      capture_type_body: parsed.rawBody.capture_type,
    });

    const { data, error } = await supabase
      .from("captures")
      .insert({
        user_id: user.id,
        raw_text: insert.raw_text,
        url: insert.url,
        source: insert.source,
        user_note: insert.user_note,
        capture_type: insert.capture_type,
        image_url: insert.image_url,
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

    const hasUrl = Boolean(insert.url?.trim());
    const hasImage = Boolean(insert.image_url);
    const finalKind = hasUrl ? "url_article" : hasImage ? "screenshot" : "text";

    console.log("API_CAPTURE_INSERT_RESULT", {
      id: data.id,
      url: data.url ?? null,
      source_type: data.source ?? null,
      capture_type: data.capture_type ?? null,
      image_url: data.image_url ?? null,
      finalKind,
    });

    console.log("ENRICH_AFTER_STARTED", {
      captureId: data.id,
      note: "background_only_does_not_block_201",
    });
    scheduleCaptureEnrichmentAfterResponse(data.id);

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
