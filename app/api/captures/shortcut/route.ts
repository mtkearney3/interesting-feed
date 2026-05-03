import { computeCaptureInsertFromParsed } from "@/lib/capture-insert-compute";
import { scheduleCaptureEnrichmentAfterResponse } from "@/lib/capture-enrich-after";
import { parseCapturePostRequest } from "@/lib/capture-request-parse";
import { uploadCaptureImageBuffer } from "@/lib/shortcut-capture-image-upload";
import {
  decodeShortcutImageBase64Field,
  mergeShortcutImageMimeHints,
  normalizeShortcutImageForOpenAi,
  parseShortcutDeclaredImageMime,
} from "@/lib/shortcut-image-normalize";
import { getServiceSupabase } from "@/lib/supabase-service";

const SHORTCUT_CORS_HEADERS = {
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
    headers: { ...SHORTCUT_CORS_HEADERS, ...init?.headers },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: SHORTCUT_CORS_HEADERS });
}

export async function POST(request: Request) {
  const service = getServiceSupabase();
  if (!service) {
    return jsonWithCors(
      {
        error:
          "Server misconfiguration: set SUPABASE_SERVICE_ROLE_KEY for shortcut ingestion.",
        code: "service_unavailable",
      },
      { status: 503 }
    );
  }

  const reqUrl = new URL(request.url);
  const token = reqUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return jsonWithCors(
      { error: "Missing token query parameter.", code: "missing_token" },
      { status: 401 }
    );
  }

  const { data: tokRow, error: tokErr } = await service
    .from("user_shortcut_tokens")
    .select("user_id")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();

  if (tokErr || !tokRow?.user_id) {
    return jsonWithCors(
      { error: "Invalid or revoked shortcut token.", code: "invalid_token" },
      { status: 401 }
    );
  }

  const ownerUserId = String(tokRow.user_id);

  const parsed = await parseCapturePostRequest(request);
  const rawBody = { ...parsed.rawBody };

  const b64 = rawBody.image_base64;
  if (typeof b64 === "string" && b64.trim()) {
    const existingUrl =
      typeof rawBody.image_url === "string" ? rawBody.image_url.trim() : "";
    if (!existingUrl) {
      const decoded = decodeShortcutImageBase64Field(b64);
      if (!decoded) {
        console.warn("[shortcut-capture] image_base64 rejected", {
          stringLen: b64.length,
        });
        return jsonWithCors(
          {
            error:
              "image_base64 is missing, too short, or not valid base64. Send a real screenshot (optionally as data:image/png;base64,... or data:image/jpeg;base64,...). HEIC and other formats are converted server-side when decodable.",
            code: "bad_image",
          },
          { status: 400 }
        );
      }

      const bodyMime = parseShortcutDeclaredImageMime(rawBody);
      const mergedMime = mergeShortcutImageMimeHints(
        bodyMime,
        decoded.dataUrlMime
      );
      const normalized = await normalizeShortcutImageForOpenAi(
        decoded.buffer,
        mergedMime
      );
      if (!normalized.ok) {
        console.error("[shortcut-capture] image normalize failed", {
          error: normalized.error,
        });
        return jsonWithCors(
          { error: normalized.error, code: "bad_image" },
          { status: 400 }
        );
      }

      const up = await uploadCaptureImageBuffer(
        service,
        normalized.buffer,
        ownerUserId,
        {
          contentType: normalized.contentType,
          extension: normalized.extension,
        }
      );
      if ("error" in up) {
        return jsonWithCors({ error: up.error }, { status: up.status });
      }
      rawBody.image_url = up.image_url;
    }
    delete rawBody.image_base64;
  }

  const src = rawBody.source;
  if (typeof src !== "string" || !src.trim()) {
    rawBody.source = "ios_share";
  }

  const computed = computeCaptureInsertFromParsed({
    ...parsed,
    rawBody,
  });

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

  const { insert, norm, normalizedBody, debugRequested } = computed;

  const { data, error } = await service
    .from("captures")
    .insert({
      user_id: ownerUserId,
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
    console.error("[shortcut-capture] insert failed", error.message);
    return jsonWithCors(
      {
        error: "Capture could not be saved.",
        message: error.message,
        code: error.code,
        ...(debugRequested
          ? { _shortcut_debug: { normalized: norm, normalizedBody } }
          : {}),
      },
      { status: 500 }
    );
  }

  scheduleCaptureEnrichmentAfterResponse(data.id);

  return jsonWithCors(
    {
      ok: true,
      capture: data,
    },
    { status: 201 }
  );
}
