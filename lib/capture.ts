import {
  captureRawTextForDisplay,
  captureUrlForDisplay,
  getCaptureKind,
  isSupabaseUserCaptureImageUrl,
} from "@/lib/capture-kind";

export const CAPTURE_TYPES = ["text", "link", "url", "screenshot", "image"] as const;
export type CaptureType = (typeof CAPTURE_TYPES)[number];

export const CAPTURE_STATUSES = [
  "raw",
  "analyzing",
  "ready",
  "processing",
  "processed",
  "error",
] as const;
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number];

export type CaptureRow = {
  id: string;
  user_id?: string | null;
  raw_text: string | null;
  url: string | null;
  source: string | null;
  user_note: string | null;
  capture_type: CaptureType | string;
  image_url: string | null;
  url_article_text?: string | null;
  last_enrichment_pipeline?: string | null;
  ai_title: string | null;
  ai_summary: string | null;
  ai_why_interesting: string | null;
  ai_category: string | null;
  ai_insight_score: number | null;
  ai_followup_questions: unknown;
  ai_related_notes: string | null;
  status: CaptureStatus | string | null;
  created_at: string;
};

export { captureRawTextForDisplay, captureUrlForDisplay, getCaptureKind };

/** @deprecated Use {@link captureUrlForDisplay} from `@/lib/capture-kind`. */
export function captureUrlForFeedDisplay(
  c: Pick<CaptureRow, "url" | "image_url" | "capture_type">
): string | null {
  return captureUrlForDisplay(c);
}

/**
 * Feed / icon: prefer persisted `capture_type` (screenshot/image first), then infer.
 * Rows mis-tagged as `url` but with a user Supabase screenshot still show as screenshot.
 */
export function feedCaptureTypeDisplay(
  c: Pick<CaptureRow, "url" | "capture_type" | "image_url" | "raw_text">
): string {
  const ct = String(c.capture_type ?? "").trim().toLowerCase();
  if (ct === "screenshot" || ct === "image") {
    return ct === "image" ? "image" : "screenshot";
  }
  if (ct === "url" || ct === "link") {
    const imgTrim = String(c.image_url ?? "").trim();
    if (imgTrim && isSupabaseUserCaptureImageUrl(imgTrim)) {
      return "screenshot";
    }
    return "url";
  }
  if (ct === "text") return "text";

  const urlTrim = String(c.url ?? "").trim();
  const imgTrim = String(c.image_url ?? "").trim();
  const rawTrim = String(c.raw_text ?? "").trim();

  if (imgTrim && !urlTrim) return "screenshot";
  if (urlTrim && captureUrlForDisplay(c)) return "url";
  if (rawTrim) return "text";
  if (imgTrim) return "screenshot";
  return ct || "—";
}

export function parseFollowupQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

export function formatCaptureDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function captureStatusDisplay(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s === "analyzing" || s === "processing") return "Analyzing…";
  if (s === "error") return "Needs attention";
  if (
    s === "ready" ||
    s === "complete" ||
    s === "done" ||
    s === "processed"
  ) {
    return "Ready";
  }
  if (!status?.trim()) return "—";
  return status;
}
