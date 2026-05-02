import type { CaptureRow } from "@/lib/capture";
import {
  FEED_BUILTIN_FILTER,
  type FeedFilterKey,
  feedFilterTopicNormalizedKey,
  isFeedFilterTopicKey,
} from "@/lib/rabbit-hole-feed-filter-keys";
import { topicFilterKey } from "@/lib/rabbit-hole-feed-topic-labels";

export type FeedClipBadgeFn = (
  clipId: string,
  createdAt: string
) => "new" | "reviewed" | null;

/**
 * Single place to extend feed filters (e.g. add {@link FEED_FILTER_REVIEWED_KEY} handling).
 */
export function clipMatchesFeedFilter(
  feedFilter: FeedFilterKey,
  row: CaptureRow,
  clipBadge: FeedClipBadgeFn
): boolean {
  const badge = (c: CaptureRow) => clipBadge(String(c.id), c.created_at);

  if (feedFilter === FEED_BUILTIN_FILTER.ALL) return true;
  if (feedFilter === FEED_BUILTIN_FILTER.NEW) return badge(row) === "new";
  if (feedFilter === FEED_BUILTIN_FILTER.UNREVIEWED) {
    return badge(row) !== "reviewed";
  }
  // Future Reviewed-only: `if (feedFilter === FEED_FILTER_REVIEWED_KEY) return badge(row) === "reviewed";`
  if (isFeedFilterTopicKey(feedFilter)) {
    const tk = feedFilterTopicNormalizedKey(feedFilter);
    const cat = row.ai_category?.trim();
    if (!cat) return false;
    return topicFilterKey(cat) === tk;
  }
  return true;
}
