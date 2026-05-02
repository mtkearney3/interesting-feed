import { isStorageImageUrl } from "@/lib/capture-kind";

/**
 * Normalizes iPhone Shortcut / bookmarklet payloads into fields for `captures` insert.
 * Does not run enrichment or OpenAI.
 */

function acceptArticleUrl(candidate: string | null | undefined): string {
  const u = (candidate ?? "").trim();
  if (!u) return "";
  if (isStorageImageUrl(u)) return "";
  return u;
}

function stripTrailingJunkFromUrl(u: string): string {
  return u.replace(/[)\].,;:]+$/g, "").trim();
}

/** First http(s) URL in a string, or leading URL if the string starts with one. */
function firstHttpUrlInString(s: string): string | null {
  if (!s) return null;
  const t = s.trim();
  const lead = t.match(/^https?:\/\/[^\s]+/);
  if (lead) return stripTrailingJunkFromUrl(lead[0]);
  const embedded = t.match(/https?:\/\/[^\s]+/);
  return embedded ? stripTrailingJunkFromUrl(embedded[0]) : null;
}

function asTrimmedString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v).trim();
  return "";
}

function urlFromScalar(v: unknown): string | null {
  const s = asTrimmedString(v);
  if (!s) return null;
  return firstHttpUrlInString(s);
}

function deepFindFirstHttpUrl(
  v: unknown,
  depth: number,
  maxDepth: number,
  maxStringLen: number
): string | null {
  if (depth > maxDepth || v == null) return null;
  if (typeof v === "string") {
    if (v.length > maxStringLen) return firstHttpUrlInString(v.slice(0, maxStringLen));
    return firstHttpUrlInString(v);
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return firstHttpUrlInString(String(v));
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      const u = deepFindFirstHttpUrl(item, depth + 1, maxDepth, maxStringLen);
      if (u) return u;
    }
    return null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      if (/^(image_url|thumbnail|previewimage|screenshot_url)$/i.test(k)) {
        continue;
      }
      const u = deepFindFirstHttpUrl(o[k], depth + 1, maxDepth, maxStringLen);
      if (u) return u;
    }
  }
  return null;
}

function extractUrlFromBody(body: Record<string, unknown>): string {
  const directKeys = [
    "url",
    "URL",
    "shareUrl",
    "sharedUrl",
    "inputUrl",
    "inputURL",
    "link",
    "Link",
    "href",
    "plainText",
    "value",
    "input",
    "body",
    "message",
  ] as const;
  for (const k of directKeys) {
    if (!(k in body)) continue;
    const u = acceptArticleUrl(urlFromScalar(body[k]));
    if (u) return u;
  }

  const textKeys = [
    "text",
    "raw_text",
    "content",
    "shortcutInput",
    "title",
  ] as const;
  for (const k of textKeys) {
    const u = acceptArticleUrl(urlFromScalar(body[k]));
    if (u) return u;
  }

  const items = body.items;
  if (Array.isArray(items) && items.length > 0) {
    const i0 = items[0];
    if (typeof i0 === "string") {
      const u = acceptArticleUrl(urlFromScalar(i0));
      if (u) return u;
    } else if (i0 && typeof i0 === "object") {
      const o = i0 as Record<string, unknown>;
      for (const k of ["url", "link", "href", "webpageURL", "uri"]) {
        const u = acceptArticleUrl(urlFromScalar(o[k]));
        if (u) return u;
      }
      const u = acceptArticleUrl(firstHttpUrlInString(JSON.stringify(i0)));
      if (u) return u;
    }
  }

  const attachments = body.attachments;
  if (Array.isArray(attachments) && attachments[0] && typeof attachments[0] === "object") {
    const u = acceptArticleUrl(
      urlFromScalar((attachments[0] as Record<string, unknown>).url)
    );
    if (u) return u;
  }

  const deep = acceptArticleUrl(deepFindFirstHttpUrl(body, 0, 8, 48_000));
  return deep ?? "";
}

function pickRawText(body: Record<string, unknown>): string {
  for (const key of [
    "raw_text",
    "text",
    "content",
    "shortcutInput",
    "plainText",
    "title",
    "value",
    "name",
  ] as const) {
    const s = asTrimmedString(body[key]);
    if (s) return s;
  }
  return "";
}

export type ShortcutCaptureNormalized = {
  raw_text: string;
  url: string;
  source: string;
  source_type: string;
  title: string;
  hasImageUrl: boolean;
  image_url: string | null;
  user_note: string | null;
  capture_type_hint: string | undefined;
};

export function normalizeShortcutCaptureBody(
  body: Record<string, unknown>
): ShortcutCaptureNormalized {
  /** Prefer real http(s) URLs; ignore non-URL strings in `url` so other fields can supply the link. */
  const url = extractUrlFromBody(body).trim();

  const title = asTrimmedString(body.title) || asTrimmedString(body.name);

  let rawText = pickRawText(body);
  if (!rawText && title) rawText = title;

  let source =
    asTrimmedString(body.source) || asTrimmedString(body.source_type);
  if (!source && url) source = "url";
  if (!source) source = "ios_shortcut";

  let source_type = asTrimmedString(body.source_type) || source;

  if (url) {
    const rawSrc =
      asTrimmedString(body.source) || asTrimmedString(body.source_type);
    const s0 = rawSrc.toLowerCase();
    if (!rawSrc || s0 === "ios_share" || s0 === "ios_shortcut") {
      source = "ios_url_share";
    } else {
      source = "url";
    }
    source_type = source;
  }

  const imageRaw = body.image_url;
  const image_url =
    typeof imageRaw === "string" && imageRaw.trim().length > 0
      ? imageRaw.trim()
      : null;
  const hasImageUrl = Boolean(image_url);

  const user_note =
    typeof body.user_note === "string" && body.user_note.trim()
      ? body.user_note.trim()
      : null;

  const capture_type_hint = url
    ? "url"
    : typeof body.capture_type === "string"
      ? body.capture_type
      : undefined;

  return {
    raw_text: rawText,
    url,
    source,
    source_type,
    title,
    hasImageUrl,
    image_url,
    user_note,
    capture_type_hint,
  };
}
