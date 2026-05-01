export const CAPTURE_TYPES = ["text", "link", "screenshot"] as const;
export type CaptureType = (typeof CAPTURE_TYPES)[number];

export const CAPTURE_STATUSES = [
  "raw",
  "processing",
  "processed",
  "error",
] as const;
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number];

export type CaptureRow = {
  id: string;
  raw_text: string | null;
  url: string | null;
  source: string | null;
  user_note: string | null;
  capture_type: CaptureType | string;
  image_url: string | null;
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

export function parseFollowupQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}
