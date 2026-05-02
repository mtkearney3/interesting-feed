/**
 * Hard checks before OpenAI chat/completions for URL article paths (no vision).
 */

import {
  assertUrlArticleOpenAiPayloadNoImageApi,
  logUrlArticleOpenAiPreflightWarnings,
} from "@/lib/url-article-payload-guard";

export type UrlArticleOpenAiPreflightMeta = {
  clipId?: string | null;
  /** chat.completions only today */
  inputType: "chat_completions_messages";
  model: string;
  articleTextLength: number;
  articleTextFirst1000: string;
  /** Full article body for substring warnings only (never used to throw). */
  articleTextForWarnings?: string;
};

/**
 * Logs preflight details; warns on suspicious article text; throws only on real image API keys in JSON.
 */
export function logAndAssertUrlArticleChatPayload(
  serializedBody: string,
  meta: UrlArticleOpenAiPreflightMeta
): void {
  const textForWarnings =
    meta.articleTextForWarnings ??
    meta.articleTextFirst1000 ??
    "";
  if (textForWarnings.length > 0) {
    logUrlArticleOpenAiPreflightWarnings(textForWarnings, {
      clipId: meta.clipId,
    });
  }

  console.log("URL_ARTICLE_OPENAI_PREFLIGHT", {
    clipId: meta.clipId ?? "(no-id)",
    model: meta.model,
    inputType: meta.inputType,
    articleTextLength: meta.articleTextLength,
    articleTextFirst1000: meta.articleTextFirst1000,
  });

  assertUrlArticleOpenAiPayloadNoImageApi(serializedBody);
}
