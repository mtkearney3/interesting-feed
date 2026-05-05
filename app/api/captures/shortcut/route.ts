import { computeCaptureInsertFromParsed } from "@/lib/capture-insert-compute";
import { scheduleCaptureEnrichmentAfterResponse } from "@/lib/capture-enrich-after";
import { getCaptureKind } from "@/lib/capture-kind";
import { parseCapturePostRequest } from "@/lib/capture-request-parse";
import { uploadCaptureImageBuffer } from "@/lib/shortcut-capture-image-upload";
import {
  decodeShortcutImageBase64Field,
  mergeShortcutImageMimeHints,
  normalizeShortcutImageForOpenAi,
  parseShortcutDeclaredImageMime,
} from "@/lib/shortcut-image-normalize";
import { normalizeShortcutCaptureBody } from "@/lib/shortcut-capture-normalize";
import { getServiceSupabase } from "@/lib/supabase-service";

const SHORTCUT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const LOG = "[shortcut-capture]";

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
  console.log(`${LOG} request received`, { method: "POST" });

  const service = getServiceSupabase();
  if (!service) {
    console.error(`${LOG} service role client unavailable`);
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
    console.warn(`${LOG} missing token query param`);
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
    console.warn(`${LOG} token invalid or lookup error`, {
      tokErr: tokErr?.message ?? null,
      hasRow: Boolean(tokRow),
    });
    return jsonWithCors(
      { error: "Invalid or revoked shortcut token.", code: "invalid_token" },
      { status: 401 }
    );
  }

  const ownerUserId = String(tokRow.user_id);
  console.log(`${LOG} token valid`, { user_id: ownerUserId });

  const parsed = await parseCapturePostRequest(request);
  const rawBody = { ...parsed.rawBody };
  const bodyKeys = Object.keys(rawBody);
  const bodyCaptureTypeLower = String(rawBody.capture_type ?? "")
    .trim()
    .toLowerCase();
  const explicitImageClip =
    bodyCaptureTypeLower === "screenshot" || bodyCaptureTypeLower === "image";
  const explicitUrlClip =
    bodyCaptureTypeLower === "url" || bodyCaptureTypeLower === "link";
  const normForUrlGate = normalizeShortcutCaptureBody(rawBody);
  const urlPrimaryShortcut =
    explicitUrlClip ||
    (Boolean(normForUrlGate.url.trim()) && !explicitImageClip);

  console.log(`${LOG} body keys`, { keys: bodyKeys });
  console.log(`${LOG} body.capture_type`, {
    capture_type: rawBody.capture_type ?? null,
    urlPrimaryShortcut,
    normalized_url_present: Boolean(normForUrlGate.url.trim()),
  });

  const hasImageB64Initial =
    typeof rawBody.image_base64 === "string" && Boolean(rawBody.image_base64.trim());
  console.log(`${LOG} image_base64 present`, { present: hasImageB64Initial });

  if (urlPrimaryShortcut && hasImageB64Initial) {
    console.log(`${LOG} url-primary: skipping image_base64 ingest`, {
      capture_type: rawBody.capture_type ?? null,
      url_preview: normForUrlGate.url.slice(0, 160),
    });
    delete rawBody.image_base64;
  }

  const hasImageB64 =
    typeof rawBody.image_base64 === "string" && rawBody.image_base64.trim();

  /** Set when we tried to process an image and decode/normalize/upload failed. */
  let imagePipelineFailure: string | null = null;
  let attemptedImageIngest = false;

  const b64 = rawBody.image_base64;
  if (typeof b64 === "string" && b64.trim()) {
    const existingUrl =
      typeof rawBody.image_url === "string" ? rawBody.image_url.trim() : "";
    if (!existingUrl) {
      attemptedImageIngest = true;
      const decoded = decodeShortcutImageBase64Field(b64);
      if (!decoded) {
        imagePipelineFailure = `decode rejected (stringLen=${b64.length})`;
        console.warn(`${LOG} image_base64 decode rejected`, {
          stringLen: b64.length,
        });
      } else {
        console.log(`${LOG} base64 decoded`, {
          byteLength: decoded.buffer.length,
          dataUrlMime: decoded.dataUrlMime,
        });

        const bodyMime = parseShortcutDeclaredImageMime(rawBody);
        const mergedMime = mergeShortcutImageMimeHints(
          bodyMime,
          decoded.dataUrlMime
        );
        console.log(`${LOG} image mime hints`, {
          bodyMime,
          mergedMime,
        });

        const normalized = await normalizeShortcutImageForOpenAi(
          decoded.buffer,
          mergedMime
        );
        if (!normalized.ok) {
          imagePipelineFailure = `normalize: ${normalized.error}`;
          console.error(`${LOG} normalization failed`, {
            error: normalized.error,
          });
        } else {
          console.log(`${LOG} normalization ok`, {
            contentType: normalized.contentType,
            extension: normalized.extension,
            outByteLength: normalized.buffer.length,
          });

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
            imagePipelineFailure = `upload: ${up.error}`;
            console.error(`${LOG} upload failed`, {
              error: up.error,
              status: up.status,
            });
          } else {
            rawBody.image_url = up.image_url;
            console.log(`${LOG} uploaded image`, { image_url: up.image_url });
          }
        }
      }
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
    if (imagePipelineFailure) {
      console.warn(`${LOG} compute returned no_content after image failure; inserting fallback clip`, {
        computeCode: computed.code,
        imagePipelineFailure,
      });
      const note = `[shortcut-image] ${imagePipelineFailure}`.slice(0, 3900);
      const userNote =
        typeof rawBody.user_note === "string" && rawBody.user_note.trim()
          ? rawBody.user_note.trim().slice(0, 4000)
          : null;

      const { data, error } = await service
        .from("captures")
        .insert({
          user_id: ownerUserId,
          raw_text: `[iPhone Shortcut] Image could not be processed (${imagePipelineFailure}). Add text or a URL in the Shortcut if you want a full clip next time.`.slice(
            0,
            80_000
          ),
          url: null,
          source: "ios_share",
          user_note: userNote,
          capture_type: "text",
          image_url: null,
          status: "error",
          ai_related_notes: note,
        })
        .select(
          "id, raw_text, url, source, user_note, capture_type, image_url, status, created_at"
        )
        .single();

      if (error) {
        console.error(`${LOG} fallback insert failed`, {
          message: error.message,
          code: error.code,
        });
        return jsonWithCors(
          {
            error: "Capture could not be saved (fallback after image error).",
            message: error.message,
            code: error.code,
          },
          { status: 500 }
        );
      }

      console.log(`${LOG} fallback insert ok`, {
        capture_id: data.id,
        status: data.status,
      });

      return jsonWithCors(
        {
          ok: true,
          capture: data,
          shortcut_image_warning: imagePipelineFailure,
        },
        { status: 201 }
      );
    }

    console.warn(`${LOG} compute failed`, {
      code: computed.code,
      body_capture_type: rawBody.capture_type ?? null,
      urlPrimaryShortcut,
      has_image_base64_request: hasImageB64Initial,
      body_keys: bodyKeys,
    });
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

  const enrichPreview = getCaptureKind({
    capture_type: String(insert.capture_type ?? ""),
    url: insert.url,
    image_url: insert.image_url,
    raw_text: insert.raw_text,
  });

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
    console.error(`${LOG} insert failed`, {
      message: error.message,
      code: error.code,
    });
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

  console.log(`${LOG} insert ok`, {
    capture_id: data.id,
    status: data.status,
    body_keys: bodyKeys,
    body_capture_type: rawBody.capture_type ?? null,
    has_image_base64_request: hasImageB64Initial,
    has_url: Boolean(String(insert.url ?? "").trim()),
    final_capture_type: insert.capture_type,
    final_url: insert.url ? String(insert.url).slice(0, 240) : null,
    final_image_url_present: Boolean(String(insert.image_url ?? "").trim()),
    enrich_kind: enrichPreview.kind,
    enrich_pipeline: enrichPreview.pipeline,
    has_image_url: Boolean(insert.image_url),
    attemptedImageIngest,
    imagePipelineFailure,
  });

  scheduleCaptureEnrichmentAfterResponse(data.id);

  return jsonWithCors(
    {
      ok: true,
      capture: data,
      ...(imagePipelineFailure && attemptedImageIngest
        ? { shortcut_image_warning: imagePipelineFailure }
        : {}),
    },
    { status: 201 }
  );
}
