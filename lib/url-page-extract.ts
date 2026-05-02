/**
 * Server-side fetch + lightweight HTML parse for capture enrichment.
 * No DOM parser dependency — regex/heuristics only.
 */

function charFromCode(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  if (code >= 0xd800 && code <= 0xdfff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

export function decodeHtmlEntities(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/&#x([0-9a-fA-F]+);/gi, (_, h) =>
    charFromCode(Number.parseInt(h, 16))
  );
  s = s.replace(/&#(\d+);/g, (_, n) => charFromCode(Number.parseInt(n, 10)));
  s = s.replace(/&nbsp;/gi, " ");
  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&#39;/g, "'");
  s = s.replace(/&amp;/g, "&");
  return s;
}

function extractTitleTag(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return "";
  return decodeHtmlEntities(m[1]);
}

/** Match meta with property= or name= then content= (either attribute order). */
function metaByKey(
  html: string,
  attr: "property" | "name",
  key: string
): string {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(
    `<meta[^>]+${attr}=["']${esc}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${esc}["']`,
    "i"
  );
  let m = re1.exec(html);
  if (!m) m = re2.exec(html);
  return m ? decodeHtmlEntities(m[1]) : "";
}

function extractNameDescription(html: string): string {
  const d = metaByKey(html, "name", "description");
  if (d) return d;
  return metaByKey(html, "name", "twitter:description");
}

function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, " ");
}

/** Remove block-level junk (figures, chrome, embeds) before article region detection. */
function removeBalancedTagBlocks(html: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  let prev = "";
  let out = html;
  let guard = 0;
  while (out !== prev && guard++ < 50) {
    prev = out;
    out = out.replace(re, "\n");
  }
  return out;
}

function removeSelfClosingMedia(html: string): string {
  return html
    .replace(/<img\b[^>]*\/?>/gi, "\n")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "\n")
    .replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, "\n");
}

/** Tags whose inner content should be dropped for article text. */
function sanitizeStructuralHtml(html: string): string {
  let s = stripComments(html);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "\n");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "\n");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, "\n");
  for (const tag of [
    "figure",
    "figcaption",
    "picture",
    "aside",
    "nav",
    "header",
    "footer",
  ]) {
    s = removeBalancedTagBlocks(s, tag);
  }
  s = removeSelfClosingMedia(s);
  return s;
}

/** Remove elements whose class suggests caption / promo / hero (not article prose). */
function stripClassBasedJunk(html: string): string {
  const classNeedle =
    "(?:caption|photo-|\\bphoto\\b|image-credit|image_credit|illustration|getty|shutterstock|byline|avatar|thumbnail|m-ad\\b|advert|promo|widget|newsletter|subscribe|related-stories|most-read)";
  const re = new RegExp(
    `<(div|section|span|p|figure|aside)\\b[^>]*class=["'][^"']*${classNeedle}[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`,
    "gi"
  );
  let prev = "";
  let out = html;
  let guard = 0;
  while (out !== prev && guard++ < 30) {
    prev = out;
    out = out.replace(re, "\n");
  }
  return out;
}

function sliceBetweenTags(html: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
    "i"
  );
  const m = re.exec(html);
  return m ? m[1] : "";
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Content after `data-testid="…"` opening tag, truncated at a coarse end marker. */
function sliceFromDataTestId(html: string, testId: string): string {
  const re = new RegExp(`\\bdata-testid=["']${escRe(testId)}["'][^>]*>`, "i");
  const m = re.exec(html);
  if (!m || m.index === undefined) return "";
  const start = m.index + m[0].length;
  const rest = html.slice(start);
  const endMarkers = [
    "</main>",
    "</article>",
    '<footer',
    'data-testid="sidebar"',
    'data-testid="comments"',
    '<aside ',
    'class="ad-',
    'id="comments"',
  ];
  let end = Math.min(rest.length, 500_000);
  for (const marker of endMarkers) {
    const idx = rest.indexOf(marker);
    if (idx > 800 && idx < end) end = idx;
  }
  return rest.slice(0, end);
}

/** Longest innerHTML for `class*="needle"` on block-ish roots. */
function sliceByClassSubstring(html: string, needle: string): string {
  const n = escRe(needle);
  const openRe = new RegExp(
    `<(div|section|article)\\b[^>]*class=["'][^"']*${n}[^"']*["'][^>]*>`,
    "gi"
  );
  let best = "";
  let m: RegExpExecArray | null;
  const hay = html;
  while ((m = openRe.exec(hay)) !== null) {
    const start = m.index + m[0].length;
    const tail = hay.slice(start);
    const endMarkers = [
      "</article>",
      "</main>",
      "</section>",
      '<footer',
      'class="ad-',
      'data-testid="',
    ];
    let end = Math.min(tail.length, 400_000);
    for (const marker of endMarkers) {
      const idx = tail.indexOf(marker);
      if (idx > 600 && idx < end) end = idx;
    }
    const inner = tail.slice(0, end);
    if (inner.length > best.length) best = inner;
  }
  return best;
}

function pickLongestHtml(candidates: string[], minLen: number): string {
  let best = "";
  for (const c of candidates) {
    if (c.length >= minLen && c.length > best.length) best = c;
  }
  return best;
}

function extractArticleHtmlChunk(html: string): string {
  const chunk = html.length > 800_000 ? html.slice(0, 800_000) : html;
  const cleaned = stripClassBasedJunk(sanitizeStructuralHtml(chunk));

  const minLen = 500;
  const candidates: string[] = [];

  const stStory = sliceFromDataTestId(cleaned, "story-text");
  const stBody = sliceFromDataTestId(cleaned, "article-body");
  if (stStory) candidates.push(stStory);
  if (stBody) candidates.push(stBody);

  const articleInner = sliceBetweenTags(cleaned, "article");
  if (articleInner.length > minLen) candidates.push(articleInner);

  const mainInner = sliceBetweenTags(cleaned, "main");
  if (mainInner.length > minLen) candidates.push(mainInner);

  for (const needle of [
    "article-body",
    "story-body",
    "story-text",
    "entry-content",
    "post-content",
    "article-content",
    "article__content",
    "article__text",
    "l-article",
  ]) {
    const s = sliceByClassSubstring(cleaned, needle);
    if (s.length > minLen) candidates.push(s);
  }

  const fromSelectors = pickLongestHtml(candidates, minLen);
  if (fromSelectors.length >= minLen) {
    return stripClassBasedJunk(sanitizeStructuralHtml(fromSelectors));
  }

  const body = sliceBetweenTags(cleaned, "body");
  if (body.length > 500) {
    return stripClassBasedJunk(sanitizeStructuralHtml(body.slice(0, 450_000)));
  }
  return stripClassBasedJunk(sanitizeStructuralHtml(chunk.slice(0, 450_000)));
}

const BAD_START =
  /^(?:shown here|in this (?:photo|image)|pictured|image:|photo:|getty|ap photo|reuters|photo by|credit:)/i;
const BAD_SUBSTR =
  /\b(caption|photo illustration|image credit|getty images|shutterstock|ap photo|reuters photo)\b/i;

function isJunkParagraph(p: string): boolean {
  const t = p.trim();
  if (t.length < 80) return true;
  const lower = t.toLowerCase();
  if (BAD_START.test(lower)) return true;
  if (BAD_SUBSTR.test(lower)) return true;
  return false;
}

/** HTML → plain paragraphs, then filter junk / captions. */
function articleHtmlToFilteredPlainText(html: string, maxLen: number): string {
  const s = html
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|section|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const paras = s
    .split(/\n+/)
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((p) => !isJunkParagraph(p));

  let out = paras.join("\n\n").trim();
  if (out.length > maxLen) out = out.slice(0, maxLen).trim() + "…";
  return out;
}

export const ARTICLE_TEXT_NOT_EXTRACTED_NOTICE =
  "Article text could not be extracted from this URL.";

export type UrlPageExtract = {
  ok: boolean;
  fetchError?: string;
  finalUrl: string;
  pageTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  articleTextExcerpt: string;
  /** When body extraction was weak; enrichment should rely on headline/metadata only. */
  articleExtractionNotice: string | null;
};

const MAX_EXCERPT = 14_000;

/** Enough real article body to trust (vs. caption-only residue). */
function excerptIsStrong(excerpt: string): boolean {
  const t = excerpt.trim();
  if (t.length < 200) return false;
  const paras = t
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 80);
  if (paras.length >= 2) return true;
  if (t.length >= 380) return true;
  if (paras.length === 1 && paras[0].length >= 260) return true;
  return false;
}

/**
 * True when we have enough to enrich (article body and/or solid metadata).
 */
export function pageExtractHasReadableContent(x: UrlPageExtract): boolean {
  if (!x.ok) return false;
  if (excerptIsStrong(x.articleTextExcerpt)) return true;
  const title = (x.ogTitle || x.pageTitle).trim();
  const desc = (x.ogDescription || x.metaDescription).trim();
  if (desc.length >= 100 && title.length >= 8) return true;
  if (desc.length >= 60 && title.length >= 20) return true;
  return false;
}

function isHttpUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function fetchUrlPageExtract(
  urlStr: string,
  options?: { signal?: AbortSignal }
): Promise<UrlPageExtract> {
  const fail = (
    fetchError: string | undefined,
    finalUrl: string
  ): UrlPageExtract => ({
    ok: false,
    fetchError,
    finalUrl,
    pageTitle: "",
    metaDescription: "",
    ogTitle: "",
    ogDescription: "",
    articleTextExcerpt: "",
    articleExtractionNotice: null,
  });

  const trimmed = urlStr.trim();
  if (!trimmed || !isHttpUrl(trimmed)) {
    return fail("invalid_url", trimmed);
  }

  try {
    const res = await fetch(trimmed, {
      redirect: "follow",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (compatible; InterestingFeed/1.0; +article-enrich)",
      },
      signal: options?.signal ?? AbortSignal.timeout(18_000),
    });

    if (!res.ok) {
      return fail(`http_${res.status}`, trimmed);
    }

    const htmlRaw = await res.text();
    const html =
      htmlRaw.length > 900_000 ? htmlRaw.slice(0, 900_000) : htmlRaw;

    const pageTitle = extractTitleTag(html);
    const metaDescription = extractNameDescription(html);
    const ogTitle = metaByKey(html, "property", "og:title");
    const ogDescription =
      metaByKey(html, "property", "og:description") ||
      metaByKey(html, "name", "twitter:description");

    const articleHtml = extractArticleHtmlChunk(html);
    let articleTextExcerpt = articleHtmlToFilteredPlainText(
      articleHtml,
      MAX_EXCERPT
    );

    let articleExtractionNotice: string | null = null;
    if (!excerptIsStrong(articleTextExcerpt)) {
      articleTextExcerpt = "";
      articleExtractionNotice = ARTICLE_TEXT_NOT_EXTRACTED_NOTICE;
    }

    const finalUrl = res.url || trimmed;

    return {
      ok: true,
      finalUrl,
      pageTitle,
      metaDescription,
      ogTitle,
      ogDescription,
      articleTextExcerpt,
      articleExtractionNotice,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return fail(msg, trimmed);
  }
}

/** Head metadata only — no HTML body / article scrape (for URL fallback prompts). */
export type UrlPageMetadataOnly = {
  ok: boolean;
  fetchError?: string;
  finalUrl: string;
  pageTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
};

export async function fetchUrlPageMetadataOnly(
  urlStr: string,
  options?: { signal?: AbortSignal }
): Promise<UrlPageMetadataOnly> {
  const fail = (
    fetchError: string | undefined,
    finalUrl: string
  ): UrlPageMetadataOnly => ({
    ok: false,
    fetchError,
    finalUrl,
    pageTitle: "",
    metaDescription: "",
    ogTitle: "",
    ogDescription: "",
  });

  const trimmed = urlStr.trim();
  if (!trimmed || !isHttpUrl(trimmed)) {
    return fail("invalid_url", trimmed);
  }

  try {
    const res = await fetch(trimmed, {
      redirect: "follow",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (compatible; InterestingFeed/1.0; +metadata)",
      },
      signal: options?.signal ?? AbortSignal.timeout(14_000),
    });

    if (!res.ok) {
      return fail(`http_${res.status}`, trimmed);
    }

    const htmlRaw = await res.text();
    const html =
      htmlRaw.length > 500_000 ? htmlRaw.slice(0, 500_000) : htmlRaw;

    const pageTitle = extractTitleTag(html);
    const metaDescription = extractNameDescription(html);
    const ogTitle = metaByKey(html, "property", "og:title");
    const ogDescription =
      metaByKey(html, "property", "og:description") ||
      metaByKey(html, "name", "twitter:description");

    return {
      ok: true,
      finalUrl: res.url || trimmed,
      pageTitle,
      metaDescription,
      ogTitle,
      ogDescription,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return fail(msg, trimmed);
  }
}
