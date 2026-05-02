import {
  extractUrlArticleCapture,
  MIN_URL_ARTICLE_CHARS,
} from "@/lib/url-article-capture";
import {
  assertUrlArticleOpenAiPayloadNoImageApi,
  logUrlArticlePayloadGuardOk,
} from "@/lib/url-article-payload-guard";
import { logAndAssertUrlArticleChatPayload } from "@/lib/url-openai-preflight";

export type FollowupCaptureContext = {
  clipId?: string | null;
  raw_text: string | null;
  url: string | null;
  image_url: string | null;
  /** Persisted extracted article body from URL enrichment (text-only follow-ups). */
  url_article_text?: string | null;
  ai_title: string | null;
  ai_summary: string | null;
  ai_why_interesting: string | null;
  ai_category: string | null;
  ai_related_notes: string | null;
};

const URL_FOLLOWUP_INSUFFICIENT_TEXT =
  "The app does not have enough readable article text stored for this link to answer reliably. Open the article in your browser or paste a relevant passage here if you need a grounded answer.";

export type FollowupStructuredResponse = {
  answer: string;
  followUps: string[];
  related: { title: string; reason: string }[];
};

function followupFetchTimeoutMs(ctx: FollowupCaptureContext): number {
  const n = Number(process.env.OPENAI_FETCH_TIMEOUT_MS);
  const base = Number.isFinite(n) && n > 5_000 ? n : 48_000;
  if (ctx.url?.trim()) return Math.max(base, 90_000);
  if (ctx.image_url?.trim()) return Math.max(base, 90_000);
  return base;
}

function buildDescription(ctx: FollowupCaptureContext): string {
  const parts = [
    ctx.ai_summary?.trim(),
    ctx.ai_why_interesting?.trim(),
    ctx.ai_category ? `Category: ${ctx.ai_category}` : null,
    ctx.ai_related_notes?.trim(),
  ].filter(Boolean) as string[];
  if (parts.length > 0) {
    return parts.join("\n\n");
  }
  const raw = ctx.raw_text?.trim();
  if (raw) return raw.slice(0, 4000);
  return "(no description)";
}

function extractJsonObject(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence) return fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function parseStructuredFollowup(raw: string): FollowupStructuredResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch {
    throw new Error("Model did not return valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid JSON shape");
  }
  const o = parsed as Record<string, unknown>;
  const answer =
    typeof o.answer === "string" ? o.answer.trim() : "";
  if (!answer) {
    throw new Error("Missing or empty answer in JSON");
  }
  const fuRaw = o.followUps;
  const followUps = Array.isArray(fuRaw)
    ? fuRaw
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const relRaw = o.related;
  const related: { title: string; reason: string }[] = [];
  if (Array.isArray(relRaw)) {
    for (const item of relRaw.slice(0, 6)) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title.trim() : "";
      const reason = typeof r.reason === "string" ? r.reason.trim() : "";
      if (title && reason) related.push({ title, reason });
    }
  }
  return {
    answer,
    followUps: followUps.slice(0, 5),
    related: related.slice(0, 3),
  };
}

type FollowupChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "user";
      content: Array<{ type: string; [k: string]: unknown }>;
    };

function assertFollowupUrlPathNoVision(messages: FollowupChatMessage[]): void {
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
          throw new Error("BUG: URL follow-up attempted to use image analysis");
        }
      }
    }
  }
}

function assertSerializedFollowupNoVision(body: string): void {
  if (
    body.includes('"image_url"') ||
    body.includes('"type":"image_url"') ||
    body.includes('"type": "image_url"')
  ) {
    throw new Error("BUG: URL follow-up attempted to use image analysis");
  }
}

type UrlFollowupPreflight = {
  clipId?: string | null;
  articleTextLength: number;
  articleTextFirst1000: string;
  articleTextForWarnings?: string;
};

async function chatFollowupJsonTextOnly(
  system: string,
  user: string,
  signal: AbortSignal,
  urlArticlePreflight?: UrlFollowupPreflight
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const messages: FollowupChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  assertFollowupUrlPathNoVision(messages);
  const body = JSON.stringify({
    model,
    temperature: 0.45,
    max_tokens: 1800,
    response_format: { type: "json_object" as const },
    messages,
  });
  assertSerializedFollowupNoVision(body);
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
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned no answer text");
  }
  return text;
}

export async function answerFollowupQuestion(
  ctx: FollowupCaptureContext,
  question: string,
  options?: { signal?: AbortSignal }
): Promise<FollowupStructuredResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const trimmedUrl = ctx.url?.trim() ?? "";
  const isUrlClip = Boolean(trimmedUrl);

  const fetchSignal =
    options?.signal ??
    AbortSignal.timeout(followupFetchTimeoutMs(ctx));

  const title = ctx.ai_title?.trim() || "Untitled clip";

  if (isUrlClip) {
    const hasPreviewImage = Boolean(ctx.image_url?.trim());
    const stored = (ctx.url_article_text ?? "").trim();
    let articleText = "";
    let finalUrl = trimmedUrl;
    let extractedTitle = title;
    let publication: string | null = null;
    let author: string | null = null;
    let publishedDate: string | null = null;
    let extractionFailedReason: string | null = null;

    if (stored.length >= MIN_URL_ARTICLE_CHARS) {
      articleText = stored;
    } else {
      const ex = await extractUrlArticleCapture(trimmedUrl, {
        signal: fetchSignal,
      });
      finalUrl = ex.finalUrl;
      extractedTitle = ex.title.trim() || title;
      publication = ex.publication;
      author = ex.author;
      publishedDate = ex.publishedDate;
      articleText = ex.articleText;
      extractionFailedReason =
        ex.extractionFailedReason ?? ex.fetchError ?? (!ex.ok ? "extract_failed" : null);
    }

    console.log("URL_ANALYSIS_MODE", {
      clipId: ctx.clipId ?? "(no-id)",
      url: ctx.url,
      mode: "URL_ARTICLE",
      hasPreviewImage,
      sentAnyImageToOpenAI: false,
      usedStoredArticleText: stored.length >= MIN_URL_ARTICLE_CHARS,
      extractedTitle,
      articleTextLength: articleText.length,
      articleTextFirst500: articleText.slice(0, 500),
      extractionFailedReason:
        articleText.length < MIN_URL_ARTICLE_CHARS
          ? extractionFailedReason ?? "below_minimum_length"
          : null,
    });

    if (articleText.length < MIN_URL_ARTICLE_CHARS) {
      return {
        answer: URL_FOLLOWUP_INSUFFICIENT_TEXT,
        followUps: [],
        related: [],
      };
    }

    const articleForPrompt = articleText.slice(0, 48_000);
    const userContent = [
      `URL: ${finalUrl}`,
      `Title: ${extractedTitle}`,
      `Publication: ${publication ?? "(unknown)"}`,
      `Author: ${author ?? "(unknown)"}`,
      `Published: ${publishedDate ?? "(unknown)"}`,
      "",
      "Article text:",
      articleForPrompt,
      "",
      `User question:\n${question}`,
    ].join("\n");

    const corePayload = JSON.stringify({
      url: finalUrl,
      title: extractedTitle,
      publication,
      author,
      publishedDate,
      articleText: articleForPrompt,
      question,
    });
    assertUrlArticleOpenAiPayloadNoImageApi(corePayload);
    logUrlArticlePayloadGuardOk(ctx.clipId);

    const system =
      "You answer follow-up questions about a saved web article. Base your answer only on the article text provided. " +
      "Do not infer from images, thumbnails, captions, metadata, or the URL alone. If the text does not support an answer, say so briefly. " +
      "Respond with a single JSON object only (no markdown). Keys: answer (string), followUps (array of 3-5 strings), " +
      "related (array of 2-3 objects with title and reason strings).";

    const outbound = JSON.stringify({ system, user: userContent });
    assertUrlArticleOpenAiPayloadNoImageApi(outbound);

    const text = await chatFollowupJsonTextOnly(
      system,
      userContent,
      fetchSignal,
      {
        clipId: ctx.clipId,
        articleTextLength: articleForPrompt.length,
        articleTextFirst1000: articleForPrompt.slice(0, 1000),
        articleTextForWarnings: articleForPrompt,
      }
    );
    return parseStructuredFollowup(text);
  }

  const hasImage = Boolean(ctx.image_url?.trim());
  const description = buildDescription(ctx);

  const userPrompt =
    `You are answering a user's question based on a piece of content they are viewing.

Your goals:
- Give a clear, insightful, conversational answer
- Expand beyond the clip when helpful
- Keep the user engaged

After answering, ALWAYS include:
1. 3–5 follow-up questions
2. 2–3 related ideas/topics

Return JSON in this format:
{
  "answer": "...",
  "followUps": ["...", "..."],
  "related": [{ "title": "...", "reason": "..." }]
}

Context:
Title: ${title}
Description: ${description}
User Question: ${question}`;

  const system =
    "You must respond with a single JSON object only (no markdown fences, no prose outside JSON). Keys: answer (string), followUps (array of 3-5 strings), related (array of 2-3 objects with title and reason strings).";

  const userMessage = hasImage
    ? {
        role: "user" as const,
        content: [
          { type: "text" as const, text: userPrompt },
          {
            type: "image_url" as const,
            image_url: {
              url: ctx.image_url!.trim(),
              detail: "high" as const,
            },
          },
        ],
      }
    : { role: "user" as const, content: userPrompt };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: fetchSignal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.45,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        userMessage,
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned no answer text");
  }

  return parseStructuredFollowup(text);
}
