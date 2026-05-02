/**
 * Runtime enrichment routing labels (logged + persisted on `captures.last_enrichment_pipeline`).
 * Classification is delegated to {@link getCaptureKind} in `lib/capture-kind.ts` only.
 */

import {
  getCaptureKind,
  type CaptureKindPipeline,
} from "@/lib/capture-kind";

export const EnrichPipeline = {
  URL_ARTICLE_TEXT_ONLY: "URL_ARTICLE_TEXT_ONLY",
  URL_ARTICLE_INSUFFICIENT: "URL_ARTICLE_INSUFFICIENT",
  IMAGE_VISION: "IMAGE_VISION",
  IMAGE_SCREENSHOT_TEXT_PRIMARY: "IMAGE_SCREENSHOT_TEXT_PRIMARY",
  TEXT_ONLY: "TEXT_ONLY",
} as const;

export type EnrichPipelineName =
  (typeof EnrichPipeline)[keyof typeof EnrichPipeline];

export type CaptureEnrichBranchInfo = {
  clipId: string;
  url: string | null;
  isUrlCapture: boolean;
  hasImageUrl: boolean;
  hasScreenshotImage: boolean;
  selectedPipeline: EnrichPipelineName;
  selectedFunctionName:
    | "enrichUrlClipTextOnly"
    | "enrichNonUrlCaptureWithOpenAI";
};

function pipelineFromKind(p: CaptureKindPipeline): EnrichPipelineName {
  switch (p) {
    case "IMAGE_VISION":
      return EnrichPipeline.IMAGE_VISION;
    case "IMAGE_SCREENSHOT_TEXT_PRIMARY":
      return EnrichPipeline.IMAGE_SCREENSHOT_TEXT_PRIMARY;
    case "URL_ARTICLE_TEXT_ONLY":
      return EnrichPipeline.URL_ARTICLE_TEXT_ONLY;
    case "TEXT_ONLY":
      return EnrichPipeline.TEXT_ONLY;
    default: {
      const _x: never = p;
      return _x;
    }
  }
}

export function describeCaptureEnrichBranch(row: {
  id: string;
  url?: string | null;
  capture_type?: string | null;
  raw_text?: string | null;
  image_url?: string | null;
  screenshot_url?: string | null;
}): CaptureEnrichBranchInfo {
  const imageTrim = String(row.image_url ?? "").trim();
  const hasImageUrl = Boolean(imageTrim);
  const hasScreenshotImage = Boolean(String(row.screenshot_url ?? "").trim());

  const k = getCaptureKind({
    capture_type: row.capture_type,
    url: row.url,
    image_url: row.image_url,
    raw_text: row.raw_text,
  });

  const selectedPipeline = pipelineFromKind(k.pipeline);

  if (k.kind === "url") {
    return {
      clipId: row.id,
      url: k.articleUrl,
      isUrlCapture: true,
      hasImageUrl,
      hasScreenshotImage,
      selectedPipeline,
      selectedFunctionName: "enrichUrlClipTextOnly",
    };
  }

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
