/**
 * Single source of truth for capture classification (feed + enrichment).
 * URL-article work must not reimplement routing outside this module.
 *
 * Order: explicit screenshot/image clips → article URLs (when not overridden by
 * a user storage screenshot on the same row) → other images → text.
 */

export type CaptureKind = "image" | "url" | "text";

export type CaptureKindPipeline =
  | "IMAGE_VISION"
  | "IMAGE_SCREENSHOT_TEXT_PRIMARY"
  | "URL_ARTICLE_TEXT_ONLY"
  | "TEXT_ONLY";

export type CaptureKindInput = {
  capture_type?: string | null;
  url?: string | null;
  image_url?: string | null;
  raw_text?: string | null;
};

export type CaptureKindResult = {
  kind: CaptureKind;
  pipeline: CaptureKindPipeline;
  /** When `kind === "image"`, whether the OpenAI request should attach the image for vision. */
  useOpenAiVision: boolean;
  /** Non-storage article URL when `kind === "url"`. */
  articleUrl: string | null;
};

function substantiveRawText(raw: string | null | undefined): boolean {
  return Boolean(raw && raw.trim().length >= 100);
}

/** User-uploaded capture image in our Supabase bucket (not og:image / web raster). */
export function isSupabaseUserCaptureImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  if (u.includes("supabase.co/storage")) return true;
  if (u.includes("/storage/v1/object/")) return true;
  return false;
}

/** Storage, CDN image assets, and raster URLs — never article URLs. */
export function isStorageImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  if (isSupabaseUserCaptureImageUrl(u)) return true;
  if (/\.(png|jpe?g|jpeg|gif|webp|svg|avif|bmp)(\?|#|$)/i.test(u)) return true;
  return false;
}

/** `http(s)` link suitable for server-side article fetch (not storage / raster). */
export function isExternalArticleUrl(urlStr: string): boolean {
  const u = urlStr.trim();
  if (!u) return false;
  if (!/^https?:\/\//i.test(u)) return false;
  return !isStorageImageUrl(u);
}

function urlLooksLikeDirectRasterFile(urlT: string): boolean {
  return /\.(png|jpe?g|jpeg|gif|webp)(\?|#|$)/i.test(urlT);
}

/**
 * Removes `image_url` and other http(s) storage / raster URLs from pasted text
 * so prompts and substantive checks are not dominated by implementation URLs.
 */
export function stripStorageUrlsFromRawText(
  raw: string | null | undefined,
  imageUrl: string | null | undefined
): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  const img = String(imageUrl ?? "").trim();
  if (img) {
    s = s.split(img).join(" ");
  }
  const words = s.split(/\s+/);
  const kept = words.filter((w) => {
    const t = w
      .replace(/^['"`([<{]+/g, "")
      .replace(/[)\].,;:]+$/g, "");
    if (!/^https?:\/\//i.test(t)) return true;
    return !isStorageImageUrl(t);
  });
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

function imageKindFromPixels(
  capture: CaptureKindInput,
  img: string
): CaptureKindResult {
  const urlT = String(capture.url ?? "").trim();
  const ct = String(capture.capture_type ?? "").toLowerCase();
  const sanitized = stripStorageUrlsFromRawText(capture.raw_text, img);
  const hasSubstantiveSanitized = substantiveRawText(sanitized);
  const forceVision =
    ct === "screenshot" ||
    ct === "image" ||
    !urlT ||
    isStorageImageUrl(urlT) ||
    urlLooksLikeDirectRasterFile(urlT);
  const useOpenAiVision = forceVision || !hasSubstantiveSanitized;
  return {
    kind: "image",
    pipeline: useOpenAiVision
      ? "IMAGE_VISION"
      : "IMAGE_SCREENSHOT_TEXT_PRIMARY",
    useOpenAiVision,
    articleUrl: null,
  };
}

/**
 * Ordered rules:
 * 1. Explicit `screenshot` / `image` clips with pixels → image pipeline (never replaced by og:image).
 * 2. External article `url` without a **user storage** screenshot on the row → URL article text pipeline
 *    (og:image / hero previews do not win over article fetch).
 * 3. Any remaining `image_url` → image pipeline (legacy og + odd cases).
 * 4. Otherwise `TEXT_ONLY`.
 */
export function getCaptureKind(capture: CaptureKindInput): CaptureKindResult {
  const img = String(capture.image_url ?? "").trim();
  const urlT = String(capture.url ?? "").trim();
  const ct = String(capture.capture_type ?? "").toLowerCase();

  const articlePage = Boolean(urlT && isExternalArticleUrl(urlT));
  const userSupabaseScreenshot = Boolean(img && isSupabaseUserCaptureImageUrl(img));

  if ((ct === "screenshot" || ct === "image") && img) {
    return imageKindFromPixels(capture, img);
  }

  if (
    articlePage &&
    !(img && userSupabaseScreenshot)
  ) {
    return {
      kind: "url",
      pipeline: "URL_ARTICLE_TEXT_ONLY",
      useOpenAiVision: false,
      articleUrl: urlT,
    };
  }

  if (img) {
    return imageKindFromPixels(capture, img);
  }

  return {
    kind: "text",
    pipeline: "TEXT_ONLY",
    useOpenAiVision: false,
    articleUrl: null,
  };
}

/** Feed / cards: hide storage links and duplicate image URLs. */
export function captureUrlForDisplay(
  c: Pick<CaptureKindInput, "url" | "image_url" | "capture_type">
): string | null {
  const k = getCaptureKind({
    url: c.url,
    image_url: c.image_url,
    capture_type: c.capture_type,
    raw_text: null,
  });
  if (k.kind === "image") return null;
  const u = String(c.url ?? "").trim();
  if (!u) return null;
  if (isStorageImageUrl(u)) return null;
  const img = String(c.image_url ?? "").trim();
  if (img && u === img) return null;
  return u;
}

/** `raw_text` with storage / raster URLs stripped when an image is present. */
export function captureRawTextForDisplay(
  raw: string | null | undefined,
  imageUrl: string | null | undefined
): string | null {
  const img = String(imageUrl ?? "").trim();
  if (!img) return (raw ?? "").trim() ? String(raw).trim() : null;
  const s = stripStorageUrlsFromRawText(raw, img);
  return s.length ? s : null;
}
