import type { CaptureRow } from "@/lib/capture";

/** Normalize category string for matching filters (lowercase, collapse spaces). */
export function topicFilterKey(category: string): string {
  return category.trim().toLowerCase().replace(/\s+/g, " ");
}

const DISPLAY_BY_NORMALIZED: Record<string, string> = {
  finance: "Finance",
  ai: "AI",
  "artificial intelligence": "AI",
  artificialintelligence: "AI",
  technology: "Tech",
  tech: "Tech",
  business: "Business",
  politics: "Politics",
  health: "Health",
  culture: "Culture",
  science: "Science",
  sports: "Sports",
  entertainment: "Entertainment",
  world: "World",
  economics: "Economics",
  crypto: "Crypto",
  cryptocurrency: "Crypto",
};

/** Short label for a topic filter pill (dynamic topics + common aliases). */
export function formatTopicFilterLabel(rawCategory: string): string {
  const k = topicFilterKey(rawCategory);
  if (!k) return rawCategory.trim();
  if (DISPLAY_BY_NORMALIZED[k]) return DISPLAY_BY_NORMALIZED[k];
  return k.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export type FeedTopicOption = { key: string; label: string };

/** Unique topic keys from loaded clips, sorted by display label. */
export function buildTopicFilterOptions(rows: CaptureRow[]): FeedTopicOption[] {
  const byKey = new Map<string, string>();
  for (const r of rows) {
    const raw = r.ai_category?.trim();
    if (!raw) continue;
    const key = topicFilterKey(raw);
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, formatTopicFilterLabel(raw));
    }
  }
  return [...byKey.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
