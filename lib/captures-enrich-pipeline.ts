/**
 * Runtime enrichment routing labels (logged + persisted on `captures.last_enrichment_pipeline`).
 */

export const EnrichPipeline = {
  URL_ARTICLE_TEXT_ONLY: "URL_ARTICLE_TEXT_ONLY",
  URL_ARTICLE_TEXT_ONLY_INSUFFICIENT: "URL_ARTICLE_TEXT_ONLY_INSUFFICIENT",
  SCREENSHOT_OPENAI_VISION: "SCREENSHOT_OPENAI_VISION",
  SCREENSHOT_TEXT_PRIMARY: "SCREENSHOT_TEXT_PRIMARY",
  PLAIN_TEXT: "PLAIN_TEXT",
} as const;

export type EnrichPipelineName =
  (typeof EnrichPipeline)[keyof typeof EnrichPipeline];

export type CaptureEnrichBranchInfo = {
  clipId: string;
  url: string | null;
  isUrlCapture: boolean;
  hasImageUrl: boolean;
  hasScreenshotImage: boolean;
  /** Intended branch before OpenAI (must be {@link EnrichPipeline.URL_ARTICLE_TEXT_ONLY} for URL clips). */
  selectedPipeline: EnrichPipelineName;
  selectedFunctionName:
    | "enrichUrlClipTextOnly"
    | "enrichNonUrlCaptureWithOpenAI";
};

function substantiveRawText(raw: string | null | undefined): boolean {
  return Boolean(raw && raw.trim().length >= 100);
}

export function describeCaptureEnrichBranch(row: {
  id: string;
  url?: string | null;
  raw_text?: string | null;
  image_url?: string | null;
  screenshot_url?: string | null;
}): CaptureEnrichBranchInfo {
  const url = row.url?.trim() ? String(row.url).trim() : null;
  const hasImageUrl = Boolean(String(row.image_url ?? "").trim());
  const hasScreenshotImage = Boolean(String(row.screenshot_url ?? "").trim());

  /** Hard rule: persisted `url` wins before any image / screenshot routing. */
  if (url) {
    return {
      clipId: row.id,
      url,
      isUrlCapture: true,
      hasImageUrl,
      hasScreenshotImage,
      selectedPipeline: EnrichPipeline.URL_ARTICLE_TEXT_ONLY,
      selectedFunctionName: "enrichUrlClipTextOnly",
    };
  }

  const hasSubstantiveRaw = substantiveRawText(row.raw_text ?? null);
  const selectedPipeline: CaptureEnrichBranchInfo["selectedPipeline"] =
    hasImageUrl && !hasSubstantiveRaw
      ? EnrichPipeline.SCREENSHOT_OPENAI_VISION
      : hasImageUrl && hasSubstantiveRaw
        ? EnrichPipeline.SCREENSHOT_TEXT_PRIMARY
        : EnrichPipeline.PLAIN_TEXT;
  return {
    clipId: row.id,
    url: null,
    isUrlCapture: false,
    hasImageUrl,
    hasScreenshotImage,
    selectedPipeline,
    selectedFunctionName: "enrichNonUrlCaptureWithOpenAI",
  };
}
