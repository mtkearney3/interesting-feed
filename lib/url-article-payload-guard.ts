/**
 * URL-article OpenAI path: block only real image API shapes in serialized JSON.
 * Suspicious fragments inside article prose (e.g. "alt=") are warnings only — handle in extractor.
 */

/** JSON / message shapes that indicate an image is attached to the OpenAI request. */
const IMAGE_API_PAYLOAD_RULES: { re: RegExp; id: string }[] = [
  { re: /"type"\s*:\s*"image_url"/i, id: "message_part_type_image_url" },
  { re: /"type"\s*:\s*"input_image"/i, id: "message_part_type_input_image" },
  { re: /"image_url"\s*:/i, id: "json_key_image_url" },
  { re: /"previewImage"\s*:/i, id: "json_key_previewImage" },
  { re: /"thumbnail"\s*:/i, id: "json_key_thumbnail" },
  { re: /"og:image"\s*:/i, id: "json_key_og:image" },
  { re: /"twitter:image"\s*:/i, id: "json_key_twitter:image" },
];

const ARTICLE_TEXT_WARNING_RULES: { re: RegExp; id: string }[] = [
  { re: /alt\s*=/i, id: "alt_fragment" },
  { re: /figcaption/i, id: "figcaption_fragment" },
  { re: /\bgetty\b/i, id: "getty" },
  { re: /\bap\s+photo\b/i, id: "ap_photo" },
  { re: /\breuters\s+photo\b/i, id: "reuters_photo" },
  { re: /\bog:image\b/i, id: "og_image_text" },
  { re: /\btwitter:image\b/i, id: "twitter_image_text" },
  { re: /\bpreviewimage\b/i, id: "previewimage_text" },
  { re: /\bimage_url\b/i, id: "image_url_text" },
];

/**
 * Logs when extracted article text contains strings that often indicate markup or wire-photo junk.
 * Does not throw — scrub in {@link extractUrlArticleCapture} / scrubber as needed.
 */
export function logUrlArticleOpenAiPreflightWarnings(
  articleText: string,
  meta: { clipId?: string | null }
): void {
  const hits: string[] = [];
  for (const { re, id } of ARTICLE_TEXT_WARNING_RULES) {
    if (re.test(articleText)) hits.push(id);
  }
  if (hits.length === 0) return;
  console.warn("URL_ARTICLE_OPENAI_PREFLIGHT_WARNING", {
    clipId: meta.clipId ?? "(no-id)",
    hits,
    articleTextLength: articleText.length,
    sample: articleText.slice(0, 400),
  });
}

/**
 * Throws only if the serialized OpenAI request string contains actual image API keys / part types.
 * Safe when the payload embeds long article text (may contain "alt=" etc. in prose).
 */
export function assertUrlArticleOpenAiPayloadNoImageApi(payload: string): void {
  for (const { re, id } of IMAGE_API_PAYLOAD_RULES) {
    if (re.test(payload)) {
      const m = payload.match(re);
      console.error("URL_ARTICLE_PAYLOAD_GUARD_FAIL", {
        id,
        pattern: String(re),
        match: m?.[0],
        preview: payload.slice(0, 280),
      });
      throw new Error(`URL article OpenAI payload blocked: ${id}`);
    }
  }
}

export function logUrlArticlePayloadGuardOk(
  clipId: string | null | undefined
): void {
  if (process.env.NODE_ENV === "development") {
    console.log("URL_ARTICLE_PAYLOAD_GUARD", {
      clipId: clipId ?? "(no-id)",
      ok: true,
      sentAnyImageToOpenAI: false,
    });
  }
}
