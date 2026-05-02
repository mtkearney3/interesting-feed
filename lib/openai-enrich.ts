import { EnrichPipeline } from "@/lib/captures-enrich-pipeline";
import {
  extractUrlArticleCapture,
  MIN_URL_ARTICLE_CHARS,
} from "@/lib/url-article-capture";
import {
  assertUrlArticleOpenAiPayloadNoImageApi,
  logUrlArticlePayloadGuardOk,
} from "@/lib/url-article-payload-guard";
import { logAndAssertUrlArticleChatPayload } from "@/lib/url-openai-preflight";

export type EnrichmentResult = {
  ai_title: string;
  ai_summary: string;
  ai_why_interesting: string;
  ai_category: string;
  ai_insight_score: number;
  ai_followup_questions: string[];
  ai_related_notes: string | null;
  /** Which server enrichment path produced this row (persisted). */
  last_enrichment_pipeline: string;
  /**
   * URL article path only: full extracted article body for follow-ups (not shown as user paste).
   */
  url_article_text?: string | null;
};

export type CaptureEnrichInput = {
  /** For server logs only */
  id?: string | null;
  raw_text: string | null;
  url: string | null;
  source: string | null;
  user_note: string | null;
  capture_type: string;
  image_url: string | null;
  /** Reserved for logging / future columns */
  screenshot_url?: string | null;
};

function clampScore(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 5;
  return Math.min(10, Math.max(1, Math.round(x)));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
    .slice(0, 6);
}

function openAiFetchTimeoutMs(preferLong: boolean): number {
  const n = Number(process.env.OPENAI_FETCH_TIMEOUT_MS);
  const base = Number.isFinite(n) && n > 5_000 ? n : 48_000;
  return preferLong ? Math.max(base, 90_000) : base;
}

function substantiveRawText(raw: string | null): boolean {
  return Boolean(raw && raw.trim().length >= 100);
}

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "user";
      content: Array<{ type: string; [k: string]: unknown }>;
    };

function assertUrlPathNoVisionMessages(messages: ChatMessage[]): void {
  for (const m of messages) {
    if (typeof m.content === "string") continue;
    if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          (part as { type: string }).type === "image_url"
        ) {
          throw new Error("BUG: URL clip attempted to use image analysis");
        }
      }
    }
  }
}

function assertSerializedBodyHasNoVision(body: string): void {
  if (
    body.includes('"image_url"') ||
    body.includes('"type":"image_url"') ||
    body.includes('"type": "image_url"')
  ) {
    throw new Error("BUG: URL clip attempted to use image analysis");
  }
}

function parseEnrichmentJson(raw: string): EnrichmentResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }

  function pickString(o: Record<string, unknown>, keys: string[]): string {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  }

  const title = pickString(parsed, ["title", "ai_title"]);
  const summary = pickString(parsed, ["summary", "ai_summary"]);
  const why = pickString(parsed, ["whyInteresting", "ai_why_interesting"]);
  const category = pickString(parsed, ["category", "ai_category"]);
  const related = pickString(parsed, ["relatedNotes", "ai_related_notes"]);

  const followRaw = parsed.followUpQuestions ?? parsed.ai_followup_questions;
  const scoreRaw = parsed.insightScore ?? parsed.ai_insight_score;

  if (!title || !summary) {
    throw new Error("OpenAI JSON missing title or summary");
  }

  return {
    ai_title: title,
    ai_summary: summary,
    ai_why_interesting: why || summary.slice(0, 200),
    ai_category: category || "general",
    ai_insight_score: clampScore(scoreRaw),
    ai_followup_questions: asStringArray(followRaw),
    ai_related_notes: related || null,
    last_enrichment_pipeline: EnrichPipeline.PLAIN_TEXT,
    url_article_text: null,
  };
}

const URL_ARTICLE_INSUFFICIENT_USER_MESSAGE =
  "I couldn't extract enough readable article text from this URL to analyze it reliably. The link was saved, but the AI analysis is limited. Please open the article or paste the article text if you want a full analysis.";

function sanitizeSaverNoteForUrlPayload(note: string | null | undefined): string {
  const t = (note ?? "").trim().slice(0, 2500);
  if (!t) return "(none)";
  let s = t;
  for (const re of [
    /\bgetty\b/gi,
    /\bap\s+photo\b/gi,
    /\breuters\s+photo\b/gi,
    /\bimage\s+url\b/gi,
    /\bog:image\b/gi,
    /\btwitter:image\b/gi,
    /\bpreviewImage\b/gi,
    /\bpreview\s+image\b/gi,
    /\bthumbnail\b/gi,
    /\binput_image\b/gi,
  ]) {
    s = s.replace(re, "[redacted]");
  }
  return s;
}

function hostnameFromUrl(urlStr: string): string {
  try {
    return new URL(urlStr).hostname;
  } catch {
    return "Saved link";
  }
}

function insufficientUrlArticleEnrichment(
  extractedTitle: string,
  fallbackUrl: string,
  reason: string | null
): EnrichmentResult {
  const title =
    extractedTitle.trim() || hostnameFromUrl(fallbackUrl.trim()) || "Saved link";
  return {
    ai_title: title.slice(0, 200) || "Saved link",
    ai_summary: URL_ARTICLE_INSUFFICIENT_USER_MESSAGE,
    ai_why_interesting: URL_ARTICLE_INSUFFICIENT_USER_MESSAGE,
    ai_category: "general",
    ai_insight_score: 1,
    ai_followup_questions: [],
    ai_related_notes: reason
      ? `[url-article] ${reason}`
      : "[url-article] insufficient_extracted_text",
    last_enrichment_pipeline:
      EnrichPipeline.URL_ARTICLE_TEXT_ONLY_INSUFFICIENT,
    url_article_text: null,
  };
}

function parseUrlArticleEnrichmentResponse(
  raw: string,
  extractedTitle: string
): Omit<EnrichmentResult, "last_enrichment_pipeline" | "url_article_text"> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }

  const description =
    typeof parsed.description === "string" ? parsed.description.trim() : "";
  const summary =
    typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const combined = summary || description;
  if (!combined) {
    throw new Error("OpenAI JSON missing summary and description");
  }

  const why =
    typeof parsed.why_it_matters === "string"
      ? parsed.why_it_matters.trim()
      : "";
  const bias =
    typeof parsed.bias_or_framing_notes === "string"
      ? parsed.bias_or_framing_notes.trim()
      : "";

  let keyPointsBlock = "";
  const kp = parsed.key_points;
  if (Array.isArray(kp)) {
    const lines = kp
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((x) => `• ${x}`);
    if (lines.length) keyPointsBlock = lines.join("\n");
  }

  const topicsRaw = parsed.topics;
  const topics = Array.isArray(topicsRaw)
    ? topicsRaw
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const fuRaw = parsed.follow_up_questions ?? parsed.followUpQuestions;
  const followUps = Array.isArray(fuRaw)
    ? fuRaw
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const relatedParts = [keyPointsBlock && `Key points:\n${keyPointsBlock}`]
    .concat(bias ? [`Bias / framing:\n${bias}`] : [])
    .filter(Boolean);
  const related = relatedParts.length ? relatedParts.join("\n\n") : null;

  const modelTitle =
    typeof parsed.title === "string" ? parsed.title.trim() : "";
  const headline =
    modelTitle || (extractedTitle || "Article").trim().slice(0, 300);

  return {
    ai_title: headline.slice(0, 300),
    ai_summary: combined,
    ai_why_interesting: why || combined.slice(0, 220),
    ai_category: topics.length ? topics.slice(0, 4).join(", ") : "news",
    ai_insight_score: 5,
    ai_followup_questions: followUps,
    ai_related_notes: related,
  };
}

type UrlArticleChatPreflightOpts = {
  clipId?: string | null;
  articleTextLength: number;
  articleTextFirst1000: string;
  articleTextForWarnings?: string;
};

async function chatCompletionsEnrichmentJson(
  system: string,
  user: string,
  signal: AbortSignal,
  urlArticlePreflight?: UrlArticleChatPreflightOpts
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  assertUrlPathNoVisionMessages(messages);
  const body = JSON.stringify({
    model,
    temperature: 0.35,
    response_format: { type: "json_object" as const },
    messages,
  });
  assertSerializedBodyHasNoVision(body);
  if (urlArticlePreflight) {
    logAndAssertUrlArticleChatPayload(body, {
      clipId: urlArticlePreflight.clipId,
      inputType: "chat_completions_messages",
      model,
      articleTextLength: urlArticlePreflight.articleTextLength,
      articleTextFirst1000: urlArticlePreflight.articleTextFirst1000,
      articleTextForWarnings: urlArticlePreflight.articleTextForWarnings,
    });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI returned no message content");
  }
  return raw;
}

/**
 * URL clips only: server-side article text extract → chat JSON (no vision, no image URLs).
 * Screenshot and plain-text enrichment use {@link enrichNonUrlCaptureWithOpenAI} unchanged.
 */
export async function enrichUrlClipTextOnly(
  capture: CaptureEnrichInput,
  options?: { signal?: AbortSignal }
): Promise<EnrichmentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const trimmedUrl = capture.url!.trim();
  const fetchSignal =
    options?.signal ??
    AbortSignal.timeout(openAiFetchTimeoutMs(true));

  const extracted = await extractUrlArticleCapture(trimmedUrl, {
    signal: fetchSignal,
  });

  if (process.env.NODE_ENV === "development") {
    console.log("URL_ARTICLE_EXTRACT_RESULT", {
      clipId: capture.id ?? "(no-id)",
      url: trimmedUrl,
      title: extracted.title,
      articleTextLength: extracted.articleText.length,
      articleTextFirst2000: extracted.articleText.slice(0, 2000),
    });
  }

  console.log("URL_ANALYSIS_MODE", {
    clipId: capture.id ?? "(no-id)",
    url: capture.url,
    mode: "URL_ARTICLE_TEXT_ONLY",
    previewImageIgnoredForEnrichment: true,
    sentAnyImageToOpenAI: false,
    extractedTitle: extracted.title,
    articleTextLength: extracted.articleText.length,
    articleTextFirst500: extracted.articleText.slice(0, 500),
    extractionFailedReason:
      extracted.extractionFailedReason ??
      extracted.fetchError ??
      (!extracted.ok ? "fetch_or_parse_failed" : null),
  });

  if (
    !extracted.ok ||
    extracted.articleText.length < MIN_URL_ARTICLE_CHARS
  ) {
    return insufficientUrlArticleEnrichment(
      extracted.title || trimmedUrl,
      trimmedUrl,
      extracted.extractionFailedReason ||
        extracted.fetchError ||
        "insufficient_article_text"
    );
  }

  const corePayload = JSON.stringify({
    url: extracted.finalUrl,
    title: extracted.title,
    publication: extracted.publication,
    author: extracted.author,
    publishedDate: extracted.publishedDate,
    articleText: extracted.articleText,
  });
  assertUrlArticleOpenAiPayloadNoImageApi(corePayload);
  logUrlArticlePayloadGuardOk(capture.id);

  const saverNote = sanitizeSaverNoteForUrlPayload(capture.user_note);
  const userContent = [
    `URL: ${extracted.finalUrl}`,
    `Title: ${extracted.title}`,
    `Publication: ${extracted.publication ?? "(unknown)"}`,
    `Author: ${extracted.author ?? "(unknown)"}`,
    `Published: ${extracted.publishedDate ?? "(unknown)"}`,
    "",
    "Article text:",
    extracted.articleText,
    "",
    "Saver note (optional context, not part of the article):",
    saverNote,
  ].join("\n");

  const system =
    "You analyze saved web articles. You must base your answer only on the article text provided. " +
    "Do not infer facts from images, thumbnails, captions, metadata, or the URL alone. " +
    "If the article text is insufficient for a claim, omit that claim. " +
    "Respond with a single JSON object only (no markdown). Use exactly these keys: " +
    "description (1-2 sentences), summary (2-5 sentences), key_points (array of 4-8 strings), " +
    "why_it_matters (1-3 sentences), topics (array of short topic strings), " +
    "bias_or_framing_notes (1-3 sentences or empty string), follow_up_questions (array of 2-4 strings). " +
    "Optional: title (short headline; omit if redundant). " +
    "All keys are required; follow_up_questions may be an empty array only if impossible.";

  const outbound = JSON.stringify({
    system,
    user: userContent,
  });
  assertUrlArticleOpenAiPayloadNoImageApi(outbound);

  const raw = await chatCompletionsEnrichmentJson(
    system,
    userContent,
    fetchSignal,
    {
      clipId: capture.id,
      articleTextLength: extracted.articleText.length,
      articleTextFirst1000: extracted.articleText.slice(0, 1000),
      articleTextForWarnings: extracted.articleText,
    }
  );
  const parsed = parseUrlArticleEnrichmentResponse(raw, extracted.title);
  const result: EnrichmentResult = {
    ...parsed,
    last_enrichment_pipeline: EnrichPipeline.URL_ARTICLE_TEXT_ONLY,
    url_article_text: extracted.articleText,
  };
  return result;
}

/** Screenshot / text-only enrichment (no `url` branch — URL handled first in `enrichCaptureWithOpenAI`). */
async function enrichNonUrlCaptureWithOpenAI(
  capture: CaptureEnrichInput,
  options?: { signal?: AbortSignal }
): Promise<EnrichmentResult> {
  if (capture.url?.trim()) {
    const msg =
      "ENRICH_PIPELINE_LEAK: URL clip entered enrichNonUrlCaptureWithOpenAI (vision/plain path)";
    console.error(msg, {
      clipId: capture.id ?? "(no-id)",
      url: capture.url,
    });
    throw new Error(msg);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const hasImage = Boolean(capture.image_url?.trim());
  const hasSubstantiveRaw = substantiveRawText(capture.raw_text);

  const fetchSignal =
    options?.signal ??
    AbortSignal.timeout(openAiFetchTimeoutMs(hasImage));

  const useVisionImage = hasImage && !hasSubstantiveRaw;

  const jsonPayload = {
    raw_text: capture.raw_text,
    url: capture.url,
    source: capture.source,
    user_note: capture.user_note,
    capture_type: capture.capture_type,
    has_image: hasImage,
  };

  let systemContent =
    "You enrich user captures for a personal reading feed. " +
    "Respond with a single JSON object only (no markdown). Use exactly these keys: " +
    "title (short headline), summary (2-4 sentences), whyInteresting (1-2 sentences), " +
    "category (short label like science, business, tools, culture), " +
    "insightScore (integer 1-10 for how thought-provoking or useful it is), " +
    "followUpQuestions (array of 2-4 concise strings the reader might explore next). " +
    "All keys are required; followUpQuestions may be an empty array only if impossible. " +
    "Be specific to the provided content; avoid generic filler.";

  if (useVisionImage) {
    systemContent +=
      " When an image is attached, summary must describe what appears in the image (visible text, UI, people, charts, etc.) and connect it to raw_text and any user note. Be concrete about the screenshot.";
  }

  let userText: string;
  if (hasSubstantiveRaw) {
    userText =
      "Analyze the user's saved text (primary). Ignore any empty image slot.\n\n" +
      JSON.stringify(jsonPayload);
  } else {
    userText = JSON.stringify(jsonPayload);
  }

  const userMessage = useVisionImage
    ? {
        role: "user" as const,
        content: [
          { type: "text" as const, text: userText },
          {
            type: "image_url" as const,
            image_url: {
              url: capture.image_url!.trim(),
              detail: "high" as const,
            },
          },
        ],
      }
    : {
        role: "user" as const,
        content: userText,
      };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: fetchSignal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemContent,
        },
        userMessage,
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI returned no message content");
  }

  const parsed = parseEnrichmentJson(raw);
  parsed.last_enrichment_pipeline = useVisionImage
    ? EnrichPipeline.SCREENSHOT_OPENAI_VISION
    : hasImage
      ? EnrichPipeline.SCREENSHOT_TEXT_PRIMARY
      : EnrichPipeline.PLAIN_TEXT;
  return parsed;
}

export async function enrichCaptureWithOpenAI(
  capture: CaptureEnrichInput,
  options?: { signal?: AbortSignal }
): Promise<EnrichmentResult> {
  const trimmedUrl = capture.url?.trim() ?? "";
  if (trimmedUrl) {
    const hadImageForUi = Boolean(
      capture.image_url?.trim() || capture.screenshot_url?.trim()
    );
    console.log("URL_CAPTURE_FINAL_ROUTING", {
      clipId: capture.id ?? "(no-id)",
      hasUrl: true,
      hasImageUrl: hadImageForUi,
      selectedPipeline: EnrichPipeline.URL_ARTICLE_TEXT_ONLY,
    });

    const urlOnlyCapture: CaptureEnrichInput = {
      ...capture,
      url: trimmedUrl,
      image_url: null,
      screenshot_url: null,
      capture_type: "url",
    };
    return enrichUrlClipTextOnly(urlOnlyCapture, options);
  }

  console.log("ENRICH_PIPELINE_RUNTIME", {
    clipId: capture.id ?? "(no-id)",
    url: capture.url ?? null,
    isUrlCapture: false,
    hasImageUrl: Boolean(capture.image_url?.trim()),
    hasScreenshotImage: Boolean(capture.screenshot_url?.trim()),
    selectedPipeline:
      capture.image_url?.trim() && !substantiveRawText(capture.raw_text)
        ? EnrichPipeline.SCREENSHOT_OPENAI_VISION
        : capture.image_url?.trim()
          ? EnrichPipeline.SCREENSHOT_TEXT_PRIMARY
          : EnrichPipeline.PLAIN_TEXT,
    selectedFunctionName: "enrichNonUrlCaptureWithOpenAI",
  });
  return enrichNonUrlCaptureWithOpenAI(capture, options);
}
