import type { CaptureType } from "@/lib/capture";
import { isStorageImageUrl } from "@/lib/capture-kind";
import {
  normalizeShortcutCaptureBody,
  type ShortcutCaptureNormalized,
} from "@/lib/shortcut-capture-normalize";

function stripUrlScanTrailingJunk(u: string): string {
  return u.replace(/[)\].,;:]+$/g, "").trim();
}

function inferCaptureTypeFromContent(hasImage: boolean): CaptureType {
  if (hasImage) return "screenshot";
  return "text";
}

function asTrimmedField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export type CaptureInsertResolved = {
  rawJson: string;
  norm: ShortcutCaptureNormalized;
  trimmedUrl: string;
  trimmedRaw: string;
  trimmedImage: string | null;
  finalSource: string;
  resolvedType: CaptureType;
  hasRaw: boolean;
  hasUrl: boolean;
  hasImage: boolean;
  stringScanMatch: RegExpMatchArray | null;
  /** Best-effort URL string for logs (may be pre-strip). */
  detectedUrl: string;
};

/**
 * Single source of truth for URL detection + insert fields (API + /capture debug).
 * If any http(s) URL appears in JSON, `trimmedUrl` / `hasUrl` reflect it (incl. string scan).
 */
export function resolveCaptureInsertFromBody(
  rawBody: Record<string, unknown>
): CaptureInsertResolved {
  const rawJson = JSON.stringify(rawBody);
  const norm = normalizeShortcutCaptureBody(rawBody);
  const bodyCaptureType =
    typeof rawBody.capture_type === "string"
      ? rawBody.capture_type.trim()
      : "";
  const bodyCaptureTypeLower = bodyCaptureType.toLowerCase();
  const explicitImageClip =
    bodyCaptureTypeLower === "screenshot" || bodyCaptureTypeLower === "image";
  const explicitUrlClip =
    bodyCaptureTypeLower === "url" || bodyCaptureTypeLower === "link";

  const stringScanMatch = rawJson.match(/https?:\/\/[^\s"]+/i);
  let trimmedUrl = norm.url.trim();
  if (!trimmedUrl && stringScanMatch?.[0]) {
    trimmedUrl = stripUrlScanTrailingJunk(stringScanMatch[0]);
  }

  if (/https?:\/\//i.test(rawJson) && !trimmedUrl) {
    const loose = rawJson.match(/https?:\/\/[^"'\s\\]+/i);
    if (loose?.[0]) trimmedUrl = stripUrlScanTrailingJunk(loose[0]);
  }

  /** Raster-looking URLs are not article pages — unless this is an image clip keeping `url` as reference. */
  if (trimmedUrl && isStorageImageUrl(trimmedUrl) && !explicitImageClip) {
    trimmedUrl = "";
  }

  const trimmedRaw = norm.raw_text.trim();
  const trimmedImage = norm.image_url;
  const imgTrim = (trimmedImage ?? "").trim();
  if (imgTrim && trimmedUrl) {
    if (trimmedUrl === imgTrim) {
      trimmedUrl = "";
    } else if (!explicitImageClip && isStorageImageUrl(trimmedUrl)) {
      trimmedUrl = "";
    }
  }

  let finalSource = norm.source.trim();

  const hasUrl = trimmedUrl.length > 0;
  /** URL share (not image-primary): allow ios_share without rewriting to ios_url_share when a preview image exists. */
  const urlPrimaryForSource =
    !imgTrim ||
    explicitUrlClip ||
    (hasUrl && !explicitImageClip);

  if (trimmedUrl && urlPrimaryForSource) {
    const rawSrc =
      asTrimmedField(rawBody.source) || asTrimmedField(rawBody.source_type);
    const s0 = rawSrc.toLowerCase();
    if (!rawSrc || s0 === "ios_share" || s0 === "ios_shortcut") {
      finalSource = "ios_url_share";
    } else {
      finalSource = "url";
    }
  }

  const hasRaw = trimmedRaw.length > 0;
  const hasImage = Boolean(trimmedImage);

  const allowedTypes: CaptureType[] = ["link", "url", "text", "screenshot"];

  const urlPrimaryForType =
    explicitUrlClip || (hasUrl && !explicitImageClip);

  let resolvedType: CaptureType;
  if (urlPrimaryForType && hasUrl) {
    resolvedType = "url";
  } else if (hasImage) {
    resolvedType =
      bodyCaptureTypeLower === "screenshot"
        ? "screenshot"
        : inferCaptureTypeFromContent(true);
  } else if (hasUrl) {
    resolvedType = "url";
  } else {
    resolvedType = allowedTypes.includes(bodyCaptureType as CaptureType)
      ? (bodyCaptureType as CaptureType)
      : inferCaptureTypeFromContent(hasImage);
  }

  const detectedUrl =
    trimmedUrl ||
    norm.url.trim() ||
    (stringScanMatch?.[0] ? stripUrlScanTrailingJunk(stringScanMatch[0]) : "");

  return {
    rawJson,
    norm,
    trimmedUrl,
    trimmedRaw,
    trimmedImage,
    finalSource,
    resolvedType,
    hasRaw,
    hasUrl,
    hasImage,
    stringScanMatch,
    detectedUrl,
  };
}
