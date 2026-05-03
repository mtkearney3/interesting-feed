import type { CaptureType } from "@/lib/capture";
import { resolveCaptureInsertFromBody } from "@/lib/capture-insert-resolve";
import {
  firstHttpUrlInString,
  pickExistingText,
  type ParsedCaptureRequest,
} from "@/lib/capture-request-parse";
import type { ShortcutCaptureNormalized } from "@/lib/shortcut-capture-normalize";

export type CaptureInsertRow = {
  raw_text: string | null;
  url: string | null;
  source: string;
  user_note: string | null;
  capture_type: CaptureType | string;
  image_url: string | null;
};

export type ComputeCaptureInsertOk = {
  ok: true;
  insert: CaptureInsertRow;
  norm: ShortcutCaptureNormalized;
  rawJson: string;
  normalizedBody: Record<string, unknown>;
  debugRequested: boolean;
};

export type ComputeCaptureInsertErr = {
  ok: false;
  code: "no_content";
  error: string;
  debugRequested: boolean;
  debug?: { normalized: ShortcutCaptureNormalized; normalizedBody: unknown };
};

export function computeCaptureInsertFromParsed(
  parsed: ParsedCaptureRequest
): ComputeCaptureInsertOk | ComputeCaptureInsertErr {
  const {
    rawText,
    rawBody,
    parseOk,
    detectedUrlFromRawBody,
    detectedUrlFromParsedString,
  } = parsed;

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
    normalizedRawText = pickExistingText(rawBody) || normalizedUrl || "";
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

  const debugRequested = rawBody.debug === true;

  const normalizedBody = {
    ...norm,
    url: normalizedUrl,
    source: finalSource,
    source_type: finalSource,
    capture_type: finalCaptureType,
  };

  if (!hasUrl && !hasRawForInsert && !hasImage) {
    return {
      ok: false,
      code: "no_content",
      error:
        "No usable content: need an http(s) URL, non-empty text, or an image.",
      debugRequested,
      ...(debugRequested
        ? {
            debug: {
              normalized: norm,
              normalizedBody,
            },
          }
        : {}),
    };
  }

  return {
    ok: true,
    insert: {
      raw_text: hasRawForInsert ? normalizedRawText : null,
      url: hasUrl ? normalizedUrl.trim() : null,
      source: finalSource,
      user_note,
      capture_type: finalCaptureType,
      image_url: trimmedImage,
    },
    norm,
    rawJson,
    normalizedBody,
    debugRequested,
  };
}
