/**
 * URL-article capture only: fetch HTML, extract main article text for OpenAI (no vision).
 * Does not use og:image, preview URLs, or image metadata in the returned article payload.
 */

import { decodeHtmlEntities } from "@/lib/url-page-extract";

export const MIN_URL_ARTICLE_CHARS = 1500;

export type UrlArticleCaptureResult = {
  ok: boolean;
  fetchError?: string;
  finalUrl: string;
  title: string;
  publication: string | null;
  author: string | null;
  publishedDate: string | null;
  articleText: string;
  extractionFailedReason: string | null;
};

function isHttpUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

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

function extractTitleTag(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return "";
  return decodeHtmlEntities(m[1]);
}

function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, " ");
}

function removeBalancedTagBlocks(html: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  let prev = "";
  let out = html;
  let guard = 0;
  while (out !== prev && guard++ < 60) {
    prev = out;
    out = out.replace(re, "\n");
  }
  return out;
}

function removeSelfClosingAndMedia(html: string): string {
  return html
    .replace(/<img\b[^>]*\/?>/gi, "\n")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "\n")
    .replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, "\n")
    .replace(/<source\b[^>]*\/?>/gi, "\n")
    .replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, "\n")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "\n");
}

/** Strip structural chrome; never retain head (avoids og:image and similar in body pass). */
function sanitizeUrlArticleHtml(html: string): string {
  let s = html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "\n");
  s = stripComments(s);
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
    "form",
    "template",
  ]) {
    s = removeBalancedTagBlocks(s, tag);
  }
  s = removeSelfClosingAndMedia(s);
  return s;
}

/** Remove modules that are almost never article prose. */
function stripModuleClassBlocks(html: string): string {
  const needle =
    "(?:caption|figcaption|photo-|\\bphoto\\b|image-credit|image_credit|featured-image|hero-image|article-image|illustration|getty|shutterstock|byline-photo|byline__image|byline-avatar|\\bavatar\\b|thumbnail|\\bgallery\\b|\\bcredit\\b|m-ad\\b|\\bad-|\\badvert|\\bpromo\\b|\\bsponsored\\b|related-stories|\\brelated-links\\b|newsletter|subscribe|read-more|\\bshare\\b|share-buttons|social-share|social-icons|sidebar|\\bcomments\\b|\\bwidget\\b|recirc|outbrain|taboola|recommended|most-popular|most\\s+read|popular-stories|story-list|rail|sticky-ad)";
  const re = new RegExp(
    `<(div|section|span|p|ul|ol|aside|article)\\b[^>]*(?:class|id)=["'][^"']*${needle}[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`,
    "gi"
  );
  let prev = "";
  let out = html;
  let guard = 0;
  while (out !== prev && guard++ < 40) {
    prev = out;
    out = out.replace(re, "\n");
  }
  return out;
}

function sliceBetweenTags(html: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(html);
  return m ? m[1] : "";
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
    "outbrain",
    "taboola",
  ];
  let end = Math.min(rest.length, 500_000);
  for (const marker of endMarkers) {
    const idx = rest.toLowerCase().indexOf(marker.toLowerCase());
    if (idx > 800 && idx < end) end = idx;
  }
  return rest.slice(0, end);
}

function sliceByClassSubstring(html: string, needle: string): string {
  const n = escRe(needle);
  const openRe = new RegExp(
    `<(div|section|article)\\b[^>]*class=["'][^"']*${n}[^"']*["'][^>]*>`,
    "gi"
  );
  let best = "";
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html)) !== null) {
    const start = m.index + m[0].length;
    const tail = html.slice(start);
    const endMarkers = [
      "</article>",
      "</main>",
      "</section>",
      '<footer',
      "outbrain",
      "taboola",
    ];
    let end = Math.min(tail.length, 400_000);
    for (const marker of endMarkers) {
      const idx = tail.toLowerCase().indexOf(marker.toLowerCase());
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
  let cleaned = sanitizeUrlArticleHtml(chunk);
  cleaned = stripModuleClassBlocks(cleaned);

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
    return stripModuleClassBlocks(sanitizeUrlArticleHtml(fromSelectors));
  }

  const body = sliceBetweenTags(cleaned, "body");
  if (body.length > 500) {
    return stripModuleClassBlocks(
      sanitizeUrlArticleHtml(body.slice(0, 450_000))
    );
  }
  return stripModuleClassBlocks(sanitizeUrlArticleHtml(chunk.slice(0, 450_000)));
}

const BAD_PARA =
  /^(?:shown here|in this (?:photo|image)|pictured|image:|photo:|getty|ap photo|reuters|photo by|credit:)/i;
const BAD_SUB =
  /\b(photo illustration|image credit|getty images|shutterstock|ap photo|reuters photo)\b/i;

function isJunkParagraph(p: string): boolean {
  const t = p.trim();
  if (t.length < 80) return true;
  const lower = t.toLowerCase();
  if (BAD_PARA.test(lower)) return true;
  if (BAD_SUB.test(lower)) return true;
  return false;
}

function articleHtmlToPlainText(html: string, maxLen: number): string {
  const s = html
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|section|blockquote|li)>/gi, "\n")
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

/** Drop leading blocks that are almost always photo/caption wire copy, not article body. */
export function scrubLeadingCaptionAndPhotoBlocks(text: string): string {
  const blocks = text.split(/\n\n+/);
  const lineStartJunk =
    /^(?:image\s+credit|photo\s+credit|getty|ap\s+photo|reuters|caption|pictured|shown\s+in\s+(?:this\s+)?(?:photo|image)|shown\s+here|(?:above|below)[\s,:—-]+|image:|credit:\s|source:\s|photographer\b)/i;
  const anywhereWire =
    /\b(getty\s+images|ap\s+photo|reuters\s+photo|image\s+credit|photo\s+credit)\b/i;

  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i].trim();
    if (!b) {
      i++;
      continue;
    }
    const low = b.toLowerCase();
    const shortBlock = b.length < 360;
    if (lineStartJunk.test(low)) {
      i++;
      continue;
    }
    if (shortBlock && anywhereWire.test(low)) {
      i++;
      continue;
    }
    break;
  }
  return blocks.slice(i).join("\n\n").trim();
}

function extractPublication(html: string): string | null {
  const s =
    metaByKey(html, "property", "og:site_name") ||
    metaByKey(html, "name", "application-name") ||
    metaByKey(html, "name", "twitter:site");
  const t = s.trim();
  return t || null;
}

function extractAuthor(html: string): string | null {
  const by =
    metaByKey(html, "name", "author") ||
    metaByKey(html, "property", "article:author") ||
    metaByKey(html, "name", "twitter:creator");
  const t = by.trim();
  return t || null;
}

function extractPublishedDate(html: string): string | null {
  const d =
    metaByKey(html, "property", "article:published_time") ||
    metaByKey(html, "property", "og:updated_time") ||
    metaByKey(html, "name", "pubdate");
  const t = d.trim();
  return t || null;
}

/**
 * Fetch URL and extract article-oriented plain text + metadata for URL-only AI paths.
 */
export async function extractUrlArticleCapture(
  urlStr: string,
  options?: { signal?: AbortSignal }
): Promise<UrlArticleCaptureResult> {
  const trimmed = urlStr.trim();
  if (!trimmed || !isHttpUrl(trimmed)) {
    return {
      ok: false,
      fetchError: "invalid_url",
      finalUrl: trimmed,
      title: "",
      publication: null,
      author: null,
      publishedDate: null,
      articleText: "",
      extractionFailedReason: "invalid_url",
    };
  }

  try {
    const res = await fetch(trimmed, {
      redirect: "follow",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (compatible; InterestingFeed/1.0; +url-article)",
      },
      signal: options?.signal ?? AbortSignal.timeout(22_000),
    });

    if (!res.ok) {
      return {
        ok: false,
        fetchError: `http_${res.status}`,
        finalUrl: trimmed,
        title: "",
        publication: null,
        author: null,
        publishedDate: null,
        articleText: "",
        extractionFailedReason: `http_${res.status}`,
      };
    }

    const htmlRaw = await res.text();
    const html =
      htmlRaw.length > 900_000 ? htmlRaw.slice(0, 900_000) : htmlRaw;

    const pageTitle = extractTitleTag(html);
    const ogTitle = metaByKey(html, "property", "og:title");
    const title = (ogTitle || pageTitle).trim() || trimmed;

    const articleHtml = extractArticleHtmlChunk(html);
    let articleText = articleHtmlToPlainText(articleHtml, 80_000);
    articleText = scrubLeadingCaptionAndPhotoBlocks(articleText);

    const finalUrl = res.url || trimmed;

    return {
      ok: true,
      finalUrl,
      title,
      publication: extractPublication(html),
      author: extractAuthor(html),
      publishedDate: extractPublishedDate(html),
      articleText,
      extractionFailedReason:
        articleText.length < MIN_URL_ARTICLE_CHARS
          ? "below_minimum_length"
          : null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return {
      ok: false,
      fetchError: msg,
      finalUrl: trimmed,
      title: "",
      publication: null,
      author: null,
      publishedDate: null,
      articleText: "",
      extractionFailedReason: msg,
    };
  }
}
