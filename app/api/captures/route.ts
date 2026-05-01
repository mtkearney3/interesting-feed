import type { CaptureType } from "@/lib/capture";
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

type CapturePayload = {
  raw_text?: string;
  url?: string;
  source?: string;
  user_note?: string;
  capture_type?: string;
  image_url?: string | null;
};

function resolveCaptureType(value: string | undefined): CaptureType {
  const v = (value ?? "link").toLowerCase();
  if (v === "text" || v === "link" || v === "screenshot") return v;
  return "link";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CapturePayload;
    const { raw_text, url, source, user_note, capture_type, image_url } = body;

    const trimmedRaw =
      typeof raw_text === "string" ? raw_text.trim() : "";
    const trimmedUrl = typeof url === "string" ? url.trim() : "";
    const trimmedSource = typeof source === "string" ? source.trim() : "";
    const trimmedImage =
      typeof image_url === "string" && image_url.trim().length > 0
        ? image_url.trim()
        : null;

    if (!trimmedSource) {
      return jsonWithCors({ error: "source is required." }, { status: 400 });
    }

    const hasRaw = trimmedRaw.length > 0;
    const hasUrl = trimmedUrl.length > 0;
    const hasImage = Boolean(trimmedImage);

    if (!hasRaw && !hasUrl && !hasImage) {
      return jsonWithCors(
        {
          error:
            "Provide at least one of: raw_text (non-empty), url (non-empty), or image_url (non-empty).",
        },
        { status: 400 }
      );
    }

    const resolvedType = resolveCaptureType(capture_type);

    // New rows start in "processing" so clients can show a thinking state immediately.
    const { data, error } = await supabase
      .from("captures")
      .insert({
        raw_text: hasRaw ? trimmedRaw : null,
        url: hasUrl ? trimmedUrl : null,
        source: trimmedSource,
        user_note:
          typeof user_note === "string" && user_note.trim()
            ? user_note.trim()
            : null,
        capture_type: resolvedType,
        image_url: trimmedImage,
        status: "processing",
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      return jsonWithCors(
        {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    // Enrichment runs after the response is sent — no blocking for forms or bookmarklets.
    after(() => {
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
          console.error("[auto-enrich] unexpected throw", {
            captureId,
            message,
          });
          await markCaptureEnrichmentFailure(captureId, message);
        }
      })();
    });

    return jsonWithCors(data, { status: 201 });
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }
}
